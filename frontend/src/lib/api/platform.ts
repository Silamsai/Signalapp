import { api } from "./client";

export type PlatformCompany = {
  id: string;
  name: string;
  researchQuotaMonthly: number;
  researchUsedMonthly: number;
  createdAt: string;
  workspaces: number;
  members: number;
  membersByRole: Record<string, number>;
  accounts: number;
};

export type PlatformOverview = {
  totals: { companies: number; workspaces: number; members: number; accounts: number };
  companies: PlatformCompany[];
};

export async function getPlatformOverview() {
  return api<PlatformOverview>("/v1/platform/overview");
}

export async function createCompany(body: {
  companyName: string;
  workspaceName?: string;
  adminEmail: string;
  adminName?: string;
  adminPassword: string;
}) {
  return api<{ tenantId: string; adminEmail: string }>("/v1/platform/tenants", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type PlatformWorkspace = {
  id: string;
  name: string;
  tenantId: string;
  companyName: string;
  createdAt: string;
  members: number;
  accounts: number;
};

export async function listPlatformWorkspaces() {
  return api<{ workspaces: PlatformWorkspace[] }>("/v1/platform/workspaces");
}

export async function createWorkspace(body: {
  tenantId: string;
  name: string;
  adminEmail?: string;
  adminName?: string;
  adminPassword?: string;
}) {
  return api<{ workspaceId: string; adminEmails: string[]; existingAccount: boolean }>("/v1/platform/workspaces", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
