import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { getEnv } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authenticateOptional } from "./middleware/authenticate.js";
import { healthRoutes } from "./routes/health.js";
import { v1Routes } from "./routes/v1/index.js";

async function main() {
  const env = getEnv();
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      // Omit OS machine name from each line (defaults to Windows hostname).
      base: { service: "signal-api" },
    },
  });


  app.setErrorHandler(errorHandler);
  await app.register(cors, {
    origin: env.FRONTEND_ORIGIN,
    credentials: true,
  });
  await app.register(cookie);
  app.addHook("onRequest", authenticateOptional);

  await healthRoutes(app);
  await v1Routes(app);

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  console.log(`Signal API listening on :${env.PORT}`);
  console.log(`Exa configured: ${Boolean(env.EXA_API_KEY?.trim())}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
