import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client.js";
import { users } from "../../db/schema/index.js";
import { hashPassword, verifyPassword } from "../../auth/password.js";
import {
  createSession,
  destroyOtherSessions,
  destroySession,
  SESSION_COOKIE,
} from "../../auth/session.js";
import { authenticateRequired } from "../../middleware/authenticate.js";
import { rateLimited, unauthorized, validationError } from "../../utils/errors.js";
import { isProduction } from "../../config/env.js";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 10;
const failures = new Map<string, { count: number; firstAt: number }>();

/** Per-email+IP failed-login throttle (in-process; one API instance per deployment). */
function checkThrottle(key: string) {
  const entry = failures.get(key);
  if (!entry) return;
  if (Date.now() - entry.firstAt > LOGIN_WINDOW_MS) {
    failures.delete(key);
    return;
  }
  if (entry.count >= LOGIN_MAX_FAILURES) {
    throw rateLimited("Too many failed sign-in attempts. Try again later.");
  }
}

function recordFailure(key: string) {
  const entry = failures.get(key);
  if (!entry || Date.now() - entry.firstAt > LOGIN_WINDOW_MS) {
    failures.set(key, { count: 1, firstAt: Date.now() });
  } else {
    entry.count++;
  }
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/v1/auth/login", async (req, reply) => {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(1),
      })
      .parse(req.body);

    const email = body.email.toLowerCase();
    const throttleKey = `${email}|${req.ip}`;
    checkThrottle(throttleKey);

    const db = getDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      recordFailure(throttleKey);
      throw unauthorized("Invalid email or password");
    }
    failures.delete(throttleKey);

    const { token, expiresAt } = await createSession(user.id);
    reply.setCookie(SESSION_COOKIE, token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction(),
      expires: expiresAt,
    });

    return {
      user: { id: user.id, email: user.email, name: user.name, mustChangePassword: user.mustChangePassword },
    };
  });

  app.post("/v1/auth/change-password", { preHandler: authenticateRequired }, async (req) => {
    const body = z
      .object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(12, "New password must be at least 12 characters").max(200),
      })
      .parse(req.body);
    if (body.newPassword === body.currentPassword) {
      throw validationError("Choose a password different from the current one");
    }
    const throttleKey = `change|${req.actor!.userId}|${req.ip}`;
    checkThrottle(throttleKey);

    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.id, req.actor!.userId)).limit(1);
    if (!user || !(await verifyPassword(body.currentPassword, user.passwordHash))) {
      recordFailure(throttleKey);
      throw validationError("Current password is incorrect");
    }
    failures.delete(throttleKey);

    await db
      .update(users)
      .set({
        passwordHash: await hashPassword(body.newPassword),
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      })
      .where(eq(users.id, user.id));
    // Keep this session, sign out everywhere else
    await destroyOtherSessions(user.id, req.cookies?.[SESSION_COOKIE]);
    return { ok: true };
  });

  app.post("/v1/auth/logout", async (req, reply) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) await destroySession(token);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/v1/auth/me", { preHandler: authenticateRequired }, async (req) => {
    return {
      user: {
        id: req.actor!.userId,
        email: req.actor!.email,
        name: req.actor!.name,
        mustChangePassword: req.actor!.mustChangePassword,
      },
    };
  });
}
