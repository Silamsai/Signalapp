import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  acceptanceDecisions,
  accounts,
  evidence,
  qualifications,
  type AcceptanceState,
} from "../db/schema/index.js";
import { conflict, forbidden, validationError } from "../utils/errors.js";
import { newId } from "../utils/ids.js";
import { writeAudit } from "./audit.js";
import type { MembershipRole } from "../db/schema/identity.js";
import { hasCapability } from "../auth/permissions.js";
import { isSuppressed } from "./suppressions.js";

const reviewerTransitions: Record<string, AcceptanceState[]> = {
  ready_for_review: ["accepted", "needs_research", "rejected"],
  accepted: ["ready_for_review"],
  rejected: ["ready_for_review"],
  needs_research: ["ready_for_review"],
  draft: ["ready_for_review"],
};

const researcherSubmitFrom: AcceptanceState[] = ["draft", "needs_research"];

export async function transitionAcceptance(input: {
  tenantId: string;
  workspaceId: string;
  accountId: string;
  toState: AcceptanceState;
  actorUserId: string;
  role: MembershipRole;
  reasonCategory?: string;
  reasonDetail?: string;
  nextAction?: string;
  ownerUserId?: string;
  briefVersion?: string;
  /** Optimistic concurrency — must match account.version (gate 6) */
  expectedVersion?: number;
}) {
  const db = getDb();
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
  if (!account) throw validationError("Account not found");

  if (
    input.expectedVersion !== undefined &&
    account.version !== input.expectedVersion
  ) {
    throw conflict("Account version mismatch — reload and retry", {
      currentVersion: account.version,
      acceptanceState: account.acceptanceState,
    });
  }

  const fromState = account.acceptanceState as AcceptanceState;

  if (researcherSubmitFrom.includes(fromState) && input.toState === "ready_for_review") {
    if (!hasCapability(input.role, "submit_review")) {
      throw forbidden("Cannot submit for review");
    }
    const [qual] = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.accountId, input.accountId))
      .limit(1);
    if (!qual?.rationale) {
      throw validationError("Submitting requires a qualification brief and rationale");
    }
  } else if (input.toState === "accepted") {
    if (!hasCapability(input.role, "accept")) throw forbidden("Not a reviewer");
    if (fromState !== "ready_for_review") {
      throw conflict("Only Ready for review can be accepted");
    }
    const ev = await db
      .select({ id: evidence.id })
      .from(evidence)
      .where(eq(evidence.accountId, input.accountId))
      .limit(1);
    if (!ev[0]) throw validationError("Acceptance requires reviewed evidence");
    if (!input.ownerUserId) throw validationError("Acceptance requires accountable owner");
    if (!input.nextAction) throw validationError("Acceptance requires next action");

    if (await isSuppressed(input.workspaceId, account.domain)) {
      throw validationError("Account domain is suppressed — cannot accept for contact");
    }
  } else if (["needs_research", "rejected"].includes(input.toState)) {
    if (!hasCapability(input.role, "accept")) throw forbidden("Not a reviewer");
    if (!input.reasonCategory) {
      throw validationError("Return/reject requires a reason category");
    }
  } else if (fromState === "accepted" || fromState === "rejected") {
    if (!hasCapability(input.role, "accept")) {
      throw forbidden("Reopening requires reviewer permission");
    }
    if (!input.reasonDetail && !input.reasonCategory) {
      throw validationError("Reopening requires a reason");
    }
  } else {
    const allowed = reviewerTransitions[fromState] ?? [];
    if (!allowed.includes(input.toState)) {
      throw conflict(`Invalid transition ${fromState} → ${input.toState}`);
    }
  }

  const newVersion = account.version + 1;
  const updated = await db
    .update(accounts)
    .set({
      acceptanceState: input.toState,
      ownerUserId: input.ownerUserId ?? account.ownerUserId,
      version: newVersion,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(accounts.id, input.accountId),
        eq(accounts.version, account.version),
        eq(accounts.acceptanceState, fromState),
      ),
    )
    .returning({ id: accounts.id });

  if (!updated[0]) {
    throw conflict("Concurrent acceptance update — reload and retry");
  }

  await db.insert(acceptanceDecisions).values({
    id: newId("acd"),
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    accountId: input.accountId,
    fromState,
    toState: input.toState,
    reasonCategory: input.reasonCategory,
    reasonDetail: input.reasonDetail,
    briefVersion: input.briefVersion,
    nextAction: input.nextAction,
    ownerUserId: input.ownerUserId,
    actorUserId: input.actorUserId,
  });

  await writeAudit({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    action: "acceptance.transition",
    entityType: "account",
    entityId: input.accountId,
    metadata: { fromState, toState: input.toState, version: newVersion },
  });

  return { fromState, toState: input.toState, version: newVersion };
}
