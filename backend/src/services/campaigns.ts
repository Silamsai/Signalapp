import { and, desc, eq, lte } from "drizzle-orm";
import { createHmac } from "node:crypto";
import { getDb } from "../db/client.js";
import {
  accounts,
  campaignVersions,
  campaigns,
  conversations,
  deliveryEvents,
  enrollments,
  outboundMessages,
  replyEvents,
  sequenceSteps,
  sendingAccounts,
  sendingDomains,
  suppressionEvents,
  suppressions,
} from "../db/schema/index.js";
import { getEnv } from "../config/env.js";
import { getSendingProvider } from "../providers/sending/index.js";
import { conflict, validationError } from "../utils/errors.js";
import { newId } from "../utils/ids.js";
import { writeAudit } from "./audit.js";
import {
  assertSendingAllowed,
  incrementSendUsage,
} from "./entitlements.js";
import { createNotification } from "./notifications.js";

type AudienceItem = { accountId: string; email: string };

export async function listCampaigns(workspaceId: string) {
  const db = getDb();
  return db
    .select()
    .from(campaigns)
    .where(eq(campaigns.workspaceId, workspaceId))
    .orderBy(desc(campaigns.createdAt));
}

export async function createCampaign(input: {
  tenantId: string;
  workspaceId: string;
  name: string;
  objective?: string;
  ownerUserId: string;
}) {
  const db = getDb();
  const id = newId("cmp");
  await db.insert(campaigns).values({
    id,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    name: input.name,
    objective: input.objective,
    ownerUserId: input.ownerUserId,
    state: "draft",
  });
  await writeAudit({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    actorUserId: input.ownerUserId,
    action: "campaign.created",
    entityType: "campaign",
    entityId: id,
  });
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return row!;
}

export async function saveCampaignDraft(input: {
  tenantId: string;
  workspaceId: string;
  campaignId: string;
  subject: string;
  bodyHtml: string;
  audience: AudienceItem[];
  delayHours?: number;
  sendingAccountId?: string;
  actorUserId: string;
}) {
  const db = getDb();
  const [c] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, input.campaignId), eq(campaigns.workspaceId, input.workspaceId)))
    .limit(1);
  if (!c) throw validationError("Campaign not found");
  if (!["draft", "pending_approval"].includes(c.state)) {
    throw conflict("Only draft/pending campaigns can be edited; create a new version after approval");
  }

  const versions = await db
    .select()
    .from(campaignVersions)
    .where(eq(campaignVersions.campaignId, c.id));
  const nextVersion = versions.length + 1;
  const versionId = newId("cmv");

  await db.insert(campaignVersions).values({
    id: versionId,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    campaignId: c.id,
    version: nextVersion,
    subject: input.subject,
    bodyHtml: input.bodyHtml,
    audienceJson: JSON.stringify(input.audience),
    scheduleJson: JSON.stringify({ delayHours: input.delayHours ?? 0 }),
    sendingAccountId: input.sendingAccountId,
  });

  await db.insert(sequenceSteps).values({
    id: newId("sst"),
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    campaignVersionId: versionId,
    stepIndex: 0,
    delayHours: 0,
    subject: input.subject,
    bodyHtml: input.bodyHtml,
  });

  if ((input.delayHours ?? 0) > 0) {
    await db.insert(sequenceSteps).values({
      id: newId("sst"),
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      campaignVersionId: versionId,
      stepIndex: 1,
      delayHours: input.delayHours!,
      subject: `Re: ${input.subject}`,
      bodyHtml: input.bodyHtml,
    });
  }

  await db
    .update(campaigns)
    .set({
      activeVersionId: versionId,
      sendingAccountId: input.sendingAccountId ?? c.sendingAccountId,
      state: "draft",
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, c.id));

  return getCampaignDetail(input.workspaceId, c.id);
}

export async function getCampaignDetail(workspaceId: string, campaignId: string) {
  const db = getDb();
  const [c] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.workspaceId, workspaceId)))
    .limit(1);
  if (!c) throw validationError("Campaign not found");
  const versions = await db
    .select()
    .from(campaignVersions)
    .where(eq(campaignVersions.campaignId, campaignId))
    .orderBy(desc(campaignVersions.version));
  const active = versions.find((v) => v.id === c.activeVersionId) ?? versions[0] ?? null;
  const steps = active
    ? await db
        .select()
        .from(sequenceSteps)
        .where(eq(sequenceSteps.campaignVersionId, active.id))
    : [];
  const enrollmentRows = active
    ? await db
        .select()
        .from(enrollments)
        .where(eq(enrollments.campaignVersionId, active.id))
    : [];
  return { campaign: c, versions, activeVersion: active, steps, enrollments: enrollmentRows };
}

