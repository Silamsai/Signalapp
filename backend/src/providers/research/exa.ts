import { Exa } from "exa-js";
import { getEnv, isExaConfigured } from "../../config/env.js";
import { providerNotConfigured } from "../../utils/errors.js";
import { canonicalizeUrl, countryFromUrl, hostnameOf } from "../../utils/normalize.js";
import {
  NormalizedProviderError,
  type NormalizedDiscovery,
  type NormalizedEvidenceItem,
  type NormalizedSources,
  type ResearchFilters,
  type ResearchMode,
  type ResearchProvider,
  type Usage,
} from "./types.js";

const REQUEST_TIMEOUT_MS = 30_000;

const SIGNAL_TERMS: Record<string, string> = {
  expansion: "expansion new site data centre facility",
  infra_hiring: "hiring infrastructure engineers",
  refresh: "server hardware refresh migration",
  compute: "compute capacity storage requirements",
  procurement: "IT infrastructure tender procurement",
};

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new NormalizedProviderError("provider_timeout", "Exa request timed out", true)),
      ms,
    );
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Map Exa/HTTP failures to normalized, secret-free error codes (spec §6). */
export function normalizeExaError(err: unknown): NormalizedProviderError {
  if (err instanceof NormalizedProviderError) return err;
  const status =
    err && typeof err === "object" && "statusCode" in err
      ? Number((err as { statusCode: unknown }).statusCode)
      : err && typeof err === "object" && "status" in err
        ? Number((err as { status: unknown }).status)
        : NaN;
  if (status === 401 || status === 403) {
    return new NormalizedProviderError("provider_auth", "Exa rejected the API key", false);
  }
  if (status === 429) {
    return new NormalizedProviderError("provider_rate_limited", "Exa rate limit reached", true);
  }
  if (status === 400 || status === 422) {
    return new NormalizedProviderError("provider_bad_request", "Exa rejected the request", false);
  }
  if (status >= 500) {
    return new NormalizedProviderError("provider_unavailable", "Exa is temporarily unavailable", true);
  }
  return new NormalizedProviderError("provider_error", "Exa request failed", true);
}

/**
 * Exa research adapter (server-only). Endpoint mapping, limits and error
 * normalization stay inside the adapter; the API key never leaves this process.
 */
export class ExaResearchProvider implements ResearchProvider {
  name = "exa";

  private client(): InstanceType<typeof Exa> {
    if (!isExaConfigured()) throw providerNotConfigured("exa");
    return new Exa(getEnv().EXA_API_KEY);
  }

  normalize(raw: unknown, requestRef = ""): NormalizedEvidenceItem[] {
    const results = Array.isArray(raw)
      ? raw
      : ((raw as { results?: unknown[] })?.results ?? []);
    const items: NormalizedEvidenceItem[] = [];
    for (const r of results) {
      const row = r as Record<string, unknown>;
      const url = typeof row.url === "string" ? row.url : "";
      if (!/^https?:\/\//i.test(url)) continue;
      const published = typeof row.publishedDate === "string" ? row.publishedDate : null;

      // Prefer highlights; page text is untrusted data and is only stored as an excerpt
      let excerpt: string | undefined;
      const highlights = row.highlights;
      if (Array.isArray(highlights) && highlights.length) {
        excerpt = highlights.map(String).join(" … ").slice(0, 800);
      } else if (typeof row.text === "string") {
        excerpt = row.text.slice(0, 800);
      }

      items.push({
        canonicalUrl: canonicalizeUrl(url),
        title: typeof row.title === "string" ? row.title.slice(0, 300) : undefined,
        excerpt,
        publisher: hostnameOf(url) ?? undefined,
        // Unknown dates stay unknown
        eventDate: published && !Number.isNaN(Date.parse(published)) ? published : null,
        country: countryFromUrl(url),
        matchRationale: "Matched by Exa web search for the research query",
        providerRequestRef: requestRef,
        signalKind: "web_signal",
        fitHint: 55,
        qualityHint: 65,
      });
    }
    return items;
  }

  async discover(
    query: string,
    filters: ResearchFilters,
    budget: number,
    mode: ResearchMode = "account",
  ): Promise<NormalizedDiscovery> {
    const exa = this.client();
    const numResults = Math.min(Math.max(budget, 1), 10);

    const parts = [query];
    if (filters.industries?.length) parts.push(filters.industries.join(" "));
    const kinds = filters.signalKinds?.length ? filters.signalKinds : Object.keys(SIGNAL_TERMS);
    if (mode === "account") parts.push(kinds.map((k) => SIGNAL_TERMS[k] ?? k).join(" "));
    const fullQuery = parts.filter(Boolean).join(" ").trim().slice(0, 1000);

    const startPublishedDate =
      mode === "account" && filters.eventWindowDays
        ? new Date(Date.now() - filters.eventWindowDays * 86400000).toISOString()
        : undefined;

    let response: { requestId?: string; results: unknown[] };
    try {
      response = (await withTimeout(
        exa.searchAndContents(fullQuery, {
          type: "auto",
          numResults,
          highlights: true,
          ...(mode === "discovery" ? { category: "company" as const } : {}),
          ...(startPublishedDate ? { startPublishedDate } : {}),
          ...(filters.countries?.length === 1 ? { userLocation: filters.countries[0] } : {}),
          ...(filters.excludeDomains?.length
            ? { excludeDomains: filters.excludeDomains.slice(0, 100) }
            : {}),
        }),
        REQUEST_TIMEOUT_MS,
      )) as { requestId?: string; results: unknown[] };
    } catch (err) {
      throw normalizeExaError(err);
    }

    const requestRef = response.requestId ?? "";
    let items = this.normalize(response, requestRef);

    // Region match uses the normalized source country only — sources with an unknown
    // country are kept (unknown is not a mismatch), known mismatches are dropped.
    if (filters.countries?.length) {
      const allowed = new Set(filters.countries);
      items = items.filter((i) => !i.country || allowed.has(i.country));
    }

    return {
      providerRunId: requestRef,
      items,
      rawCount: Array.isArray(response.results) ? response.results.length : 0,
    };
  }

  async retrieve(sourceReferences: string[]): Promise<NormalizedSources> {
    const exa = this.client();
    const urls = sourceReferences.filter(Boolean).slice(0, 10);
    if (urls.length === 0) return { items: [] };
    try {
      const response = (await withTimeout(
        exa.getContents(urls, { highlights: true }),
        REQUEST_TIMEOUT_MS,
      )) as { requestId?: string; results: unknown[] };
      return { items: this.normalize(response, response.requestId ?? "") };
    } catch (err) {
      throw normalizeExaError(err);
    }
  }

  /** One unit per result returned (minimum one for the request); unused units are refunded. */
  async reportUsage(discovery: NormalizedDiscovery, reservedUnits: number): Promise<Usage> {
    return {
      requestRef: discovery.providerRunId,
      units: Math.min(reservedUnits, Math.max(1, discovery.rawCount)),
    };
  }
}
