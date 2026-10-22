import { pgTable, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { tenants, workspaces } from "./identity.js";
import { accounts } from "./accounts.js";

export const drafts = pgTable(
  "drafts",
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
    channel: text("channel").notNull().default("email"),
    subject: text("subject"),
    body: text("body").notNull().default(""),
    evidenceIdsJson: text("evidence_ids_json").notNull().default("[]"),
    hypothesesJson: text("hypotheses_json").notNull().default("[]"),
    staleWarning: integer("stale_warning").notNull().default(0),
    version: integer("version").notNull().default(1),
    authorUserId: text("author_user_id").notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: text("approved_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("drafts_account_idx").on(t.accountId)],
);
