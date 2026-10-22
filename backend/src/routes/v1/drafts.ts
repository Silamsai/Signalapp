import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getDb } from "../../db/client.js";
import { accounts } from "../../db/schema/index.js";
import { authenticateRequired } from "../../middleware/authenticate.js";
import {
  accountScope,
  assertAccountReadable,
  loadMembership,
  requireCap,
} from "../../middleware/requireMembership.js";
import {
  approveDraft,
  createDraft,
  getDraft,
  listDrafts,
  updateDraft,
} from "../../services/drafts.js";
import { isAccountSuppressed } from "../../services/suppressions.js";
import { validationError } from "../../utils/errors.js";
import { writeAudit } from "../../services/audit.js";

export async function draftRoutes(app: FastifyInstance) {
  app.get(
    "/v1/workspaces/:workspaceId/drafts",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "view_drafts");
      const q = z.object({ accountId: z.string().optional() }).parse(req.query);
      let scoped: string[] | undefined;
      if (m.role === "sdr") {
        const db = getDb();
        scoped = (await db.select({ id: accounts.id }).from(accounts).where(accountScope(m))).map((a) => a.id);
      }
      return { drafts: await listDrafts(m.tenantId, workspaceId, scoped, q.accountId) };
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
      await assertAccountReadable(m, accountId);
      const body = z
        .object({
          channel: z.enum(["email", "call_script", "linkedin_note"]).optional(),
          subject: z.string().max(300).optional(),
          body: z.string().max(20000).optional(),
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
        expectedVersion: z.number().int(),
        subject: z.string().max(300).optional(),
        body: z.string().max(20000).optional(),
      })
      .parse(req.body);
    const m = await loadMembership(req, body.workspaceId);
    requireCap(m, "drafts");
    const existing = await getDraft(m.tenantId, m.workspaceId, draftId);
    await assertAccountReadable(m, existing.accountId);
    const draft = await updateDraft({
      tenantId: m.tenantId,
      workspaceId: m.workspaceId,
      draftId,
      subject: body.subject,
      body: body.body,
      expectedVersion: body.expectedVersion,
    });
    return { draft };
  });

  app.post("/v1/drafts/:draftId/approve", { preHandler: authenticateRequired }, async (req) => {
    const { draftId } = req.params as { draftId: string };
    const body = z.object({ workspaceId: z.string(), expectedVersion: z.number().int() }).parse(req.body);
    const m = await loadMembership(req, body.workspaceId);
    requireCap(m, "drafts");
    const existing = await getDraft(m.tenantId, m.workspaceId, draftId);
    await assertAccountReadable(m, existing.accountId);
    const draft = await approveDraft({
      tenantId: m.tenantId,
      workspaceId: m.workspaceId,
      draftId,
      expectedVersion: body.expectedVersion,
      actorUserId: req.actor!.userId,
    });
    return { draft };
  });

  /** SDR export of an approved draft as plain text — nothing is sent (R6). */
  app.get("/v1/drafts/:draftId/export", { preHandler: authenticateRequired }, async (req, reply) => {
    const { draftId } = req.params as { draftId: string };
    const q = z.object({ workspaceId: z.string() }).parse(req.query);
    const m = await loadMembership(req, q.workspaceId);
    requireCap(m, "export");
    const draft = await getDraft(m.tenantId, m.workspaceId, draftId);
    await assertAccountReadable(m, draft.accountId);
    if (!draft.approvedAt) throw validationError("Only approved drafts can be exported");
    if (await isAccountSuppressed(m.workspaceId, draft.accountId)) {
      throw validationError("Account is suppressed — export blocked");
    }
    await writeAudit({
      tenantId: m.tenantId,
      workspaceId: m.workspaceId,
      actorUserId: m.userId,
      action: "draft.exported",
      entityType: "draft",
      entityId: draft.id,
    });
    reply.header("content-type", "text/plain; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="draft-${draft.id}.txt"`);
    reply.header("cache-control", "no-store");
    return `Subject: ${draft.subject ?? ""}\n\n${draft.body}\n`;
  });
}
