import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  accounts,
  evidence,
  handoffAccess,
  handoffs,
  memberships,
  qualifications,
  qualificationFacts,
  sources,
  users,
} from "../db/schema/index.js";
import { validationError, conflict, forbidden, notFound } from "../utils/errors.js";
import { newId } from "../utils/ids.js";
import { writeAudit } from "./audit.js";
import { isSuppressed } from "./suppressions.js";
import { isActiveMember } from "../middleware/requireMembership.js";
import { FIELD_KEYS } from "./qualification.js";

const ACCOUNT_FIELD_KEYS = ["name", "domain", "country", "legalName", "fitScore"] as const;

/** Brief fields a reviewer may permit a partner to see (R7). */
export const HANDOFF_FIELDS = [
  ...ACCOUNT_FIELD_KEYS,
  "reason",
  "nextAction",
  "evidence",
  "qualification",
  ...FIELD_KEYS.map((k) => `fact:${k}`),
] as const;

async function loadHandoff(tenantId: string, workspaceId: string, handoffId: string) {
  const db = getDb();
  const [h] = await db
    .select()
    .from(handoffs)
    .where(
      and(eq(handoffs.id, handoffId), eq(handoffs.workspaceId, workspaceId), eq(handoffs.tenantId, tenantId)),
    )
    .limit(1);
  if (!h) throw notFound("Handoff not found");
  return h;
}

