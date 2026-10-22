import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  accounts,
  drafts,
  evidence,
  offers,
  qualificationFacts,
  qualifications,
  sources,
} from "../db/schema/index.js";
import { conflict, notFound, validationError } from "../utils/errors.js";
import { newId } from "../utils/ids.js";
import { evidenceFreshness } from "./evidence.js";
import { writeAudit } from "./audit.js";

/**
 * Reviewable draft from offer context and cited, reviewed facts (R8). Hypotheses
 * are listed separately, unknowns stay unknown, and no contact details are generated.
 * Creating a draft never dispatches anything.
 */
export async function createDraft(input: {
  tenantId: string;
  workspaceId: string;
  accountId: string;
  channel?: string;
  authorUserId: string;
  subject?: string;
  bodyEdits?: string;
}) {
  const db = getDb();
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, input.accountId), eq(accounts.workspaceId, input.workspaceId)))
    .limit(1);
  if (!account) throw notFound("Account not found");
  const [offer] = await db
    .select()
    .from(offers)
    .where(eq(offers.workspaceId, input.workspaceId))
    .limit(1);
  const windowDays = offer?.eventWindowDays ?? 90;

  const evRows = await db
    .select({ evidence, source: sources })
    .from(evidence)
    .innerJoin(sources, eq(evidence.sourceId, sources.id))
    .where(
      and(
        eq(evidence.accountId, input.accountId),
        eq(evidence.workspaceId, input.workspaceId),
        isNotNull(evidence.reviewedAt),
      ),
    )
    .orderBy(desc(evidence.eventDate))
    .limit(5);

  const [qual] = await db
    .select()
    .from(qualifications)
    .where(and(eq(qualifications.accountId, input.accountId), eq(qualifications.workspaceId, input.workspaceId)))
    .limit(1);
  const hypotheses = qual
    ? (
        await db
          .select()
          .from(qualificationFacts)
          .where(
            and(
              eq(qualificationFacts.qualificationId, qual.id),
              isNull(qualificationFacts.supersededBy),
              eq(qualificationFacts.basis, "research_hypothesis"),
            ),
          )
      ).map((f) => `${f.fieldKey.replace(/_/g, " ")}: ${f.value ?? "unknown"}`)
    : [];

  const stale = evRows.some((e) => evidenceFreshness(e.evidence, windowDays) === "stale") ? 1 : 0;
  const claims = evRows.map(
    (e, i) =>
      `[${i + 1}] ${(e.evidence.excerpt ?? e.source.title ?? "").slice(0, 200)} — ${e.source.publisher ?? e.source.canonicalUrl}`,
  );

  const body =
    input.bodyEdits ??
    [
      `Hi {{first_name}},`,
      "",
      offer?.offering
        ? `I'm getting in touch about ${offer.offering} for ${account.name}.`
        : `I'm getting in touch about infrastructure at ${account.name}.`,
      "",
      ...(claims.length
        ? ["What we noticed (sourced):", ...claims]
        : ["(No reviewed evidence yet — add sourced facts before using this draft.)"]),
      "",
      ...(hypotheses.length
        ? ["Hypotheses to confirm (not facts):", ...hypotheses.map((h) => `- ${h}`), ""]
        : []),
      "Would a short conversation be useful?",
    ].join("\n");

  const id = newId("dft");
  await db.insert(drafts).values({
    id,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    accountId: input.accountId,
    channel: input.channel ?? "email",
    subject: input.subject ?? `${account.name} — infrastructure`,
    body,
    evidenceIdsJson: JSON.stringify(evRows.map((e) => e.evidence.id)),
    hypothesesJson: JSON.stringify(hypotheses),
    staleWarning: stale,
    authorUserId: input.authorUserId,
  });

  const [row] = await db.select().from(drafts).where(eq(drafts.id, id)).limit(1);
  return row!;
}

export async function listDrafts(tenantId: string, workspaceId: string, accountIds?: string[], accountId?: string) {
  const db = getDb();
  const rows = await db
    .select({ draft: drafts, accountName: accounts.name })
    .from(drafts)
    .innerJoin(accounts, eq(drafts.accountId, accounts.id))
    .where(and(eq(drafts.workspaceId, workspaceId), eq(drafts.tenantId, tenantId)))
    .orderBy(desc(drafts.updatedAt));
  return rows
    .filter((r) => (accountId ? r.draft.accountId === accountId : true))
    .filter((r) => (accountIds ? accountIds.includes(r.draft.accountId) : true))
    .map((r) => ({ ...r.draft, accountName: r.accountName }));
}

export async function getDraft(tenantId: string, workspaceId: string, draftId: string) {
  const db = getDb();
  const [d] = await db
    .select()
    .from(drafts)
    .where(and(eq(drafts.id, draftId), eq(drafts.workspaceId, workspaceId), eq(drafts.tenantId, tenantId)))
    .limit(1);
  if (!d) throw notFound("Draft not found");
  return d;
}

export async function updateDraft(input: {
  tenantId: string;
  workspaceId: string;
  draftId: string;
  subject?: string;
  body?: string;
  expectedVersion: number;
}) {
  const db = getDb();
  const d = await getDraft(input.tenantId, input.workspaceId, input.draftId);
  // Edits are preserved as the current version; any edit requires fresh review
  const updated = await db
    .update(drafts)
    .set({
      subject: input.subject ?? d.subject,
      body: input.body ?? d.body,
      version: d.version + 1,
      approvedAt: null,
      approvedBy: null,
      updatedAt: new Date(),
    })
    .where(and(eq(drafts.id, d.id), eq(drafts.version, input.expectedVersion)))
    .returning();
  if (!updated[0]) throw conflict("Draft changed by someone else — reload and retry");
  return updated[0];
}

export async function approveDraft(input: {
  tenantId: string;
  workspaceId: string;
  draftId: string;
  expectedVersion: number;
  actorUserId: string;
}) {
  const db = getDb();
  const d = await getDraft(input.tenantId, input.workspaceId, input.draftId);
  if (/\{\{(?!first_name\}\})[^}]+\}\}/.test(d.body)) {
    throw validationError("Resolve template placeholders before approving");
  }
  const updated = await db
    .update(drafts)
    .set({ approvedAt: new Date(), approvedBy: input.actorUserId })
    .where(and(eq(drafts.id, d.id), eq(drafts.version, input.expectedVersion)))
    .returning();
  if (!updated[0]) throw conflict("Draft changed since you reviewed it — reload and retry");
  await writeAudit({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    action: "draft.approved",
    entityType: "draft",
    entityId: d.id,
    metadata: { version: d.version },
  });
  return updated[0];
}
