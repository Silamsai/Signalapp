import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateRequired } from "../../middleware/authenticate.js";
import {
  assertAccountInWorkspace,
  loadMembership,
  requireCap,
} from "../../middleware/requireMembership.js";
import { createTask, listTasks, updateTask } from "../../services/tasks.js";

export async function taskRoutes(app: FastifyInstance) {
  app.get(
    "/v1/workspaces/:workspaceId/tasks",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      await loadMembership(req, workspaceId);
      const q = z
        .object({
          ownerUserId: z.string().optional(),
          status: z.string().optional(),
        })
        .parse(req.query);
      const tasks = await listTasks(workspaceId, q);
      return { tasks };
    },
  );

  app.post("/v1/tasks", { preHandler: authenticateRequired }, async (req) => {
    const body = z
      .object({
        workspaceId: z.string(),
        accountId: z.string(),
        type: z.enum(["research", "call", "email", "follow_up"]),
        ownerUserId: z.string(),
        dueAt: z.string().optional(),
        timezone: z.string().optional(),
        instruction: z.string().optional(),
        priority: z.string().optional(),
        idempotencyKey: z.string().optional(),
        confirmFollowUp: z.boolean().optional(),
      })
      .parse(req.body);

    const m = await loadMembership(req, body.workspaceId);
    requireCap(m, "tasks");
    await assertAccountInWorkspace(body.accountId, m.workspaceId, m.tenantId);

    const task = await createTask({
      tenantId: m.tenantId,
      workspaceId: m.workspaceId,
      accountId: body.accountId,
      type: body.type,
      ownerUserId: body.ownerUserId,
      dueAt: body.dueAt,
      timezone: body.timezone,
      instruction: body.instruction,
      priority: body.priority,
      idempotencyKey: body.idempotencyKey,
      createdBy: req.actor!.userId,
      confirmFollowUp: body.confirmFollowUp,
    });
    return { task };
  });

  app.patch("/v1/tasks/:taskId", { preHandler: authenticateRequired }, async (req) => {
    const { taskId } = req.params as { taskId: string };
    const body = z
      .object({
        workspaceId: z.string(),
        status: z.enum(["open", "in_progress", "completed", "cancelled"]).optional(),
        outcome: z.string().optional(),
        cancelReason: z.string().optional(),
      })
      .parse(req.body);

    const m = await loadMembership(req, body.workspaceId);
    requireCap(m, "tasks");
    const task = await updateTask({
      tenantId: m.tenantId,
      workspaceId: m.workspaceId,
      taskId,
      status: body.status,
      outcome: body.outcome,
      cancelReason: body.cancelReason,
      actorUserId: req.actor!.userId,
    });
    return { task };
  });
}
