import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  acceptanceDecisions,
  qualificationFacts,
  qualifications,
  accounts,
  evidence,
  type FactBasis,
} from "../db/schema/index.js";
import { conflict, notFound, validationError } from "../utils/errors.js";
import { newId } from "../utils/ids.js";
import { writeAudit } from "./audit.js";

const FIELD_KEYS = [
  "workload_use_case",
  "current_environment",
  "refresh_driver",
  "buying_timeframe",
  "stakeholders",
  "procurement_route",
  "incumbent_partner",
  "indicative_scope",
  "budget_status",
  "location",
  "incumbent_hardware",
  "deployment_model",
] as const;

/** Fields whose change after acceptance is always material (gate 6). */
const MATERIAL_FIELDS = new Set<string>([
  "workload_use_case",
  "buying_timeframe",
  "budget_status",
  "procurement_route",
  "indicative_scope",
  "stakeholders",
  "refresh_driver",
]);

export async function getOrCreateQualification(
  tenantId: string,
  workspaceId: string,
  accountId: string,
) {
  const db = getDb();
  const existing = await db
    .select()
    .from(qualifications)
    .where(
      and(
        eq(qualifications.accountId, accountId),
        eq(qualifications.workspaceId, workspaceId),
        eq(qualifications.tenantId, tenantId),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];
  const id = newId("qual");
  await db.insert(qualifications).values({
    id,
    tenantId,
    workspaceId,
    accountId,
  });
  const [row] = await db.select().from(qualifications).where(eq(qualifications.id, id)).limit(1);
  return row!;
}

/** Current facts plus superseded history (R4: retain superseded values). */
export async function getQualificationFacts(qualificationId: string) {
  const db = getDb();
  const all = await db
    .select()
    .from(qualificationFacts)
    .where(eq(qualificationFacts.qualificationId, qualificationId));
  return {
    current: all.filter((f) => !f.supersededBy),
    history: all.filter((f) => f.supersededBy),
  };
}

function normalizeFactValue(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export async function updateQualification(input: {
  tenantId: string;
  workspaceId: string;
  accountId: string;
  expectedVersion: number;
  rationale?: string;
  facts?: Array<{
    fieldKey: string;
    value?: string | null;
    basis: FactBasis;
    evidenceIds?: string[];
    confirmationNote?: string;
    confirmerUserId?: string;
  }>;
  actorUserId: string;
}) {
  const db = getDb();
  const qual = await getOrCreateQualification(input.tenantId, input.workspaceId, input.accountId);
  if (qual.version !== input.expectedVersion) {
    throw conflict("Qualification version mismatch — reload and retry", {
      currentVersion: qual.version,
    });
  }

  const [account] = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, input.accountId),
        eq(accounts.workspaceId, input.workspaceId),
        eq(accounts.tenantId, input.tenantId),
      ),
    )
    .limit(1);
  if (!account) throw notFound("Account not found");

  // Validate everything before any write
  for (const fact of input.facts ?? []) {
    if (!FIELD_KEYS.includes(fact.fieldKey as (typeof FIELD_KEYS)[number])) {
      throw validationError(`Unknown field: ${fact.fieldKey}`);
    }
    if (fact.basis === "source_observed" && !fact.evidenceIds?.length) {
      throw validationError("Source-observed facts require evidence references");
    }
    if (fact.basis === "prospect_confirmed" && !fact.confirmationNote?.trim()) {
      throw validationError("Prospect-confirmed requires a note of who said what and when");
    }
    if (fact.basis === "unknown" && fact.value?.trim()) {
      throw validationError(`${fact.fieldKey}: an unknown fact cannot carry a value`);
    }
    if (fact.evidenceIds?.length) {
      const owned = await db
        .select({ id: evidence.id })
        .from(evidence)
        .where(
          and(
            inArray(evidence.id, fact.evidenceIds),
            eq(evidence.accountId, input.accountId),
            eq(evidence.workspaceId, input.workspaceId),
          ),
        );
      if (owned.length !== new Set(fact.evidenceIds).size) {
        throw validationError(`${fact.fieldKey}: evidence references must belong to this account`);
      }
    }
  }

  // Claim the new version first: a concurrent save fails here before writing (gate 6)
  const newVersion = qual.version + 1;
  const claimed = await db
    .update(qualifications)
    .set({
      version: newVersion,
      rationale: input.rationale ?? qual.rationale,
      updatedAt: new Date(),
    })
    .where(and(eq(qualifications.id, qual.id), eq(qualifications.version, qual.version)))
    .returning({ id: qualifications.id });
  if (!claimed[0]) {
    throw conflict("Qualification changed concurrently — reload and retry");
  }

  let materialChange = Boolean(input.rationale && input.rationale !== qual.rationale);

  for (const fact of input.facts ?? []) {
    const [current] = await db
      .select()
      .from(qualificationFacts)
      .where(
        and(
          eq(qualificationFacts.qualificationId, qual.id),
          eq(qualificationFacts.fieldKey, fact.fieldKey),
          isNull(qualificationFacts.supersededBy),
        ),
      )
      .limit(1);

    const valueChanged = normalizeFactValue(current?.value) !== normalizeFactValue(fact.value);
    const basisChanged = (current?.basis ?? "unknown") !== fact.basis;
    if (!valueChanged && !basisChanged && !fact.confirmationNote && !fact.evidenceIds?.length) {
      continue;
    }
    if (MATERIAL_FIELDS.has(fact.fieldKey) && (valueChanged || basisChanged)) {
      materialChange = true;
    }

    const factId = newId("qf");
    await db.insert(qualificationFacts).values({
      id: factId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      qualificationId: qual.id,
      fieldKey: fact.fieldKey,
      value: fact.basis === "unknown" ? null : (fact.value ?? null),
      basis: fact.basis,
      evidenceIdsJson: JSON.stringify(fact.evidenceIds ?? []),
      confirmationNote: fact.confirmationNote,
      confirmerUserId: fact.confirmerUserId,
      confirmedAt: fact.basis === "prospect_confirmed" ? new Date() : null,
      supersededBy: null,
    });
    if (current) {
      await db
        .update(qualificationFacts)
        .set({ supersededBy: factId })
        .where(eq(qualificationFacts.id, current.id));
    }
  }

  // Material change after acceptance → invalidate approval and keep decision history
  let reopenedForReview = false;
  if (account.acceptanceState === "accepted" && materialChange) {
    const bumped = await db
      .update(accounts)
      .set({
        acceptanceState: "ready_for_review",
        version: account.version + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(accounts.id, input.accountId), eq(accounts.version, account.version)))
      .returning({ id: accounts.id });
    if (!bumped[0]) {
      throw conflict("Concurrent account update while invalidating acceptance — reload and retry");
    }
    reopenedForReview = true;
    await db.insert(acceptanceDecisions).values({
      id: newId("acd"),
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      accountId: input.accountId,
      fromState: "accepted",
      toState: "ready_for_review",
      reasonCategory: "material_change",
      reasonDetail: "Qualification brief changed materially after acceptance",
      briefVersion: String(newVersion),
      actorUserId: input.actorUserId,
    });
  }

  await writeAudit({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    action: "qualification.updated",
    entityType: "account",
    entityId: input.accountId,
    metadata: { version: newVersion, materialChange, reopenedForReview },
  });

  return { version: newVersion, reopenedForReview };
}

export { FIELD_KEYS, MATERIAL_FIELDS };
