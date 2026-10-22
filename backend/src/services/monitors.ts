import { and, desc, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getDb } from "../db/client.js";
import {
  changeEvents,
  memberships,
  monitorRuns,
  monitors,
  type MonitorRunStatus,
} from "../db/schema/index.js";
import { validationError } from "../utils/errors.js";
import { newId } from "../utils/ids.js";
import { assertMonitorsAllowed, assertResearchAllowed } from "./entitlements.js";
import { createNotification } from "./notifications.js";
import { writeAudit } from "./audit.js";
import { getResearchProvider } from "../providers/research/index.js";
import { isExaConfigured } from "../config/env.js";

export async function listMonitors(workspaceId: string) {
  const db = getDb();
  return db
    .select()
    .from(monitors)
    .where(eq(monitors.workspaceId, workspaceId))
    .orderBy(desc(monitors.createdAt));
}

export async function createMonitor(input: {
  tenantId: string;
  workspaceId: string;
  name: string;
  query: string;
  accountId?: string;
  cadenceHours?: number;
  createdBy: string;
}) {
  await assertMonitorsAllowed(input.tenantId, input.workspaceId);
  const db = getDb();
  const id = newId("mon");
  await db.insert(monitors).values({
    id,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    accountId: input.accountId,
    name: input.name,
    query: input.query,
    cadenceHours: input.cadenceHours ?? 24,
    createdBy: input.createdBy,
  });
  await writeAudit({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    actorUserId: input.createdBy,
    action: "monitor.created",
    entityType: "monitor",
    entityId: id,
  });
  const [row] = await db.select().from(monitors).where(eq(monitors.id, id)).limit(1);
  return row!;
}

export async function patchMonitor(
  workspaceId: string,
  monitorId: string,
  patch: { status?: "active" | "paused" | "killed"; name?: string; cadenceHours?: number },
) {
  const db = getDb();
  const [m] = await db
    .select()
    .from(monitors)
    .where(and(eq(monitors.id, monitorId), eq(monitors.workspaceId, workspaceId)))
    .limit(1);
  if (!m) throw validationError("Monitor not found");
  await db
    .update(monitors)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(monitors.id, monitorId));
  const [row] = await db.select().from(monitors).where(eq(monitors.id, monitorId)).limit(1);
  return row!;
}

export async function runMonitor(monitorId: string) {
  const db = getDb();
  const [m] = await db.select().from(monitors).where(eq(monitors.id, monitorId)).limit(1);
  if (!m) throw validationError("Monitor not found");
  if (m.status !== "active") {
    return { skipped: true, reason: m.status };
  }

  await assertMonitorsAllowed(m.tenantId, m.workspaceId);

  const runId = newId("mnr");
  await db.insert(monitorRuns).values({
    id: runId,
    tenantId: m.tenantId,
    workspaceId: m.workspaceId,
    monitorId: m.id,
    status: "failed",
  });
  await db
    .update(monitors)
    .set({ lastAttemptAt: new Date(), updatedAt: new Date() })
    .where(eq(monitors.id, m.id));

  let status: MonitorRunStatus = "failed";
  let summary: string | null = null;
  let error: string | null = null;

  try {
    await assertResearchAllowed(m.tenantId, m.workspaceId);
    if (!isExaConfigured()) {
      // Dry-run simulated monitor hit when Exa is not configured
      status = "success";
      summary = `Simulated monitor check for: ${m.query}`;
      const dedupeKey = createHash("sha256")
        .update(`${m.id}|sim|${new Date().toISOString().slice(0, 10)}`)
        .digest("hex")
        .slice(0, 24);
      const [existing] = await db
        .select()
        .from(changeEvents)
        .where(and(eq(changeEvents.monitorId, m.id), eq(changeEvents.dedupeKey, dedupeKey)))
        .limit(1);
      if (!existing) {
        const changeId = newId("chg");
        await db.insert(changeEvents).values({
          id: changeId,
          tenantId: m.tenantId,
          workspaceId: m.workspaceId,
          monitorId: m.id,
          dedupeKey,
          title: `Change detected · ${m.name}`,
          detail: summary,
          material: true,
        });
        await notifyWorkspaceAdmins(m.tenantId, m.workspaceId, {
          kind: "monitor.change",
          title: `Monitor alert: ${m.name}`,
          body: summary,
          entityType: "monitor",
          entityId: m.id,
        });
      }
    } else {
      const provider = getResearchProvider();
      const result = await provider.discover(m.query, {}, 1);
      if (!result.items.length) {
        status = "no_results";
        summary = "No results";
      } else {
        status = "success";
        summary = `Found ${result.items.length} sources`;
        const top = result.items[0]!;
        const dedupeKey = createHash("sha256")
          .update(`${m.id}|${top.canonicalUrl}`)
          .digest("hex")
          .slice(0, 24);
        const [existing] = await db
          .select()
          .from(changeEvents)
          .where(and(eq(changeEvents.monitorId, m.id), eq(changeEvents.dedupeKey, dedupeKey)))
          .limit(1);
        if (!existing) {
          await db.insert(changeEvents).values({
            id: newId("chg"),
            tenantId: m.tenantId,
            workspaceId: m.workspaceId,
            monitorId: m.id,
            dedupeKey,
            title: top.title || "New signal",
            detail: top.canonicalUrl,
            material: true,
          });
          await notifyWorkspaceAdmins(m.tenantId, m.workspaceId, {
            kind: "monitor.change",
            title: `Monitor alert: ${m.name}`,
            body: top.title || top.canonicalUrl,
            entityType: "monitor",
            entityId: m.id,
          });
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/budget|quota|rate/i.test(msg)) status = "budget_exhausted";
    else if (/network|timeout|provider|exa/i.test(msg)) status = "outage";
    else status = "failed";
    error = msg;
  }

  await db
    .update(monitorRuns)
    .set({ status, resultSummary: summary, error, finishedAt: new Date() })
    .where(eq(monitorRuns.id, runId));

  await db
    .update(monitors)
    .set({
      lastRunStatus: status,
      lastSuccessAt: status === "success" ? new Date() : m.lastSuccessAt,
      updatedAt: new Date(),
    })
    .where(eq(monitors.id, m.id));

  return { runId, status, summary, error };
}

async function notifyWorkspaceAdmins(
  tenantId: string,
  workspaceId: string,
  n: { kind: string; title: string; body?: string; entityType?: string; entityId?: string },
) {
  const db = getDb();
  const members = await db
    .select()
    .from(memberships)
    .where(eq(memberships.workspaceId, workspaceId));
  for (const mem of members) {
    if (mem.role === "tenant_admin" || mem.role === "sales_reviewer" || mem.role === "researcher") {
      await createNotification({
        tenantId,
        workspaceId,
        userId: mem.userId,
        ...n,
      });
    }
  }
}
