import { boolean, integer, pgTable, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { tenants, workspaces, users } from "./identity.js";
import { accounts } from "./accounts.js";

export const sendingDomains = pgTable(
  "sending_domains",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    domain: text("domain").notNull(),
    dnsStatus: text("dns_status").notNull().default("pending"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sending_domains_workspace_idx").on(t.workspaceId)],
);

export const sendingAccounts = pgTable(
  "sending_accounts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    domainId: text("domain_id")
      .notNull()
      .references(() => sendingDomains.id),
    mailbox: text("mailbox").notNull(),
    displayName: text("display_name"),
    provider: text("provider").notNull().default("simulated"),
    connectionState: text("connection_state").notNull().default("disconnected"),
    timezone: text("timezone").notNull().default("UTC"),
    enabled: boolean("enabled").notNull().default(false),
    dailyLimit: integer("daily_limit").notNull().default(50),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sending_accounts_workspace_idx").on(t.workspaceId)],
);

export const campaignStates = [
  "draft",
  "pending_approval",
  "approved",
  "scheduled",
  "running",
  "paused",
  "cancelled",
  "completed",
] as const;
export type CampaignState = (typeof campaignStates)[number];

export const campaigns = pgTable(
  "campaigns",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    name: text("name").notNull(),
    objective: text("objective"),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id),
    sendingAccountId: text("sending_account_id").references(() => sendingAccounts.id),
    state: text("state").notNull().$type<CampaignState>().default("draft"),
    activeVersionId: text("active_version_id"),
    requireAccepted: boolean("require_accepted").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("campaigns_workspace_idx").on(t.workspaceId)],
);

export const campaignVersions = pgTable(
  "campaign_versions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    version: integer("version").notNull(),
    subject: text("subject").notNull(),
    bodyHtml: text("body_html").notNull(),
    audienceJson: text("audience_json").notNull().default("[]"),
    scheduleJson: text("schedule_json").notNull().default("{}"),
    sendingAccountId: text("sending_account_id"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: text("approved_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("campaign_versions_uidx").on(t.campaignId, t.version),
  ],
);

export const sequenceSteps = pgTable(
  "sequence_steps",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    campaignVersionId: text("campaign_version_id")
      .notNull()
      .references(() => campaignVersions.id),
    stepIndex: integer("step_index").notNull(),
    delayHours: integer("delay_hours").notNull().default(0),
    subject: text("subject").notNull(),
    bodyHtml: text("body_html").notNull(),
  },
  (t) => [index("sequence_steps_version_idx").on(t.campaignVersionId)],
);

export const enrollments = pgTable(
  "enrollments",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    campaignVersionId: text("campaign_version_id")
      .notNull()
      .references(() => campaignVersions.id),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    email: text("email").notNull(),
    status: text("status").notNull().default("active"),
    stopReason: text("stop_reason"),
    nextStepIndex: integer("next_step_index").notNull().default(0),
    nextSendAt: timestamp("next_send_at", { withTimezone: true }),
    lastSubmittedAt: timestamp("last_submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("enrollments_version_email_uidx").on(t.campaignVersionId, t.email),
    index("enrollments_next_send_idx").on(t.nextSendAt),
  ],
);

export const outboundMessages = pgTable(
  "outbound_messages",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => enrollments.id),
    stepId: text("step_id")
      .notNull()
      .references(() => sequenceSteps.id),
    campaignVersionId: text("campaign_version_id").notNull(),
    providerMessageId: text("provider_message_id"),
    status: text("status").notNull().default("queued"),
    subject: text("subject").notNull(),
    bodyHtml: text("body_html").notNull(),
    error: text("error"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("outbound_enroll_step_uidx").on(t.enrollmentId, t.stepId, t.campaignVersionId),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    enrollmentId: text("enrollment_id").references(() => enrollments.id),
    accountId: text("account_id").references(() => accounts.id),
    contactEmail: text("contact_email").notNull(),
    status: text("status").notNull().default("open"),
    assignedUserId: text("assigned_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conversations_workspace_idx").on(t.workspaceId)],
);

export const replyEvents = pgTable(
  "reply_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id),
    providerThreadId: text("provider_thread_id"),
    classification: text("classification").notNull().default("reply"),
    bodyText: text("body_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("reply_events_conversation_idx").on(t.conversationId)],
);

export const suppressionEvents = pgTable(
  "suppression_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    address: text("address").notNull(),
    reason: text("reason").notNull(),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("suppression_events_workspace_idx").on(t.workspaceId, t.address)],
);

export const deliveryEvents = pgTable(
  "delivery_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    outboundMessageId: text("outbound_message_id")
      .notNull()
      .references(() => outboundMessages.id),
    kind: text("kind").notNull(),
    detail: text("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("delivery_events_message_idx").on(t.outboundMessageId)],
);
