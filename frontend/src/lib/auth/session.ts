import { api } from "../api/client";
import type { Capability } from "./capabilities";

export type User = {
  id: string;
  email: string;
  name: string;
  mustChangePassword: boolean;
  /** App owner: lands on /platform and belongs to no workspace */
  isPlatformAdmin?: boolean;
};

export async function changePassword(currentPassword: string, newPassword: string) {
  return api<{ ok: boolean }>("/v1/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export type WorkspaceMembership = {
  id: string;
  name: string;
  tenantId: string;
  currency: string;
  role: string;
  capabilities: Capability[];
};

export async function login(email: string, password: string) {
  return api<{ user: User }>("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function logout() {
  // A JSON body is required: the API rejects an empty body sent as application/json
  return api<{ ok: boolean }>("/v1/auth/logout", { method: "POST", body: "{}", keepalive: true });
}

export async function me() {
  return api<{ user: User }>("/v1/auth/me");
}

export async function listWorkspaces() {
  return api<{ workspaces: WorkspaceMembership[] }>("/v1/workspaces");
}
