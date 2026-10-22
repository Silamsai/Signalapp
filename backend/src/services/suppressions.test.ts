import { describe, expect, it } from "vitest";
import { normalizeSuppressionValue } from "./suppressions.js";

describe("normalizeSuppressionValue", () => {
  it("normalizes domains and emails", () => {
    expect(normalizeSuppressionValue("HTTPS://WWW.Example.COM/path")).toBe("example.com");
    expect(normalizeSuppressionValue("Person@Example.COM")).toBe("person@example.com");
  });
});
