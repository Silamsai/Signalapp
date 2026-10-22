import { describe, expect, it } from "vitest";
import { escapeCsvCell, parseCsv } from "./csv.js";

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
});

describe("parseCsv", () => {
  it("returns useful errors for empty input", () => {
    const r = parseCsv("");
    expect(r.errors[0]).toMatch(/Empty CSV/);
  });

  it("parses rows with headers", () => {
    const r = parseCsv("name,domain\nAcme,acme.com\n");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].name).toBe("Acme");
  });
});
