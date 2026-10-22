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

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[]; errors: string[] } {
  const errors: string[] = [];
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [], errors: ["Empty CSV"] };
  }
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  if (headers.length === 0) {
    return { headers: [], rows: [], errors: ["No header row"] };
  }
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    try {
      const cols = splitCsvLine(lines[i]);
      if (cols.every((c) => !c.trim())) continue;
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = (cols[idx] ?? "").trim();
      });
      rows.push(row);
    } catch (e) {
      errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : "parse error"}`);
    }
  }
  return { headers, rows, errors };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
