import type { FastifyReply, FastifyRequest } from "fastify";
import { resolveSession, SESSION_COOKIE, type Actor } from "../auth/session.js";
import { AppError, forbidden, unauthorized } from "../utils/errors.js";

declare module "fastify" {
  interface FastifyRequest {
    actor: Actor | null;
  }
}

export async function authenticateOptional(req: FastifyRequest) {
  const token = req.cookies?.[SESSION_COOKIE];
  req.actor = await resolveSession(token);
}

export async function authenticateRequired(req: FastifyRequest, _reply: FastifyReply) {
  await authenticateOptional(req);
  if (!req.actor) {
    throw unauthorized();
  }
  // A temporary password only allows choosing a new one
  if (req.actor.mustChangePassword && !req.url.startsWith("/v1/auth/")) {
    throw new AppError(403, "Set a new password to continue", "password_change_required");
  }
}

/** App-owner routes (/v1/platform). Tenant roles never qualify, not even tenant admin. */
export async function requirePlatformAdmin(req: FastifyRequest, reply: FastifyReply) {
  await authenticateRequired(req, reply);
  if (!req.actor!.isPlatformAdmin) throw forbidden("Platform admin only");
}
