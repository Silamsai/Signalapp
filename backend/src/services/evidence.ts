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

    await db.insert(signals).values({
      id: newId("sig"),
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      accountId: input.accountId,
      evidenceId,
      kind: item.signalKind ?? "infrastructure",
      observedFact: item.excerpt,
      hypothesis: null,
      unknownNote: item.eventDate ? null : "event_date_unknown",
      fitComponent: score.fit,
      recencyComponent: score.recency,
      qualityComponent: score.quality,
    });
  }

  return { fitScore: bestScore, explanations };
}