export async function submitForApproval(workspaceId: string, campaignId: string, actorUserId: string) {
  const db = getDb();
  const detail = await getCampaignDetail(workspaceId, campaignId);
  if (!detail.activeVersion) throw validationError("Save a draft version first");
  if (detail.campaign.state !== "draft") throw conflict("Campaign must be draft to submit");
  await db
    .update(campaigns)
    .set({ state: "pending_approval", updatedAt: new Date() })
    .where(eq(campaigns.id, campaignId));
  await writeAudit({
    tenantId: detail.campaign.tenantId,
    workspaceId,
    actorUserId,
    action: "campaign.submitted",
    entityType: "campaign",
    entityId: campaignId,
  });
  return getCampaignDetail(workspaceId, campaignId);
}

export async function approveCampaign(workspaceId: string, campaignId: string, actorUserId: string) {
  const db = getDb();
  const detail = await getCampaignDetail(workspaceId, campaignId);
  if (detail.campaign.state !== "pending_approval") throw conflict("Not pending approval");
  if (!detail.activeVersion) throw validationError("No version");
  await db
    .update(campaignVersions)
    .set({ approvedAt: new Date(), approvedBy: actorUserId })
    .where(eq(campaignVersions.id, detail.activeVersion.id));
  await db
    .update(campaigns)
    .set({ state: "approved", updatedAt: new Date() })
    .where(eq(campaigns.id, campaignId));
  await writeAudit({
    tenantId: detail.campaign.tenantId,
    workspaceId,
    actorUserId,
    action: "campaign.approved",
    entityType: "campaign",
    entityId: campaignId,
  });
  return getCampaignDetail(workspaceId, campaignId);
}

export async function launchCampaign(workspaceId: string, campaignId: string, actorUserId: string) {
  const db = getDb();
  const detail = await getCampaignDetail(workspaceId, campaignId);
  const c = detail.campaign;
  if (c.state !== "approved" && c.state !== "paused") {
    throw conflict("Launch requires approved or paused campaign");
  }
  if (!detail.activeVersion?.approvedAt) throw validationError("Version not approved");
  await assertSendingAllowed(c.tenantId, workspaceId);

  const accountId = c.sendingAccountId || detail.activeVersion.sendingAccountId;
  if (!accountId) throw validationError("Sending account required");
  const [sa] = await db
    .select()
    .from(sendingAccounts)
    .where(and(eq(sendingAccounts.id, accountId), eq(sendingAccounts.workspaceId, workspaceId)))
    .limit(1);
  if (!sa?.enabled || sa.connectionState !== "connected") {
    throw validationError("Sending account must be enabled and connected");
  }

  const audience = JSON.parse(detail.activeVersion.audienceJson) as AudienceItem[];
  const now = new Date();
  for (const item of audience) {
    const email = item.email.trim().toLowerCase();
    if (!email) continue;
    if (await isSuppressed(workspaceId, email)) continue;

    if (c.requireAccepted) {
      const [acct] = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, item.accountId), eq(accounts.workspaceId, workspaceId)))
        .limit(1);
      if (!acct || acct.acceptanceState !== "accepted") continue;
    }

    try {
      await db.insert(enrollments).values({
        id: newId("enr"),
        tenantId: c.tenantId,
        workspaceId,
        campaignId: c.id,
        campaignVersionId: detail.activeVersion.id,
        accountId: item.accountId,
        email,
        status: "active",
        nextStepIndex: 0,
        nextSendAt: now,
      });
    } catch {
      // duplicate enrollment for this version — skip
    }
  }

  await db
    .update(campaigns)
    .set({ state: "running", updatedAt: new Date() })
    .where(eq(campaigns.id, campaignId));

  await writeAudit({
    tenantId: c.tenantId,
    workspaceId,
    actorUserId,
    action: "campaign.launched",
    entityType: "campaign",
    entityId: campaignId,
  });

  return getCampaignDetail(workspaceId, campaignId);
}

