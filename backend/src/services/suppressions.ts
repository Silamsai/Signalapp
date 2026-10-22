import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { accounts, suppressions } from "../db/schema/index.js";
import { notFound, validationError } from "../utils/errors.js";
import { newId } from "../utils/ids.js";
import { writeAudit } from "./audit.js";

export const suppressionReasons = [
  "opt_out",
  "do_not_contact",
  "existing_customer",
  "legal",
  "competitor",
  "other",
] as const;
export type SuppressionReason = (typeof suppressionReasons)[number];

export function normalizeSuppressionValue(raw: string): string {
  let v = raw.trim().toLowerCase();
  if (v.includes("@")) {
    return v;
  }
  v = v.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? v;
  return v;
}

/** Suppression is active once effective and until (optional) expiry. */
function activeClause() {
  const now = new Date();
  return and(
    sql`${suppressions.effectiveAt} <= ${now}`,
    or(isNull(suppressions.expiresAt), gt(suppressions.expiresAt, now)),
  );
}

/** True if address or domain (or account domain) is actively suppressed in this workspace. */
export async function isSuppressed(
  workspaceId: string,
  addressOrDomain: string | null | undefined,
): Promise<boolean> {
  if (!addressOrDomain?.trim()) return false;
  const value = normalizeSuppressionValue(addressOrDomain);
  const db = getDb();

  const domainPart = value.includes("@") ? value.split("@")[1]! : value;

  const rows = await db
    .select({ id: suppressions.id })
    .from(suppressions)
    .where(
      and(
        eq(suppressions.workspaceId, workspaceId),
        or(
          sql`lower(${suppressions.addressOrDomain}) = ${value}`,
          sql`lower(${suppressions.addressOrDomain}) = ${domainPart}`,
        ),
        activeClause(),
      ),
    )
    .limit(1);
  return Boolean(rows[0]);
}

export async function isAccountSuppressed(workspaceId: string, accountId: string): Promise<boolean> {
  const db = getDb();
  const [account] = await db
    .select({ domain: accounts.domain })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.workspaceId, workspaceId)))
    .limit(1);
  if (!account) return false;
  return isSuppressed(workspaceId, account.domain);
}

/** Active suppressed values for bulk filtering (exports, discovery results). */
export async function activeSuppressionSet(workspaceId: string): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select({ value: suppressions.addressOrDomain })
    .from(suppressions)
    .where(and(eq(suppressions.workspaceId, workspaceId), activeClause()));
  return new Set(rows.map((s) => normalizeSuppressionValue(s.value)));
}

/** Filter account rows whose domain is on the suppression list. */
export async function filterUnsuppressedAccounts<T extends { domain?: string | null }>(
  workspaceId: string,
  rows: T[],
): Promise<T[]> {
  if (!rows.length) return rows;
  const set = await activeSuppressionSet(workspaceId);
  return rows.filter((r) => !r.domain || !set.has(normalizeSuppressionValue(r.domain)));
}

export async function listSuppressions(workspaceId: string) {
  const db = getDb();
  return db
    .select()
    .from(suppressions)
    .where(eq(suppressions.workspaceId, workspaceId))
    .orderBy(desc(suppressions.createdAt));
}

export async function createSuppression(input: {
  tenantId: string;
  workspaceId: string;
  addressOrDomain: string;
  reason: SuppressionReason;
  source?: string;
  expiresAt?: string | null;
  actorUserId: string;
}) {
  const value = normalizeSuppressionValue(input.addressOrDomain);
  if (!value || (!value.includes("@") && !value.includes("."))) {
    throw validationError("Enter an email address or a domain such as example.com");
  }
  const db = getDb();
  const id = newId("sup");
  await db.insert(suppressions).values({
    id,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    addressOrDomain: value,
    reason: input.reason,
    source: input.source ?? "manual",
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    createdBy: input.actorUserId,
  });
  await writeAudit({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    action: "suppression.created",
    entityType: "suppression",
    entityId: id,
    metadata: { reason: input.reason, source: input.source ?? "manual" },
  });
  const [row] = await db.select().from(suppressions).where(eq(suppressions.id, id)).limit(1);
  return row!;
}

/** Lifecycle end: expire now (record kept for retention/audit, never hard-deleted). */
export async function expireSuppression(input: {
  tenantId: string;
  workspaceId: string;
  suppressionId: string;
  actorUserId: string;
}) {
  const db = getDb();
  const updated = await db
    .update(suppressions)
    .set({ expiresAt: new Date() })
    .where(
      and(
        eq(suppressions.id, input.suppressionId),
        eq(suppressions.workspaceId, input.workspaceId),
        eq(suppressions.tenantId, input.tenantId),
      ),
    )
    .returning();
  if (!updated[0]) throw notFound("Suppression not found");
  await writeAudit({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    action: "suppression.expired",
    entityType: "suppression",
    entityId: input.suppressionId,
  });
  return updated[0];
}
