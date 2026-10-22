/** Normalizers shared by import, discovery and evidence (R2/R3). */

export function normalizeDomain(raw?: string | null): string | null {
  if (!raw) return null;
  let d = raw.trim().toLowerCase();
  d = d.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "");
  d = d.split(/[/?#]/)[0] ?? "";
  d = d.split("@").pop() ?? "";
  d = d.replace(/:\d+$/, "").replace(/\.$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) return null;
  return d;
}

/** Country names / codes → ISO-3166 alpha-2. Unknown inputs return null (never guessed). */
const COUNTRY_ALIASES: Record<string, string> = {
  uk: "GB",
  gb: "GB",
  "united kingdom": "GB",
  "great britain": "GB",
  britain: "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",
  ie: "IE",
  ireland: "IE",
  "republic of ireland": "IE",
  us: "US",
  usa: "US",
  "united states": "US",
  "united states of america": "US",
  de: "DE",
  germany: "DE",
  fr: "FR",
  france: "FR",
  nl: "NL",
  netherlands: "NL",
  be: "BE",
  belgium: "BE",
  es: "ES",
  spain: "ES",
  it: "IT",
  italy: "IT",
  ca: "CA",
  canada: "CA",
  au: "AU",
  australia: "AU",
  in: "IN",
  india: "IN",
  se: "SE",
  sweden: "SE",
  dk: "DK",
  denmark: "DK",
  no: "NO",
  norway: "NO",
  ch: "CH",
  switzerland: "CH",
  pl: "PL",
  poland: "PL",
  sg: "SG",
  singapore: "SG",
};

export function normalizeCountry(raw?: string | null): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase().replace(/\./g, "");
  return COUNTRY_ALIASES[key] ?? null;
}

export function countryLabel(code: string): string {
  const labels: Record<string, string> = { GB: "United Kingdom", IE: "Ireland", US: "United States" };
  return labels[code] ?? code;
}

/** ccTLD → ISO country for normalized source region (no free-text substring matching). */
const TLD_COUNTRY: Record<string, string> = {
  uk: "GB",
  ie: "IE",
  de: "DE",
  fr: "FR",
  nl: "NL",
  be: "BE",
  es: "ES",
  it: "IT",
  ca: "CA",
  au: "AU",
  in: "IN",
  se: "SE",
  dk: "DK",
  no: "NO",
  ch: "CH",
  pl: "PL",
  sg: "SG",
};

export function countryFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const tld = host.split(".").pop() ?? "";
    return TLD_COUNTRY[tld] ?? null;
  } catch {
    return null;
  }
}

export function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

const TRACKING_PARAMS = /^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|ref$|ref_src$|igshid$)/i;

/** Canonical URL for evidence deduplication: lower host, no www/fragment/tracking params. */
export function canonicalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    if ((u.protocol === "http:" && u.port === "80") || (u.protocol === "https:" && u.port === "443")) {
      u.port = "";
    }
    const keep = [...u.searchParams.entries()].filter(([k]) => !TRACKING_PARAMS.test(k));
    keep.sort(([a], [b]) => a.localeCompare(b));
    u.search = keep.length ? `?${new URLSearchParams(keep).toString()}` : "";
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) u.pathname = u.pathname.slice(0, -1);
    return u.toString().replace(/^http:/, "https:");
  } catch {
    return raw.trim();
  }
}

const LEGAL_SUFFIXES =
  /\b(limited|ltd|plc|llp|llc|inc|incorporated|corp|corporation|co|company|gmbh|ag|sa|bv|nv|group|holdings)\b/g;

/** Company name key for duplicate detection — distinguishes "Acme UK" from "Acme" by keeping qualifiers. */
export function companyNameKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(LEGAL_SUFFIXES, " ")
    .replace(/\s+/g, " ")
    .trim();
}
