import { describe, expect, it } from "vitest";
import { escapeCsvCell, parseCsv, toCsv } from "./csv.js";

describe("escapeCsvCell", () => {
  it("guards formula-injection prefixes", () => {
    expect(escapeCsvCell("=cmd")).toBe("'=cmd");
    expect(escapeCsvCell("+1")).toBe("'+1");
    expect(escapeCsvCell("-1")).toBe("'-1");
    expect(escapeCsvCell("@sum")).toBe("'@sum");
  });

  it("quotes commas and quotes", () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it("toCsv escapes every cell including headers", () => {
    expect(toCsv(["=h"], [["=SUM(A1)"]])).toBe("'=h\r\n'=SUM(A1)");
  });
});

describe("parseCsv", () => {
  it("returns useful errors for empty input", () => {
    const r = parseCsv("");
    expect(r.errors[0]).toMatch(/Empty CSV/);
  });

  it("parses rows with headers", () => {
    const r = parseCsv("name,domain\nAcme,acme.com\n");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.name).toBe("Acme");
  });

  it("keeps commas, escaped quotes and newlines inside quoted fields", () => {
    const r = parseCsv('name,notes\r\n"Acme, Ltd","line1\nline2 ""quoted"""\r\nBeta,x\r\n');
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]!.name).toBe("Acme, Ltd");
    expect(r.rows[0]!.notes).toBe('line1\nline2 "quoted"');
    expect(r.rowLines).toEqual([2, 4]);
  });

  it("reports rows with too many columns and unterminated quotes", () => {
    const r = parseCsv('name,domain\nA,a.com,extra\nB,b.com\n"C,c.com\n');
    expect(r.rows.map((x) => x.name)).toEqual(["B"]);
    expect(r.errors.some((e) => /Line 2: 3 columns/.test(e))).toBe(true);
    expect(r.errors.some((e) => /unterminated/.test(e))).toBe(true);
  });

  it("rejects binary or non-UTF-8 input", () => {
    expect(parseCsv("a\u0000b").errors[0]).toMatch(/binary/);
    expect(parseCsv("name\nAcm�").errors[0]).toMatch(/UTF-8/);
  });

  it("strips the UTF-8 BOM", () => {
    expect(parseCsv("﻿name\nAcme").headers).toEqual(["name"]);
  });
});
