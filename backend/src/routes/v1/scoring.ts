import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateRequired } from "../../middleware/authenticate.js";
import { loadMembership, requireCap } from "../../middleware/requireMembership.js";
import {
  activateScoreModel,
  createScoreModel,
  evaluateScoreModel,
  listScoreModels,
  rollbackScoreModel,
} from "../../services/scoreModels.js";

export async function scoringRoutes(app: FastifyInstance) {
  app.get(
    "/v1/workspaces/:workspaceId/score-models",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      await loadMembership(req, workspaceId);
      return { models: await listScoreModels(workspaceId) };
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/score-models",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "manage_score_models");
      const body = z
        .object({
          name: z.string().min(1),
          rules: z.record(z.unknown()).optional(),
          notes: z.string().optional(),
        })
        .parse(req.body);
      const model = await createScoreModel({
        tenantId: m.tenantId,
        workspaceId,
        name: body.name,
        rules: body.rules,
        notes: body.notes,
        createdBy: req.actor!.userId,
      });
      return { model };
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/score-models/:modelId/evaluate",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId, modelId } = req.params as { workspaceId: string; modelId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "manage_score_models");
      return { eval: await evaluateScoreModel(workspaceId, modelId) };
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/score-models/:modelId/activate",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId, modelId } = req.params as { workspaceId: string; modelId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "manage_score_models");
      return { models: await activateScoreModel(workspaceId, modelId, req.actor!.userId) };
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/score-models/:modelId/rollback",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId, modelId } = req.params as { workspaceId: string; modelId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "manage_score_models");
      return { models: await rollbackScoreModel(workspaceId, modelId, req.actor!.userId) };
    },
  );
}
