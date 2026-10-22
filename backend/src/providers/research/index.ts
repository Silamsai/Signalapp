import { isExaConfigured } from "../../config/env.js";
import { providerNotConfigured } from "../../utils/errors.js";
import { ExaResearchProvider } from "./exa.js";
import type { ResearchProvider } from "./types.js";

export function getResearchProvider(): ResearchProvider {
  if (!isExaConfigured()) {
    throw providerNotConfigured("exa");
  }
  return new ExaResearchProvider();
}

export function researchProviderStatus() {
  return {
    provider: "exa",
    configured: isExaConfigured(),
  };
}

export type { ResearchProvider } from "./types.js";
