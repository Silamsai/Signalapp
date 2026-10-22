import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  accountIdentities,
  accounts,
  evidence,
  mergeCandidates,
  signals,
  qualifications,
  qualificationFacts,
} from "../db/schema/index.js";
import { notFound, validationError } from "../utils/errors.js";
import { writeAudit } from "./audit.js";

export async function resolveMergeCandidate(input: {
  tenantId: string;
  workspaceId: string;
  candidateId: string;
  action: "merge" | "keep_separate" | "reject";
  /** When merging, which account survives */
  keepAccountId?: string;
  actorUserId: string;
}) {
  const db = getDb();
  const [cand] = await db
    .select()
    .from(mergeCandidates)
    .where(
      and(
        eq(mergeCandidates.id, input.candidateId),
        eq(mergeCandidates.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);
  if (!cand) throw notFound("Merge candidate not found");
  if (cand.status !== "pending") {
    throw validationError(`Candidate already ${cand.status}`);
  }

  if (input.action === "reject" || input.action === "keep_separate") {
    await db
      .update(mergeCandidates)
      .set({ status: input.action === "reject" ? "rejected" : "kept_separate" })
      .where(eq(mergeCandidates.id, cand.id));
    await writeAudit({
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: `merge.${input.action}`,
      entityType: "merge_candidate",
      entityId: cand.id,
    });
    return { status: input.action === "reject" ? "rejected" : "kept_separate" };
  }

  const keepId = input.keepAccountId ?? cand.accountIdA;
  const dropId = keepId === cand.accountIdA ? cand.accountIdB : cand.accountIdA;
  if (keepId !== cand.accountIdA && keepId !== cand.accountIdB) {
    throw validationError("keepAccountId must be one of the candidate accounts");
  }

  const [keep, drop] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.id, keepId)).limit(1),
    db.select().from(accounts).where(eq(accounts.id, dropId)).limit(1),
  ]);
  if (!keep[0] || !drop[0]) throw notFound("Account not found for merge");

  // Move research artifacts onto survivor
  await db.update(evidence).set({ accountId: keepId }).where(eq(evidence.accountId, dropId));
  await db.update(signals).set({ accountId: keepId }).where(eq(signals.accountId, dropId));

  // Prefer survivor qualification; drop the other
  const dropQual = await db
    .select()
    .from(qualifications)
    .where(eq(qualifications.accountId, dropId))
    .limit(1);
  if (dropQual[0]) {
    await db
      .delete(qualificationFacts)
      .where(eq(qualificationFacts.qualificationId, dropQual[0].id));
    await db.delete(qualifications).where(eq(qualifications.id, dropQual[0].id));
  }

  await db.delete(accountIdentities).where(eq(accountIdentities.accountId, dropId));
  await db.delete(accounts).where(eq(accounts.id, dropId));

  await db
    .update(mergeCandidates)
    .set({ status: "merged" })
    .where(eq(mergeCandidates.id, cand.id));

  // Close other pending candidates involving the dropped account
  const others = await db
    .select()
    .from(mergeCandidates)
    .where(
      and(eq(mergeCandidates.workspaceId, input.workspaceId), eq(mergeCandidates.status, "pending")),
    );
  for (const o of others) {
    if (o.accountIdA === dropId || o.accountIdB === dropId) {
      await db.update(mergeCandidates).set({ status: "superseded" }).where(eq(mergeCandidates.id, o.id));
    }
  }

  await writeAudit({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    action: "merge.merged",
    entityType: "merge_candidate",
    entityId: cand.id,
    metadata: { keepAccountId: keepId, droppedAccountId: dropId },
  });

  return { status: "merged", keepAccountId: keepId, droppedAccountId: dropId };
}
