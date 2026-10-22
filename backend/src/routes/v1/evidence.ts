import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateRequired } from "../../middleware/authenticate.js";
import {
  assertAccountReadable,
  loadMembership,
  requireCap,
} from "../../middleware/requireMembership.js";
import { getEvidenceAccountId, markEvidenceReviewed } from "../../services/evidence.js";

export async function evidenceRoutes(app: FastifyInstance) {
  app.post(
    "/v1/evidence/:evidenceId/review",
    { preHandler: authenticateRequired },
    async (req) => {
      const { evidenceId } = req.params as { evidenceId: string };
      const body = z
        .object({ workspaceId: z.string(), reviewed: z.boolean().default(true) })
        .parse(req.body);
      const m = await loadMembership(req, body.workspaceId);
      requireCap(m, "review_evidence");
      const accountId = await getEvidenceAccountId(m.workspaceId, evidenceId);
      await assertAccountReadable(m, accountId);
      const evidence = await markEvidenceReviewed({
        tenantId: m.tenantId,
        workspaceId: m.workspaceId,
        evidenceId,
        actorUserId: req.actor!.userId,
        reviewed: body.reviewed,
      });
      return { evidence };
    },
  );
}
