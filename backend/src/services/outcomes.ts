import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  acceptanceDecisions,
  accounts,
  handoffs,
  tasks,
  workspaces,
} from "../db/schema/index.js";

export async function computeOutcomes(workspaceId: string, from?: string, to?: string) {
  const db = getDb();
  const fromDate = from ? new Date(from) : new Date(Date.now() - 90 * 86400000);
  const toDate = to ? new Date(to) : new Date();

  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  const currency = ws?.currency ?? "GBP";

  const acct = await db.select().from(accounts).where(eq(accounts.workspaceId, workspaceId));
  const decisions = await db
    .select()
    .from(acceptanceDecisions)
    .where(eq(acceptanceDecisions.workspaceId, workspaceId));
  const inRange = decisions.filter(
    (d) => d.createdAt >= fromDate && d.createdAt <= toDate,
  );

  const researched = acct.filter((a) => a.researchState === "researched").length;
  const acceptedAccounts = new Set(
    inRange.filter((d) => d.toState === "accepted").map((d) => d.accountId),
  );
  const decidedAccounts = new Set(inRange.map((d) => d.accountId));
  const returned = inRange.filter((d) => d.toState === "needs_research").length;
  const rejected = inRange.filter((d) => d.toState === "rejected").length;

  const taskRows = await db.select().from(tasks).where(eq(tasks.workspaceId, workspaceId));
  const completedTasks = taskRows.filter(
    (t) => t.status === "completed" && t.updatedAt >= fromDate && t.updatedAt <= toDate,
  ).length;

  const handoffRows = await db
    .select()
    .from(handoffs)
    .where(eq(handoffs.workspaceId, workspaceId));
  const handoffCount = handoffRows.filter(
    (h) => h.createdAt >= fromDate && h.createdAt <= toDate,
  ).length;

  const acceptanceRate =
    decidedAccounts.size === 0
      ? null
      : acceptedAccounts.size / decidedAccounts.size;

  return {
    cohort: { from: fromDate.toISOString(), to: toDate.toISOString() },
    currency,
    denominators: {
      accountsWithReviewerDecision: decidedAccounts.size,
      researchedAccounts: researched,
    },
    metrics: {
      uniqueResearchReviewedAccounts: researched,
      explicitSalesAccepted: acceptedAccounts.size,
      returnedDecisions: returned,
      rejectedDecisions: rejected,
      completedSdrActions: completedTasks,
      partnerHandoffs: handoffCount,
      acceptanceRate,
      attribution: "unassigned",
    },
    notes: [
      "Acceptance rate = distinct accepted accounts / distinct accounts with a reviewer decision",
      "Task completion is an activity count only",
      `Currency ${currency} disclosed for monetary fields when present; Phase 1 has no revenue amounts`,
      "Metrics reconcile from acceptance_decisions, tasks, and handoffs activity records",
    ],
  };
}
