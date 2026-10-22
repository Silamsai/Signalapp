import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateRequired } from "../../middleware/authenticate.js";
import {
  assertAccountInWorkspace,
  loadMembership,
  requireCap,
} from "../../middleware/requireMembership.js";
import {
  createHandoff,
  getPartnerHandoffView,
  listHandoffsForAccount,
  revokeHandoffAccess,
  shareHandoff,
  transitionHandoff,
} from "../../services/handoffs.js";

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

  app.post(
    "/v1/handoffs/:handoffId/revoke-access",
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
      return revokeHandoffAccess({
        tenantId: m.tenantId,
        workspaceId: m.workspaceId,
        handoffId,
        granteeEmail: body.granteeEmail,
        actorUserId: req.actor!.userId,
      });
    },
  );

  app.get(
    "/v1/handoffs/:handoffId/partner-view",
    { preHandler: authenticateRequired },
    async (req) => {
      const { handoffId } = req.params as { handoffId: string };
      const q = z.object({ workspaceId: z.string() }).parse(req.query);
      const m = await loadMembership(req, q.workspaceId);
      return getPartnerHandoffView({
        workspaceId: m.workspaceId,
        handoffId,
        actorEmail: req.actor!.email,
        isWorkspaceMember: true,
        role: m.role,
      });
    },
  );

  app.get(
    "/v1/accounts/:accountId/handoffs",
    { preHandler: authenticateRequired },
    async (req) => {
      const { accountId } = req.params as { accountId: string };
      const q = z.object({ workspaceId: z.string() }).parse(req.query);
      const m = await loadMembership(req, q.workspaceId);
      await assertAccountInWorkspace(accountId, m.workspaceId, m.tenantId);
      // Partners must not list full handoff rows for prepared records
      const rows = await listHandoffsForAccount(m.workspaceId, accountId);
      if (m.role === "partner") {
        return {
          handoffs: rows
            .filter((h) => h.state !== "prepared")
            .map((h) => ({
              id: h.id,
              state: h.state,
              receivingOrg: h.receivingOrg,
              sharedAt: h.sharedAt,
            })),
        };
      }
      return { handoffs: rows };
    },
  );

  app.post(
    "/v1/handoffs/:handoffId/transition",
    { preHandler: authenticateRequired },
    async (req) => {
      const { handoffId } = req.params as { handoffId: string };
      const body = z
        .object({
          workspaceId: z.string(),
          toState: z.enum(["acknowledged", "returned", "closed"]),
          returnReason: z.string().optional(),
        })
        .parse(req.body);
      const m = await loadMembership(req, body.workspaceId);
      requireCap(m, "acknowledge_handoff");
      const handoff = await transitionHandoff({
        tenantId: m.tenantId,
        workspaceId: m.workspaceId,
        handoffId,
        toState: body.toState,
        returnReason: body.returnReason,
        actorUserId: req.actor!.userId,
      });
      return { handoff };
    },
  );
}
