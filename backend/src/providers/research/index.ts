import { isExaConfigured } from "../../config/env.js";
import { providerNotConfigured } from "../../utils/errors.js";
import { ExaResearchProvider } from "./exa.js";
import type { ResearchProvider } from "./types.js";

let override: ResearchProvider | null = null;

/** Test hook: replace the live provider with a fake (never used in production paths). */
export function setResearchProviderForTests(provider: ResearchProvider | null) {
  override = provider;
}

export function getResearchProvider(): ResearchProvider {
  if (override) return override;
  if (!isExaConfigured()) {
    throw providerNotConfigured("exa");
  }
  return new ExaResearchProvider();
}

export function isResearchConfigured(): boolean {
  return Boolean(override) || isExaConfigured();
}

export function researchProviderStatus() {
  return {
    provider: "exa",
    configured: isExaConfigured(),
  };
}

export type { ResearchProvider } from "./types.js";
