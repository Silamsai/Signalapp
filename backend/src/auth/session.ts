import { createHash, randomBytes } from "node:crypto";
import { eq, and, gt } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { sessions, users } from "../db/schema/index.js";
import { newId } from "../utils/ids.js";
import { getEnv } from "../config/env.js";

const SESSION_DAYS = 14;
export const SESSION_COOKIE = "signal_session";

/**
 * Short-lived in-process cache of resolved sessions. Every database round trip
 * costs hundreds of milliseconds, so the API avoids one per request. Entries are
 * dropped immediately on logout, password change/reset and session deletion, and
 * expire after CACHE_TTL_MS so changes made outside this process apply quickly.
 */
const CACHE_TTL_MS = 30_000;
type CachedActor = { actor: Actor; userId: string; cachedAt: number };
const sessionCache = new Map<string, CachedActor>();

function hashToken(token: string): string {
  return createHash("sha256").update(token + getEnv().AUTH_SECRET).digest("hex");
}

/** Forget every cached session of a user (logout everywhere, password change, reset). */
export function forgetUserSessions(userId: string) {
  for (const [key, entry] of sessionCache) {
    if (entry.userId === userId) sessionCache.delete(key);
  }
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
  const hash = hashToken(token);
  sessionCache.delete(hash);
  await db.delete(sessions).where(eq(sessions.tokenHash, hash));
}

export async function resolveSession(token: string | undefined) {
  if (!token) return null;
  const hash = hashToken(token);
  const now = Date.now();
  const cached = sessionCache.get(hash);
  if (cached && now - cached.cachedAt < CACHE_TTL_MS && cached.actor.expiresAt.getTime() > now) {
    return cached.actor;
  }
  sessionCache.delete(hash);

  const db = getDb();
  const rows = await db
    .select({
      sessionId: sessions.id,
      userId: users.id,
      email: users.email,
      name: users.name,
      mustChangePassword: users.mustChangePassword,
      isPlatformAdmin: users.isPlatformAdmin,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hash), gt(sessions.expiresAt, new Date(now))))
    .limit(1);
  const actor = rows[0] ?? null;
  if (actor) sessionCache.set(hash, { actor, userId: actor.userId, cachedAt: now });
  return actor;
}

export type Actor = {
  sessionId: string;
  userId: string;
  email: string;
  name: string;
  mustChangePassword: boolean;
  isPlatformAdmin: boolean;
  expiresAt: Date;
};

/** Sign out every other session of a user (after a password change). */
export async function destroyOtherSessions(userId: string, keepToken?: string) {
  const db = getDb();
  const keep = keepToken ? hashToken(keepToken) : null;
  forgetUserSessions(userId);
  const rows = await db.select({ id: sessions.id, tokenHash: sessions.tokenHash }).from(sessions).where(eq(sessions.userId, userId));
  for (const r of rows) {
    if (r.tokenHash !== keep) await db.delete(sessions).where(eq(sessions.id, r.id));
  }
}
