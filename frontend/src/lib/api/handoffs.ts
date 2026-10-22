import { api } from "./client";

export type Handoff = {
  id: string;
  accountId: string;
  receivingOrg: string;
  receivingUser: string | null;
  internalOwnerUserId: string;
  permittedFields: string[];
  reason: string;
  nextAction: string | null;
  dueAt: string | null;
  state: "prepared" | "shared" | "acknowledged" | "returned" | "closed";
  returnReason: string | null;
  sharedAt: string | null;
  createdAt: string;
  grants: Array<{ granteeEmail: string; createdAt: string; revokedAt: string | null }>;
};

export function listHandoffFields() {
  return api<{ fields: string[] }>("/v1/handoffs/fields");
}

export function listHandoffs(accountId: string, workspaceId: string) {
  return api<{ handoffs: Handoff[] }>(`/v1/accounts/${accountId}/handoffs?workspaceId=${workspaceId}`);
}

export function createHandoff(
  accountId: string,
  workspaceId: string,
  body: {
    receivingOrg: string;
    receivingUser: string;
    internalOwnerUserId: string;
    permittedFields: string[];
    reason: string;
    nextAction: string;
    dueAt: string;
    acknowledgeConflict?: boolean;
  },
) {
  return api<{ handoff: Handoff }>(`/v1/accounts/${accountId}/handoffs?workspaceId=${workspaceId}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function shareHandoff(handoffId: string, workspaceId: string, granteeEmail: string) {
  return api<{ handoff: Handoff }>(`/v1/handoffs/${handoffId}/share`, {
    method: "POST",
    body: JSON.stringify({ workspaceId, granteeEmail }),
  });
}

export function revokeHandoffAccess(handoffId: string, workspaceId: string, granteeEmail: string) {
  return api<{ revoked: number }>(`/v1/handoffs/${handoffId}/revoke-access`, {
    method: "POST",
    body: JSON.stringify({ workspaceId, granteeEmail }),
  });
}

export function transitionHandoff(
  handoffId: string,
  body: { workspaceId: string; toState: "acknowledged" | "returned" | "closed"; returnReason?: string },
) {
  return api<{ handoff: Handoff }>(`/v1/handoffs/${handoffId}/transition`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type SharedHandoff = {
  id: string;
  state: Handoff["state"];
  receivingOrg: string;
  accountName: string;
  sharedAt: string | null;
  dueAt: string | null;
};

export function listSharedHandoffs(workspaceId: string) {
  return api<{ handoffs: SharedHandoff[] }>(`/v1/workspaces/${workspaceId}/shared-handoffs`);
}

export type PartnerView = {
  handoff: {
    id: string;
    state: Handoff["state"];
    receivingOrg: string;
    reason?: string;
    nextAction?: string;
    dueAt: string | null;
    returnReason: string | null;
    permittedFields: string[];
  };
  account: Record<string, string | number | null>;
  facts: Array<{ fieldKey: string; value: string | null; basis: string }>;
  evidence: Array<{
    excerpt: string | null;
    sourceUrl: string;
    sourceTitle: string | null;
    eventDate: string | null;
    discoveredAt: string;
    checkedAt: string;
  }>;
};

export function getPartnerView(handoffId: string, workspaceId: string) {
  return api<PartnerView>(`/v1/handoffs/${handoffId}/partner-view?workspaceId=${workspaceId}`);
}
