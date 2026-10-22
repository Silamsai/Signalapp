import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateRequired } from "../../middleware/authenticate.js";
import {
  assertAccountReadable,
  loadMembership,
  requireCap,
} from "../../middleware/requireMembership.js";
import {
  FIELD_KEYS,
  getOrCreateQualification,
  getQualificationFacts,
  updateQualification,
} from "../../services/qualification.js";

export async function qualificationRoutes(app: FastifyInstance) {
  app.get(
    "/v1/accounts/:accountId/qualification",
    { preHandler: authenticateRequired },
    async (req) => {
      const { accountId } = req.params as { accountId: string };
      const q = z.object({ workspaceId: z.string() }).parse(req.query);
      const m = await loadMembership(req, q.workspaceId);
      await assertAccountReadable(m, accountId);
      const qual = await getOrCreateQualification(m.tenantId, m.workspaceId, accountId);
      const { current, history } = await getQualificationFacts(qual.id);
      return {
        qualification: qual,
        facts: current,
        history,
        fieldKeys: FIELD_KEYS,
      };
    },
  );

  app.patch(
    "/v1/accounts/:accountId/qualification",
    { preHandler: authenticateRequired },
    async (req) => {
      const { accountId } = req.params as { accountId: string };
      const q = z.object({ workspaceId: z.string() }).parse(req.query);
      const m = await loadMembership(req, q.workspaceId);
      requireCap(m, "qualify");
      await assertAccountReadable(m, accountId);

      const body = z
        .object({
          expectedVersion: z.number().int(),
          rationale: z.string().optional(),
          facts: z
            .array(
              z.object({
                fieldKey: z.string(),
                value: z.string().nullable().optional(),
                basis: z.enum([
                  "unknown",
                  "research_hypothesis",
                  "source_observed",
                  "prospect_confirmed",
                ]),
                evidenceIds: z.array(z.string()).optional(),
                confirmationNote: z.string().optional(),
              }),
            )
            .optional(),
        })
        .parse(req.body);

      return updateQualification({
        tenantId: m.tenantId,
        workspaceId: m.workspaceId,
        accountId,
        expectedVersion: body.expectedVersion,
        rationale: body.rationale,
        facts: body.facts?.map((f) => ({
          ...f,
          // Confirmer identity comes from the session, never the form
          confirmerUserId: f.basis === "prospect_confirmed" ? req.actor!.userId : undefined,
        })),
        actorUserId: req.actor!.userId,
      });
    },
  );
}
