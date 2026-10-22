import { integer, pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { tenants, workspaces } from "./identity.js";

export const scoreModelStatuses = ["candidate", "active", "rolled_back"] as const;
export type ScoreModelStatus = (typeof scoreModelStatuses)[number];

export const scoreModelVersions = pgTable(
  "score_model_versions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    name: text("name").notNull(),
    version: integer("version").notNull(),
    status: text("status").notNull().$type<ScoreModelStatus>().default("candidate"),
    rulesJson: text("rules_json").notNull(),
    notes: text("notes"),
    createdBy: text("created_by").notNull(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("score_models_workspace_idx").on(t.workspaceId)],
);

export const scoreEvalRuns = pgTable(
  "score_eval_runs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    modelVersionId: text("model_version_id")
      .notNull()
      .references(() => scoreModelVersions.id),
    heldOutSize: integer("held_out_size").notNull().default(0),
    precisionPct: integer("precision_pct"),
    recallPct: integer("recall_pct"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("score_evals_model_idx").on(t.modelVersionId)],
);
