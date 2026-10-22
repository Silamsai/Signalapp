import { eq, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { tenants } from "../db/schema/index.js";
import { rateLimited } from "../utils/errors.js";

export async function reserveResearchBudget(tenantId: string, units = 1) {
  const db = getDb();
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) throw rateLimited("Tenant not found for budget");
  if (tenant.researchUsedMonthly + units > tenant.researchQuotaMonthly) {
    throw rateLimited("Research budget exhausted for this tenant");
  }
  await db
    .update(tenants)
    .set({ researchUsedMonthly: sql`${tenants.researchUsedMonthly} + ${units}` })
    .where(eq(tenants.id, tenantId));
  return { reserved: units, remaining: tenant.researchQuotaMonthly - tenant.researchUsedMonthly - units };
}

export async function reconcileUsage(tenantId: string, reserved: number, actual: number) {
  const delta = actual - reserved;
  if (delta === 0) return;
  const db = getDb();
  await db
    .update(tenants)
    .set({ researchUsedMonthly: sql`${tenants.researchUsedMonthly} + ${delta}` })
    .where(eq(tenants.id, tenantId));
}

export async function getUsage(tenantId: string) {
  const db = getDb();
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  return {
    quotaMonthly: tenant?.researchQuotaMonthly ?? 0,
    usedMonthly: tenant?.researchUsedMonthly ?? 0,
  };
}
