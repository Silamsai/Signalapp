import { pgTable, text, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { tenants, workspaces } from "./identity.js";
import { accounts } from "./accounts.js";

export const researchRuns = pgTable(
  "research_runs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    accountId: text("account_id").references(() => accounts.id),
    status: text("status").notNull().default("queued"),
    query: text("query").notNull(),
    filtersJson: text("filters_json").notNull().default("{}"),
    playbookVersionId: text("playbook_version_id"),
    budgetReserved: integer("budget_reserved").notNull().default(1),
    budgetActual: integer("budget_actual"),
    providerRunId: text("provider_run_id"),
    idempotencyKey: text("idempotency_key"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    progressPct: integer("progress_pct").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("research_runs_workspace_idx").on(t.workspaceId),
    uniqueIndex("research_runs_idempotency_uidx").on(t.workspaceId, t.idempotencyKey),
  ],
);

export const providerUsage = pgTable(
  "provider_usage",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    researchRunId: text("research_run_id").references(() => researchRuns.id),
    provider: text("provider").notNull(),
    requestRef: text("request_ref"),
    units: integer("units").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("provider_usage_tenant_idx").on(t.tenantId)],
);

export const sources = pgTable(
  "sources",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    canonicalUrl: text("canonical_url").notNull(),
    publisher: text("publisher"),
    title: text("title"),
    contentFingerprint: text("content_fingerprint"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sources_ws_url_uidx").on(t.workspaceId, t.canonicalUrl),
  ],
);

export const evidence = pgTable(
  "evidence",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id),
    researchRunId: text("research_run_id").references(() => researchRuns.id),
    excerpt: text("excerpt"),
    eventDate: timestamp("event_date", { withTimezone: true }),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
    matchRationale: text("match_rationale"),
    extractionVersion: text("extraction_version").notNull().default("1"),
    providerRequestRef: text("provider_request_ref"),
    stale: integer("stale").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("evidence_account_idx").on(t.accountId),
    index("evidence_workspace_idx").on(t.workspaceId),
  ],
);

export const signals = pgTable(
  "signals",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    evidenceId: text("evidence_id").references(() => evidence.id),
    kind: text("kind").notNull(),
    observedFact: text("observed_fact"),
    hypothesis: text("hypothesis"),
    unknownNote: text("unknown_note"),
    fitComponent: integer("fit_component"),
    recencyComponent: integer("recency_component"),
    qualityComponent: integer("quality_component"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("signals_account_idx").on(t.accountId)],
);
