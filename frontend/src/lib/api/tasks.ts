import { api } from "./client";

export type Task = {
  id: string;
  accountId: string;
  type: "research" | "call" | "email" | "follow_up";
  status: "open" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  instruction: string | null;
  outcome: string | null;
  cancelReason: string | null;
  ownerUserId: string;
  dueAt: string | null;
  timezone: string;
};

export type TaskFilters = {
  ownerUserId?: string;
  status?: string;
  priority?: string;
  accountId?: string;
  due?: "overdue" | "today" | "week";
};

export function listTasks(workspaceId: string, filters: TaskFilters = {}) {
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]);
  return api<{ tasks: Task[] }>(`/v1/workspaces/${workspaceId}/tasks${qs.size ? `?${qs}` : ""}`);
}

export function createTask(body: {
  workspaceId: string;
  accountId: string;
  type: Task["type"];
  ownerUserId: string;
  dueAt?: string;
  timezone?: string;
  instruction?: string;
  priority?: Task["priority"];
  idempotencyKey?: string;
  confirmFollowUp?: boolean;
}) {
  return api<{ task: Task }>("/v1/tasks", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchTask(taskId: string, body: Record<string, unknown>) {
  return api<{ task: Task }>(`/v1/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
