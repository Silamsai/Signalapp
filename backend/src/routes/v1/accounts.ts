import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client.js";
import {
  accounts,
  evidence,
  mergeCandidates,
  qualifications,
  qualificationFacts,
  signals,
  sources,
  acceptanceDecisions,
} from "../../db/schema/index.js";
import { authenticateRequired } from "../../middleware/authenticate.js";
import {
  assertAccountInWorkspace,
  loadMembership,
  requireCap,
} from "../../middleware/requireMembership.js";
import { escapeCsvCell } from "../../utils/csv.js";
import { newId } from "../../utils/ids.js";

export async function accountRoutes(app: FastifyInstance) {
  app.get(
    "/v1/workspaces/:workspaceId/accounts",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      await loadMembership(req, workspaceId);
      const db = getDb();
      const rows = await db
        .select()
        .from(accounts)
        .where(eq(accounts.workspaceId, workspaceId))
        .orderBy(desc(accounts.updatedAt));
      return { accounts: rows };
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/accounts",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "import");
      const body = z
        .object({
          name: z.string().min(1),
          domain: z.string().optional(),
          country: z.string().optional(),
        })
        .parse(req.body);
      const db = getDb();
      const id = newId("acc");
      await db.insert(accounts).values({
        id,
        tenantId: m.tenantId,
        workspaceId,
        name: body.name,
        domain: body.domain?.toLowerCase() ?? null,
        country: body.country,
        researchState: "unresearched",
        acceptanceState: "draft",
      });
      const [row] = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
      return { account: row };
    },
  );

  app.get(
    "/v1/workspaces/:workspaceId/merge-candidates",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      await loadMembership(req, workspaceId);
      const db = getDb();
      const rows = await db
        .select()
        .from(mergeCandidates)
        .where(
          and(eq(mergeCandidates.workspaceId, workspaceId), eq(mergeCandidates.status, "pending")),
        );
      return { candidates: rows };
    },
  );

  app.get(
    "/v1/accounts/:accountId/brief",
    { preHandler: authenticateRequired },
    async (req) => {
      const { accountId } = req.params as { accountId: string };
      const q = z.object({ workspaceId: z.string() }).parse(req.query);
      const m = await loadMembership(req, q.workspaceId);
      await assertAccountInWorkspace(accountId, m.workspaceId, m.tenantId);

      const db = getDb();
      const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
      const ev = await db
        .select({
          evidence: evidence,
          source: sources,
        })
        .from(evidence)
        .innerJoin(sources, eq(evidence.sourceId, sources.id))
        .where(eq(evidence.accountId, accountId));
      const sigs = await db.select().from(signals).where(eq(signals.accountId, accountId));
      const [qual] = await db
        .select()
        .from(qualifications)
        .where(eq(qualifications.accountId, accountId))
        .limit(1);
      let facts: (typeof qualificationFacts.$inferSelect)[] = [];
      if (qual) {
        facts = await db
          .select()
          .from(qualificationFacts)
          .where(eq(qualificationFacts.qualificationId, qual.id));
        facts = facts.filter((f) => !f.supersededBy);
      }
      const decisions = await db
        .select()
        .from(acceptanceDecisions)
        .where(eq(acceptanceDecisions.accountId, accountId))
        .orderBy(desc(acceptanceDecisions.createdAt));

      return {
        account,
        evidence: ev.map((e) => ({
          ...e.evidence,
          sourceUrl: e.source.canonicalUrl,
          sourceTitle: e.source.title,
          publisher: e.source.publisher,
        })),
        signals: sigs,
        qualification: qual,
        facts,
        decisions,
      };
    },
  );

  app.get(
    "/v1/workspaces/:workspaceId/accounts/export",
    { preHandler: authenticateRequired },
    async (req, reply) => {
      const { workspaceId } = req.params as { workspaceId: string };
      await loadMembership(req, workspaceId);
      const db = getDb();
      const rows = await db.select().from(accounts).where(eq(accounts.workspaceId, workspaceId));
      const header = ["name", "domain", "country", "research_state", "acceptance_state", "fit_score"];
      const lines = [
        header.join(","),
        ...rows.map((r) =>
          [
            escapeCsvCell(r.name),
            escapeCsvCell(r.domain),
            escapeCsvCell(r.country),
            escapeCsvCell(r.researchState),
            escapeCsvCell(r.acceptanceState),
            escapeCsvCell(r.fitScore),
          ].join(","),
        ),
      ];
      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header("content-disposition", 'attachment; filename="accounts.csv"');
      return lines.join("\n");
    },
  );
}
