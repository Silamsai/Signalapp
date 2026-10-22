import { api } from "./client";

export type Account = {
  id: string;
  name: string;
  domain: string | null;
  country: string | null;
  researchState: string;
  acceptanceState: string;
  fitScore: number | null;
};

export function listAccounts(workspaceId: string) {
  return api<{ accounts: Account[] }>(`/v1/workspaces/${workspaceId}/accounts`);
}

export function createAccount(
  workspaceId: string,
  body: { name: string; domain?: string; country?: string },
) {
  return api<{ account: Account }>(`/v1/workspaces/${workspaceId}/accounts`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function startImport(workspaceId: string, csvText: string) {
  return api<{ importJobId: string; status: string }>(
    `/v1/workspaces/${workspaceId}/imports`,
    { method: "POST", body: JSON.stringify({ csvText }) },
  );
}

export function getImport(importJobId: string, workspaceId: string) {
  return api<{ import: { status: string; successRows: number; errorRows: number; rowErrors: string[] } }>(
    `/v1/imports/${importJobId}?workspaceId=${workspaceId}`,
  );
}

export function getBrief(accountId: string, workspaceId: string) {
  return api<Record<string, unknown>>(
    `/v1/accounts/${accountId}/brief?workspaceId=${workspaceId}`,
  );
}

export function listMergeCandidates(workspaceId: string) {
  return api<{ candidates: Array<{ id: string; reason: string; accountIdA: string; accountIdB: string }> }>(
    `/v1/workspaces/${workspaceId}/merge-candidates`,
  );
}

export function resolveMergeCandidate(
  workspaceId: string,
  candidateId: string,
  body: { action: "merge" | "keep_separate" | "reject"; keepAccountId?: string },
) {
  return api<{ status: string }>(
    `/v1/workspaces/${workspaceId}/merge-candidates/${candidateId}/resolve`,
    { method: "POST", body: JSON.stringify(body) },
  );
}
