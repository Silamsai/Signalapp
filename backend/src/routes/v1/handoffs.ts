import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateRequired } from "../../middleware/authenticate.js";
import {
  assertAccountReadable,
  loadMembership,
  requireCap,
} from "../../middleware/requireMembership.js";
import { hasCapability } from "../../auth/permissions.js";
import {
  HANDOFF_FIELDS,
  createHandoff,
  getPartnerHandoffView,
  listHandoffsForAccount,
  listHandoffsSharedWith,
  revokeHandoffAccess,
  shareHandoff,
  transitionHandoff,
} from "../../services/handoffs.js";
import { forbidden } from "../../utils/errors.js";

export async function handoffRoutes(app: FastifyInstance) {
  app.get("/v1/handoffs/fields", { preHandler: authenticateRequired }, async () => ({
    fields: HANDOFF_FIELDS,
  }));

  app.post(
    "/v1/accounts/:accountId/handoffs",
    { preHandler: authenticateRequired },
    async (req) => {
      const { accountId } = req.params as { accountId: string };
      const q = z.object({ workspaceId: z.string() }).parse(req.query);
      const m = await loadMembership(req, q.workspaceId);
      requireCap(m, "handoff");
      await assertAccountReadable(m, accountId);

      const body = z
        .object({
          receivingOrg: z.string().trim().min(1).max(200),
          receivingUser: z.string().email(),
          internalOwnerUserId: z.string(),
          permittedFields: z.array(z.string()).min(1),
          reason: z.string().trim().min(1).max(2000),
          nextAction: z.string().trim().min(1).max(500),
          dueAt: z.string().datetime({ offset: true }),
          acknowledgeConflict: z.boolean().optional(),
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

  /** Partner inbox */
  app.get(
    "/v1/workspaces/:workspaceId/shared-handoffs",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "acknowledge_handoff");
      return { handoffs: await listHandoffsSharedWith(m.workspaceId, req.actor!.email) };
    },
  );

  app.get(
    "/v1/handoffs/:handoffId/partner-view",
    { preHandler: authenticateRequired },
    async (req) => {
      const { handoffId } = req.params as { handoffId: string };
      const q = z.object({ workspaceId: z.string() }).parse(req.query);
      const m = await loadMembership(req, q.workspaceId);
      if (m.role !== "partner" && !hasCapability(m.role, "handoff")) {
        throw forbidden("Missing capability: handoff");
      }
      return getPartnerHandoffView({
        tenantId: m.tenantId,
        workspaceId: m.workspaceId,
        handoffId,
        actorEmail: req.actor!.email,
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
      await assertAccountReadable(m, accountId);
      return { handoffs: await listHandoffsForAccount(m.tenantId, m.workspaceId, accountId) };
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
          returnReason: z.string().max(2000).optional(),
        })
        .parse(req.body);
      const m = await loadMembership(req, body.workspaceId);
      const handoff = await transitionHandoff({
        tenantId: m.tenantId,
        workspaceId: m.workspaceId,
        handoffId,
        toState: body.toState,
        returnReason: body.returnReason,
        actorUserId: req.actor!.userId,
        actorEmail: req.actor!.email,
        role: m.role,
        canManage: hasCapability(m.role, "share_handoff"),
      });
      return { handoff };
    },
  );
}
