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
          from: z.string().datetime({ offset: true }).optional(),
          to: z.string().datetime({ offset: true }).optional(),
        })
        .parse(req.query);
      return computeOutcomes(m.tenantId, workspaceId, q.from, q.to);
    },
  );
}
