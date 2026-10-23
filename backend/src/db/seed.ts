import "dotenv/config";
import { eq } from "drizzle-orm";
import { getEnv } from "../config/env.js";
import { getDb } from "./client.js";
import { memberships, users } from "./schema/index.js";
import { ensureWorkspaceDefaults, provisionTenant } from "../services/tenants.js";

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

function readSeedInput() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("Set SEED_ADMIN_EMAIL to the first admin's email address");
  }
  if (password.length < 8) {
    throw new Error("Set SEED_ADMIN_PASSWORD to a password of at least 8 characters");
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

  if (existing) {
    const [mem] = await db.select().from(memberships).where(eq(memberships.userId, existing.id)).limit(1);
    if (!mem) throw new Error(`${input.email} exists without a workspace membership — fix it in the database`);
    await ensureWorkspaceDefaults(mem.tenantId, mem.workspaceId);
    console.log(`${input.email} already exists — leaving the account and password unchanged`);
  } else {
    await provisionTenant({
      tenantName: input.tenantName,
      workspaceName: input.workspaceName,
      adminEmail: input.email,
      adminName: input.name,
      adminPassword: input.password,
    });
    console.log(`Created tenant "${input.tenantName}", workspace "${input.workspaceName}" and admin ${input.email}`);
  }

  console.log("Sign in with that email, then add other people under Settings → Members.");
}

seed().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
