import { describe, expect, it } from "vitest";
import { redactSecrets, redactString } from "./redact.js";

describe("redactSecrets", () => {
  it("strips secret keys", () => {
    const out = redactSecrets({
      EXA_API_KEY: "sk-secret-value-here",
      ok: "fine",
      nested: { apiKey: "abc", keep: 1 },
    });
    expect(out.EXA_API_KEY).toBeUndefined();
    expect(out.ok).toBe("fine");
    expect((out.nested as Record<string, unknown>).apiKey).toBeUndefined();
    expect((out.nested as Record<string, unknown>).keep).toBe(1);
  });
});

describe("redactString", () => {
  it("redacts bearer and sk tokens", () => {
    expect(redactString("Authorization Bearer abcdefghijklmnop")).toContain("[redacted]");
    expect(redactString("key sk-abcdefghijklmnop")).toContain("[redacted]");
  });

  it("redacts keys containing underscores and the configured key value itself", () => {
    expect(redactString("Bearer exa_TEST_key_with_underscores")).toBe("[redacted]");
    const prev = process.env.EXA_API_KEY;
    process.env.EXA_API_KEY = "0f9c2a7e-plain-uuid-shaped-key";
    try {
      expect(redactString("failed with 0f9c2a7e-plain-uuid-shaped-key")).toBe("failed with [redacted]");
    } finally {
      process.env.EXA_API_KEY = prev;
    }
  });
});
