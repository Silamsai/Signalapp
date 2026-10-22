import { api } from "./client";

export function listMonitors(workspaceId: string) {
  return api<{ monitors: Array<Record<string, unknown>> }>(
    `/v1/workspaces/${workspaceId}/monitors`,
  );
}

export function createMonitor(
  workspaceId: string,
  body: { name: string; query: string; accountId?: string; cadenceHours?: number },
) {
  return api<{ monitor: Record<string, unknown> }>(`/v1/workspaces/${workspaceId}/monitors`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function runMonitor(workspaceId: string, monitorId: string) {
  return api<{ queued: boolean; result: Record<string, unknown> }>(
    `/v1/workspaces/${workspaceId}/monitors/${monitorId}/run`,
    { method: "POST", body: "{}" },
  );
}

export function patchMonitor(
  workspaceId: string,
  monitorId: string,
  body: { status?: string; name?: string },
) {
  return api<{ monitor: Record<string, unknown> }>(
    `/v1/workspaces/${workspaceId}/monitors/${monitorId}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export function listNotifications(workspaceId: string, unreadOnly = false) {
  return api<{ notifications: Array<Record<string, unknown>> }>(
    `/v1/workspaces/${workspaceId}/notifications${unreadOnly ? "?unreadOnly=1" : ""}`,
  );
}

export function markNotificationRead(notificationId: string) {
  return api<{ ok: boolean }>(`/v1/notifications/${notificationId}/read`, {
    method: "POST",
    body: "{}",
  });
}

export function listHandoffs(accountId: string, workspaceId: string) {
  return api<{ handoffs: Array<Record<string, unknown>> }>(
    `/v1/accounts/${accountId}/handoffs?workspaceId=${workspaceId}`,
  );
}

export function transitionHandoff(
  handoffId: string,
  body: { workspaceId: string; toState: string; returnReason?: string },
) {
  return api<{ handoff: Record<string, unknown> }>(`/v1/handoffs/${handoffId}/transition`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listCampaigns(workspaceId: string) {
  return api<{ campaigns: Array<Record<string, unknown>> }>(
    `/v1/workspaces/${workspaceId}/campaigns`,
  );
}

export function createCampaign(workspaceId: string, body: { name: string; objective?: string }) {
  return api<{ campaign: Record<string, unknown> }>(`/v1/workspaces/${workspaceId}/campaigns`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getCampaign(workspaceId: string, campaignId: string) {
  return api<Record<string, unknown>>(`/v1/workspaces/${workspaceId}/campaigns/${campaignId}`);
}

export function saveCampaignDraft(
  workspaceId: string,
  campaignId: string,
  body: Record<string, unknown>,
) {
  return api<Record<string, unknown>>(
    `/v1/workspaces/${workspaceId}/campaigns/${campaignId}/draft`,
    { method: "PUT", body: JSON.stringify(body) },
  );
}

export function campaignAction(
  workspaceId: string,
  campaignId: string,
  action: "submit" | "approve" | "launch" | "pause",
) {
  return api<Record<string, unknown>>(
    `/v1/workspaces/${workspaceId}/campaigns/${campaignId}/${action}`,
    { method: "POST", body: "{}" },
  );
}

export function listConversations(workspaceId: string) {
  return api<{ conversations: Array<Record<string, unknown>> }>(
    `/v1/workspaces/${workspaceId}/conversations`,
  );
}

export function simulateReply(
  workspaceId: string,
  body: { enrollmentId: string; bodyText: string; classification?: string },
) {
  return api(`/v1/workspaces/${workspaceId}/replies/simulate`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getSending(workspaceId: string) {
  return api<{
    domains: Array<Record<string, unknown>>;
    accounts: Array<Record<string, unknown>>;
  }>(`/v1/workspaces/${workspaceId}/sending`);
}

export function addDomain(workspaceId: string, domain: string) {
  return api<{ domain: Record<string, unknown> }>(
    `/v1/workspaces/${workspaceId}/sending/domains`,
    { method: "POST", body: JSON.stringify({ domain }) },
  );
}

export function verifyDomain(workspaceId: string, domainId: string) {
  return api<{ domain: Record<string, unknown> }>(
    `/v1/workspaces/${workspaceId}/sending/domains/${domainId}/verify`,
    { method: "POST", body: "{}" },
  );
}

export function addMailbox(
  workspaceId: string,
  body: { domainId: string; mailbox: string; displayName?: string },
) {
  return api<{ account: Record<string, unknown> }>(
    `/v1/workspaces/${workspaceId}/sending/accounts`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function enableMailbox(workspaceId: string, accountId: string, enabled: boolean) {
  return api<{ account: Record<string, unknown> }>(
    `/v1/workspaces/${workspaceId}/sending/accounts/${accountId}/enable`,
    { method: "POST", body: JSON.stringify({ enabled }) },
  );
}

export function testMailbox(workspaceId: string, accountId: string, to: string) {
  return api<{ result: Record<string, unknown> }>(
    `/v1/workspaces/${workspaceId}/sending/accounts/${accountId}/test`,
    { method: "POST", body: JSON.stringify({ to }) },
  );
}

export function getEntitlements(workspaceId: string) {
  return api<{ entitlements: Record<string, unknown> }>(
    `/v1/workspaces/${workspaceId}/entitlements`,
  );
}

export function patchEntitlements(workspaceId: string, body: Record<string, unknown>) {
  return api<{ entitlements: Record<string, unknown> }>(
    `/v1/workspaces/${workspaceId}/entitlements`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export function listScoreModels(workspaceId: string) {
  return api<{ models: Array<Record<string, unknown>> }>(
    `/v1/workspaces/${workspaceId}/score-models`,
  );
}

export function createScoreModel(workspaceId: string, body: { name: string; notes?: string }) {
  return api<{ model: Record<string, unknown> }>(`/v1/workspaces/${workspaceId}/score-models`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function evaluateScoreModel(workspaceId: string, modelId: string) {
  return api<{ eval: Record<string, unknown> }>(
    `/v1/workspaces/${workspaceId}/score-models/${modelId}/evaluate`,
    { method: "POST", body: "{}" },
  );
}

export function activateScoreModel(workspaceId: string, modelId: string) {
  return api<{ models: Array<Record<string, unknown>> }>(
    `/v1/workspaces/${workspaceId}/score-models/${modelId}/activate`,
    { method: "POST", body: "{}" },
  );
}

export function rollbackScoreModel(workspaceId: string, modelId: string) {
  return api<{ models: Array<Record<string, unknown>> }>(
    `/v1/workspaces/${workspaceId}/score-models/${modelId}/rollback`,
    { method: "POST", body: "{}" },
  );
}
