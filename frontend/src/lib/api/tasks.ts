import { api } from "./client";

export type Task = {
  id: string;
  accountId: string;
  type: string;
  status: string;
  instruction: string | null;
  outcome: string | null;
  ownerUserId: string;
  dueAt: string | null;
};

export function listTasks(workspaceId: string) {
  return api<{ tasks: Task[] }>(`/v1/workspaces/${workspaceId}/tasks`);
}

export function createTask(body: Record<string, unknown>) {
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
