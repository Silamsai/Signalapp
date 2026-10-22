import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  qualificationFacts,
  qualifications,
  accounts,
  type FactBasis,
} from "../db/schema/index.js";
import { conflict, validationError } from "../utils/errors.js";
import { newId } from "../utils/ids.js";

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
    .where(eq(qualifications.accountId, accountId))
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
      ),
    )
    .limit(1);
  if (!account) throw validationError("Account not found");

  let materialChange = Boolean(input.rationale && input.rationale !== qual.rationale);

  if (input.facts) {
    for (const fact of input.facts) {
      if (!FIELD_KEYS.includes(fact.fieldKey as (typeof FIELD_KEYS)[number])) {
        throw validationError(`Unknown field: ${fact.fieldKey}`);
      }
      if (
        (fact.basis === "source_observed" || fact.basis === "prospect_confirmed") &&
        !(fact.evidenceIds?.length || fact.confirmationNote)
      ) {
        throw validationError(
          `${fact.basis} requires evidence references or confirmation note`,
        );
      }
      if (fact.basis === "prospect_confirmed" && !fact.confirmationNote) {
        throw validationError("Prospect-confirmed requires who said what and when");
      }

      const old = await db
        .select()
        .from(qualificationFacts)
        .where(
          and(
            eq(qualificationFacts.qualificationId, qual.id),
            eq(qualificationFacts.fieldKey, fact.fieldKey),
          ),
        )
        .limit(1);

      const current = old.find((f) => !f.supersededBy) ?? old[0];
      if (
        MATERIAL_FIELDS.has(fact.fieldKey) &&
        normalizeFactValue(current?.value) !== normalizeFactValue(fact.value)
      ) {
        materialChange = true;
      }
      if (fact.basis === "unknown") {
        materialChange = true;
      }

      const factId = newId("qf");
      await db.insert(qualificationFacts).values({
        id: factId,
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        qualificationId: qual.id,
        fieldKey: fact.fieldKey,
        value: fact.value ?? null,
        basis: fact.basis,
        evidenceIdsJson: JSON.stringify(fact.evidenceIds ?? []),
        confirmationNote: fact.confirmationNote,
        confirmerUserId: fact.confirmerUserId,
        confirmedAt: fact.basis === "prospect_confirmed" ? new Date() : null,
        supersededBy: null,
      });
      if (old[0]) {
        await db
          .update(qualificationFacts)
          .set({ supersededBy: factId })
          .where(eq(qualificationFacts.id, old[0].id));
      }
    }
  }

  const newVersion = qual.version + 1;
  await db
    .update(qualifications)
    .set({
      version: newVersion,
      rationale: input.rationale ?? qual.rationale,
      updatedAt: new Date(),
    })
    .where(and(eq(qualifications.id, qual.id), eq(qualifications.version, qual.version)));

  // Material change after acceptance → invalidate approval (require re-review)
  // Also bump account.version so concurrent accept cannot silently overwrite.
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
  }

  return { version: newVersion, reopenedForReview: account.acceptanceState === "accepted" && materialChange };
}

export { FIELD_KEYS, MATERIAL_FIELDS };
