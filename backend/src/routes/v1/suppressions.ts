import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateRequired } from "../../middleware/authenticate.js";
import { loadMembership, requireCap } from "../../middleware/requireMembership.js";
import {
  createSuppression,
  expireSuppression,
  listSuppressions,
  suppressionReasons,
} from "../../services/suppressions.js";

export async function suppressionRoutes(app: FastifyInstance) {
  app.get(
    "/v1/workspaces/:workspaceId/suppressions",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "manage_suppressions");
      return { suppressions: await listSuppressions(workspaceId), reasons: suppressionReasons };
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/suppressions",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "manage_suppressions");
      const body = z
        .object({
          addressOrDomain: z.string().min(3).max(320),
          reason: z.enum(suppressionReasons),
          source: z.enum(["manual", "verbal_request", "written_request", "import"]).optional(),
          expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
        })
        .parse(req.body);
      const suppression = await createSuppression({
        tenantId: m.tenantId,
        workspaceId,
        ...body,
        actorUserId: req.actor!.userId,
      });
      return { suppression };
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/suppressions/:suppressionId/expire",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId, suppressionId } = req.params as {
        workspaceId: string;
        suppressionId: string;
      };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "manage_suppressions");
      const suppression = await expireSuppression({
        tenantId: m.tenantId,
        workspaceId,
        suppressionId,
        actorUserId: req.actor!.userId,
      });
      return { suppression };
    },
  );
}
