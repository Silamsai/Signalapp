import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { tenants } from "../db/schema/index.js";
import { rateLimited } from "../utils/errors.js";

/**
 * Atomically reserve research units. Fails if quota would be exceeded (gate 10).
 */
export async function reserveResearchBudget(tenantId: string, units = 1) {
  const db = getDb();
  const updated = await db
    .update(tenants)
    .set({ researchUsedMonthly: sql`${tenants.researchUsedMonthly} + ${units}` })
    .where(
      and(
        eq(tenants.id, tenantId),
        sql`${tenants.researchUsedMonthly} + ${units} <= ${tenants.researchQuotaMonthly}`,
      ),
    )
    .returning({
      researchUsedMonthly: tenants.researchUsedMonthly,
      researchQuotaMonthly: tenants.researchQuotaMonthly,
    });

  if (!updated[0]) {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    if (!tenant) throw rateLimited("Tenant not found for budget");
    throw rateLimited("Research budget exhausted for this tenant");
  }

  return {
    reserved: units,
    remaining: updated[0].researchQuotaMonthly - updated[0].researchUsedMonthly,
  };
}

/** Adjust usage after a run (actual − reserved). Negative delta refunds. */
export async function reconcileUsage(tenantId: string, reserved: number, actual: number) {
  const delta = actual - reserved;
  if (delta === 0) return;
  const db = getDb();
  if (delta < 0) {
    await db
      .update(tenants)
      .set({
        researchUsedMonthly: sql`GREATEST(0, ${tenants.researchUsedMonthly} + ${delta})`,
      })
      .where(eq(tenants.id, tenantId));
    return;
  }
  await db
    .update(tenants)
    .set({ researchUsedMonthly: sql`${tenants.researchUsedMonthly} + ${delta}` })
    .where(eq(tenants.id, tenantId));
}

export async function refundResearchBudget(tenantId: string, units: number) {
  if (units <= 0) return;
  await reconcileUsage(tenantId, units, 0);
}

export async function getUsage(tenantId: string) {
  const db = getDb();
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  return {
    quotaMonthly: tenant?.researchQuotaMonthly ?? 0,
    usedMonthly: tenant?.researchUsedMonthly ?? 0,
  };
}