export async function pauseCampaign(workspaceId: string, campaignId: string, actorUserId: string) {
  const db = getDb();
  const detail = await getCampaignDetail(workspaceId, campaignId);
  if (!["running", "scheduled"].includes(detail.campaign.state)) {
    throw conflict("Only running campaigns can be paused");
  }
  await db
    .update(campaigns)
    .set({ state: "paused", updatedAt: new Date() })
    .where(eq(campaigns.id, campaignId));
  await writeAudit({
    tenantId: detail.campaign.tenantId,
    workspaceId,
    actorUserId,
    action: "campaign.paused",
    entityType: "campaign",
    entityId: campaignId,
  });
  return getCampaignDetail(workspaceId, campaignId);
}

async function isSuppressed(workspaceId: string, address: string) {
  const { isSuppressed: shared } = await import("./suppressions.js");
  if (await shared(workspaceId, address)) return true;
  const db = getDb();
  const [s] = await db
    .select()
    .from(suppressionEvents)
    .where(and(eq(suppressionEvents.workspaceId, workspaceId), eq(suppressionEvents.address, address)))
    .limit(1);
  return Boolean(s);
}

export async function processDueEnrollments(limit = 25) {
  const db = getDb();
  const due = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.status, "active"), lte(enrollments.nextSendAt, new Date())))
    .limit(limit);

  const sender = getSendingProvider();
  let processed = 0;

  for (const enr of due) {
    const [camp] = await db.select().from(campaigns).where(eq(campaigns.id, enr.campaignId)).limit(1);
    if (!camp || camp.state !== "running") continue;

    try {
      await assertSendingAllowed(enr.tenantId, enr.workspaceId);
    } catch {
      continue;
    }

    if (await isSuppressed(enr.workspaceId, enr.email)) {
      await db
        .update(enrollments)
        .set({ status: "stopped", stopReason: "suppressed" })
        .where(eq(enrollments.id, enr.id));
      continue;
    }

    const steps = await db
      .select()
      .from(sequenceSteps)
      .where(eq(sequenceSteps.campaignVersionId, enr.campaignVersionId));
    const step = steps.find((s) => s.stepIndex === enr.nextStepIndex);
    if (!step) {
      await db
        .update(enrollments)
        .set({ status: "completed", nextSendAt: null })
        .where(eq(enrollments.id, enr.id));
      continue;
    }

    const [sa] = camp.sendingAccountId
      ? await db
          .select()
          .from(sendingAccounts)
          .where(eq(sendingAccounts.id, camp.sendingAccountId))
          .limit(1)
      : [null];
    if (!sa?.enabled) continue;

    const msgId = newId("omsg");
    const idempotencyKey = `${enr.id}:${step.id}:${enr.campaignVersionId}`;
    try {
      await db.insert(outboundMessages).values({
        id: msgId,
        tenantId: enr.tenantId,
        workspaceId: enr.workspaceId,
        enrollmentId: enr.id,
        stepId: step.id,
        campaignVersionId: enr.campaignVersionId,
        status: "queued",
        subject: step.subject,
        bodyHtml: step.bodyHtml,
      });
    } catch {
      continue; // already sent this step
    }

    const result = await sender.send({
      from: sa.mailbox,
      to: enr.email,
      subject: step.subject,
      bodyHtml: step.bodyHtml,
      idempotencyKey,
    });

    const now = new Date();
    if (result.status === "bounced" || result.status === "failed") {
      await db
        .update(outboundMessages)
        .set({
          status: result.status,
          providerMessageId: result.providerMessageId,
          error: result.detail,
          submittedAt: now,
        })
        .where(eq(outboundMessages.id, msgId));
      await db.insert(deliveryEvents).values({
        id: newId("dev"),
        tenantId: enr.tenantId,
        workspaceId: enr.workspaceId,
        outboundMessageId: msgId,
        kind: result.status,
        detail: result.detail,
      });
      if (result.status === "bounced") {
        await addSuppression(enr.tenantId, enr.workspaceId, enr.email, "bounce", "provider");
        await db
          .update(enrollments)
          .set({ status: "stopped", stopReason: "bounce", nextSendAt: null })
          .where(eq(enrollments.id, enr.id));
      }
    } else {
      await db
        .update(outboundMessages)
        .set({
          status: result.status === "delivery_confirmed" ? "delivery_confirmed" : "submitted",
          providerMessageId: result.providerMessageId,
          submittedAt: now,
          deliveredAt: result.status === "delivery_confirmed" ? now : null,
        })
        .where(eq(outboundMessages.id, msgId));
      await db.insert(deliveryEvents).values({
        id: newId("dev"),
        tenantId: enr.tenantId,
        workspaceId: enr.workspaceId,
        outboundMessageId: msgId,
        kind: result.status,
        detail: result.detail,
      });
      await incrementSendUsage(enr.workspaceId, 1);

      const nextIndex = enr.nextStepIndex + 1;
      const nextStep = steps.find((s) => s.stepIndex === nextIndex);
      if (!nextStep) {
        await db
          .update(enrollments)
          .set({
            status: "completed",
            lastSubmittedAt: now,
            nextStepIndex: nextIndex,
            nextSendAt: null,
          })
          .where(eq(enrollments.id, enr.id));
      } else {
        const nextSendAt = new Date(now.getTime() + nextStep.delayHours * 3600_000);
        await db
          .update(enrollments)
          .set({
            lastSubmittedAt: now,
            nextStepIndex: nextIndex,
            nextSendAt,
          })
          .where(eq(enrollments.id, enr.id));
      }
    }
    processed += 1;
  }

  return { processed };
}

