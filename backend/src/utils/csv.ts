/** Escape CSV cell against formula injection and quoting. */
export function escapeCsvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  if (/[",\n\r]/.test(s)) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a formula-safe CSV document from a header and rows. */
export function toCsv(header: string[], rows: unknown[][]): string {
  return [header.map(escapeCsvCell).join(","), ...rows.map((r) => r.map(escapeCsvCell).join(","))].join(
    "\r\n",
  );
}

export const CSV_MAX_BYTES = 2_000_000;
export const CSV_MAX_ROWS = 5000;

export type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
  /** 1-based physical line number where each row starts (for row reports) */
  rowLines: number[];
  errors: string[];
};

/** Reject binary or mis-encoded input before parsing (R2: encoding validation). */
export function encodingError(text: string): string | null {
  if (text.includes("\u0000")) return "File looks binary, not a CSV text file";
  if (text.includes("�")) {
    return "File is not valid UTF-8 — re-save it as \"CSV UTF-8\" and try again";
  }
  return null;
}

/**
 * RFC-4180 parser: quoted fields may contain commas, quotes ("") and newlines.
 * Malformed rows (unterminated quotes, too many columns) are reported, not guessed.
 */
export function parseCsv(input: string): ParsedCsv {
  const text = input.replace(/^﻿/, "");
  const enc = encodingError(text);
  if (enc) return { headers: [], rows: [], rowLines: [], errors: [enc] };
  if (!text.trim()) return { headers: [], rows: [], rowLines: [], errors: ["Empty CSV"] };

  const records: Array<{ cells: string[]; line: number; error?: string }> = [];
  let cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;
  let quotedJustClosed = false;

  const endRecord = (error?: string) => {
    cells.push(cur);
    records.push({ cells, line: recordLine, error });
    cells = [];
    cur = "";
    quotedJustClosed = false;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
          quotedJustClosed = true;
        }
      } else {
        if (ch === "\n") line++;
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      if (cur.trim() === "" && !quotedJustClosed) {
        cur = "";
        inQuotes = true;
      } else {
        cur += ch; // stray quote inside an unquoted field — keep literally
      }
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
      quotedJustClosed = false;
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRecord();
      line++;
      recordLine = line;
    } else {
      cur += ch;
    }
  }
  if (inQuotes) {
    endRecord("unterminated quoted field");
  } else if (cur !== "" || cells.length) {
    endRecord();
  }

  const nonEmpty = records.filter((r) => r.error || r.cells.some((c) => c.trim() !== ""));
  if (!nonEmpty.length) return { headers: [], rows: [], rowLines: [], errors: ["Empty CSV"] };

  const headerRecord = nonEmpty[0]!;
  const headers = headerRecord.cells.map((h) => h.trim().toLowerCase());
  const errors: string[] = [];
  if (headerRecord.error || headers.every((h) => !h)) {
    return { headers: [], rows: [], rowLines: [], errors: ["No valid header row"] };
  }
  const dupHeader = headers.find((h, idx) => h && headers.indexOf(h) !== idx);
  if (dupHeader) errors.push(`Duplicate column header "${dupHeader}"`);

  const rows: Record<string, string>[] = [];
  const rowLines: number[] = [];
  for (const rec of nonEmpty.slice(1)) {
    if (rec.error) {
      errors.push(`Line ${rec.line}: ${rec.error}`);
      continue;
    }
    if (rec.cells.length > headers.length && rec.cells.slice(headers.length).some((c) => c.trim())) {
      errors.push(
        `Line ${rec.line}: ${rec.cells.length} columns but header has ${headers.length}`,
      );
      continue;
    }
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (h) row[h] = (rec.cells[idx] ?? "").trim();
    });
    rows.push(row);
    rowLines.push(rec.line);
  }
  return { headers, rows, rowLines, errors };
}
