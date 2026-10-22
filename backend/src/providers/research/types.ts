export type ResearchFilters = {
  region?: string[];
  industries?: string[];
  companySize?: string[];
  exclude?: string[];
};

export type NormalizedEvidenceItem = {
  canonicalUrl: string;
  publisher?: string;
  title?: string;
  excerpt?: string;
  eventDate?: string | null;
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

export interface ResearchProvider {
  name: string;
  discover(
    query: string,
    filters: ResearchFilters,
    budget: number,
  ): Promise<NormalizedDiscovery>;
  retrieve(sourceReferences: string[]): Promise<NormalizedSources>;
  normalize(raw: unknown): NormalizedEvidenceItem[];
  reportUsage(requestId: string): Promise<Usage>;
}
