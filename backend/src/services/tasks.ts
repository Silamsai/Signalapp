import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { activities, tasks, type TaskStatus, type TaskType } from "../db/schema/index.js";
import { validationError } from "../utils/errors.js";
import { newId } from "../utils/ids.js";
import { isAccountSuppressed } from "./suppressions.js";

export async function createTask(input: {
  tenantId: string;
  workspaceId: string;
  accountId: string;
  type: TaskType;
  ownerUserId: string;
  dueAt?: string | null;
  timezone?: string;
  instruction?: string;
  priority?: string;
  idempotencyKey?: string;
  createdBy: string;
  confirmFollowUp?: boolean;
}) {
  if (input.type === "follow_up" && !input.confirmFollowUp) {
    throw validationError("Proposed follow-up task requires confirmation");
  }

  if (await isAccountSuppressed(input.workspaceId, input.accountId)) {
    throw validationError("Cannot create task for suppressed account");
  }

  const db = getDb();
  if (input.idempotencyKey) {
    const existing = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.workspaceId, input.workspaceId),
          eq(tasks.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1);
    if (existing[0]) return existing[0];
  }
  const id = newId("tsk");
  await db.insert(tasks).values({
    id,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    accountId: input.accountId,
    type: input.type,
    ownerUserId: input.ownerUserId,
    dueAt: input.dueAt ? new Date(input.dueAt) : null,
    timezone: input.timezone ?? "UTC",
    instruction: input.instruction,
    priority: input.priority ?? "normal",
    idempotencyKey: input.idempotencyKey,
    createdBy: input.createdBy,
  });
  const [row] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return row!;
}

export async function updateTask(input: {
  tenantId: string;
  workspaceId: string;
  taskId: string;
  status?: TaskStatus;
  outcome?: string;
  cancelReason?: string;
  actorUserId: string;
}) {
  const db = getDb();
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, input.taskId), eq(tasks.workspaceId, input.workspaceId)))
    .limit(1);
  if (!task) throw validationError("Task not found");

  if (input.status === "completed" && !input.outcome) {
    throw validationError("Completion requires an outcome");
  }
  if (input.status === "cancelled" && !input.cancelReason) {
    throw validationError("Cancellation requires a reason");
  }

  await db
    .update(tasks)
    .set({
      status: input.status ?? task.status,
      outcome: input.outcome ?? task.outcome,
      cancelReason: input.cancelReason ?? task.cancelReason,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, task.id));

  if (input.status === "completed" || input.status === "cancelled") {
    await db.insert(activities).values({
      id: newId("act"),
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      accountId: task.accountId,
      taskId: task.id,
      kind: input.status === "completed" ? "task_completed" : "task_cancelled",
      note: input.outcome ?? input.cancelReason,
      actorUserId: input.actorUserId,
    });
  }

  // Explicit: task completion does not update opportunity stage, send messages,
  // or create attended meetings — activity record only (gate 7).
  const [updated] = await db.select().from(tasks).where(eq(tasks.id, task.id)).limit(1);
  return updated!;
}

export async function listTasks(workspaceId: string, filters?: {
  ownerUserId?: string;
  status?: string;
}) {
  const db = getDb();
  let rows = await db.select().from(tasks).where(eq(tasks.workspaceId, workspaceId));
  if (filters?.ownerUserId) rows = rows.filter((t) => t.ownerUserId === filters.ownerUserId);
  if (filters?.status) rows = rows.filter((t) => t.status === filters.status);
  return rows;
}
