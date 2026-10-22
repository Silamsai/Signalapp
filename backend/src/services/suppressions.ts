import { and, eq, or, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { accounts, suppressions } from "../db/schema/index.js";

export function normalizeSuppressionValue(raw: string): string {
  let v = raw.trim().toLowerCase();
  if (v.includes("@")) {
    return v;
  }
  v = v.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? v;
  return v;
}

/** True if address or domain (or account domain) is suppressed in this workspace. */
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
          eq(suppressions.addressOrDomain, value),
          eq(suppressions.addressOrDomain, domainPart),
          sql`lower(${suppressions.addressOrDomain}) = ${value}`,
          sql`lower(${suppressions.addressOrDomain}) = ${domainPart}`,
        ),
      ),
    )
    .limit(1);
  return Boolean(rows[0]);
}

export async function assertNotSuppressed(
  workspaceId: string,
  addressOrDomain: string | null | undefined,
  message = "Target is suppressed",
) {
  if (await isSuppressed(workspaceId, addressOrDomain)) {
    const { validationError } = await import("../utils/errors.js");
    throw validationError(message);
  }
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

/** Filter account rows whose domain is on the suppression list. */
export async function filterUnsuppressedAccounts<T extends { domain?: string | null }>(
  workspaceId: string,
  rows: T[],
): Promise<T[]> {
  if (!rows.length) return rows;
  const db = getDb();
  const suppressed = await db
    .select({ value: suppressions.addressOrDomain })
    .from(suppressions)
    .where(eq(suppressions.workspaceId, workspaceId));
  const set = new Set(suppressed.map((s) => normalizeSuppressionValue(s.value)));
  return rows.filter((r) => {
    if (!r.domain) return true;
    const d = normalizeSuppressionValue(r.domain);
    return !set.has(d);
  });
}
