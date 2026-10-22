import { normalizeCountry } from "../utils/normalize.js";

/** Structured query shown to the user for confirmation before a run (R1). */
export type StructuredQuery = {
  keywords: string;
  countries: string[];
  industries: string[];
  companySizes: string[];
  signalKinds: string[];
  eventWindowDays: number | null;
};

export type ParsedBrief = {
  structured: StructuredQuery;
  /** Filters the user asked for that this deployment cannot apply — shown, never silently ignored */
  unsupported: string[];
};

const INDUSTRIES: Record<string, string[]> = {
  "Financial Services": ["financial services", "banking", "bank", "banks", "insurance", "fintech"],
  Healthcare: ["healthcare", "health care", "nhs", "hospital", "hospitals", "pharma", "life sciences"],
  Manufacturing: ["manufacturing", "manufacturer", "manufacturers", "factory", "factories"],
  Retail: ["retail", "retailer", "retailers", "ecommerce", "e-commerce"],
  Education: ["education", "university", "universities", "school", "schools", "college"],
  "Public Sector": ["public sector", "government", "council", "councils", "local authority"],
  Logistics: ["logistics", "transport", "warehousing", "supply chain"],
  Energy: ["energy", "utilities", "utility", "oil and gas"],
  Telecommunications: ["telecom", "telecoms", "telecommunications"],
  Technology: ["technology", "software", "saas", "tech companies"],
  "Professional Services": ["legal", "law firm", "law firms", "accounting", "consulting"],
  Media: ["media", "broadcasting", "publishing"],
};

const SIGNALS: Record<string, string[]> = {
  expansion: ["expansion", "expanding", "new site", "new office", "data centre", "data center", "facility"],
  infra_hiring: ["hiring", "recruiting", "job posting", "jobs", "headcount"],
  refresh: ["refresh", "upgrade", "migration", "migrating", "end of life", "replacement"],
  compute: ["compute", "gpu", "ai workload", "hpc", "storage", "capacity"],
  procurement: ["procurement", "tender", "rfp", "rfq", "framework", "bid"],
};

const UNSUPPORTED: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /\blinkedin\b/i, message: "LinkedIn filters are not supported" },
  { pattern: /\bintent\s*(score|data|signals?)\b/i, message: "Third-party intent scores are not supported" },
  { pattern: /\b(revenue|turnover|arr)\b/i, message: "Revenue/turnover filters are not supported" },
  { pattern: /\b(funding|raised|series [a-e]|venture)\b/i, message: "Funding-round filters are not supported" },
  { pattern: /\b(uses|using|running)\s+[A-Z][\w.-]+/, message: "Technology-stack (technographic) filters are not supported" },
  {
    pattern: /\b(email address(es)?|phone number|mobile|direct dial|contact details)\b/i,
    message: "Contact lookup is not part of research — contacts require a separate verified source",
  },
  { pattern: /\b(growth|grew|growing)\s+\d+\s*%/i, message: "Headcount growth-rate filters are not supported" },
];

function includesPhrase(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
}

const COUNTRY_PHRASES = [
  "united kingdom",
  "great britain",
  "northern ireland",
  "republic of ireland",
  "united states",
  "uk",
  "gb",
  "britain",
  "england",
  "scotland",
  "wales",
  "ireland",
  "usa",
  "us",
  "germany",
  "france",
  "netherlands",
  "belgium",
  "spain",
  "italy",
  "canada",
  "australia",
  "india",
  "sweden",
  "denmark",
  "norway",
  "switzerland",
  "poland",
  "singapore",
];

/**
 * Deterministic natural-language brief parser. The output is shown to the user to
 * confirm or correct before any research runs; the original brief is persisted.
 */
export function parseBrief(brief: string): ParsedBrief {
  const text = brief.trim();
  const lower = text.toLowerCase();

  const countries = new Set<string>();
  for (const phrase of COUNTRY_PHRASES) {
    // "us" as a pronoun is common — only accept it uppercased
    if (phrase === "us" && !/\bUS\b/.test(text)) continue;
    if (includesPhrase(lower, phrase)) {
      const code = normalizeCountry(phrase);
      if (code) countries.add(code);
    }
  }

  const industries = Object.entries(INDUSTRIES)
    .filter(([, words]) => words.some((w) => includesPhrase(lower, w)))
    .map(([name]) => name);

  const signalKinds = Object.entries(SIGNALS)
    .filter(([, words]) => words.some((w) => includesPhrase(lower, w)))
    .map(([kind]) => kind);

  const companySizes: string[] = [];
  for (const m of lower.matchAll(/(\d[\d,]*)\s*(\+|-\s*(\d[\d,]*))?\s*(employees|staff|people)/g)) {
    const from = m[1]!.replace(/,/g, "");
    const to = m[3]?.replace(/,/g, "");
    companySizes.push(to ? `${from}-${to}` : `${from}+`);
  }
  for (const m of lower.matchAll(/(over|more than|at least)\s+(\d[\d,]*)\s*(employees|staff|people)/g)) {
    companySizes.push(`${m[2]!.replace(/,/g, "")}+`);
  }

  let eventWindowDays: number | null = null;
  const win = lower.match(/(last|past|within|previous)\s+(\d+)\s*(day|week|month|year)s?/);
  if (win) {
    const n = Number(win[2]);
    const unit = win[3]!;
    eventWindowDays = unit === "day" ? n : unit === "week" ? n * 7 : unit === "month" ? n * 30 : n * 365;
  } else if (/\bthis year\b/.test(lower)) {
    eventWindowDays = 365;
  }

  const unsupported = UNSUPPORTED.filter((u) => u.pattern.test(text)).map((u) => u.message);

  return {
    structured: {
      keywords: text.slice(0, 500),
      countries: [...countries],
      industries,
      companySizes: [...new Set(companySizes)],
      signalKinds,
      eventWindowDays,
    },
    unsupported,
  };
}
