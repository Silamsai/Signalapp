import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticateRequired } from "../../middleware/authenticate.js";
import { loadMembership, requireCap } from "../../middleware/requireMembership.js";
import {
  approveCampaign,
  createCampaign,
  getCampaignDetail,
  launchCampaign,
  listCampaigns,
  listConversations,
  listSendingAccounts,
  addSendingAccount,
  addSendingDomain,
  enableSendingAccount,
  pauseCampaign,
  recordSimulatedReply,
  saveCampaignDraft,
  submitForApproval,
  testSend,
  verifySendingDomain,
  processUnsubscribeToken,
} from "../../services/campaigns.js";
import { ensureEntitlements, updateEntitlements } from "../../services/entitlements.js";

export async function campaignRoutes(app: FastifyInstance) {
  app.get(
    "/v1/workspaces/:workspaceId/campaigns",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      await loadMembership(req, workspaceId);
      return { campaigns: await listCampaigns(workspaceId) };
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/campaigns",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "campaign_operate");
      const body = z
        .object({ name: z.string().min(1), objective: z.string().optional() })
        .parse(req.body);
      const campaign = await createCampaign({
        tenantId: m.tenantId,
        workspaceId,
        name: body.name,
        objective: body.objective,
        ownerUserId: req.actor!.userId,
      });
      return { campaign };
    },
  );

  app.get(
    "/v1/workspaces/:workspaceId/campaigns/:campaignId",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId, campaignId } = req.params as { workspaceId: string; campaignId: string };
      await loadMembership(req, workspaceId);
      return getCampaignDetail(workspaceId, campaignId);
    },
  );

  app.put(
    "/v1/workspaces/:workspaceId/campaigns/:campaignId/draft",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId, campaignId } = req.params as { workspaceId: string; campaignId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "campaign_operate");
      const body = z
        .object({
          subject: z.string().min(1),
          bodyHtml: z.string().min(1),
          audience: z.array(
            z.object({ accountId: z.string(), email: z.string().email() }),
          ),
          delayHours: z.number().int().min(0).optional(),
          sendingAccountId: z.string().optional(),
        })
        .parse(req.body);
      return saveCampaignDraft({
        tenantId: m.tenantId,
        workspaceId,
        campaignId,
        ...body,
        actorUserId: req.actor!.userId,
      });
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/campaigns/:campaignId/submit",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId, campaignId } = req.params as { workspaceId: string; campaignId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "campaign_operate");
      return submitForApproval(workspaceId, campaignId, req.actor!.userId);
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/campaigns/:campaignId/approve",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId, campaignId } = req.params as { workspaceId: string; campaignId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "campaign_approve");
      return approveCampaign(workspaceId, campaignId, req.actor!.userId);
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/campaigns/:campaignId/launch",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId, campaignId } = req.params as { workspaceId: string; campaignId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "campaign_operate");
      return launchCampaign(workspaceId, campaignId, req.actor!.userId);
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/campaigns/:campaignId/pause",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId, campaignId } = req.params as { workspaceId: string; campaignId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "campaign_operate");
      return pauseCampaign(workspaceId, campaignId, req.actor!.userId);
    },
  );

  app.get(
    "/v1/workspaces/:workspaceId/conversations",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      await loadMembership(req, workspaceId);
      return { conversations: await listConversations(workspaceId) };
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/replies/simulate",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "campaign_operate");
      const body = z
        .object({
          enrollmentId: z.string(),
          bodyText: z.string().min(1),
          classification: z.string().optional(),
        })
        .parse(req.body);
      return recordSimulatedReply({
        workspaceId,
        ...body,
        actorUserId: req.actor!.userId,
      });
    },
  );

  app.get(
    "/v1/workspaces/:workspaceId/sending",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      await loadMembership(req, workspaceId);
      return listSendingAccounts(workspaceId);
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/sending/domains",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "manage_sending");
      const body = z.object({ domain: z.string().min(3) }).parse(req.body);
      const domain = await addSendingDomain({
        tenantId: m.tenantId,
        workspaceId,
        domain: body.domain,
      });
      return { domain };
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/sending/domains/:domainId/verify",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId, domainId } = req.params as { workspaceId: string; domainId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "manage_sending");
      return { domain: await verifySendingDomain(workspaceId, domainId) };
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/sending/accounts",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "manage_sending");
      const body = z
        .object({
          domainId: z.string(),
          mailbox: z.string().email(),
          displayName: z.string().optional(),
        })
        .parse(req.body);
      const account = await addSendingAccount({
        tenantId: m.tenantId,
        workspaceId,
        ...body,
      });
      return { account };
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/sending/accounts/:accountId/enable",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId, accountId } = req.params as { workspaceId: string; accountId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "manage_sending");
      const body = z.object({ enabled: z.boolean() }).parse(req.body);
      return { account: await enableSendingAccount(workspaceId, accountId, body.enabled) };
    },
  );

  app.post(
    "/v1/workspaces/:workspaceId/sending/accounts/:accountId/test",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId, accountId } = req.params as { workspaceId: string; accountId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "manage_sending");
      const body = z.object({ to: z.string().email() }).parse(req.body);
      return { result: await testSend(workspaceId, accountId, body.to) };
    },
  );

  app.get(
    "/v1/workspaces/:workspaceId/entitlements",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      const m = await loadMembership(req, workspaceId);
      return { entitlements: await ensureEntitlements(m.tenantId, workspaceId) };
    },
  );

  app.patch(
    "/v1/workspaces/:workspaceId/entitlements",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "manage_entitlements");
      await ensureEntitlements(m.tenantId, workspaceId);
      const body = z
        .object({
          researchEnabled: z.boolean().optional(),
          sendingEnabled: z.boolean().optional(),
          monitorsEnabled: z.boolean().optional(),
          researchKillSwitch: z.boolean().optional(),
          sendingKillSwitch: z.boolean().optional(),
          sendQuotaMonthly: z.number().int().positive().optional(),
        })
        .parse(req.body);
      return { entitlements: await updateEntitlements(workspaceId, body) };
    },
  );

  // Public unsubscribe (token-gated)
  app.post("/v1/unsubscribe", async (req) => {
    const body = z
      .object({ workspaceId: z.string(), address: z.string().email(), token: z.string() })
      .parse(req.body);
    return processUnsubscribeToken(body.workspaceId, body.address, body.token);
  });
}
