import { describe, expect, it } from "vitest";
import {
  canonicalizeUrl,
  companyNameKey,
  countryFromUrl,
  normalizeCountry,
  normalizeDomain,
} from "./normalize.js";

describe("normalizeDomain", () => {
  it("strips scheme, www, path, port and email local part", () => {
    expect(normalizeDomain("https://WWW.Acme.co.uk/about?x=1")).toBe("acme.co.uk");
    expect(normalizeDomain("ops@acme.com")).toBe("acme.com");
    expect(normalizeDomain("acme.com:8080")).toBe("acme.com");
  });
  it("rejects values that are not domains", () => {
    expect(normalizeDomain("Acme Ltd")).toBeNull();
    expect(normalizeDomain("")).toBeNull();
  });
});

describe("normalizeCountry", () => {
  it("maps names and codes to ISO alpha-2", () => {
    expect(normalizeCountry("UK")).toBe("GB");
    expect(normalizeCountry("United Kingdom")).toBe("GB");
    expect(normalizeCountry("U.S.")).toBe("US");
  });
  it("does not guess unknown values", () => {
    expect(normalizeCountry("Atlantis")).toBeNull();
  });
});

describe("countryFromUrl", () => {
  it("uses the ccTLD, not text", () => {
    expect(countryFromUrl("https://news.example.co.uk/a")).toBe("GB");
    expect(countryFromUrl("https://uk-news.example.com/a")).toBeNull();
  });
});

describe("canonicalizeUrl", () => {
  it("removes tracking params, fragments, www and trailing slash", () => {
    expect(canonicalizeUrl("http://www.Example.com/post/?utm_source=x&b=2&a=1#top")).toBe(
      "https://example.com/post?a=1&b=2",
    );
  });
});

describe("companyNameKey", () => {
  it("ignores legal suffixes but keeps qualifiers", () => {
    expect(companyNameKey("Acme Holdings Ltd.")).toBe("acme");
    expect(companyNameKey("ACME plc")).toBe("acme");
    expect(companyNameKey("Acme UK Limited")).toBe("acme uk");
  });
});
