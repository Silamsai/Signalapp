import type { FastifyInstance } from "fastify";
import { authRoutes } from "./auth.js";
import { workspaceRoutes } from "./workspaces.js";
import { settingsRoutes } from "./settings.js";
import { accountRoutes } from "./accounts.js";
import { importRoutes } from "./imports.js";
import { researchRunRoutes } from "./researchRuns.js";
import { qualificationRoutes } from "./qualification.js";
import { acceptanceRoutes } from "./acceptance.js";
import { taskRoutes } from "./tasks.js";
import { handoffRoutes } from "./handoffs.js";
import { draftRoutes } from "./drafts.js";
import { outcomeRoutes } from "./outcomes.js";
import { monitorRoutes } from "./monitors.js";
import { notificationRoutes } from "./notifications.js";
import { campaignRoutes } from "./campaigns.js";
import { scoringRoutes } from "./scoring.js";
import { membershipRoutes } from "./memberships.js";

export async function v1Routes(app: FastifyInstance) {
  await authRoutes(app);
  await workspaceRoutes(app);
  await membershipRoutes(app);
  await settingsRoutes(app);
  await accountRoutes(app);
  await importRoutes(app);
  await researchRunRoutes(app);
  await qualificationRoutes(app);
  await acceptanceRoutes(app);
  await taskRoutes(app);
  await handoffRoutes(app);
  await draftRoutes(app);
  await outcomeRoutes(app);
  await monitorRoutes(app);
  await notificationRoutes(app);
  await campaignRoutes(app);
  await scoringRoutes(app);
}
