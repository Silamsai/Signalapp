import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { getEnv } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { healthRoutes } from "./routes/health.js";
import { v1Routes } from "./routes/v1/index.js";

/** Build the API without listening — used by index.ts and by the gate tests. */
export async function buildApp(opts: { logger?: boolean } = {}) {
  const env = getEnv();
  const app = Fastify({
    logger:
      opts.logger === false
        ? false
        : {
            level: process.env.LOG_LEVEL ?? "info",
            // Omit OS machine name from each line (defaults to Windows hostname).
            base: { service: "signal-api" },
            // Gate 12: credentials never reach application logs
            redact: ["req.headers.cookie", "req.headers.authorization", "res.headers['set-cookie']"],
          },
  });

  app.setErrorHandler(errorHandler);
  await app.register(cors, {
    origin: env.FRONTEND_ORIGIN,
    credentials: true,
  });
  await app.register(cookie);
  // Each protected route authenticates once in its preHandler (one session lookup per request)
  app.decorateRequest("actor", null);

  await healthRoutes(app);
  await v1Routes(app);
  return app;
}
