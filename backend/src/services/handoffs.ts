import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { accounts, handoffAccess, handoffs, suppressions } from "../db/schema/index.js";
import { validationError, conflict } from "../utils/errors.js";
import { newId } from "../utils/ids.js";
import { writeAudit } from "./audit.js";

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
  if (account.domain) {
    const [sup] = await db
      .select()
      .from(suppressions)
      .where(
        and(
          eq(suppressions.workspaceId, input.workspaceId),
          eq(suppressions.addressOrDomain, account.domain),
        ),
      )
      .limit(1);
    if (sup) throw validationError("Account is suppressed");
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
    granteeEmail: input.granteeEmail,
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
  return updated!;
}
