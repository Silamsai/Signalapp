import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client.js";
import { users } from "../../db/schema/index.js";
import { verifyPassword } from "../../auth/password.js";
import {
  createSession,
  destroySession,
  SESSION_COOKIE,
} from "../../auth/session.js";
import { authenticateRequired } from "../../middleware/authenticate.js";
import { unauthorized } from "../../utils/errors.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/v1/auth/login", async (req, reply) => {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(1),
      })
      .parse(req.body);

    const db = getDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, body.email.toLowerCase()))
      .limit(1);
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw unauthorized("Invalid email or password");
    }

    const { token, expiresAt } = await createSession(user.id);
    reply.setCookie(SESSION_COOKIE, token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      expires: expiresAt,
    });

    return {
      user: { id: user.id, email: user.email, name: user.name },
    };
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
      },
    };
  });
}
