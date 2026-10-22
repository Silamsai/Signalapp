import { pgTable, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { tenants, workspaces } from "./identity.js";
import { accounts } from "./accounts.js";

export const factBases = [
  "unknown",
  "research_hypothesis",
  "source_observed",
  "prospect_confirmed",
] as const;
export type FactBasis = (typeof factBases)[number];

export const qualifications = pgTable(
  "qualifications",
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
    version: integer("version").notNull().default(1),
    rationale: text("rationale"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("qualifications_account_idx").on(t.accountId)],
);

export const qualificationFacts = pgTable(
  "qualification_facts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    qualificationId: text("qualification_id")
      .notNull()
      .references(() => qualifications.id),
    fieldKey: text("field_key").notNull(),
    value: text("value"),
    basis: text("basis").notNull().$type<FactBasis>().default("unknown"),
    evidenceIdsJson: text("evidence_ids_json").notNull().default("[]"),
    confirmationNote: text("confirmation_note"),
    confirmerUserId: text("confirmer_user_id"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    supersededBy: text("superseded_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("qualification_facts_qual_idx").on(t.qualificationId)],
);
