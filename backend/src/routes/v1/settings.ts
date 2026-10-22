import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client.js";
import { offers, playbookVersions } from "../../db/schema/index.js";
import { authenticateRequired } from "../../middleware/authenticate.js";
import { loadMembership, requireCap } from "../../middleware/requireMembership.js";
import { getUsage } from "../../services/budget.js";
import { researchProviderStatus } from "../../providers/research/index.js";
import { newId } from "../../utils/ids.js";
import { writeAudit } from "../../services/audit.js";
import { ensureEntitlements } from "../../services/entitlements.js";
import { listSendingAccounts } from "../../services/campaigns.js";

export async function settingsRoutes(app: FastifyInstance) {
  app.get(
    "/v1/workspaces/:workspaceId/settings/offer",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      const m = await loadMembership(req, workspaceId);
      const db = getDb();
      const [offer] = await db
        .select()
        .from(offers)
        .where(eq(offers.workspaceId, workspaceId))
        .limit(1);
      const playbooks = await db
        .select()
        .from(playbookVersions)
        .where(eq(playbookVersions.workspaceId, workspaceId));
      return {
        offer: offer
          ? {
              ...offer,
              buyerRoles: JSON.parse(offer.buyerRolesJson),
              industries: JSON.parse(offer.industriesJson),
              companySizes: JSON.parse(offer.companySizesJson),
              territory: JSON.parse(offer.territoryJson),
              exclusions: JSON.parse(offer.exclusionsJson),
              structuredQuery: offer.structuredQueryJson
                ? JSON.parse(offer.structuredQueryJson)
                : null,
              unsupportedFilters: JSON.parse(offer.unsupportedFiltersJson),
            }
          : null,
        playbooks,
      };
    },
  );

  app.put(
    "/v1/workspaces/:workspaceId/settings/offer",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      const m = await loadMembership(req, workspaceId);
      requireCap(m, "manage_settings");
      const body = z
        .object({
          offering: z.string(),
          buyerRoles: z.array(z.string()).default([]),
          industries: z.array(z.string()).default([]),
          companySizes: z.array(z.string()).default([]),
          territory: z.array(z.string()).default([]),
          exclusions: z.array(z.string()).default([]),
          eventWindowDays: z.number().int().positive().default(90),
          naturalLanguageBrief: z.string().optional(),
        })
        .parse(req.body);

      // Parse NL brief into visible structured query; surface unsupported filters
      const unsupported: string[] = [];
      const structured: Record<string, unknown> = {
        offering: body.offering,
        territory: body.territory,
        industries: body.industries,
      };
      if (body.naturalLanguageBrief) {
        const brief = body.naturalLanguageBrief.toLowerCase();
        if (brief.includes("linkedin") || brief.includes("intent score")) {
          unsupported.push("LinkedIn/intent score filters are not supported in Phase 1");
        }
        structured.briefTokens = body.naturalLanguageBrief.split(/\s+/).slice(0, 40);
      }

      const db = getDb();
      const [existing] = await db
        .select()
        .from(offers)
        .where(eq(offers.workspaceId, workspaceId))
        .limit(1);

      if (existing) {
        await db
          .update(offers)
          .set({
            offering: body.offering,
            buyerRolesJson: JSON.stringify(body.buyerRoles),
            industriesJson: JSON.stringify(body.industries),
            companySizesJson: JSON.stringify(body.companySizes),
            territoryJson: JSON.stringify(body.territory),
            exclusionsJson: JSON.stringify(body.exclusions),
            eventWindowDays: body.eventWindowDays,
            naturalLanguageBrief: body.naturalLanguageBrief,
            structuredQueryJson: JSON.stringify(structured),
            unsupportedFiltersJson: JSON.stringify(unsupported),
            version: existing.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(offers.id, existing.id));
      } else {
        await db.insert(offers).values({
          id: newId("ofr"),
          tenantId: m.tenantId,
          workspaceId,
          offering: body.offering,
          buyerRolesJson: JSON.stringify(body.buyerRoles),
          industriesJson: JSON.stringify(body.industries),
          companySizesJson: JSON.stringify(body.companySizes),
          territoryJson: JSON.stringify(body.territory),
          exclusionsJson: JSON.stringify(body.exclusions),
          eventWindowDays: body.eventWindowDays,
          naturalLanguageBrief: body.naturalLanguageBrief,
          structuredQueryJson: JSON.stringify(structured),
          unsupportedFiltersJson: JSON.stringify(unsupported),
        });
      }

      await writeAudit({
        tenantId: m.tenantId,
        workspaceId,
        actorUserId: req.actor!.userId,
        action: "settings.offer.updated",
      });

      return { ok: true, unsupportedFilters: unsupported, structuredQuery: structured };
    },
  );

  app.get(
    "/v1/workspaces/:workspaceId/settings/connections",
    { preHandler: authenticateRequired },
    async (req) => {
      const { workspaceId } = req.params as { workspaceId: string };
      const m = await loadMembership(req, workspaceId);
      const usage = await getUsage(m.tenantId);
      const entitlements = await ensureEntitlements(m.tenantId, workspaceId);
      const sending = await listSendingAccounts(workspaceId);
      const enabledMailbox = sending.accounts.some((a) => a.enabled);
      return {
        research: researchProviderStatus(),
        usage,
        entitlements,
        crm: {
          configured: false,
          skipped: true,
          note: "CRM sync is not enabled in this deployment",
        },
        sending: {
          provider: "simulated",
          enabled: enabledMailbox && entitlements.sendingEnabled && !entitlements.sendingKillSwitch,
          accounts: sending.accounts.length,
          domains: sending.domains.length,
        },
        monitors: { enabled: entitlements.monitorsEnabled },
      };
    },
  );
}
