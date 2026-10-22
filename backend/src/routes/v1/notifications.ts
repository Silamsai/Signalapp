import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateRequired } from "../../middleware/authenticate.js";
import { loadMembership } from "../../middleware/requireMembership.js";
import { listNotifications, markNotificationRead } from "../../services/notifications.js";

export async function notificationRoutes(app: FastifyInstance) {
  app.get(
    "/v1/workspaces/:workspaceId/notifications",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      await loadMembership(req, workspaceId);
      const q = z.object({ unreadOnly: z.string().optional() }).parse(req.query);
      const items = await listNotifications(
        workspaceId,
        req.actor!.userId,
        q.unreadOnly === "1" || q.unreadOnly === "true",
      );
      return { notifications: items };
    },
  );

  app.post(
    "/v1/notifications/:notificationId/read",
    { preHandler: authenticateRequired },
    async (req) => {
      const { notificationId } = req.params as { notificationId: string };
      return markNotificationRead(notificationId, req.actor!.userId);
    },
  );
}
