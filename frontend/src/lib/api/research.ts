import { api } from "./client";

export function startResearchRun(
  workspaceId: string,
  body: { query: string; accountId?: string; budget?: number; idempotencyKey?: string },
) {
  return api<{ researchRunId: string; status: string }>(
    `/v1/workspaces/${workspaceId}/research-runs`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function getResearchRun(id: string, workspaceId: string) {
  return api<{
    researchRun: {
      id: string;
      status: string;
      progressPct: number;
      errorMessage: string | null;
      budgetActual: number | null;
    };
  }>(`/v1/research-runs/${id}?workspaceId=${workspaceId}`);
}
