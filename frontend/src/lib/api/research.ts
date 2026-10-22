import { api } from "./client";

export type ResearchFilters = {
  countries?: string[];
  industries?: string[];
  companySizes?: string[];
  signalKinds?: string[];
  eventWindowDays?: number | null;
};

export type ParsedBrief = {
  structured: {
    keywords: string;
    countries: string[];
    industries: string[];
    companySizes: string[];
    signalKinds: string[];
    eventWindowDays: number | null;
  };
  unsupported: string[];
  usage: { quotaMonthly: number; usedMonthly: number };
};

export function parseBrief(workspaceId: string, brief: string) {
  return api<ParsedBrief>(`/v1/workspaces/${workspaceId}/research-runs/parse-brief`, {
    method: "POST",
    body: JSON.stringify({ brief }),
  });
}

export function startResearchRun(
  workspaceId: string,
  body: {
    mode: "account" | "discovery";
    query: string;
    brief?: string;
    filters?: ResearchFilters;
    accountId?: string;
    playbookVersionId?: string;
    budget?: number;
    idempotencyKey?: string;
  },
) {
  return api<{ researchRunId: string; status: string; reused?: boolean }>(
    `/v1/workspaces/${workspaceId}/research-runs`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export type ResearchRun = {
  id: string;
  mode: string;
  status: string;
  progressPct: number;
  errorCode: string | null;
  errorMessage: string | null;
  budgetReserved: number;
  budgetActual: number | null;
  accountId: string | null;
  result: {
    noResults?: boolean;
    evidenceCreated?: number;
    duplicatesSkipped?: number;
    candidateAccountIds?: string[];
    alreadyKnownAccountIds?: string[];
    skippedSuppressed?: number;
  } | null;
};

export function getResearchRun(id: string, workspaceId: string) {
  return api<{ researchRun: ResearchRun }>(`/v1/research-runs/${id}?workspaceId=${workspaceId}`);
}
