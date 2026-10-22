import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../utils/errors.js";

export function errorHandler(error: FastifyError | Error, _req: FastifyRequest, reply: FastifyReply) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }

  const statusCode = "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500;
  const message = statusCode >= 500 ? "Internal server error" : error.message;
  if (statusCode >= 500) {
    console.error(error);
  }
  return reply.status(statusCode).send({
    error: {
      code: statusCode >= 500 ? "internal_error" : "request_error",
      message,
    },
  });
}
