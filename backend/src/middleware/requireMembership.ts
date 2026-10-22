import { and, eq } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { getDb } from "../db/client.js";
import { memberships, workspaces, type MembershipRole } from "../db/schema/index.js";
import { hasCapability, type Capability } from "../auth/permissions.js";
import { forbidden, notFound, unauthorized } from "../utils/errors.js";

export type MembershipContext = {
  membershipId: string;
  tenantId: string;
  workspaceId: string;
  role: MembershipRole;
};

declare module "fastify" {
  interface FastifyRequest {
    membership: MembershipContext | null;
  }
}

export async function loadMembership(req: FastifyRequest, workspaceId: string): Promise<MembershipContext> {
  if (!req.actor) throw unauthorized();
  const db = getDb();
  const rows = await db
    .select({
      membershipId: memberships.id,
      tenantId: memberships.tenantId,
      workspaceId: memberships.workspaceId,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(workspaces, eq(memberships.workspaceId, workspaces.id))
    .where(
      and(
        eq(memberships.workspaceId, workspaceId),
        eq(memberships.userId, req.actor.userId),
        eq(workspaces.id, workspaceId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) throw forbidden("No membership for this workspace");
  const ctx: MembershipContext = {
    membershipId: row.membershipId,
    tenantId: row.tenantId,
    workspaceId: row.workspaceId,
    role: row.role as MembershipRole,
  };
  req.membership = ctx;
  return ctx;
}

export function requireCap(ctx: MembershipContext, cap: Capability) {
  if (!hasCapability(ctx.role, cap)) {
    throw forbidden(`Missing capability: ${cap}`);
  }
}

export async function assertAccountInWorkspace(accountId: string, workspaceId: string, tenantId: string) {
  const db = getDb();
  const { accounts } = await import("../db/schema/index.js");
  const rows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.id, accountId),
        eq(accounts.workspaceId, workspaceId),
        eq(accounts.tenantId, tenantId),
      ),
    )
    .limit(1);
  if (!rows[0]) throw notFound("Account not found");
}
