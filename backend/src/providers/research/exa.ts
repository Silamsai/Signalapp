import { Exa } from "exa-js";
import { getEnv, isExaConfigured } from "../../config/env.js";
import { providerNotConfigured } from "../../utils/errors.js";
import type {
  NormalizedDiscovery,
  NormalizedEvidenceItem,
  NormalizedSources,
  ResearchFilters,
  ResearchProvider,
  Usage,
} from "./types.js";

/**
 * Exa research adapter (server-only).
 * Follows Exa recommended shape: search + contents.highlights.
 * API key never leaves backend process.
 */
export class ExaResearchProvider implements ResearchProvider {
  name = "exa";
  private lastRequestRef = "";

  private client(): InstanceType<typeof Exa> {
    if (!isExaConfigured()) throw providerNotConfigured("exa");
    return new Exa(getEnv().EXA_API_KEY);
  }

  normalize(raw: unknown): NormalizedEvidenceItem[] {
    const results = Array.isArray(raw)
      ? raw
      : ((raw as { results?: unknown[] })?.results ?? []);
    return results.map((r) => {
      const row = r as Record<string, unknown>;
      const url = String(row.url ?? row.id ?? "");
      const title = typeof row.title === "string" ? row.title : undefined;
      const published =
        typeof row.publishedDate === "string" ? row.publishedDate : null;

      // Prefer highlights (Exa recommended); fall back to text if present
      let excerpt: string | undefined;
      const highlights = row.highlights;
      if (Array.isArray(highlights) && highlights.length) {
        excerpt = highlights.map(String).join(" … ").slice(0, 800);
      } else if (typeof row.text === "string") {
        excerpt = row.text.slice(0, 800);
      }

      return {
        canonicalUrl: url,
        title,
        excerpt,
        publisher: typeof row.author === "string" ? row.author : undefined,
        eventDate: published,
        matchRationale: "Matched via Exa web search",
        providerRequestRef: this.lastRequestRef,
        signalKind: "web_signal",
        fitHint: 55,
        qualityHint: 65,
      };
    });
  }

  async discover(
    query: string,
    filters: ResearchFilters,
    budget: number,
  ): Promise<NormalizedDiscovery> {
    const exa = this.client();
    // Intentional product budget (tenant research units) — not boilerplate
    const numResults = Math.min(Math.max(budget, 1), 10);

    // Recency / region expressed in query phrasing (Exa guidance), not hard date filters
    const parts = [query];
    if (filters.region?.length) parts.push(filters.region.join(" "));
    if (filters.industries?.length) parts.push(filters.industries.join(" "));
    parts.push("recent infrastructure expansion hiring refresh procurement");
    const fullQuery = parts.filter(Boolean).join(" ").trim();

    // SDK: searchAndContents merges ContentsOptions at top level.
    // HTTP equivalent: { type, contents: { highlights: true } }
    const response = await exa.searchAndContents(fullQuery, {
      type: "auto",
      numResults,
      highlights: true,
    });

    this.lastRequestRef = `exa_${Date.now()}`;
    const items = this.normalize(response);
    return {
      providerRunId: this.lastRequestRef,
      items,
      rawCount: items.length,
    };
  }

  async retrieve(sourceReferences: string[]): Promise<NormalizedSources> {
    const exa = this.client();
    const urls = sourceReferences.filter(Boolean).slice(0, 10);
    if (urls.length === 0) return { items: [] };

    // Contents endpoint: highlights at top level (not nested under contents)
    const response = await exa.getContents(urls, {
      highlights: true,
    });
    this.lastRequestRef = `exa_retrieve_${Date.now()}`;
    return { items: this.normalize(response) };
  }

  async reportUsage(requestId: string): Promise<Usage> {
    return { requestRef: requestId || this.lastRequestRef, units: 1 };
  }
}
