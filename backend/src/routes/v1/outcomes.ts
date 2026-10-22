import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateRequired } from "../../middleware/authenticate.js";
import { loadMembership, requireCap } from "../../middleware/requireMembership.js";
import { computeOutcomes } from "../../services/outcomes.js";

export async function outcomeRoutes(app: FastifyInstance) {
  app.get(
    "/v1/workspaces/:workspaceId/outcomes",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "view_outcomes");
      const q = z
        .object({
          from: z.string().optional(),
          to: z.string().optional(),
        })
        .parse(req.query);
      return computeOutcomes(workspaceId, q.from, q.to);
    },
  );
}
