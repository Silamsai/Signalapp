import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AppError } from "../utils/errors.js";
import { redactSecrets, redactString } from "../utils/redact.js";

export function errorHandler(error: FastifyError | Error, _req: FastifyRequest, reply: FastifyReply) {
  if (error instanceof AppError) {
    const details =
      error.details && typeof error.details === "object"
        ? redactSecrets(error.details as Record<string, unknown>)
        : error.details;
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: redactString(error.message),
        details,
      },
    });
  }

  // Request validation is a 400, never a 500 (spec §8: distinct error classes)
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: {
        code: "validation_error",
        message: error.issues
          .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
          .join("; "),
        details: { issues: error.issues.map((i) => ({ path: i.path, message: i.message })) },
      },
    });
  }

  const statusCode = "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500;
  const rawMessage = statusCode >= 500 ? "Internal server error" : error.message;
  const message = redactString(rawMessage);
  if (statusCode >= 500) {
    console.error(redactString(error.stack ?? error.message));
  }
  return reply.status(statusCode).send({
    error: {
      code: statusCode >= 500 ? "internal_error" : "request_error",
      message,
    },
  });
}
