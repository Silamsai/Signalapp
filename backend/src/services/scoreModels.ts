import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  acceptanceDecisions,
  accounts,
  scoreEvalRuns,
  scoreModelVersions,
} from "../db/schema/index.js";
import { conflict, validationError } from "../utils/errors.js";
import { newId } from "../utils/ids.js";
import { writeAudit } from "./audit.js";

const DEFAULT_RULES = {
  weights: { fit: 0.4, quality: 0.3, freshness: 0.3 },
  minAcceptedScore: 60,
};

export async function listScoreModels(workspaceId: string) {
  const db = getDb();
  const models = await db
    .select()
    .from(scoreModelVersions)
    .where(eq(scoreModelVersions.workspaceId, workspaceId))
    .orderBy(desc(scoreModelVersions.createdAt));
  const withEvals = [];
  for (const m of models) {
    const evals = await db
      .select()
      .from(scoreEvalRuns)
      .where(eq(scoreEvalRuns.modelVersionId, m.id))
      .orderBy(desc(scoreEvalRuns.createdAt))
      .limit(5);
    withEvals.push({ ...m, rules: JSON.parse(m.rulesJson), evals });
  }
  return withEvals;
}

export async function createScoreModel(input: {
  tenantId: string;
  workspaceId: string;
  name: string;
  rules?: Record<string, unknown>;
  notes?: string;
  createdBy: string;
}) {
  const db = getDb();
  const existing = await db
    .select()
    .from(scoreModelVersions)
    .where(eq(scoreModelVersions.workspaceId, input.workspaceId));
  const version = existing.length + 1;
  const id = newId("smv");
  await db.insert(scoreModelVersions).values({
    id,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    name: input.name,
    version,
    status: "candidate",
    rulesJson: JSON.stringify(input.rules ?? DEFAULT_RULES),
    notes: input.notes,
    createdBy: input.createdBy,
  });
  await writeAudit({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    actorUserId: input.createdBy,
    action: "score_model.created",
    entityType: "score_model",
    entityId: id,
  });
  return listScoreModels(input.workspaceId).then((rows) => rows.find((r) => r.id === id)!);
}

export async function evaluateScoreModel(workspaceId: string, modelId: string) {
  const db = getDb();
  const [model] = await db
    .select()
    .from(scoreModelVersions)
    .where(and(eq(scoreModelVersions.id, modelId), eq(scoreModelVersions.workspaceId, workspaceId)))
    .limit(1);
  if (!model) throw validationError("Model not found");

  const accts = await db.select().from(accounts).where(eq(accounts.workspaceId, workspaceId));
  const decisions = await db
    .select()
    .from(acceptanceDecisions)
    .where(eq(acceptanceDecisions.workspaceId, workspaceId));

  const accepted = new Set(
    decisions.filter((d) => d.toState === "accepted").map((d) => d.accountId),
  );
  const decided = new Set(decisions.map((d) => d.accountId));
  const rules = JSON.parse(model.rulesJson) as { minAcceptedScore?: number };
  const threshold = rules.minAcceptedScore ?? 60;

  const heldOut = accts.filter((a) => a.fitScore != null && decided.has(a.id));
  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (const a of heldOut) {
    const predicted = (a.fitScore ?? 0) >= threshold;
    const actual = accepted.has(a.id);
    if (predicted && actual) tp += 1;
    else if (predicted && !actual) fp += 1;
    else if (!predicted && actual) fn += 1;
  }
  const precisionPct = tp + fp === 0 ? null : Math.round((tp / (tp + fp)) * 100);
  const recallPct = tp + fn === 0 ? null : Math.round((tp / (tp + fn)) * 100);

  const evalId = newId("sev");
  await db.insert(scoreEvalRuns).values({
    id: evalId,
    tenantId: model.tenantId,
    workspaceId,
    modelVersionId: model.id,
    heldOutSize: heldOut.length,
    precisionPct,
    recallPct,
    notes: `threshold=${threshold}`,
  });

  const [row] = await db.select().from(scoreEvalRuns).where(eq(scoreEvalRuns.id, evalId)).limit(1);
  return row!;
}

export async function activateScoreModel(
  workspaceId: string,
  modelId: string,
  actorUserId: string,
) {
  const db = getDb();
  const [model] = await db
    .select()
    .from(scoreModelVersions)
    .where(and(eq(scoreModelVersions.id, modelId), eq(scoreModelVersions.workspaceId, workspaceId)))
    .limit(1);
  if (!model) throw validationError("Model not found");
  if (model.status === "active") throw conflict("Already active");

  const evals = await db
    .select()
    .from(scoreEvalRuns)
    .where(eq(scoreEvalRuns.modelVersionId, modelId))
    .limit(1);
  if (!evals[0]) throw validationError("Run evaluation against held-out data before activation");

  const active = await db
    .select()
    .from(scoreModelVersions)
    .where(
      and(eq(scoreModelVersions.workspaceId, workspaceId), eq(scoreModelVersions.status, "active")),
    );
  for (const a of active) {
    await db
      .update(scoreModelVersions)
      .set({ status: "rolled_back" })
      .where(eq(scoreModelVersions.id, a.id));
  }

  await db
    .update(scoreModelVersions)
    .set({ status: "active", activatedAt: new Date() })
    .where(eq(scoreModelVersions.id, modelId));

  await writeAudit({
    tenantId: model.tenantId,
    workspaceId,
    actorUserId,
    action: "score_model.activated",
    entityType: "score_model",
    entityId: modelId,
  });

  return listScoreModels(workspaceId);
}

export async function rollbackScoreModel(
  workspaceId: string,
  modelId: string,
  actorUserId: string,
) {
  const db = getDb();
  const [model] = await db
    .select()
    .from(scoreModelVersions)
    .where(and(eq(scoreModelVersions.id, modelId), eq(scoreModelVersions.workspaceId, workspaceId)))
    .limit(1);
  if (!model) throw validationError("Model not found");
  if (model.status !== "active") throw conflict("Only active models can be rolled back");

  await db
    .update(scoreModelVersions)
    .set({ status: "rolled_back" })
    .where(eq(scoreModelVersions.id, modelId));

  await writeAudit({
    tenantId: model.tenantId,
    workspaceId,
    actorUserId,
    action: "score_model.rolled_back",
    entityType: "score_model",
    entityId: modelId,
  });

  return listScoreModels(workspaceId);
}

export async function getActiveScoreRules(workspaceId: string) {
  const db = getDb();
  const [active] = await db
    .select()
    .from(scoreModelVersions)
    .where(
      and(eq(scoreModelVersions.workspaceId, workspaceId), eq(scoreModelVersions.status, "active")),
    )
    .limit(1);
  if (!active) return DEFAULT_RULES;
  return JSON.parse(active.rulesJson) as typeof DEFAULT_RULES;
}
