import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateRequired } from "../../middleware/authenticate.js";
import { loadMembership, requireCap } from "../../middleware/requireMembership.js";
import { createMonitor, listMonitors, patchMonitor, runMonitor } from "../../services/monitors.js";
import { enqueueMonitorRun } from "../../jobs/queue.js";

export async function monitorRoutes(app: FastifyInstance) {
  app.get(
    "/v1/workspaces/:workspaceId/monitors",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      await loadMembership(req, workspaceId);
      const monitors = await listMonitors(workspaceId);
      return { monitors };
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/monitors",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "manage_monitors");
      const body = z
        .object({
          name: z.string().min(1),
          query: z.string().min(1),
          accountId: z.string().optional(),
          cadenceHours: z.number().int().positive().optional(),
        })
        .parse(req.body);
      const monitor = await createMonitor({
        tenantId: m.tenantId,
        workspaceId,
        ...body,
        createdBy: req.actor!.userId,
      });
      return { monitor };
    },
  );

  app.patch(
    "/v1/workspaces/:workspaceId/monitors/:monitorId",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId, monitorId } = req.params as { workspaceId: string; monitorId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "manage_monitors");
      const body = z
        .object({
          status: z.enum(["active", "paused", "killed"]).optional(),
          name: z.string().optional(),
          cadenceHours: z.number().int().positive().optional(),
        })
        .parse(req.body);
      const monitor = await patchMonitor(workspaceId, monitorId, body);
      return { monitor };
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/monitors/:monitorId/run",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId, monitorId } = req.params as { workspaceId: string; monitorId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "manage_monitors");
      await enqueueMonitorRun(monitorId);
      // Also run inline for snappy UX in local/dev
      const result = await runMonitor(monitorId);
      return { queued: true, result };
    },
  );
}
