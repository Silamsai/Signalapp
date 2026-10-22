import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client.js";
import { accounts, offers, playbookVersions, researchRuns } from "../../db/schema/index.js";
import { authenticateRequired } from "../../middleware/authenticate.js";
import {
  assertAccountReadable,
  loadMembership,
  requireCap,
} from "../../middleware/requireMembership.js";
import { enqueueResearchRun } from "../../jobs/queue.js";
import { isResearchConfigured } from "../../providers/research/index.js";
import { notFound, providerNotConfigured, validationError } from "../../utils/errors.js";
import { getUsage, reserveResearchBudget } from "../../services/budget.js";
import { assertResearchAllowed } from "../../services/entitlements.js";
import { isAccountSuppressed } from "../../services/suppressions.js";
import { parseBrief } from "../../services/briefParser.js";
import { newId } from "../../utils/ids.js";
import { writeAudit } from "../../services/audit.js";
import type { ResearchFilters } from "../../providers/research/types.js";
import { normalizeCountry } from "../../utils/normalize.js";

const filtersSchema = z.object({
  countries: z.array(z.string().length(2)).max(20).optional(),
  industries: z.array(z.string().max(80)).max(20).optional(),
  companySizes: z.array(z.string().max(20)).max(10).optional(),
  signalKinds: z.array(z.string().max(40)).max(10).optional(),
  eventWindowDays: z.number().int().min(1).max(3650).nullable().optional(),
});

export async function researchRunRoutes(app: FastifyInstance) {
  /** Parse a brief into a visible structured query for confirmation (R1). Free. */
  app.post(
    "/v1/workspaces/:workspaceId/research-runs/parse-brief",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "discover");
      const body = z.object({ brief: z.string().min(1).max(2000) }).parse(req.body);
      const parsed = parseBrief(body.brief);
      const usage = await getUsage(m.tenantId);
      return { ...parsed, usage };
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/research-runs",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "research");
      await assertResearchAllowed(m.tenantId, workspaceId);
      if (!isResearchConfigured()) throw providerNotConfigured("exa");

      const body = z
        .object({
          mode: z.enum(["account", "discovery"]).default("account"),
          query: z.string().min(1).max(1000),
          brief: z.string().max(2000).optional(),
          filters: filtersSchema.optional(),
          accountId: z.string().optional(),
          playbookVersionId: z.string().optional(),
          idempotencyKey: z.string().max(200).optional(),
          budget: z.number().int().min(1).max(10).default(3),
        })
        .parse(req.body);

      if (body.mode === "discovery") requireCap(m, "discover");
      if (body.mode === "account" && !body.accountId) {
        throw validationError("Account research requires an accountId");
      }

      const db = getDb();
      let account: typeof accounts.$inferSelect | undefined;
      if (body.accountId) {
        await assertAccountReadable(m, body.accountId);
        if (await isAccountSuppressed(m.workspaceId, body.accountId)) {
          throw validationError("Cannot research a suppressed account");
        }
        [account] = await db.select().from(accounts).where(eq(accounts.id, body.accountId)).limit(1);
      }

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

      // Persist the executed playbook version with every run (R1)
      let playbookVersionId = body.playbookVersionId;
      if (playbookVersionId) {
        const [pb] = await db
          .select({ id: playbookVersions.id })
          .from(playbookVersions)
          .where(and(eq(playbookVersions.id, playbookVersionId), eq(playbookVersions.workspaceId, workspaceId)))
          .limit(1);
        if (!pb) throw validationError("Unknown playbook version");
      } else {
        const [latest] = await db
          .select({ id: playbookVersions.id })
          .from(playbookVersions)
          .where(
            and(eq(playbookVersions.workspaceId, workspaceId), eq(playbookVersions.templateKey, "infrastructure")),
          )
          .orderBy(desc(playbookVersions.version))
          .limit(1);
        playbookVersionId = latest?.id;
      }

      // Executed filters: explicit confirmed filters, else workspace targeting defaults
      const [offer] = await db.select().from(offers).where(eq(offers.workspaceId, workspaceId)).limit(1);
      const offerTerritory = (offer ? (JSON.parse(offer.territoryJson) as string[]) : [])
        .map((t) => normalizeCountry(t))
        .filter((c): c is string => Boolean(c));
      const filters: ResearchFilters = {
        countries: body.filters?.countries ?? offerTerritory,
        industries: body.filters?.industries ?? (offer ? (JSON.parse(offer.industriesJson) as string[]) : []),
        companySizes: body.filters?.companySizes ?? [],
        signalKinds: body.filters?.signalKinds ?? [],
        eventWindowDays: body.filters?.eventWindowDays ?? offer?.eventWindowDays ?? 90,
      };
      const query =
        body.mode === "account" && account
          ? `${account.name}${account.domain ? ` ${account.domain}` : ""} ${body.query}`.trim()
          : body.query;

      await reserveResearchBudget(m.tenantId, body.budget);

      const id = newId("rr");
      await db.insert(researchRuns).values({
        id,
        tenantId: m.tenantId,
        workspaceId,
        accountId: body.accountId,
        mode: body.mode,
        query,
        brief: body.brief,
        filtersJson: JSON.stringify(filters),
        playbookVersionId,
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
        metadata: { mode: body.mode, budget: body.budget },
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
      const m = await loadMembership(req, q.workspaceId);
      requireCap(m, "view_accounts");
      const db = getDb();
      const [run] = await db
        .select()
        .from(researchRuns)
        .where(
          and(
            eq(researchRuns.id, id),
            eq(researchRuns.workspaceId, m.workspaceId),
            eq(researchRuns.tenantId, m.tenantId),
          ),
        )
        .limit(1);
      if (!run) throw notFound("Research run not found");
      const result = run.resultJson ? (JSON.parse(run.resultJson) as Record<string, unknown>) : null;
      return {
        researchRun: {
          id: run.id,
          mode: run.mode,
          status: run.status,
          progressPct: run.progressPct,
          budgetReserved: run.budgetReserved,
          budgetActual: run.budgetActual,
          errorCode: run.errorCode,
          errorMessage: run.errorMessage,
          providerRunId: run.providerRunId,
          accountId: run.accountId,
          brief: run.brief,
          filters: JSON.parse(run.filtersJson || "{}"),
          playbookVersionId: run.playbookVersionId,
          // Never echo raw provider items; only the summary
          result: result && result.stage === "done" ? result : null,
          createdAt: run.createdAt,
          completedAt: run.completedAt,
        },
      };
    },
  );
}
