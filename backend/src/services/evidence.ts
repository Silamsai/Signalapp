import { and, eq, isNull } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getDb } from "../db/client.js";
import { evidence, sources, signals } from "../db/schema/index.js";
import { newId } from "../utils/ids.js";
import { canonicalizeUrl } from "../utils/normalize.js";
import { notFound } from "../utils/errors.js";
import type { NormalizedEvidenceItem } from "../providers/research/types.js";
import { scoreEvidence } from "./scoring.js";
import { writeAudit } from "./audit.js";

export const EXTRACTION_VERSION = "2";
/** Re-check policy: evidence not checked for this long is stale regardless of event date */
const RECHECK_DAYS = 30;

function sha(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

function normText(text: string | null | undefined): string {
  return (text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Same article text → same content fingerprint, whatever the URL. */
export function contentFingerprint(excerpt: string | null | undefined): string | null {
  const n = normText(excerpt);
  return n ? sha(n.slice(0, 400)) : null;
}

/** Syndicated copies of one event share title + event day. */
export function eventFingerprint(title: string | undefined, eventDate: string | null | undefined): string | null {
  const t = normText(title);
  if (!t) return null;
  const day = eventDate ? new Date(eventDate).toISOString().slice(0, 10) : "undated";
  return sha(`${t.slice(0, 160)}|${day}`);
}

export type Freshness = "fresh" | "stale" | "date_unknown";

/** Source-specific freshness: event outside the offer window, or not re-checked recently. */
export function evidenceFreshness(
  row: { eventDate: Date | null; checkedAt: Date },
  eventWindowDays: number,
  now = new Date(),
): Freshness {
  const checkedAge = (now.getTime() - row.checkedAt.getTime()) / 86400000;
  if (checkedAge > RECHECK_DAYS) return "stale";
  if (!row.eventDate) return "date_unknown";
  const eventAge = (now.getTime() - row.eventDate.getTime()) / 86400000;
  return eventAge > eventWindowDays ? "stale" : "fresh";
}

export async function persistNormalizedEvidence(input: {
  tenantId: string;
  workspaceId: string;
  accountId: string;
  researchRunId: string;
  items: NormalizedEvidenceItem[];
}) {
  const db = getDb();
  let bestScore = 0;
  let created = 0;
  let duplicates = 0;
  const explanations: string[] = [];

  // Idempotent per item: a resumed run re-sees its own sources as duplicates (gate 10)
  const existingForAccount = await db
    .select({
      id: evidence.id,
      sourceId: evidence.sourceId,
      eventFingerprint: evidence.eventFingerprint,
      contentFp: sources.contentFingerprint,
    })
    .from(evidence)
    .innerJoin(sources, eq(evidence.sourceId, sources.id))
    .where(and(eq(evidence.accountId, input.accountId), eq(evidence.workspaceId, input.workspaceId)));
  const seenEvents = new Set(existingForAccount.map((e) => e.eventFingerprint).filter(Boolean));
  const seenContent = new Set(existingForAccount.map((e) => e.contentFp).filter(Boolean));

  for (const item of input.items) {
    const canonicalUrl = canonicalizeUrl(item.canonicalUrl);
    const cfp = contentFingerprint(item.excerpt);
    const efp = eventFingerprint(item.title, item.eventDate);

    // Source rows are shared per workspace by canonical URL
    await db
      .insert(sources)
      .values({
        id: newId("src"),
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        canonicalUrl,
        publisher: item.publisher,
        title: item.title,
        contentFingerprint: cfp,
        country: item.country ?? null,
      })
      .onConflictDoNothing();
    const [source] = await db
      .select()
      .from(sources)
      .where(and(eq(sources.workspaceId, input.workspaceId), eq(sources.canonicalUrl, canonicalUrl)))
      .limit(1);
    if (!source) continue;

    // Same URL already cited for this account: refresh its check time, never delete it
    const sameSource = existingForAccount.find((e) => e.sourceId === source.id);
    if (sameSource) {
      await db.update(evidence).set({ checkedAt: new Date() }).where(eq(evidence.id, sameSource.id));
      duplicates++;
      continue;
    }
    // Syndicated/repeated copy of an event or text already cited for this account
    if ((efp && seenEvents.has(efp)) || (cfp && seenContent.has(cfp))) {
      duplicates++;
      continue;
    }

    const evidenceId = newId("ev");
    const now = new Date();
    await db.insert(evidence).values({
      id: evidenceId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      accountId: input.accountId,
      sourceId: source.id,
      researchRunId: input.researchRunId,
      excerpt: item.excerpt,
      eventDate: item.eventDate ? new Date(item.eventDate) : null,
      discoveredAt: now,
      checkedAt: now,
      matchRationale: item.matchRationale,
      extractionVersion: EXTRACTION_VERSION,
      providerRequestRef: item.providerRequestRef,
      eventFingerprint: efp,
    });
    existingForAccount.push({ id: evidenceId, sourceId: source.id, eventFingerprint: efp, contentFp: cfp });
    if (efp) seenEvents.add(efp);
    if (cfp) seenContent.add(cfp);
    created++;

    const days =
      item.eventDate != null
        ? Math.floor((Date.now() - new Date(item.eventDate).getTime()) / 86400000)
        : null;
    const score = scoreEvidence({
      hasEvidence: true,
      daysSinceEvent: days,
      sourceQuality: item.qualityHint ?? 60,
      fitHints: item.fitHint ?? 50,
    });
    bestScore = Math.max(bestScore, score.total);
    explanations.push(...score.explanation);

    await db.insert(signals).values({
      id: newId("sig"),
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      accountId: input.accountId,
      evidenceId,
      kind: item.signalKind ?? "web_signal",
      // Observed text only; hypotheses are written by reviewers, never inferred here
      observedFact: item.excerpt,
      hypothesis: null,
      unknownNote: item.eventDate ? null : "event_date_unknown",
      fitComponent: score.fit,
      recencyComponent: score.recency,
      qualityComponent: score.quality,
    });
  }

  await flagDateContradictions(input.workspaceId, input.accountId);

  return { fitScore: created ? bestScore : null, created, duplicates, explanations };
}

/**
 * Contradiction: sources with the same headline report event dates more than
 * 30 days apart. Both signals are flagged for review rather than resolved.
 */
async function flagDateContradictions(workspaceId: string, accountId: string) {
  const db = getDb();
  const rows = await db
    .select({ signalId: signals.id, title: sources.title, eventDate: evidence.eventDate })
    .from(signals)
    .innerJoin(evidence, eq(signals.evidenceId, evidence.id))
    .innerJoin(sources, eq(evidence.sourceId, sources.id))
    .where(and(eq(signals.workspaceId, workspaceId), eq(signals.accountId, accountId)));
  const byTitle = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = normText(r.title).slice(0, 160);
    if (!key || !r.eventDate) continue;
    byTitle.set(key, [...(byTitle.get(key) ?? []), r]);
  }
  for (const group of byTitle.values()) {
    const times = group.map((g) => g.eventDate!.getTime());
    if (Math.max(...times) - Math.min(...times) > 30 * 86400000) {
      for (const g of group) {
        await db.update(signals).set({ unknownNote: "contradiction" }).where(eq(signals.id, g.signalId));
      }
    }
  }
}

/** Gate 5: a reviewer or researcher marks evidence as reviewed before acceptance. */
export async function markEvidenceReviewed(input: {
  tenantId: string;
  workspaceId: string;
  evidenceId: string;
  actorUserId: string;
  reviewed: boolean;
}) {
  const db = getDb();
  const updated = await db
    .update(evidence)
    .set({
      reviewedAt: input.reviewed ? new Date() : null,
      reviewedBy: input.reviewed ? input.actorUserId : null,
    })
    .where(
      and(
        eq(evidence.id, input.evidenceId),
        eq(evidence.workspaceId, input.workspaceId),
        eq(evidence.tenantId, input.tenantId),
      ),
    )
    .returning();
  if (!updated[0]) throw notFound("Evidence not found");
  await writeAudit({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    action: input.reviewed ? "evidence.reviewed" : "evidence.review_cleared",
    entityType: "evidence",
    entityId: input.evidenceId,
  });
  return updated[0];
}

export async function getEvidenceAccountId(workspaceId: string, evidenceId: string) {
  const db = getDb();
  const [row] = await db
    .select({ accountId: evidence.accountId })
    .from(evidence)
    .where(and(eq(evidence.id, evidenceId), eq(evidence.workspaceId, workspaceId)))
    .limit(1);
  if (!row) throw notFound("Evidence not found");
  return row.accountId;
}

export async function countUnreviewed(accountId: string) {
  const db = getDb();
  const rows = await db
    .select({ id: evidence.id })
    .from(evidence)
    .where(and(eq(evidence.accountId, accountId), isNull(evidence.reviewedAt)));
  return rows.length;
}
