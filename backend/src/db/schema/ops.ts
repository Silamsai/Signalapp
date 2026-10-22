import { boolean, integer, pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { tenants, workspaces, users } from "./identity.js";
import { accounts } from "./accounts.js";

export const monitorStatuses = ["active", "paused", "killed"] as const;
export type MonitorStatus = (typeof monitorStatuses)[number];

export const monitors = pgTable(
  "monitors",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    accountId: text("account_id").references(() => accounts.id),
    name: text("name").notNull(),
    query: text("query").notNull(),
    cadenceHours: integer("cadence_hours").notNull().default(24),
    status: text("status").notNull().$type<MonitorStatus>().default("active"),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    lastRunStatus: text("last_run_status"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("monitors_workspace_idx").on(t.workspaceId)],
);

export const monitorRunStatuses = [
  "success",
  "no_results",
  "outage",
  "budget_exhausted",
  "failed",
] as const;
export type MonitorRunStatus = (typeof monitorRunStatuses)[number];

export const monitorRuns = pgTable(
  "monitor_runs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    monitorId: text("monitor_id")
      .notNull()
      .references(() => monitors.id),
    status: text("status").notNull().$type<MonitorRunStatus>(),
    resultSummary: text("result_summary"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("monitor_runs_monitor_idx").on(t.monitorId)],
);

export const changeEvents = pgTable(
  "change_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    monitorId: text("monitor_id")
      .notNull()
      .references(() => monitors.id),
    dedupeKey: text("dedupe_key").notNull(),
    title: text("title").notNull(),
    detail: text("detail"),
    material: boolean("material").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("change_events_monitor_idx").on(t.monitorId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.workspaceId)],
);

export const entitlements = pgTable(
  "entitlements",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    researchEnabled: boolean("research_enabled").notNull().default(true),
    sendingEnabled: boolean("sending_enabled").notNull().default(true),
    monitorsEnabled: boolean("monitors_enabled").notNull().default(true),
    researchKillSwitch: boolean("research_kill_switch").notNull().default(false),
    sendingKillSwitch: boolean("sending_kill_switch").notNull().default(false),
    sendQuotaMonthly: integer("send_quota_monthly").notNull().default(500),
    sendUsedMonthly: integer("send_used_monthly").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("entitlements_workspace_idx").on(t.workspaceId)],
);