export async function createHandoff(input: {
  tenantId: string;
  workspaceId: string;
  accountId: string;
  receivingOrg: string;
  receivingUser?: string;
  internalOwnerUserId: string;
  permittedFields: string[];
  reason: string;
  nextAction: string;
  dueAt: string;
  acknowledgeConflict?: boolean;
  createdBy: string;
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
  if (!account) throw notFound("Account not found");
  if (account.acceptanceState !== "accepted") {
    throw validationError("Handoff requires an accepted account");
  }
  if (await isSuppressed(input.workspaceId, account.domain)) {
    throw validationError("Account is suppressed");
  }
  if (!(await isActiveMember(input.workspaceId, input.internalOwnerUserId))) {
    throw validationError("Accountable internal owner must be an active workspace member");
  }
  const unknownFields = input.permittedFields.filter(
    (f) => !(HANDOFF_FIELDS as readonly string[]).includes(f),
  );
  if (unknownFields.length) throw validationError(`Unknown brief fields: ${unknownFields.join(", ")}`);
  if (!input.permittedFields.length) throw validationError("Select at least one permitted brief field");

  // Existing owner / partner relationship check — conflicts are routed for review (R7)
  const active = await db
    .select()
    .from(handoffs)
    .where(
      and(
        eq(handoffs.accountId, input.accountId),
        inArray(handoffs.state, ["prepared", "shared", "acknowledged"]),
      ),
    );
  const conflicts = [
    ...active.map((h) => `Open handoff to ${h.receivingOrg} (${h.state})`),
    ...(account.ownerUserId && account.ownerUserId !== input.internalOwnerUserId
      ? ["Internal owner differs from the account's accountable owner"]
      : []),
  ];
  if (conflicts.length && !input.acknowledgeConflict) {
    throw conflict("Handoff conflicts need review before preparing", { conflicts });
  }

  const id = newId("hnd");
  await db.insert(handoffs).values({
    id,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    accountId: input.accountId,
    receivingOrg: input.receivingOrg,
    receivingUser: input.receivingUser?.toLowerCase(),
    internalOwnerUserId: input.internalOwnerUserId,
    permittedFieldsJson: JSON.stringify(input.permittedFields),
    reason: input.reason,
    nextAction: input.nextAction,
    dueAt: new Date(input.dueAt),
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
    metadata: { receivingOrg: input.receivingOrg, conflictsAcknowledged: conflicts },
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
  const h = await loadHandoff(input.tenantId, input.workspaceId, input.handoffId);
  if (h.state !== "prepared" && h.state !== "shared") {
    throw conflict(`Cannot share handoff in state ${h.state}`);
  }
  const email = input.granteeEmail.toLowerCase();
  if (h.receivingUser && h.receivingUser !== email) {
    throw validationError(`This handoff is addressed to ${h.receivingUser}`);
  }

  // Recipient must be a named Partner member of this workspace
  const [recipient] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(
      and(
        eq(memberships.workspaceId, input.workspaceId),
        eq(users.email, email),
        isNull(memberships.revokedAt),
      ),
    )
    .limit(1);
  if (!recipient || recipient.role !== "partner") {
    throw validationError("Invite the recipient as a Partner member of this workspace first");
  }

  const [account] = await db.select().from(accounts).where(eq(accounts.id, h.accountId)).limit(1);
  if (await isSuppressed(input.workspaceId, account?.domain)) {
    throw validationError("Account is suppressed — sharing blocked");
  }

  // Idempotent: a retried share does not create a second grant
  const [existing] = await db
    .select({ id: handoffAccess.id })
    .from(handoffAccess)
    .where(
      and(
        eq(handoffAccess.handoffId, h.id),
        eq(handoffAccess.granteeEmail, email),
        isNull(handoffAccess.revokedAt),
      ),
    )
    .limit(1);
  if (!existing) {
    await db.insert(handoffAccess).values({
      id: newId("hna"),
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      handoffId: h.id,
      granteeEmail: email,
      fieldsJson: h.permittedFieldsJson,
    });
    await writeAudit({
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: "handoff.shared",
      entityType: "handoff",
      entityId: h.id,
      metadata: { granteeEmail: email },
    });
  }

  await db
    .update(handoffs)
    .set({ state: "shared", sharedAt: h.sharedAt ?? new Date() })
    .where(eq(handoffs.id, h.id));

  const [updated] = await db.select().from(handoffs).where(eq(handoffs.id, h.id)).limit(1);
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
  await loadHandoff(input.tenantId, input.workspaceId, input.handoffId);
  const email = input.granteeEmail.toLowerCase();
  const revoked = await db
    .update(handoffAccess)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(handoffAccess.handoffId, input.handoffId),
        eq(handoffAccess.workspaceId, input.workspaceId),
        eq(handoffAccess.granteeEmail, email),
        isNull(handoffAccess.revokedAt),
      ),
    )
    .returning({ id: handoffAccess.id });
  await writeAudit({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    action: "handoff.access_revoked",
    entityType: "handoff",
    entityId: input.handoffId,
    metadata: { granteeEmail: email },
  });
  return { revoked: revoked.length };
}

async function activeAccess(handoffId: string, email: string) {
  const db = getDb();
  const [access] = await db
    .select()
    .from(handoffAccess)
    .where(
      and(
        eq(handoffAccess.handoffId, handoffId),
        eq(handoffAccess.granteeEmail, email.toLowerCase()),
        isNull(handoffAccess.revokedAt),
      ),
    )
    .limit(1);
  return access ?? null;
}

/** Partner inbox: only handoffs expressly shared with this user (no tenant-wide search). */
export async function listHandoffsSharedWith(workspaceId: string, email: string) {
  const db = getDb();
  const rows = await db
    .select({ handoff: handoffs, accountName: accounts.name })
    .from(handoffAccess)
    .innerJoin(handoffs, eq(handoffAccess.handoffId, handoffs.id))
    .innerJoin(accounts, eq(handoffs.accountId, accounts.id))
    .where(
      and(
        eq(handoffAccess.workspaceId, workspaceId),
        eq(handoffAccess.granteeEmail, email.toLowerCase()),
        isNull(handoffAccess.revokedAt),
      ),
    )
    .orderBy(desc(handoffs.sharedAt));
  return rows.map((r) => {
    const permitted = JSON.parse(r.handoff.permittedFieldsJson) as string[];
    return {
      id: r.handoff.id,
      state: r.handoff.state,
      receivingOrg: r.handoff.receivingOrg,
      accountName: permitted.includes("name") ? r.accountName : "(name not shared)",
      sharedAt: r.handoff.sharedAt,
      dueAt: r.handoff.dueAt,
    };
  });
}

/**
 * Partner-facing view: only after share, only to an active grantee, and only
 * permitted fields (gate 9). Internal members may preview what the partner sees.
 */
export async function getPartnerHandoffView(input: {
  tenantId: string;
  workspaceId: string;
  handoffId: string;
  actorEmail: string;
  role: string;
}) {
  const db = getDb();
  const h = await loadHandoff(input.tenantId, input.workspaceId, input.handoffId);
  const isPartner = input.role === "partner";

  if (isPartner) {
    if (h.state === "prepared") throw notFound("Handoff not found");
    if (!(await activeAccess(h.id, input.actorEmail))) throw notFound("Handoff not found");
  }

  const permitted = JSON.parse(h.permittedFieldsJson) as string[];

  const [account] = await db.select().from(accounts).where(eq(accounts.id, h.accountId)).limit(1);
  if (!account) throw notFound("Account not found");

  const accountView: Record<string, unknown> = {};
  for (const key of ACCOUNT_FIELD_KEYS) {
    if (permitted.includes(key)) accountView[key] = account[key];
  }

  let facts: Array<{ fieldKey: string; value: string | null; basis: string }> = [];
  if (permitted.includes("qualification") || permitted.some((p) => p.startsWith("fact:"))) {
    const [qual] = await db
      .select()
      .from(qualifications)
      .where(eq(qualifications.accountId, h.accountId))
      .limit(1);
    if (qual) {
      const allFacts = await db
        .select()
        .from(qualificationFacts)
        .where(and(eq(qualificationFacts.qualificationId, qual.id), isNull(qualificationFacts.supersededBy)));
      facts = allFacts
        .filter((f) => permitted.includes("qualification") || permitted.includes(`fact:${f.fieldKey}`))
        .map((f) => ({ fieldKey: f.fieldKey, value: f.value, basis: f.basis }));
    }
  }

  let evidenceView: Array<{
    excerpt: string | null;
    sourceUrl: string;
    sourceTitle: string | null;
    eventDate: Date | null;
    discoveredAt: Date;
    checkedAt: Date;
  }> = [];
  if (permitted.includes("evidence")) {
    // Only reviewed evidence leaves the tenant
    const ev = await db
      .select({ evidence, source: sources })
      .from(evidence)
      .innerJoin(sources, eq(evidence.sourceId, sources.id))
      .where(and(eq(evidence.accountId, h.accountId), isNotNull(evidence.reviewedAt)));
    evidenceView = ev.map((e) => ({
      excerpt: e.evidence.excerpt,
      sourceUrl: e.source.canonicalUrl,
      sourceTitle: e.source.title,
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
      reason: permitted.includes("reason") ? h.reason : undefined,
      nextAction: permitted.includes("nextAction") ? h.nextAction : undefined,
      dueAt: h.dueAt,
      returnReason: h.returnReason,
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
  actorEmail: string;
  role: string;
  canManage: boolean;
}) {
  const db = getDb();
  const h = await loadHandoff(input.tenantId, input.workspaceId, input.handoffId);

  if (input.role === "partner") {
    // Partners act only on handoffs shared with them, and cannot close them
    if (!(await activeAccess(h.id, input.actorEmail))) throw notFound("Handoff not found");
    if (input.toState === "closed") throw forbidden("Only the internal team can close a handoff");
  } else if (!input.canManage) {
    throw forbidden("Missing capability: share_handoff");
  }

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

  const updated = await db
    .update(handoffs)
    .set({
      state: input.toState,
      returnReason: input.toState === "returned" ? input.returnReason : h.returnReason,
    })
    .where(and(eq(handoffs.id, h.id), eq(handoffs.state, h.state)))
    .returning({ id: handoffs.id });
  if (!updated[0]) throw conflict("Handoff changed concurrently — reload and retry");

  // Closing ends partner access; returned handoffs keep internal ownership
  if (input.toState === "closed") {
    await db
      .update(handoffAccess)
      .set({ revokedAt: new Date() })
      .where(and(eq(handoffAccess.handoffId, h.id), isNull(handoffAccess.revokedAt)));
  }

  await writeAudit({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    action: `handoff.${input.toState}`,
    entityType: "handoff",
    entityId: h.id,
    metadata: { returnReason: input.returnReason },
  });

  const [row] = await db.select().from(handoffs).where(eq(handoffs.id, h.id)).limit(1);
  return row!;
}

export async function listHandoffsForAccount(tenantId: string, workspaceId: string, accountId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(handoffs)
    .where(
      and(
        eq(handoffs.workspaceId, workspaceId),
        eq(handoffs.tenantId, tenantId),
        eq(handoffs.accountId, accountId),
      ),
    )
    .orderBy(desc(handoffs.createdAt));
  const grants = rows.length
    ? await db
        .select()
        .from(handoffAccess)
        .where(inArray(handoffAccess.handoffId, rows.map((r) => r.id)))
    : [];
  return rows.map((h) => ({
    ...h,
    permittedFields: JSON.parse(h.permittedFieldsJson) as string[],
    grants: grants
      .filter((g) => g.handoffId === h.id)
      .map((g) => ({ granteeEmail: g.granteeEmail, createdAt: g.createdAt, revokedAt: g.revokedAt })),
  }));
}
