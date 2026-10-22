"use client";

import type { Task } from "../../lib/api/tasks";
import { StatusBadge } from "../common/StatusBadge";
import { EmptyState } from "../common/EmptyState";

export function TaskQueue({
  tasks,
  onComplete,
}: {
  tasks: Task[];
  onComplete: (taskId: string, outcome: string) => void;
}) {
  if (!tasks.length) {
    return <EmptyState title="No SDR tasks" detail="Create research, call, email, or follow-up tasks." />;
  }
  return (
    <ul className="space-y-3">
      {tasks.map((t) => (
        <li key={t.id} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium capitalize text-slate-900">{t.type.replace("_", " ")}</p>
              <p className="text-sm text-slate-600">{t.instruction ?? "No instruction"}</p>
            </div>
            <StatusBadge status={t.status} />
          </div>
          {t.status !== "completed" && t.status !== "cancelled" ? (
            <button
              type="button"
              className="mt-3 rounded bg-teal-800 px-3 py-1.5 text-sm text-white"
              onClick={() => {
                const outcome = window.prompt("Outcome (required)") ?? "";
                if (outcome) onComplete(t.id, outcome);
              }}
            >
              Complete
            </button>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Outcome: {t.outcome}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