export async function addSuppression(
  tenantId: string,
  workspaceId: string,
  address: string,
  reason: string,
  source: string,
) {
  const db = getDb();
  const addr = address.trim().toLowerCase();
  await db.insert(suppressionEvents).values({
    id: newId("spe"),
    tenantId,
    workspaceId,
    address: addr,
    reason,
    source,
  });
  // also legacy suppressions table
  try {
    await db.insert(suppressions).values({
      id: newId("sup"),
      tenantId,
      workspaceId,
      scope: "contact",
      addressOrDomain: addr,
      reason,
      source,
    });
  } catch {
    /* ignore dup */
  }
}

export async function recordSimulatedReply(input: {
  workspaceId: string;
  enrollmentId: string;
  bodyText: string;
  classification?: string;
  actorUserId: string;
}) {
  const db = getDb();
  const [enr] = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.id, input.enrollmentId), eq(enrollments.workspaceId, input.workspaceId)))
    .limit(1);
  if (!enr) throw validationError("Enrollment not found");

  let [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.enrollmentId, enr.id))
    .limit(1);
  if (!conv) {
    const id = newId("cnv");
    await db.insert(conversations).values({
      id,
      tenantId: enr.tenantId,
      workspaceId: enr.workspaceId,
      enrollmentId: enr.id,
      accountId: enr.accountId,
      contactEmail: enr.email,
      status: "open",
      assignedUserId: input.actorUserId,
    });
    [conv] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  }

  await db.insert(replyEvents).values({
    id: newId("rpl"),
    tenantId: enr.tenantId,
    workspaceId: enr.workspaceId,
    conversationId: conv!.id,
    classification: input.classification ?? "reply",
    bodyText: input.bodyText,
  });

  await db
    .update(enrollments)
    .set({ status: "stopped", stopReason: "reply", nextSendAt: null })
    .where(eq(enrollments.id, enr.id));

  if (input.classification === "unsubscribe") {
    await addSuppression(enr.tenantId, enr.workspaceId, enr.email, "unsubscribe", "reply");
  }

  await createNotification({
    tenantId: enr.tenantId,
    workspaceId: enr.workspaceId,
    userId: input.actorUserId,
    kind: "reply.received",
    title: `Reply from ${enr.email}`,
    body: input.bodyText.slice(0, 200),
    entityType: "conversation",
    entityId: conv!.id,
  });

  return { conversation: conv };
}

export async function listConversations(workspaceId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.workspaceId, workspaceId))
    .orderBy(desc(conversations.updatedAt));
  const withReplies = [];
  for (const c of rows) {
    const replies = await db
      .select()
      .from(replyEvents)
      .where(eq(replyEvents.conversationId, c.id))
      .orderBy(desc(replyEvents.createdAt));
    withReplies.push({ ...c, replies });
  }
  return withReplies;
}

export function unsubscribeToken(workspaceId: string, address: string) {
  const secret = getEnv().AUTH_SECRET;
  return createHmac("sha256", secret).update(`${workspaceId}|${address}`).digest("hex").slice(0, 32);
}

