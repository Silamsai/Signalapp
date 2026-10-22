import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import {
  accountIdentities,
  accounts,
  mergeCandidates,
  offers,
  providerUsage,
  researchRuns,
} from "../../db/schema/index.js";
import { getResearchProvider } from "../../providers/research/index.js";
import {
  NormalizedProviderError,
  type NormalizedEvidenceItem,
  type ResearchFilters,
  type ResearchMode,
} from "../../providers/research/types.js";
import { reconcileUsage, refundResearchBudget } from "../../services/budget.js";
import { persistNormalizedEvidence } from "../../services/evidence.js";
import { activeSuppressionSet, isSuppressed } from "../../services/suppressions.js";
import { newId } from "../../utils/ids.js";
import { companyNameKey, hostnameOf, normalizeDomain } from "../../utils/normalize.js";
import { redactString } from "../../utils/redact.js";

type FetchedResult = { stage: "fetched"; providerRunId: string; items: NormalizedEvidenceItem[] };

function companyNameFromTitle(title: string | undefined, domain: string): string {
  const first = (title ?? "").split(/\s[|\-–—:]\s/)[0]?.trim();
  if (first && first.length >= 2 && first.length <= 120) return first;
  const label = domain.split(".")[0] ?? domain;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Research job. Usage is charged exactly once per run: the provider usage row is
 * written immediately after the provider call, and a retry that finds it resumes
 * from the stored results instead of calling the provider again (gate 10).
 */
export async function handleResearchRun(
  payload: { researchRunId: string },
  attempt: { retryCount: number; retryLimit: number } = { retryCount: 0, retryLimit: 0 },
) {
  const db = getDb();
  const [run] = await db
    .select()
    .from(researchRuns)
    .where(eq(researchRuns.id, payload.researchRunId))
    .limit(1);
  if (!run) return;
  if (run.status === "completed" || run.status === "cancelled") return;

  const claimed = await db
    .update(researchRuns)
    .set({ status: "running", startedAt: run.startedAt ?? new Date(), progressPct: 10, errorCode: null, errorMessage: null })
    .where(and(eq(researchRuns.id, run.id), inArray(researchRuns.status, ["queued", "retrying", "running"])))
    .returning({ id: researchRuns.id });
  if (!claimed[0]) return;

  const mode = (run.mode as ResearchMode) ?? "account";

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
    let fetched: FetchedResult;
    const [priorUsage] = await db
      .select()
      .from(providerUsage)
      .where(eq(providerUsage.researchRunId, run.id))
      .limit(1);
    const stored = run.resultJson ? (JSON.parse(run.resultJson) as Partial<FetchedResult>) : null;

    if (priorUsage && stored?.stage === "fetched") {
      // Retry after a crash: reuse charged results — no second provider call or charge
      fetched = stored as FetchedResult;
    } else if (priorUsage) {
      throw new NormalizedProviderError(
        "provider_error",
        "Provider results were charged but not stored; review manually",
        false,
      );
    } else {
      const provider = getResearchProvider();
      const filters = JSON.parse(run.filtersJson || "{}") as ResearchFilters;
      const [offer] = await db
        .select()
        .from(offers)
        .where(eq(offers.workspaceId, run.workspaceId))
        .limit(1);
      const offerExclusions = offer ? (JSON.parse(offer.exclusionsJson) as string[]) : [];
      const suppressed = await activeSuppressionSet(run.workspaceId);
      filters.excludeDomains = [
        ...new Set([
          ...(filters.excludeDomains ?? []),
          ...offerExclusions.map((e) => normalizeDomain(e)).filter((d): d is string => Boolean(d)),
          ...[...suppressed].filter((v) => !v.includes("@")),
        ]),
      ];

      await db.update(researchRuns).set({ progressPct: 40 }).where(eq(researchRuns.id, run.id));
      const discovery = await provider.discover(run.query, filters, run.budgetReserved, mode);
      const usage = await provider.reportUsage(discovery, run.budgetReserved);

      fetched = { stage: "fetched", providerRunId: discovery.providerRunId, items: discovery.items };
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
      await db
        .update(researchRuns)
        .set({
          progressPct: 70,
          providerRunId: discovery.providerRunId,
          budgetActual: usage.units,
          resultJson: JSON.stringify(fetched),
        })
        .where(eq(researchRuns.id, run.id));
    }

    let summary: Record<string, unknown>;
    if (mode === "discovery") {
      summary = await createCandidateAccounts(run, fetched.items);
    } else if (run.accountId) {
      const result = await persistNormalizedEvidence({
        tenantId: run.tenantId,
        workspaceId: run.workspaceId,
        accountId: run.accountId,
        researchRunId: run.id,
        items: fetched.items,
      });
      const [acct] = await db.select().from(accounts).where(eq(accounts.id, run.accountId)).limit(1);
      await db
        .update(accounts)
        .set({
          researchState: "researched",
          // Missing evidence cannot inflate (or erase) a score
          fitScore:
            result.fitScore == null ? (acct?.fitScore ?? null) : Math.max(acct?.fitScore ?? 0, result.fitScore),
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, run.accountId));
      summary = {
        evidenceCreated: result.created,
        duplicatesSkipped: result.duplicates,
        // "Nothing found" is recorded as such — never as a negative fact
        noResults: fetched.items.length === 0,
      };
    } else {
      summary = { noResults: fetched.items.length === 0 };
    }

    await db
      .update(researchRuns)
      .set({
        status: "completed",
        progressPct: 100,
        resultJson: JSON.stringify({ stage: "done", ...summary }),
        completedAt: new Date(),
      })
      .where(eq(researchRuns.id, run.id));
  } catch (err) {
    const normalized =
      err instanceof NormalizedProviderError
        ? err
        : new NormalizedProviderError("provider_error", err instanceof Error ? err.message : "Research failed", true);
    const willRetry = normalized.retryable && attempt.retryCount < attempt.retryLimit;
    const [charged] = await db
      .select({ id: providerUsage.id })
      .from(providerUsage)
      .where(eq(providerUsage.researchRunId, run.id))
      .limit(1);

    if (willRetry) {
      // Keep the reservation: the retry is the same run and must stay inside the quota
      await db
        .update(researchRuns)
        .set({
          status: "retrying",
          errorCode: normalized.code,
          errorMessage: redactString(normalized.message).slice(0, 500),
        })
        .where(eq(researchRuns.id, run.id));
      throw err;
    }

    // Final failure: refund only if the provider never charged this run
    if (!charged) await refundResearchBudget(run.tenantId, run.budgetReserved);
    await db
      .update(researchRuns)
      .set({
        status: "failed",
        errorCode: normalized.code,
        errorMessage: redactString(normalized.message).slice(0, 500),
        completedAt: new Date(),
        budgetActual: charged ? run.budgetActual : 0,
      })
      .where(eq(researchRuns.id, run.id));
    if (run.accountId) {
      await db
        .update(accounts)
        .set({ researchState: "failed", updatedAt: new Date() })
        .where(eq(accounts.id, run.accountId));
    }
  }
}

