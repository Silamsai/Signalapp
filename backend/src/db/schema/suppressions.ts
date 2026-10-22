import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { tenants, workspaces } from "./identity.js";

export const suppressions = pgTable(
  "suppressions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    scope: text("scope").notNull().default("workspace"),
    addressOrDomain: text("address_or_domain").notNull(),
    reason: text("reason").notNull(),
    source: text("source").notNull().default("manual"),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("suppressions_workspace_idx").on(t.workspaceId)],
);
