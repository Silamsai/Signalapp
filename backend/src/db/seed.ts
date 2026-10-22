import "dotenv/config";
import { eq } from "drizzle-orm";
import { getEnv } from "../config/env.js";
import { getDb } from "./client.js";
import {
  memberships,
  offers,
  playbookVersions,
  tenants,
  users,
  workspaces,
} from "./schema/index.js";
import { hashPassword } from "../auth/password.js";
import { newId } from "../utils/ids.js";

async function seed() {
  getEnv();
  const db = getDb();

  const email = "admin@signal.local";
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) {
    console.log("Seed already applied. Login:", email, "/ password123");
    return;
  }

  const tenantId = newId("ten");
  const workspaceId = newId("ws");
  const userId = newId("usr");

  await db.insert(tenants).values({
    id: tenantId,
    name: "Demo Tenant",
    researchQuotaMonthly: 100,
    researchUsedMonthly: 0,
  });

  await db.insert(workspaces).values({
    id: workspaceId,
    tenantId,
    name: "Default Workspace",
  });

  await db.insert(users).values({
    id: userId,
    email,
    name: "Tenant Admin",
    passwordHash: await hashPassword("password123"),
  });

  await db.insert(memberships).values({
    id: newId("mem"),
    tenantId,
    workspaceId,
    userId,
    role: "tenant_admin",
  });

  await db.insert(offers).values({
    id: newId("ofr"),
    tenantId,
    workspaceId,
    offering: "Infrastructure servers and managed IT",
    buyerRolesJson: JSON.stringify(["CIO", "Infrastructure Manager"]),
    industriesJson: JSON.stringify(["Financial Services", "Healthcare"]),
    companySizesJson: JSON.stringify(["200-1000", "1000+"]),
    territoryJson: JSON.stringify(["UK", "IE"]),
    exclusionsJson: JSON.stringify([]),
    eventWindowDays: 90,
    naturalLanguageBrief: "Find UK firms expanding server capacity or hiring infrastructure roles",
    structuredQueryJson: JSON.stringify({
      offering: "Infrastructure servers and managed IT",
      territory: ["UK", "IE"],
    }),
    unsupportedFiltersJson: JSON.stringify([]),
  });

  await db.insert(playbookVersions).values({
    id: newId("pbk"),
    tenantId,
    workspaceId,
    name: "Infrastructure signals v1",
    templateKey: "infrastructure",
    version: 1,
    rulesJson: JSON.stringify({
      signals: ["expansion", "infra_hiring", "refresh", "compute", "procurement"],
    }),
  });

  console.log("Seeded tenant/workspace/admin");
  console.log("Login:", email, "/ password123");
  console.log("Workspace ID:", workspaceId);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