export async function processUnsubscribeToken(workspaceId: string, address: string, token: string) {
  const expected = unsubscribeToken(workspaceId, address);
  if (token !== expected) throw validationError("Invalid unsubscribe token");
  const db = getDb();
  const [camp] = await db.select().from(campaigns).where(eq(campaigns.workspaceId, workspaceId)).limit(1);
  const tenantId = camp?.tenantId;
  if (!tenantId) throw validationError("Workspace not found");
  await addSuppression(tenantId, workspaceId, address, "unsubscribe", "one_click");
  // stop enrollments
  const rows = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.workspaceId, workspaceId), eq(enrollments.email, address.toLowerCase())));
  for (const enr of rows) {
    if (enr.status === "active") {
      await db
        .update(enrollments)
        .set({ status: "stopped", stopReason: "unsubscribe", nextSendAt: null })
        .where(eq(enrollments.id, enr.id));
    }
  }
  return { ok: true };
}

// —— Sending accounts ——
export async function listSendingAccounts(workspaceId: string) {
  const db = getDb();
  const domains = await db
    .select()
    .from(sendingDomains)
    .where(eq(sendingDomains.workspaceId, workspaceId));
  const accountsRows = await db
    .select()
    .from(sendingAccounts)
    .where(eq(sendingAccounts.workspaceId, workspaceId));
  return { domains, accounts: accountsRows };
}

export async function addSendingDomain(input: {
  tenantId: string;
  workspaceId: string;
  domain: string;
}) {
  const db = getDb();
  const id = newId("sdm");
  await db.insert(sendingDomains).values({
    id,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    domain: input.domain.toLowerCase(),
    dnsStatus: "pending",
  });
  const [row] = await db.select().from(sendingDomains).where(eq(sendingDomains.id, id)).limit(1);
  return row!;
}

export async function verifySendingDomain(workspaceId: string, domainId: string) {
  const db = getDb();
  const [d] = await db
    .select()
    .from(sendingDomains)
    .where(and(eq(sendingDomains.id, domainId), eq(sendingDomains.workspaceId, workspaceId)))
    .limit(1);
  if (!d) throw validationError("Domain not found");
  // Simulated DNS verification always succeeds
  await db
    .update(sendingDomains)
    .set({ dnsStatus: "verified", verifiedAt: new Date() })
    .where(eq(sendingDomains.id, domainId));
  const [row] = await db.select().from(sendingDomains).where(eq(sendingDomains.id, domainId)).limit(1);
  return row!;
}

export async function addSendingAccount(input: {
  tenantId: string;
  workspaceId: string;
  domainId: string;
  mailbox: string;
  displayName?: string;
}) {
  const db = getDb();
  const [d] = await db
    .select()
    .from(sendingDomains)
    .where(and(eq(sendingDomains.id, input.domainId), eq(sendingDomains.workspaceId, input.workspaceId)))
    .limit(1);
  if (!d) throw validationError("Domain not found");
  if (d.dnsStatus !== "verified") throw validationError("Verify domain first");
  const id = newId("sac");
  await db.insert(sendingAccounts).values({
    id,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    domainId: input.domainId,
    mailbox: input.mailbox.toLowerCase(),
    displayName: input.displayName,
    provider: "simulated",
    connectionState: "connected",
    enabled: false,
  });
  const [row] = await db.select().from(sendingAccounts).where(eq(sendingAccounts.id, id)).limit(1);
  return row!;
}

export async function enableSendingAccount(workspaceId: string, accountId: string, enabled: boolean) {
  const db = getDb();
  const [sa] = await db
    .select()
    .from(sendingAccounts)
    .where(and(eq(sendingAccounts.id, accountId), eq(sendingAccounts.workspaceId, workspaceId)))
    .limit(1);
  if (!sa) throw validationError("Sending account not found");
  if (enabled && sa.connectionState !== "connected") {
    throw validationError("Connect account before enabling");
  }
  await db
    .update(sendingAccounts)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(sendingAccounts.id, accountId));
  const [row] = await db.select().from(sendingAccounts).where(eq(sendingAccounts.id, accountId)).limit(1);
  return row!;
}

export async function testSend(workspaceId: string, accountId: string, to: string) {
  const db = getDb();
  const [sa] = await db
    .select()
    .from(sendingAccounts)
    .where(and(eq(sendingAccounts.id, accountId), eq(sendingAccounts.workspaceId, workspaceId)))
    .limit(1);
  if (!sa) throw validationError("Sending account not found");
  const sender = getSendingProvider();
  const result = await sender.send({
    from: sa.mailbox,
    to,
    subject: "SignalApp test message",
    bodyHtml: "<p>Simulated test send from SignalApp.</p>",
    idempotencyKey: `test:${accountId}:${Date.now()}`,
  });
  return result;
}
