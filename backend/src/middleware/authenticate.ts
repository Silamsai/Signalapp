import type { FastifyReply, FastifyRequest } from "fastify";
import { resolveSession, SESSION_COOKIE, type Actor } from "../auth/session.js";
import { unauthorized } from "../utils/errors.js";

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
}
