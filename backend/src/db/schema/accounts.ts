import {
  pgTable,
  text,
  timestamp,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants, workspaces } from "./identity.js";

export const accountResearchStates = [
  "unresearched",
  "researching",
  "researched",
  "failed",
] as const;
export type AccountResearchState = (typeof accountResearchStates)[number];

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    name: text("name").notNull(),
    domain: text("domain"),
    country: text("country"),
    legalName: text("legal_name"),
    researchState: text("research_state")
      .notNull()
      .$type<AccountResearchState>()
      .default("unresearched"),
    fitScore: integer("fit_score"),
    acceptanceState: text("acceptance_state")
      .notNull()
      .default("draft"),
    ownerUserId: text("owner_user_id"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("accounts_workspace_idx").on(t.workspaceId),
    index("accounts_tenant_idx").on(t.tenantId),
    index("accounts_domain_idx").on(t.workspaceId, t.domain),
  ],
);

export const accountIdentities = pgTable(
  "account_identities",
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
    kind: text("kind").notNull(),
    value: text("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("account_identities_account_idx").on(t.accountId),
    uniqueIndex("account_identities_ws_kind_val_uidx").on(t.workspaceId, t.kind, t.value),
  ],
);

export const mergeCandidates = pgTable(
  "merge_candidates",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    accountIdA: text("account_id_a")
      .notNull()
      .references(() => accounts.id),
    accountIdB: text("account_id_b")
      .notNull()
      .references(() => accounts.id),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("merge_candidates_workspace_idx").on(t.workspaceId)],
);

export const importJobs = pgTable(
  "import_jobs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    status: text("status").notNull().default("queued"),
    totalRows: integer("total_rows").notNull().default(0),
    successRows: integer("success_rows").notNull().default(0),
    errorRows: integer("error_rows").notNull().default(0),
    rowErrorsJson: text("row_errors_json"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("import_jobs_workspace_idx").on(t.workspaceId)],
);
