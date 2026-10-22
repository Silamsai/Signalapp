import { createHash, randomBytes } from "node:crypto";
import { eq, and, gt } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { sessions, users } from "../db/schema/index.js";
import { newId } from "../utils/ids.js";
import { getEnv } from "../config/env.js";

const SESSION_DAYS = 14;
export const SESSION_COOKIE = "signal_session";

function hashToken(token: string): string {
  return createHash("sha256").update(token + getEnv().AUTH_SECRET).digest("hex");
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const db = getDb();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({
    id: newId("ses"),
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });
  return { token, expiresAt };
}

export async function destroySession(token: string): Promise<void> {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function resolveSession(token: string | undefined) {
  if (!token) return null;
  const db = getDb();
  const now = new Date();
  const rows = await db
    .select({
      sessionId: sessions.id,
      userId: users.id,
      email: users.email,
      name: users.name,
      mustChangePassword: users.mustChangePassword,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, now)))
    .limit(1);
  return rows[0] ?? null;
}

export type Actor = NonNullable<Awaited<ReturnType<typeof resolveSession>>>;

/** Sign out every other session of a user (after a password change). */
export async function destroyOtherSessions(userId: string, keepToken?: string) {
  const db = getDb();
  const keep = keepToken ? hashToken(keepToken) : null;
  const rows = await db.select({ id: sessions.id, tokenHash: sessions.tokenHash }).from(sessions).where(eq(sessions.userId, userId));
  for (const r of rows) {
    if (r.tokenHash !== keep) await db.delete(sessions).where(eq(sessions.id, r.id));
  }
}
