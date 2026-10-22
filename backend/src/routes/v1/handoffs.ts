import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateRequired } from "../../middleware/authenticate.js";
import {
  assertAccountInWorkspace,
  loadMembership,
  requireCap,
} from "../../middleware/requireMembership.js";
import { createHandoff, shareHandoff } from "../../services/handoffs.js";

export async function handoffRoutes(app: FastifyInstance) {
  app.post(
    "/v1/accounts/:accountId/handoffs",
    { preHandler: authenticateRequired },
    async (req) => {
      const { accountId } = req.params as { accountId: string };
      const q = z.object({ workspaceId: z.string() }).parse(req.query);
      const m = await loadMembership(req, q.workspaceId);
      requireCap(m, "handoff");
      await assertAccountInWorkspace(accountId, m.workspaceId, m.tenantId);

      const body = z
        .object({
          receivingOrg: z.string().min(1),
          receivingUser: z.string().optional(),
          internalOwnerUserId: z.string(),
          permittedFields: z.array(z.string()).default([]),
          reason: z.string().min(1),
          nextAction: z.string().optional(),
          dueAt: z.string().optional(),
        })
        .parse(req.body);

      const handoff = await createHandoff({
        tenantId: m.tenantId,
        workspaceId: m.workspaceId,
        accountId,
        ...body,
        createdBy: req.actor!.userId,
      });
      return { handoff };
    },
  );

  app.post(
    "/v1/handoffs/:handoffId/share",
    { preHandler: authenticateRequired },
    async (req) => {
      const { handoffId } = req.params as { handoffId: string };
      const body = z
        .object({
          workspaceId: z.string(),
          granteeEmail: z.string().email(),
        })
        .parse(req.body);
      const m = await loadMembership(req, body.workspaceId);
      requireCap(m, "share_handoff");
      const handoff = await shareHandoff({
        tenantId: m.tenantId,
        workspaceId: m.workspaceId,
        handoffId,
        granteeEmail: body.granteeEmail,
        actorUserId: req.actor!.userId,
      });
      return { handoff };
    },
  );
}
