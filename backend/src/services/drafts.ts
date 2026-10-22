import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { drafts, evidence, offers } from "../db/schema/index.js";
import { newId } from "../utils/ids.js";

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
  const evRows = await db
    .select()
    .from(evidence)
    .where(eq(evidence.accountId, input.accountId));
  const [offer] = await db
    .select()
    .from(offers)
    .where(eq(offers.workspaceId, input.workspaceId))
    .limit(1);

  const cited = evRows.slice(0, 5);
  const claims = cited
    .map((e) => (e.excerpt ? `• ${e.excerpt.slice(0, 200)}` : null))
    .filter(Boolean);
  const stale = cited.some((e) => e.stale === 1) ? 1 : 0;

  const body =
    input.bodyEdits ??
    [
      offer?.offering ? `Regarding ${offer.offering}:` : "Draft outreach:",
      "",
      "Cited facts:",
      ...(claims.length ? claims : ["• (no sourced facts yet — do not invent contacts)"]),
      "",
      "Hypotheses are marked separately and require review before send.",
      "",
      "[Phase 1: draft only — no dispatch]",
    ].join("\n");

  const id = newId("dft");
  await db.insert(drafts).values({
    id,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    accountId: input.accountId,
    channel: input.channel ?? "email",
    subject: input.subject ?? "Infrastructure conversation",
    body,
    evidenceIdsJson: JSON.stringify(cited.map((e) => e.id)),
    hypothesesJson: JSON.stringify([]),
    staleWarning: stale,
    authorUserId: input.authorUserId,
  });

  const [row] = await db.select().from(drafts).where(eq(drafts.id, id)).limit(1);
  return row!;
}

export async function listDrafts(workspaceId: string, accountId?: string) {
  const db = getDb();
  const rows = await db.select().from(drafts).where(eq(drafts.workspaceId, workspaceId));
  return accountId ? rows.filter((d) => d.accountId === accountId) : rows;
}

export async function updateDraft(input: {
  workspaceId: string;
  draftId: string;
  subject?: string;
  body?: string;
}) {
  const db = getDb();
  const [d] = await db
    .select()
    .from(drafts)
    .where(and(eq(drafts.id, input.draftId), eq(drafts.workspaceId, input.workspaceId)))
    .limit(1);
  if (!d) return null;
  await db
    .update(drafts)
    .set({
      subject: input.subject ?? d.subject,
      body: input.body ?? d.body,
      version: d.version + 1,
      updatedAt: new Date(),
    })
    .where(eq(drafts.id, d.id));
  const [updated] = await db.select().from(drafts).where(eq(drafts.id, d.id)).limit(1);
  return updated!;
}
