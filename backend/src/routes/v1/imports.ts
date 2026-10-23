import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client.js";
import { importJobs } from "../../db/schema/index.js";
import { authenticateRequired } from "../../middleware/authenticate.js";
import { loadMembership, requireCap } from "../../middleware/requireMembership.js";
import { enqueueCsvImport } from "../../jobs/queue.js";
import { IMPORT_FIELDS, resolveMapping } from "../../jobs/handlers/csvImport.js";
import { notFound, validationError } from "../../utils/errors.js";
import { CSV_MAX_BYTES, CSV_MAX_ROWS, parseCsv, toCsv } from "../../utils/csv.js";
import { newId } from "../../utils/ids.js";

const mappingSchema = z
  .object(Object.fromEntries(IMPORT_FIELDS.map((f) => [f, z.string().optional()])))
  .partial()
  .optional();

export async function importRoutes(app: FastifyInstance) {
  /** Synchronous preview: headers, suggested mapping, first rows and parse errors. */
  app.post(
    "/v1/workspaces/:workspaceId/imports/preview",
    { preHandler: authenticateRequired, bodyLimit: CSV_MAX_BYTES + 100_000 },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "import");
      const body = z.object({ csvText: z.string().min(1).max(CSV_MAX_BYTES) }).parse(req.body);
      const parsed = parseCsv(body.csvText);
      return {
        headers: parsed.headers,
        suggestedMapping: resolveMapping(parsed.headers),
        sampleRows: parsed.rows.slice(0, 5),
        rowCount: parsed.rows.length,
        maxRows: CSV_MAX_ROWS,
        errors: parsed.errors.slice(0, 50),
      };
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/imports",
    { preHandler: authenticateRequired, bodyLimit: CSV_MAX_BYTES + 100_000 },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "import");

      const body = z
        .object({
          csvText: z.string().min(1).max(CSV_MAX_BYTES),
          mapping: mappingSchema,
        })
        .parse(req.body);

      if (Buffer.byteLength(body.csvText, "utf8") > CSV_MAX_BYTES) {
        throw validationError("CSV file too large (max 2 MB)");
      }
      const parsed = parseCsv(body.csvText);
      if (!parsed.headers.length) throw validationError(parsed.errors[0] ?? "No valid header row");
      if (parsed.rows.length > CSV_MAX_ROWS) {
        throw validationError(`CSV exceeds ${CSV_MAX_ROWS} row limit`);
      }

      const db = getDb();
      const id = newId("imp");
      await db.insert(importJobs).values({
        id,
        tenantId: m.tenantId,
        workspaceId,
        status: "queued",
        mappingJson: body.mapping ? JSON.stringify(body.mapping) : null,
        createdBy: req.actor!.userId,
      });

      await enqueueCsvImport(id, body.csvText, body.mapping as Record<string, string> | undefined);
      return { importJobId: id, status: "queued" };
    },
  );

  /** Recent imports, so the Accounts page can show the last import's report after a refresh. */
  app.get(
    "/v1/workspaces/:workspaceId/imports",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "import");
      const db = getDb();
      const jobs = await db
        .select()
        .from(importJobs)
        .where(and(eq(importJobs.workspaceId, m.workspaceId), eq(importJobs.tenantId, m.tenantId)))
        .orderBy(desc(importJobs.createdAt))
        .limit(5);
      return {
        imports: jobs.map(({ rowErrorsJson, mappingJson: _mapping, ...j }) => ({
          ...j,
          rowErrors: rowErrorsJson ? (JSON.parse(rowErrorsJson) as string[]) : [],
        })),
      };
    },
  );

  app.get(
    "/v1/imports/:importJobId",
    { preHandler: authenticateRequired },
    async (req) => {
      const { importJobId } = req.params as { importJobId: string };
      const q = z.object({ workspaceId: z.string() }).parse(req.query);
      const m = await loadMembership(req, q.workspaceId);
      requireCap(m, "import");
      const job = await loadJob(importJobId, m.workspaceId, m.tenantId);
      return {
        import: {
          ...job,
          rowErrors: job.rowErrorsJson ? JSON.parse(job.rowErrorsJson) : [],
        },
      };
    },
  );

  /** Formula-safe row error report download (gate 4). */
  app.get(
    "/v1/imports/:importJobId/errors.csv",
    { preHandler: authenticateRequired },
    async (req, reply) => {
      const { importJobId } = req.params as { importJobId: string };
      const q = z.object({ workspaceId: z.string() }).parse(req.query);
      const m = await loadMembership(req, q.workspaceId);
      requireCap(m, "import");
      const job = await loadJob(importJobId, m.workspaceId, m.tenantId);
      const errors: string[] = job.rowErrorsJson ? JSON.parse(job.rowErrorsJson) : [];
      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header("content-disposition", `attachment; filename="import-${job.id}-errors.csv"`);
      return toCsv(["message"], errors.map((e) => [e]));
    },
  );
}

async function loadJob(importJobId: string, workspaceId: string, tenantId: string) {
  const db = getDb();
  const [job] = await db
    .select()
    .from(importJobs)
    .where(
      and(
        eq(importJobs.id, importJobId),
        eq(importJobs.workspaceId, workspaceId),
        eq(importJobs.tenantId, tenantId),
      ),
    )
    .limit(1);
  if (!job) throw notFound("Import not found");
  return job;
}