/** Discovery: turn company results into unresearched candidate accounts (R2). */
async function createCandidateAccounts(
  run: typeof researchRuns.$inferSelect,
  items: NormalizedEvidenceItem[],
) {
  const db = getDb();
  const suppressed = await activeSuppressionSet(run.workspaceId);
  const existing = await db
    .select({ id: accounts.id, name: accounts.name, domain: accounts.domain })
    .from(accounts)
    .where(and(eq(accounts.workspaceId, run.workspaceId), eq(accounts.tenantId, run.tenantId)));
  const byDomain = new Map(existing.filter((a) => a.domain).map((a) => [a.domain!, a]));
  const byName = new Map(existing.map((a) => [companyNameKey(a.name), a]));

  const created: string[] = [];
  const alreadyKnown: string[] = [];
  let skippedSuppressed = 0;

  for (const item of items) {
    const domain = normalizeDomain(hostnameOf(item.canonicalUrl));
    if (!domain) continue;
    if (suppressed.has(domain)) {
      skippedSuppressed++;
      continue;
    }
    const known = byDomain.get(domain);
    if (known) {
      alreadyKnown.push(known.id);
      continue;
    }
    const name = companyNameFromTitle(item.title, domain);
    const id = newId("acc");
    await db.insert(accounts).values({
      id,
      tenantId: run.tenantId,
      workspaceId: run.workspaceId,
      name,
      domain,
      country: item.country ?? null,
      source: "discovery",
      // Discovered accounts stay unresearched until a research run completes
      researchState: "unresearched",
      acceptanceState: "draft",
    });
    await db
      .insert(accountIdentities)
      .values({
        id: newId("aid"),
        tenantId: run.tenantId,
        workspaceId: run.workspaceId,
        accountId: id,
        kind: "domain",
        value: domain,
      })
      .onConflictDoNothing();
    const nameDup = byName.get(companyNameKey(name));
    if (nameDup) {
      await db.insert(mergeCandidates).values({
        id: newId("mrg"),
        tenantId: run.tenantId,
        workspaceId: run.workspaceId,
        accountIdA: nameDup.id,
        accountIdB: id,
        reason: `Same company name as "${nameDup.name}" with different domain ${domain}`,
      });
    }
    byDomain.set(domain, { id, name, domain });
    byName.set(companyNameKey(name), { id, name, domain });
    created.push(id);
  }

  return {
    candidateAccountIds: created,
    alreadyKnownAccountIds: alreadyKnown,
    skippedSuppressed,
    noResults: items.length === 0,
  };
}
