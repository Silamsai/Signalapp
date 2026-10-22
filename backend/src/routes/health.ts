import type { FastifyInstance } from "fastify";
import { researchProviderStatus } from "../providers/research/index.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    ok: true,
    service: "signal-backend",
    research: researchProviderStatus(),
  }));
}
