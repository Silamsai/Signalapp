import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import { memberships, workspaces } from "../../db/schema/index.js";
import { authenticateRequired } from "../../middleware/authenticate.js";

export async function workspaceRoutes(app: FastifyInstance) {
  app.get("/v1/workspaces", { preHandler: authenticateRequired }, async (req) => {
    const db = getDb();
    const rows = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        tenantId: workspaces.tenantId,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(workspaces, eq(memberships.workspaceId, workspaces.id))
      .where(eq(memberships.userId, req.actor!.userId));
    return { workspaces: rows };
  });
}
