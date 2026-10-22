import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client.js";
import { importJobs } from "../../db/schema/index.js";
import { authenticateRequired } from "../../middleware/authenticate.js";
import { loadMembership, requireCap } from "../../middleware/requireMembership.js";
import { enqueueCsvImport } from "../../jobs/queue.js";
import { validationError } from "../../utils/errors.js";
import { newId } from "../../utils/ids.js";

export async function importRoutes(app: FastifyInstance) {
  app.post(
    "/v1/workspaces/:workspaceId/imports",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "import");

      const body = z
        .object({
          csvText: z.string().min(1).max(2_000_000),
        })
        .parse(req.body);

      if (Buffer.byteLength(body.csvText, "utf8") > 2_000_000) {
        throw validationError("CSV file too large (max ~2MB)");
      }

      const db = getDb();
      const id = newId("imp");
      await db.insert(importJobs).values({
        id,
        tenantId: m.tenantId,
        workspaceId,
        status: "queued",
        createdBy: req.actor!.userId,
      });

      await enqueueCsvImport(id, body.csvText);
      return { importJobId: id, status: "queued" };
    },
  );

  app.get(
    "/v1/imports/:importJobId",
    { preHandler: authenticateRequired },
    async (req) => {
      const { importJobId } = req.params as { importJobId: string };
      const q = z.object({ workspaceId: z.string() }).parse(req.query);
      await loadMembership(req, q.workspaceId);
      const db = getDb();
      const [job] = await db
        .select()
        .from(importJobs)
        .where(eq(importJobs.id, importJobId))
        .limit(1);
      if (!job || job.workspaceId !== q.workspaceId) {
        return { error: { code: "not_found", message: "Import not found" } };
      }
      return {
        import: {
          ...job,
          rowErrors: job.rowErrorsJson ? JSON.parse(job.rowErrorsJson) : [],
        },
      };
    },
  );
}
