import type { FastifyInstance } from "fastify";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import { memberships, users, workspaces, type MembershipRole } from "../../db/schema/index.js";
import { authenticateRequired } from "../../middleware/authenticate.js";
import { loadMembership } from "../../middleware/requireMembership.js";
import { capabilitiesFor, hasCapability } from "../../auth/permissions.js";
import { forbidden } from "../../utils/errors.js";

export async function workspaceRoutes(app: FastifyInstance) {
  app.get("/v1/workspaces", { preHandler: authenticateRequired }, async (req) => {
    const db = getDb();
    const rows = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        tenantId: workspaces.tenantId,
        currency: workspaces.currency,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(workspaces, eq(memberships.workspaceId, workspaces.id))
      .where(
        and(eq(memberships.userId, req.actor!.userId), isNull(memberships.revokedAt)),
      );
    // Server is the source of truth for what the UI may show (role-based UI)
    return {
      workspaces: rows.map((w) => ({
        ...w,
        capabilities: capabilitiesFor(w.role as MembershipRole),
      })),
    };
  });

  /** Minimal member directory for owner/assignee pickers. */
  app.get(
    "/v1/workspaces/:workspaceId/people",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      const m = await loadMembership(req, workspaceId);
      if (!hasCapability(m.role, "tasks") && !hasCapability(m.role, "assign_owner")) {
        throw forbidden("Missing capability: tasks");
      }
      const db = getDb();
      const people = await db
        .select({ userId: users.id, name: users.name, email: users.email, role: memberships.role })
        .from(memberships)
        .innerJoin(users, eq(memberships.userId, users.id))
        .where(and(eq(memberships.workspaceId, workspaceId), isNull(memberships.revokedAt)));
      // Partners are external recipients, not internal owners
      return { people: people.filter((p) => p.role !== "partner") };
    },
  );
}
