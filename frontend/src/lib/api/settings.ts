import { api } from "./client";

export function getOffer(workspaceId: string) {
  return api<{ offer: Record<string, unknown> | null; playbooks: unknown[] }>(
    `/v1/workspaces/${workspaceId}/settings/offer`,
  );
}

export function saveOffer(workspaceId: string, body: Record<string, unknown>) {
  return api<{ ok: boolean; unsupportedFilters: string[] }>(
    `/v1/workspaces/${workspaceId}/settings/offer`,
    { method: "PUT", body: JSON.stringify(body) },
  );
}

export function getConnections(workspaceId: string) {
  return api<{
    research: { provider: string; configured: boolean };
    usage: { quotaMonthly: number; usedMonthly: number };
    crm: { configured: boolean; phase: number };
    sending: { enabled: boolean; phase: number };
  }>(`/v1/workspaces/${workspaceId}/settings/connections`);
}

export function getOutcomes(workspaceId: string) {
  return api<Record<string, unknown>>(`/v1/workspaces/${workspaceId}/outcomes`);
}
