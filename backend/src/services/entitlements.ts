import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { entitlements } from "../db/schema/index.js";
import { forbidden, rateLimited } from "../utils/errors.js";
import { newId } from "../utils/ids.js";

export async function ensureEntitlements(tenantId: string, workspaceId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(entitlements)
    .where(eq(entitlements.workspaceId, workspaceId))
    .limit(1);
  if (row) return row;
  const id = newId("ent");
  await db.insert(entitlements).values({ id, tenantId, workspaceId });
  const [created] = await db.select().from(entitlements).where(eq(entitlements.id, id)).limit(1);
  return created!;
}

export async function assertResearchAllowed(tenantId: string, workspaceId: string) {
  const e = await ensureEntitlements(tenantId, workspaceId);
  if (!e.researchEnabled || e.researchKillSwitch) {
    throw forbidden("Research is disabled for this workspace");
  }
  return e;
}

export async function assertSendingAllowed(tenantId: string, workspaceId: string) {
  const e = await ensureEntitlements(tenantId, workspaceId);
  if (!e.sendingEnabled || e.sendingKillSwitch) {
    throw forbidden("Sending is disabled for this workspace");
  }
  if (e.sendUsedMonthly >= e.sendQuotaMonthly) {
    throw rateLimited("Send quota exhausted for this workspace");
  }
  return e;
}

export async function assertMonitorsAllowed(tenantId: string, workspaceId: string) {
  const e = await ensureEntitlements(tenantId, workspaceId);
  if (!e.monitorsEnabled) throw forbidden("Monitors are disabled for this workspace");
  return e;
}

export async function incrementSendUsage(workspaceId: string, units = 1) {
  const db = getDb();
  const [e] = await db
    .select()
    .from(entitlements)
    .where(eq(entitlements.workspaceId, workspaceId))
    .limit(1);
  if (!e) return;
  await db
    .update(entitlements)
    .set({ sendUsedMonthly: e.sendUsedMonthly + units, updatedAt: new Date() })
    .where(eq(entitlements.id, e.id));
}

export async function updateEntitlements(
  workspaceId: string,
  patch: Partial<{
    researchEnabled: boolean;
    sendingEnabled: boolean;
    monitorsEnabled: boolean;
    researchKillSwitch: boolean;
    sendingKillSwitch: boolean;
    sendQuotaMonthly: number;
  }>,
) {
  const db = getDb();
  await db
    .update(entitlements)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(entitlements.workspaceId, workspaceId));
  const [row] = await db
    .select()
    .from(entitlements)
    .where(eq(entitlements.workspaceId, workspaceId))
    .limit(1);
  return row!;
}
