import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  accounts,
  evidence,
  handoffAccess,
  handoffs,
  qualifications,
  qualificationFacts,
  sources,
} from "../db/schema/index.js";
import { validationError, conflict, forbidden, notFound } from "../utils/errors.js";
import { newId } from "../utils/ids.js";
import { writeAudit } from "./audit.js";
import { isSuppressed } from "./suppressions.js";

const ACCOUNT_FIELD_KEYS = [
  "name",
  "domain",
  "country",
  "legalName",
  "fitScore",
  "acceptanceState",
  "researchState",
] as const;

export async function createHandoff(input: {
  tenantId: string;
  workspaceId: string;
  accountId: string;
  receivingOrg: string;
  receivingUser?: string;
  internalOwnerUserId: string;
  permittedFields: string[];
  reason: string;
  nextAction?: string;
  dueAt?: string;
  createdBy: string;
}) {
  const db = getDb();
  const [account] = await db
    .select()
    .from(accounts)
    .where(
      and(eq(accounts.id, input.accountId), eq(accounts.workspaceId, input.workspaceId)),
    )
    .limit(1);
  if (!account) throw validationError("Account not found");
  if (account.acceptanceState !== "accepted") {
    throw validationError("Handoff requires an accepted account");
  }
  if (await isSuppressed(input.workspaceId, account.domain)) {
    throw validationError("Account is suppressed");
  }

  const id = newId("hnd");
  await db.insert(handoffs).values({
    id,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    accountId: input.accountId,
    receivingOrg: input.receivingOrg,
    receivingUser: input.receivingUser,
    internalOwnerUserId: input.internalOwnerUserId,
    permittedFieldsJson: JSON.stringify(input.permittedFields),
    reason: input.reason,
    nextAction: input.nextAction,
    dueAt: input.dueAt ? new Date(input.dueAt) : null,
    state: "prepared",
    createdBy: input.createdBy,
  });

  await writeAudit({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    actorUserId: input.createdBy,
    action: "handoff.prepared",
    entityType: "handoff",
    entityId: id,
  });

  // Recording does NOT grant access or send notifications
  const [row] = await db.select().from(handoffs).where(eq(handoffs.id, id)).limit(1);
  return row!;
}

export async function shareHandoff(input: {
  tenantId: string;
  workspaceId: string;
  handoffId: string;
  granteeEmail: string;
  actorUserId: string;
}) {
  const db = getDb();
  const [h] = await db
    .select()
    .from(handoffs)
    .where(and(eq(handoffs.id, input.handoffId), eq(handoffs.workspaceId, input.workspaceId)))
    .limit(1);
  if (!h) throw validationError("Handoff not found");
  if (h.state !== "prepared" && h.state !== "shared") {
    throw conflict(`Cannot share handoff in state ${h.state}`);
  }

  await db.insert(handoffAccess).values({
    id: newId("hna"),
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    handoffId: h.id,
    granteeEmail: input.granteeEmail.toLowerCase(),
    fieldsJson: h.permittedFieldsJson,
  });

  await db
    .update(handoffs)
    .set({ state: "shared", sharedAt: new Date() })
    .where(eq(handoffs.id, h.id));

  await writeAudit({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    action: "handoff.shared",
    entityType: "handoff",
    entityId: h.id,
    metadata: { granteeEmail: input.granteeEmail },
  });

  const [updated] = await db.select().from(handoffs).where(eq(handoffs.id, h.id)).limit(1);

  const { createNotification } = await import("./notifications.js");
  await createNotification({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    userId: h.internalOwnerUserId,
    kind: "handoff.shared",
    title: "Handoff shared",
    body: `Shared with ${input.granteeEmail}`,
    entityType: "handoff",
    entityId: h.id,
  });

  return updated!;
}

export async function revokeHandoffAccess(input: {
  tenantId: string;
  workspaceId: string;
  handoffId: string;
  granteeEmail: string;
  actorUserId: string;
}) {
  const db = getDb();
  const email = input.granteeEmail.toLowerCase();
  const rows = await db
    .select()
    .from(handoffAccess)
    .where(
      and(
        eq(handoffAccess.handoffId, input.handoffId),
        eq(handoffAccess.workspaceId, input.workspaceId),
        eq(handoffAccess.granteeEmail, email),
        isNull(handoffAccess.revokedAt),
      ),
    );
  for (const row of rows) {
    await db
      .update(handoffAccess)
      .set({ revokedAt: new Date() })
      .where(eq(handoffAccess.id, row.id));
  }
  await writeAudit({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    action: "handoff.access_revoked",
    entityType: "handoff",
    entityId: input.handoffId,
    metadata: { granteeEmail: email },
  });
  return { revoked: rows.length };
}

/**
 * Partner-facing view: only after share, and only permitted fields (gate 9).
 */
