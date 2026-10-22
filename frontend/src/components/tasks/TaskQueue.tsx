"use client";

import type { Task } from "../../lib/api/tasks";
import { StatusBadge } from "../common/StatusBadge";
import { EmptyState } from "../common/EmptyState";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

export function TaskQueue({
  tasks,
  onComplete,
}: {
  tasks: Task[];
  onComplete: (taskId: string, outcome: string) => void;
}) {
  if (!tasks.length) {
    return (
      <EmptyState
        title="No SDR tasks"
        detail="Create research, call, email, or follow-up tasks."
      />
    );
  }
  return (
    <ul className="space-y-3">
      {tasks.map((t) => (
        <li key={t.id}>
          <Card className="!p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold capitalize text-[var(--foreground)]">
                  {t.type.replace("_", " ")}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  {t.instruction ?? "No instruction"}
                </p>
              </div>
              <StatusBadge status={t.status} />
            </div>
            {t.status !== "completed" && t.status !== "cancelled" ? (
              <Button
                className="mt-3"
                variant="primary"
                onClick={() => {
                  const outcome = window.prompt("Outcome (required)") ?? "";
                  if (outcome) onComplete(t.id, outcome);
                }}
              >
                Complete
              </Button>
            ) : (
              <p className="mt-2 text-xs text-[var(--muted)]">Outcome: {t.outcome}</p>
            )}
          </Card>
        </li>
      ))}
    </ul>
  );
}
