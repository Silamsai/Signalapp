export type ResearchFilters = {
  /** ISO-3166 alpha-2 codes, e.g. ["GB", "IE"] */
  countries?: string[];
  industries?: string[];
  companySizes?: string[];
  signalKinds?: string[];
  /** Domains never to return (offer exclusions + active suppressions) */
  excludeDomains?: string[];
  /** Only sources published within this many days (event window) */
  eventWindowDays?: number;
};

/** account = research one known company; discovery = find candidate companies */
export type ResearchMode = "account" | "discovery";

export type NormalizedEvidenceItem = {
  canonicalUrl: string;
  publisher?: string;
  title?: string;
  excerpt?: string;
  eventDate?: string | null;
  /** ISO country derived from normalized source data (URL ccTLD), never free text */
  country?: string | null;
  matchRationale?: string;
  providerRequestRef?: string;
  signalKind?: string;
  fitHint?: number;
  qualityHint?: number;
};

export type NormalizedDiscovery = {
  providerRunId: string;
  items: NormalizedEvidenceItem[];
  rawCount: number;
};

export type NormalizedSources = {
  items: NormalizedEvidenceItem[];
};

export type Usage = {
  requestRef: string;
  units: number;
};

/** Provider-neutral research adapter contract (spec §6). */
export interface ResearchProvider {
  name: string;
  discover(
    query: string,
    filters: ResearchFilters,
    budget: number,
    mode?: ResearchMode,
  ): Promise<NormalizedDiscovery>;
  retrieve(sourceReferences: string[]): Promise<NormalizedSources>;
  normalize(raw: unknown, requestRef?: string): NormalizedEvidenceItem[];
  reportUsage(discovery: NormalizedDiscovery, reservedUnits: number): Promise<Usage>;
}

/** Normalized provider error codes — never contain secrets or raw payloads. */
export type ProviderErrorCode =
  | "provider_auth"
  | "provider_rate_limited"
  | "provider_timeout"
  | "provider_unavailable"
  | "provider_bad_request"
  | "provider_error";

export class NormalizedProviderError extends Error {
  constructor(
    public code: ProviderErrorCode,
    message: string,
    /** Whether a retry may succeed */
    public retryable: boolean,
  ) {
    super(message);
    this.name = "NormalizedProviderError";
  }
}
