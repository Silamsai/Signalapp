import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateRequired } from "../../middleware/authenticate.js";
import {
  assertAccountInWorkspace,
  loadMembership,
  requireCap,
} from "../../middleware/requireMembership.js";
import { createDraft, listDrafts, updateDraft } from "../../services/drafts.js";

export async function draftRoutes(app: FastifyInstance) {
  app.get(
    "/v1/workspaces/:workspaceId/drafts",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      await loadMembership(req, workspaceId);
      const q = z.object({ accountId: z.string().optional() }).parse(req.query);
      const drafts = await listDrafts(workspaceId, q.accountId);
      return { drafts };
    },
  );

  app.post(
    "/v1/accounts/:accountId/drafts",
    { preHandler: authenticateRequired },
    async (req) => {
      const { accountId } = req.params as { accountId: string };
      const q = z.object({ workspaceId: z.string() }).parse(req.query);
      const m = await loadMembership(req, q.workspaceId);
      requireCap(m, "drafts");
      await assertAccountInWorkspace(accountId, m.workspaceId, m.tenantId);
      const body = z
        .object({
          channel: z.string().optional(),
          subject: z.string().optional(),
          body: z.string().optional(),
        })
        .parse(req.body ?? {});

      const draft = await createDraft({
        tenantId: m.tenantId,
        workspaceId: m.workspaceId,
        accountId,
        channel: body.channel,
        subject: body.subject,
        bodyEdits: body.body,
        authorUserId: req.actor!.userId,
      });
      return { draft };
    },
  );

  app.patch("/v1/drafts/:draftId", { preHandler: authenticateRequired }, async (req) => {
    const { draftId } = req.params as { draftId: string };
    const body = z
      .object({
        workspaceId: z.string(),
        subject: z.string().optional(),
        body: z.string().optional(),
      })
      .parse(req.body);
    const m = await loadMembership(req, body.workspaceId);
    requireCap(m, "drafts");
    const draft = await updateDraft({
      workspaceId: m.workspaceId,
      draftId,
      subject: body.subject,
      body: body.body,
    });
    return { draft };
  });
}
