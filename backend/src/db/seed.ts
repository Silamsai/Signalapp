import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { getEnv } from "../config/env.js";
import { getDb } from "./client.js";
import {
  entitlements,
  memberships,
  offers,
  playbookVersions,
  tenants,
  users,
  workspaces,
} from "./schema/index.js";
import { hashPassword } from "../auth/password.js";
import { newId } from "../utils/ids.js";

/**
 * Bootstraps a tenant, its first workspace and its first tenant admin.
 * No credentials live in code: the admin comes from environment variables
 * passed when running the seed, and every other user is added in
 * Settings → Members, so their details exist only in the database.
 *
 *   SEED_ADMIN_EMAIL=you@company.com SEED_ADMIN_PASSWORD='a long password' npm run db:seed
 *
 * Optional: SEED_ADMIN_NAME, SEED_TENANT_NAME, SEED_WORKSPACE_NAME.
 */

/** Versioned playbook templates (R1). */
const PLAYBOOKS = [
  {
    name: "Infrastructure signals",
    templateKey: "infrastructure",
    rules: { signals: ["expansion", "infra_hiring", "refresh", "compute", "procurement"] },
  },
  {
    name: "Recruitment signals",
    templateKey: "recruitment",
    rules: { signals: ["infra_hiring", "expansion"] },
  },
  {
    name: "Managed IT signals",
    templateKey: "managed_it",
    rules: { signals: ["refresh", "expansion", "procurement"] },
  },
];

function readSeedInput() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("Set SEED_ADMIN_EMAIL to the first admin's email address");
  }
  if (password.length < 12) {
    throw new Error("Set SEED_ADMIN_PASSWORD to a password of at least 12 characters");
  }
  return {
    email,
    password,
    name: process.env.SEED_ADMIN_NAME?.trim() || email.split("@")[0]!,
    tenantName: process.env.SEED_TENANT_NAME?.trim() || "My Company",
    workspaceName: process.env.SEED_WORKSPACE_NAME?.trim() || "Default Workspace",
  };
}

async function seed() {
  getEnv();
  const input = readSeedInput();
  const db = getDb();

  const [existing] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  let tenantId: string;
  let workspaceId: string;

  if (existing) {
    const [mem] = await db.select().from(memberships).where(eq(memberships.userId, existing.id)).limit(1);
    if (!mem) throw new Error(`${input.email} exists without a workspace membership — fix it in the database`);
    tenantId = mem.tenantId;
    workspaceId = mem.workspaceId;
    console.log(`${input.email} already exists — leaving the account and password unchanged`);
  } else {
    tenantId = newId("ten");
    workspaceId = newId("ws");
    await db.insert(tenants).values({ id: tenantId, name: input.tenantName });
    await db.insert(workspaces).values({ id: workspaceId, tenantId, name: input.workspaceName });
    const userId = newId("usr");
    await db.insert(users).values({
      id: userId,
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
    });
    await db.insert(memberships).values({ id: newId("mem"), tenantId, workspaceId, userId, role: "tenant_admin" });
    await db.insert(offers).values({ id: newId("ofr"), tenantId, workspaceId, offering: "Infrastructure servers and managed IT" });
    console.log(`Created tenant "${input.tenantName}", workspace "${input.workspaceName}" and admin ${input.email}`);
  }

  const existingPlaybooks = await db
    .select()
    .from(playbookVersions)
    .where(eq(playbookVersions.workspaceId, workspaceId));
  for (const p of PLAYBOOKS) {
    if (existingPlaybooks.some((e) => e.templateKey === p.templateKey)) continue;
    await db.insert(playbookVersions).values({
      id: newId("pbk"),
      tenantId,
      workspaceId,
      name: p.name,
      templateKey: p.templateKey,
      version: 1,
      rulesJson: JSON.stringify(p.rules),
    });
  }

  const [ent] = await db
    .select()
    .from(entitlements)
    .where(and(eq(entitlements.workspaceId, workspaceId), eq(entitlements.tenantId, tenantId)))
    .limit(1);
  if (!ent) await db.insert(entitlements).values({ id: newId("ent"), tenantId, workspaceId });

  console.log("Sign in with that email, then add other people under Settings → Members.");
}

seed().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
