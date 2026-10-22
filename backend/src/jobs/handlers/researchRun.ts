import { eq } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import { accounts, offers, providerUsage, researchRuns } from "../../db/schema/index.js";
import { getResearchProvider } from "../../providers/research/index.js";
import { reconcileUsage } from "../../services/budget.js";
import { persistNormalizedEvidence } from "../../services/evidence.js";
import { newId } from "../../utils/ids.js";

export async function handleResearchRun(payload: { researchRunId: string }) {
  const db = getDb();
  const [run] = await db
    .select()
    .from(researchRuns)
    .where(eq(researchRuns.id, payload.researchRunId))
    .limit(1);
  if (!run) return;
  if (run.status === "completed" || run.status === "cancelled") return;

  await db
    .update(researchRuns)
    .set({ status: "running", startedAt: new Date(), progressPct: 10 })
    .where(eq(researchRuns.id, run.id));

  if (run.accountId) {
    await db
      .update(accounts)
      .set({ researchState: "researching", updatedAt: new Date() })
      .where(eq(accounts.id, run.accountId));
  }

  try {
    const provider = getResearchProvider();
    const [offer] = await db
      .select()
      .from(offers)
      .where(eq(offers.workspaceId, run.workspaceId))
      .limit(1);

    const filters = {
      region: offer ? (JSON.parse(offer.territoryJson) as string[]) : [],
      industries: offer ? (JSON.parse(offer.industriesJson) as string[]) : [],
      exclude: offer ? (JSON.parse(offer.exclusionsJson) as string[]) : [],
    };

    await db.update(researchRuns).set({ progressPct: 40 }).where(eq(researchRuns.id, run.id));

    const discovery = await provider.discover(run.query, filters, run.budgetReserved);
    const usage = await provider.reportUsage(discovery.providerRunId);

    await db.insert(providerUsage).values({
      id: newId("pug"),
      tenantId: run.tenantId,
      workspaceId: run.workspaceId,
      researchRunId: run.id,
      provider: provider.name,
      requestRef: usage.requestRef,
      units: usage.units,
    });

    await reconcileUsage(run.tenantId, run.budgetReserved, usage.units);

    let fitScore = 0;
    if (run.accountId && discovery.items.length) {
      const result = await persistNormalizedEvidence({
        tenantId: run.tenantId,
        workspaceId: run.workspaceId,
        accountId: run.accountId,
        researchRunId: run.id,
        items: discovery.items,
      });
      fitScore = result.fitScore;
      await db
        .update(accounts)
        .set({
          researchState: "researched",
          fitScore,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, run.accountId));
    } else if (run.accountId) {
      await db
        .update(accounts)
        .set({ researchState: "researched", updatedAt: new Date() })
        .where(eq(accounts.id, run.accountId));
    }

    await db
      .update(researchRuns)
      .set({
        status: "completed",
        progressPct: 100,
        providerRunId: discovery.providerRunId,
        budgetActual: usage.units,
        completedAt: new Date(),
      })
      .where(eq(researchRuns.id, run.id));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Research failed";
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: string }).code)
        : "provider_error";

    await db
      .update(researchRuns)
      .set({
        status: "failed",
        errorCode: code,
        errorMessage: message.slice(0, 500),
        completedAt: new Date(),
      })
      .where(eq(researchRuns.id, run.id));

    if (run.accountId) {
      await db
        .update(accounts)
        .set({ researchState: "failed", updatedAt: new Date() })
        .where(eq(accounts.id, run.accountId));
    }

    // Do not double-charge on failure after reservation — leave reserved as spent attempt
    throw err;
  }
}