export async function getPartnerHandoffView(input: {
  workspaceId: string;
  handoffId: string;
  actorEmail: string;
  isWorkspaceMember: boolean;
  role: string;
}) {
  const db = getDb();
  const [h] = await db
    .select()
    .from(handoffs)
    .where(and(eq(handoffs.id, input.handoffId), eq(handoffs.workspaceId, input.workspaceId)))
    .limit(1);
  if (!h) throw notFound("Handoff not found");

  if (h.state === "prepared") {
    if (!input.isWorkspaceMember || input.role === "partner") {
      throw forbidden("Handoff has not been shared");
    }
    // Internal members may see prepared handoffs in full list; partner view still blocked
    throw forbidden("Handoff remains unshared until authorized");
  }

  const email = input.actorEmail.toLowerCase();
  const [access] = await db
    .select()
    .from(handoffAccess)
    .where(
      and(
        eq(handoffAccess.handoffId, h.id),
        eq(handoffAccess.granteeEmail, email),
        isNull(handoffAccess.revokedAt),
      ),
    )
    .limit(1);

  const isPartnerRole = input.role === "partner";
  if (isPartnerRole && !access) {
    throw forbidden("No handoff access for this user");
  }
  if (!input.isWorkspaceMember && !access) {
    throw forbidden("No handoff access");
  }

  const permitted: string[] = JSON.parse(
    access?.fieldsJson ?? h.permittedFieldsJson ?? "[]",
  ) as string[];

  const [account] = await db.select().from(accounts).where(eq(accounts.id, h.accountId)).limit(1);
  if (!account) throw notFound("Account not found");

  const accountView: Record<string, unknown> = {};
  for (const key of ACCOUNT_FIELD_KEYS) {
    if (permitted.includes(key) || permitted.includes("*")) {
      accountView[key] = account[key];
    }
  }

  let facts: Array<{ fieldKey: string; value: string | null; basis: string }> = [];
  if (permitted.includes("qualification") || permitted.includes("*") || permitted.some((p) => p.startsWith("fact:"))) {
    const [qual] = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.accountId, h.accountId))
      .limit(1);
    if (qual) {
      const allFacts = await db
        .select()
        .from(qualificationFacts)
        .where(eq(qualificationFacts.qualificationId, qual.id));
      facts = allFacts
        .filter((f) => !f.supersededBy)
        .filter(
          (f) =>
            permitted.includes("*") ||
            permitted.includes("qualification") ||
            permitted.includes(`fact:${f.fieldKey}`),
        )
        .map((f) => ({ fieldKey: f.fieldKey, value: f.value, basis: f.basis }));
    }
  }

  let evidenceView: Array<{
    excerpt: string | null;
    sourceUrl: string;
    eventDate: Date | null;
    discoveredAt: Date;
    checkedAt: Date;
  }> = [];
  if (permitted.includes("evidence") || permitted.includes("*")) {
    const ev = await db
      .select({ evidence, source: sources })
      .from(evidence)
      .innerJoin(sources, eq(evidence.sourceId, sources.id))
      .where(eq(evidence.accountId, h.accountId));
    evidenceView = ev.map((e) => ({
      excerpt: e.evidence.excerpt,
      sourceUrl: e.source.canonicalUrl,
      eventDate: e.evidence.eventDate,
      discoveredAt: e.evidence.discoveredAt,
      checkedAt: e.evidence.checkedAt,
    }));
  }

  return {
    handoff: {
      id: h.id,
      state: h.state,
      receivingOrg: h.receivingOrg,
      reason: permitted.includes("reason") || permitted.includes("*") ? h.reason : undefined,
      nextAction: permitted.includes("nextAction") || permitted.includes("*") ? h.nextAction : undefined,
      permittedFields: permitted,
    },
    account: accountView,
    facts,
    evidence: evidenceView,
  };
}

export async function transitionHandoff(input: {
  tenantId: string;
  workspaceId: string;
  handoffId: string;
  toState: "acknowledged" | "returned" | "closed";
  returnReason?: string;
  actorUserId: string;
}) {
  const db = getDb();
  const [h] = await db
    .select()
    .from(handoffs)
    .where(and(eq(handoffs.id, input.handoffId), eq(handoffs.workspaceId, input.workspaceId)))
    .limit(1);
  if (!h) throw validationError("Handoff not found");

  const allowed: Record<string, string[]> = {
    shared: ["acknowledged", "returned"],
    acknowledged: ["closed", "returned"],
    returned: ["closed"],
  };
  if (!allowed[h.state]?.includes(input.toState)) {
    throw conflict(`Cannot move handoff from ${h.state} to ${input.toState}`);
  }
  if (input.toState === "returned" && !input.returnReason?.trim()) {
    throw validationError("Return reason is required");
  }

  await db
    .update(handoffs)
    .set({
      state: input.toState,
      returnReason: input.toState === "returned" ? input.returnReason : h.returnReason,
    })
    .where(eq(handoffs.id, h.id));

  await writeAudit({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    action: `handoff.${input.toState}`,
    entityType: "handoff",
    entityId: h.id,
    metadata: { returnReason: input.returnReason },
  });

  const { createNotification } = await import("./notifications.js");
  await createNotification({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    userId: h.internalOwnerUserId,
    kind: `handoff.${input.toState}`,
    title: `Handoff ${input.toState}`,
    body: input.returnReason,
    entityType: "handoff",
    entityId: h.id,
  });

  const [updated] = await db.select().from(handoffs).where(eq(handoffs.id, h.id)).limit(1);
  return updated!;
}

export async function listHandoffsForAccount(workspaceId: string, accountId: string) {
  const db = getDb();
  return db
    .select()
    .from(handoffs)
    .where(and(eq(handoffs.workspaceId, workspaceId), eq(handoffs.accountId, accountId)));
}
