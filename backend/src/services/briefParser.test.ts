import { describe, expect, it } from "vitest";
import { parseBrief } from "./briefParser.js";

describe("parseBrief", () => {
  it("extracts territory, industry, signals, size and window", () => {
    const r = parseBrief(
      "Find UK and Ireland banks with 1000+ employees announcing data centre expansion in the last 3 months",
    );
    expect(r.structured.countries.sort()).toEqual(["GB", "IE"]);
    expect(r.structured.industries).toContain("Financial Services");
    expect(r.structured.signalKinds).toContain("expansion");
    expect(r.structured.companySizes).toContain("1000+");
    expect(r.structured.eventWindowDays).toBe(90);
    expect(r.unsupported).toEqual([]);
  });

  it("surfaces unsupported filters instead of ignoring them", () => {
    const r = parseBrief("Companies with revenue over £50m, high intent score, and their email addresses");
    expect(r.unsupported).toHaveLength(3);
  });

  it("does not read the pronoun 'us' as United States", () => {
    expect(parseBrief("help us find hospitals").structured.countries).toEqual([]);
    expect(parseBrief("hospitals in the US").structured.countries).toEqual(["US"]);
  });

  it("does not match countries inside other words", () => {
    expect(parseBrief("businesses in Bukhara").structured.countries).toEqual([]);
  });
});
