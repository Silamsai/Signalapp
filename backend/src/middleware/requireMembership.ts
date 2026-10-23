import { and, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { getDb } from "../db/client.js";
import { accounts, memberships, tasks, workspaces, type MembershipRole } from "../db/schema/index.js";
import { hasCapability, type Capability } from "../auth/permissions.js";
import { forbidden, notFound, unauthorized } from "../utils/errors.js";

export type MembershipContext = {
  membershipId: string;
  tenantId: string;
  workspaceId: string;
  role: MembershipRole;
  userId: string;
};

declare module "fastify" {
  interface FastifyRequest {
    membership: MembershipContext | null;
  }
}

const MEMBERSHIP_TTL_MS = 30_000;
const membershipCache = new Map<string, { ctx: MembershipContext; cachedAt: number }>();

export function forgetMemberships() {
  membershipCache.clear();
}

/** Resolve workspace access from authenticated, non-revoked membership (spec §4). */
export async function loadMembership(req: FastifyRequest, workspaceId: string): Promise<MembershipContext> {
  if (!req.actor) throw unauthorized();
  const cacheKey = `${req.actor.userId}|${workspaceId}`;
  const cached = membershipCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < MEMBERSHIP_TTL_MS) {
    req.membership = cached.ctx;
    return cached.ctx;
  }
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
        eq(workspaces.tenantId, memberships.tenantId),
        isNull(memberships.revokedAt),
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
    userId: req.actor.userId,
  };
  membershipCache.set(cacheKey, { ctx, cachedAt: Date.now() });
  req.membership = ctx;
  return ctx;
}

export function requireCap(ctx: MembershipContext, cap: Capability) {
  if (!hasCapability(ctx.role, cap)) {
    throw forbidden(`Missing capability: ${cap}`);
  }
}

/**
 * Row filter for accounts the member may read. SDRs only see accounts they own
 * or hold a task on (spec §4 "Assigned accounts").
 */
export function accountScope(ctx: MembershipContext): SQL {
  const base = and(
    eq(accounts.workspaceId, ctx.workspaceId),
    eq(accounts.tenantId, ctx.tenantId),
    isNull(accounts.mergedIntoId),
  )!;
  if (ctx.role !== "sdr") return base;
  return and(
    base,
    or(
      eq(accounts.ownerUserId, ctx.userId),
      sql`exists (select 1 from ${tasks} where ${tasks.accountId} = ${accounts.id} and ${tasks.ownerUserId} = ${ctx.userId})`,
    ),
  )!;
}

/** Workspace + tenant ownership check; 404 so guessed IDs reveal nothing (gate 1). */
export async function assertAccountInWorkspace(accountId: string, workspaceId: string, tenantId: string) {
  const db = getDb();
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

/** Read access to one account: capability + workspace + SDR assignment scope. */
export async function assertAccountReadable(ctx: MembershipContext, accountId: string) {
  requireCap(ctx, "view_accounts");
  const db = getDb();
  const rows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), accountScope(ctx)))
    .limit(1);
  if (!rows[0]) throw notFound("Account not found");
}

/** True when the user is an active member of the workspace (owners/assignees). */
export async function isActiveMember(workspaceId: string, userId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.workspaceId, workspaceId),
        eq(memberships.userId, userId),
        isNull(memberships.revokedAt),
      ),
    )
    .limit(1);
  return Boolean(rows[0]);
}
