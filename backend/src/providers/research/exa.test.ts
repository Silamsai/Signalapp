import { describe, expect, it } from "vitest";
import { parseSubject } from "./exa.js";

describe("parseSubject", () => {
  it("reads the structured company summary", () => {
    expect(
      parseSubject(JSON.stringify({ companyName: "Acme", companyWebsite: "acme.com", signalType: "expansion", eventSummary: "Acme expands" })),
    ).toEqual({ companyName: "Acme", companyWebsite: "acme.com", signalType: "expansion", eventSummary: "Acme expands" });
  });

  it("treats empty, unknown or malformed values as unknown", () => {
    expect(parseSubject(JSON.stringify({ companyName: " ", companyWebsite: "", signalType: "other" }))).toEqual({
      companyName: null,
      companyWebsite: null,
      signalType: null,
      eventSummary: null,
    });
    expect(parseSubject("not json")).toBeNull();
    expect(parseSubject(undefined)).toBeNull();
  });
});
