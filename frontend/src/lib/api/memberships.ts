import { api } from "./client";

export type MembershipRow = {
  id: string;
  userId: string;
  role: string;
  email: string;
  name: string;
  revokedAt: string | null;
  createdAt: string;
};

export function listMemberships(workspaceId: string) {
  return api<{ memberships: MembershipRow[] }>(
    `/v1/workspaces/${workspaceId}/memberships`,
  );
}

export function grantMembership(
  workspaceId: string,
  body: { email: string; name?: string; role: string },
) {
  return api<{
    membership: { id: string };
    temporaryPassword?: string;
  }>(`/v1/workspaces/${workspaceId}/memberships`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function revokeMembership(workspaceId: string, membershipId: string) {
  return api<{ membership: { id: string } }>(
    `/v1/workspaces/${workspaceId}/memberships/${membershipId}/revoke`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export function resetMemberPassword(workspaceId: string, membershipId: string) {
  return api<{ temporaryPassword: string }>(
    `/v1/workspaces/${workspaceId}/memberships/${membershipId}/reset-password`,
    { method: "POST", body: JSON.stringify({}) },
  );
}
