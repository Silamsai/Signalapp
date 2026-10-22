import { api } from "../api/client";

export type User = { id: string; email: string; name: string };

export async function login(email: string, password: string) {
  return api<{ user: User }>("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function logout() {
  return api<{ ok: boolean }>("/v1/auth/logout", { method: "POST" });
}

export async function me() {
  return api<{ user: User }>("/v1/auth/me");
}

export async function listWorkspaces() {
  return api<{
    workspaces: Array<{ id: string; name: string; tenantId: string; role: string }>;
  }>("/v1/workspaces");
}
