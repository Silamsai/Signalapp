import { and, eq } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import { accounts, offers, providerUsage, researchRuns } from "../../db/schema/index.js";
import { getResearchProvider } from "../../providers/research/index.js";
import { reconcileUsage, refundResearchBudget } from "../../services/budget.js";
import { persistNormalizedEvidence } from "../../services/evidence.js";
import { isSuppressed } from "../../services/suppressions.js";
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

  // Idempotent retry: if usage already recorded, do not re-call provider or re-charge (gate 10)
  const [priorUsage] = await db
    .select()
    .from(providerUsage)
    .where(eq(providerUsage.researchRunId, run.id))
    .limit(1);
  if (priorUsage) {
    await db
      .update(researchRuns)
      .set({
        status: "completed",
        progressPct: 100,
        budgetActual: priorUsage.units,
        completedAt: run.completedAt ?? new Date(),
      })
      .where(eq(researchRuns.id, run.id));
    return;
  }

  // Claim the run — only one worker proceeds if status was queued/failed
  const claimed = await db
    .update(researchRuns)
    .set({ status: "running", startedAt: new Date(), progressPct: 10, errorCode: null, errorMessage: null })
    .where(
      and(
        eq(researchRuns.id, run.id),
        // allow re-entry from failed only after refund path; still guarded by priorUsage
        eq(researchRuns.status, run.status),
      ),
    )
    .returning({ id: researchRuns.id });
  if (!claimed[0]) return;

  if (run.accountId) {
    const [acct] = await db.select().from(accounts).where(eq(accounts.id, run.accountId)).limit(1);
    if (acct?.domain && (await isSuppressed(run.workspaceId, acct.domain))) {
      await refundResearchBudget(run.tenantId, run.budgetReserved);
      await db
        .update(researchRuns)
        .set({
          status: "cancelled",
          errorCode: "suppressed",
          errorMessage: "Account domain is suppressed",
          completedAt: new Date(),
          budgetActual: 0,
        })
        .where(eq(researchRuns.id, run.id));
      await db
        .update(accounts)
        .set({ researchState: "unresearched", updatedAt: new Date() })
        .where(eq(accounts.id, run.accountId));
      return;
    }
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
    // Charge actual units equal to reserved product budget for this job (no silent under-report)
    const usage = await provider.reportUsage(discovery.providerRunId, run.budgetReserved);

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

    // Refund reserved units so retries do not double-charge (gate 10)
    await refundResearchBudget(run.tenantId, run.budgetReserved);

    await db
      .update(researchRuns)
      .set({
        status: "failed",
        errorCode: code,
        errorMessage: message.slice(0, 500),
        completedAt: new Date(),
        budgetActual: 0,
      })
      .where(eq(researchRuns.id, run.id));

    if (run.accountId) {
      await db
        .update(accounts)
        .set({ researchState: "failed", updatedAt: new Date() })
        .where(eq(accounts.id, run.accountId));
    }

    throw err;
  }
}
