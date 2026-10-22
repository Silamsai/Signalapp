import { api } from "./client";

export type Draft = {
  id: string;
  accountId: string;
  accountName: string;
  channel: string;
  subject: string | null;
  body: string;
  evidenceIdsJson: string;
  hypothesesJson: string;
  staleWarning: number;
  version: number;
  approvedAt: string | null;
  updatedAt: string;
};

export function listDrafts(workspaceId: string, accountId?: string) {
  return api<{ drafts: Draft[] }>(
    `/v1/workspaces/${workspaceId}/drafts${accountId ? `?accountId=${accountId}` : ""}`,
  );
}

export function createDraft(accountId: string, workspaceId: string, channel = "email") {
  return api<{ draft: Draft }>(`/v1/accounts/${accountId}/drafts?workspaceId=${workspaceId}`, {
    method: "POST",
    body: JSON.stringify({ channel }),
  });
}

export function saveDraft(
  draftId: string,
  body: { workspaceId: string; expectedVersion: number; subject?: string; body?: string },
) {
  return api<{ draft: Draft }>(`/v1/drafts/${draftId}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function approveDraft(draftId: string, workspaceId: string, expectedVersion: number) {
  return api<{ draft: Draft }>(`/v1/drafts/${draftId}/approve`, {
    method: "POST",
    body: JSON.stringify({ workspaceId, expectedVersion }),
  });
}
