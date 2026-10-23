import "dotenv/config";
import { eq } from "drizzle-orm";
import { getEnv } from "../config/env.js";
import { getDb } from "./client.js";
import { users } from "./schema/index.js";
import { hashPassword } from "../auth/password.js";
import { newId } from "../utils/ids.js";

/**
 * Creates the app owner's platform admin account, or marks an existing user as one.
 * A platform admin belongs to no tenant: they see counts across all companies and can
 * onboard new ones, but never open a tenant's accounts or evidence.
 *
 *   PLATFORM_ADMIN_EMAIL=owner@yourapp.com PLATFORM_ADMIN_PASSWORD='a password' npm run db:seed-platform-admin
 *
 * Optional: PLATFORM_ADMIN_NAME. An existing user's password is left unchanged.
 */
async function seedPlatformAdmin() {
  getEnv();
  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.PLATFORM_ADMIN_PASSWORD ?? "";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("Set PLATFORM_ADMIN_EMAIL to the platform admin's email address");
  }

  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    await db.update(users).set({ isPlatformAdmin: true }).where(eq(users.id, existing.id));
    console.log(`${email} is now a platform admin (password unchanged)`);
    return;
  }

  if (password.length < 8) {
    throw new Error("Set PLATFORM_ADMIN_PASSWORD to a password of at least 8 characters");
  }
  await db.insert(users).values({
    id: newId("usr"),
    email,
    name: process.env.PLATFORM_ADMIN_NAME?.trim() || "Platform Admin",
    passwordHash: await hashPassword(password),
    isPlatformAdmin: true,
  });
  console.log(`Created platform admin ${email}. Sign in and you'll land on /platform.`);
}

seedPlatformAdmin().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
