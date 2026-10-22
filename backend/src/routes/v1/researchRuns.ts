import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client.js";
import { accounts, researchRuns } from "../../db/schema/index.js";
import { authenticateRequired } from "../../middleware/authenticate.js";
import {
  assertAccountInWorkspace,
  loadMembership,
  requireCap,
} from "../../middleware/requireMembership.js";
import { enqueueResearchRun } from "../../jobs/queue.js";
import { isExaConfigured } from "../../config/env.js";
import { providerNotConfigured, validationError } from "../../utils/errors.js";
import { reserveResearchBudget } from "../../services/budget.js";
import { newId } from "../../utils/ids.js";
import { writeAudit } from "../../services/audit.js";

export async function researchRunRoutes(app: FastifyInstance) {
  app.post(
    "/v1/workspaces/:workspaceId/research-runs",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "research");

      if (!isExaConfigured()) throw providerNotConfigured("exa");

      const body = z
        .object({
          query: z.string().min(1),
          accountId: z.string().optional(),
          playbookVersionId: z.string().optional(),
          idempotencyKey: z.string().optional(),
          budget: z.number().int().min(1).max(10).default(3),
        })
        .parse(req.body);

      if (body.accountId) {
        await assertAccountInWorkspace(body.accountId, m.workspaceId, m.tenantId);
      }

      const db = getDb();
      if (body.idempotencyKey) {
        const existing = await db
          .select()
          .from(researchRuns)
          .where(
            and(
              eq(researchRuns.workspaceId, workspaceId),
              eq(researchRuns.idempotencyKey, body.idempotencyKey),
            ),
          )
          .limit(1);
        if (existing[0]) {
          return { researchRunId: existing[0].id, status: existing[0].status, reused: true };
        }
      }

      await reserveResearchBudget(m.tenantId, body.budget);

      const id = newId("rr");
      await db.insert(researchRuns).values({
        id,
        tenantId: m.tenantId,
        workspaceId,
        accountId: body.accountId,
        query: body.query,
        playbookVersionId: body.playbookVersionId,
        budgetReserved: body.budget,
        idempotencyKey: body.idempotencyKey,
        createdBy: req.actor!.userId,
        status: "queued",
      });

      if (body.accountId) {
        await db
          .update(accounts)
          .set({ researchState: "researching", updatedAt: new Date() })
          .where(eq(accounts.id, body.accountId));
      }

      await enqueueResearchRun(id);
      await writeAudit({
        tenantId: m.tenantId,
        workspaceId,
        actorUserId: req.actor!.userId,
        action: "research_run.queued",
        entityType: "research_run",
        entityId: id,
      });

      return { researchRunId: id, status: "queued" };
    },
  );

  app.get(
    "/v1/research-runs/:id",
    { preHandler: authenticateRequired },
    async (req) => {
      const { id } = req.params as { id: string };
      const q = z.object({ workspaceId: z.string() }).parse(req.query);
      await loadMembership(req, q.workspaceId);
      const db = getDb();
      const [run] = await db
        .select()
        .from(researchRuns)
        .where(eq(researchRuns.id, id))
        .limit(1);
      if (!run || run.workspaceId !== q.workspaceId) {
        throw validationError("Research run not found");
      }
      return {
        researchRun: {
          id: run.id,
          status: run.status,
          progressPct: run.progressPct,
          budgetReserved: run.budgetReserved,
          budgetActual: run.budgetActual,
          errorCode: run.errorCode,
          errorMessage: run.errorMessage,
          providerRunId: run.providerRunId,
          accountId: run.accountId,
          createdAt: run.createdAt,
          completedAt: run.completedAt,
        },
      };
    },
  );
}
