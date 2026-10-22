import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateRequired } from "../../middleware/authenticate.js";
import {
  assertAccountInWorkspace,
  loadMembership,
} from "../../middleware/requireMembership.js";
import { transitionAcceptance } from "../../services/acceptance.js";
import type { AcceptanceState } from "../../db/schema/workflow.js";

export async function acceptanceRoutes(app: FastifyInstance) {
  app.post(
    "/v1/accounts/:accountId/acceptance-decisions",
    { preHandler: authenticateRequired },
    async (req) => {
      const { accountId } = req.params as { accountId: string };
      const q = z.object({ workspaceId: z.string() }).parse(req.query);
      const m = await loadMembership(req, q.workspaceId);
      await assertAccountInWorkspace(accountId, m.workspaceId, m.tenantId);

      const body = z
        .object({
          toState: z.enum([
            "draft",
            "ready_for_review",
            "accepted",
            "needs_research",
            "rejected",
          ]),
          reasonCategory: z.string().optional(),
          reasonDetail: z.string().optional(),
          nextAction: z.string().optional(),
          ownerUserId: z.string().optional(),
          briefVersion: z.string().optional(),
          expectedVersion: z.number().int().optional(),
        })
        .parse(req.body);

      const result = await transitionAcceptance({
        tenantId: m.tenantId,
        workspaceId: m.workspaceId,
        accountId,
        toState: body.toState as AcceptanceState,
        actorUserId: req.actor!.userId,
        role: m.role,
        reasonCategory: body.reasonCategory,
        reasonDetail: body.reasonDetail,
        nextAction: body.nextAction,
        ownerUserId: body.ownerUserId,
        briefVersion: body.briefVersion,
        expectedVersion: body.expectedVersion,
      });
      return result;
    },
  );
}
