import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getDb } from "../db/client.js";
import { evidence, sources, signals } from "../db/schema/index.js";
import { newId } from "../utils/ids.js";
import type { NormalizedEvidenceItem } from "../providers/research/types.js";
import { scoreEvidence } from "./scoring.js";

function fingerprint(url: string, excerpt: string): string {
  return createHash("sha256").update(`${url}|${excerpt}`).digest("hex").slice(0, 32);
}

function normalizeFact(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/** Detect contradictory observed facts for the same signal kind on an account. */
async function flagContradictions(
  workspaceId: string,
  accountId: string,
  kind: string,
  observedFact: string,
  newSignalId: string,
) {
  const db = getDb();
  const norm = normalizeFact(observedFact);
  if (!norm) return;

  const existing = await db
    .select()
    .from(signals)
    .where(
      and(
        eq(signals.workspaceId, workspaceId),
        eq(signals.accountId, accountId),
        eq(signals.kind, kind),
      ),
    );

  for (const s of existing) {
    if (s.id === newSignalId || !s.observedFact) continue;
    const other = normalizeFact(s.observedFact);
    if (!other || other === norm) continue;
    // Different non-empty facts for same kind → flag both
    await db
      .update(signals)
      .set({ unknownNote: "contradiction" })
      .where(eq(signals.id, s.id));
    await db
      .update(signals)
      .set({ unknownNote: "contradiction" })
      .where(eq(signals.id, newSignalId));
  }
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
  const explanations: string[] = [];

  // Skip if this run already persisted evidence (retry safety — gate 10)
  const prior = await db
    .select({ id: evidence.id })
    .from(evidence)
    .where(eq(evidence.researchRunId, input.researchRunId))
    .limit(1);
  if (prior[0]) {
    return { fitScore: 0, explanations: ["evidence_already_persisted"], skippedDuplicateRun: true };
  }

  for (const item of input.items) {
    const fp = fingerprint(item.canonicalUrl, item.excerpt ?? "");
    const existing = await db
      .select()
      .from(sources)
      .where(
        and(
          eq(sources.workspaceId, input.workspaceId),
          eq(sources.canonicalUrl, item.canonicalUrl),
        ),
      )
      .limit(1);

    let sourceId = existing[0]?.id;
    if (!sourceId) {
      sourceId = newId("src");
      await db.insert(sources).values({
        id: sourceId,
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        canonicalUrl: item.canonicalUrl,
        publisher: item.publisher,
        title: item.title,
        contentFingerprint: fp,
      });
    } else if (existing[0]?.contentFingerprint === fp) {
      // Deduplicated syndicated/repeated evidence
      continue;
    } else {
      await db
        .update(sources)
        .set({ contentFingerprint: fp, title: item.title ?? existing[0]?.title })
        .where(eq(sources.id, sourceId));
    }

    const evidenceId = newId("ev");
    const now = new Date();
    await db.insert(evidence).values({
      id: evidenceId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      accountId: input.accountId,
      sourceId,
      researchRunId: input.researchRunId,
      excerpt: item.excerpt,
      eventDate: item.eventDate ? new Date(item.eventDate) : null,
      discoveredAt: now,
      checkedAt: now,
      matchRationale: item.matchRationale,
      extractionVersion: "1",
      providerRequestRef: item.providerRequestRef,
    });

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

    const kind = item.signalKind ?? "infrastructure";
    const signalId = newId("sig");
    const unknownNote = item.eventDate ? null : "event_date_unknown";
    await db.insert(signals).values({
      id: signalId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      accountId: input.accountId,
      evidenceId,
      kind,
      observedFact: item.excerpt,
      hypothesis: null,
      unknownNote,
      fitComponent: score.fit,
      recencyComponent: score.recency,
      qualityComponent: score.quality,
    });

    if (item.excerpt) {
      await flagContradictions(
        input.workspaceId,
        input.accountId,
        kind,
        item.excerpt,
        signalId,
      );
    }
  }

  return { fitScore: bestScore, explanations, skippedDuplicateRun: false };
}

export async function listOpenContradictionFlags(accountId: string) {
  const db = getDb();
  return db
    .select()
    .from(signals)
    .where(and(eq(signals.accountId, accountId), eq(signals.unknownNote, "contradiction")));
}
