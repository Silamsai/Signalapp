import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  membershipRoles,
  type MembershipRole,
} from "../../db/schema/identity.js";
import { authenticateRequired } from "../../middleware/authenticate.js";
import { loadMembership, requireCap } from "../../middleware/requireMembership.js";
import {
  grantMembership,
  listMemberships,
  resetMemberPassword,
  revokeMembership,
} from "../../services/memberships.js";

const roleSchema = z.enum(
  membershipRoles as unknown as [MembershipRole, ...MembershipRole[]],
);

export async function membershipRoutes(app: FastifyInstance) {
  app.get(
    "/v1/workspaces/:workspaceId/memberships",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "manage_membership");
      return { memberships: await listMemberships(workspaceId) };
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/memberships",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "manage_membership");
      const body = z
        .object({
          email: z.string().email(),
          name: z.string().optional(),
          role: roleSchema,
          password: z.string().min(8, "Password must be at least 8 characters").max(200).optional(),
        })
        .parse(req.body);
      const result = await grantMembership({
        tenantId: m.tenantId,
        workspaceId,
        email: body.email,
        name: body.name,
        role: body.role,
        password: body.password,
        actorUserId: req.actor!.userId,
      });
      return result;
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/memberships/:membershipId/revoke",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId, membershipId } = req.params as {
        workspaceId: string;
        membershipId: string;
      };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "manage_membership");
      const membership = await revokeMembership({
        tenantId: m.tenantId,
        workspaceId,
        membershipId,
        actorUserId: req.actor!.userId,
      });
      return { membership };
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/memberships/:membershipId/reset-password",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId, membershipId } = req.params as {
        workspaceId: string;
        membershipId: string;
      };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "manage_membership");
      const body = z
        .object({ newPassword: z.string().min(8, "Password must be at least 8 characters").max(200) })
        .parse(req.body);
      return resetMemberPassword({
        tenantId: m.tenantId,
        workspaceId,
        membershipId,
        newPassword: body.newPassword,
        actorUserId: req.actor!.userId,
      });
    },
  );
}
