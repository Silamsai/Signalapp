import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { entitlements } from "../db/schema/index.js";
import { forbidden } from "../utils/errors.js";
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

export async function updateEntitlements(
  tenantId: string,
  workspaceId: string,
  patch: Partial<{ researchEnabled: boolean; researchKillSwitch: boolean }>,
) {
  await ensureEntitlements(tenantId, workspaceId);
  const db = getDb();
  await db
    .update(entitlements)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(entitlements.workspaceId, workspaceId));
  return ensureEntitlements(tenantId, workspaceId);
}
