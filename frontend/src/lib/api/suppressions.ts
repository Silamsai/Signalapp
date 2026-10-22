import { api } from "./client";

export type Suppression = {
  id: string;
  addressOrDomain: string;
  reason: string;
  source: string;
  effectiveAt: string;
  expiresAt: string | null;
  createdAt: string;
};

export function listSuppressions(workspaceId: string) {
  return api<{ suppressions: Suppression[]; reasons: string[] }>(
    `/v1/workspaces/${workspaceId}/suppressions`,
  );
}

export function createSuppression(
  workspaceId: string,
  body: { addressOrDomain: string; reason: string; source?: string; expiresAt?: string | null },
) {
  return api<{ suppression: Suppression }>(`/v1/workspaces/${workspaceId}/suppressions`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function expireSuppression(workspaceId: string, suppressionId: string) {
  return api<{ suppression: Suppression }>(
    `/v1/workspaces/${workspaceId}/suppressions/${suppressionId}/expire`,
    { method: "POST", body: "{}" },
  );
}
