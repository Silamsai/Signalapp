"use client";

import Link from "next/link";
import { useState } from "react";
import type { Task } from "../../lib/api/tasks";
import { formatDate } from "../../lib/utils/dates";
import { StatusBadge } from "../common/StatusBadge";
import { EmptyState } from "../common/EmptyState";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { FormError, humanize, inputClass } from "../ui/Field";

type Pending = { taskId: string; kind: "complete" | "cancel" } | null;

export function TaskQueue({
  tasks,
  accountNames,
  peopleNames,
  canEdit,
  onUpdate,
}: {
  tasks: Task[];
  accountNames: Map<string, string>;
  peopleNames: Map<string, string>;
  canEdit: boolean;
  onUpdate: (taskId: string, body: Record<string, unknown>) => Promise<void>;
}) {
  const [pending, setPending] = useState<Pending>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!tasks.length) {
    return <EmptyState title="No tasks match" detail="Change the filters or create a task." />;
  }

  async function submit(taskId: string, body: Record<string, unknown>) {
    setError(null);
    try {
      await onUpdate(taskId, body);
      setPending(null);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  const now = Date.now();
  return (
    <ul className="space-y-3">
      {tasks.map((t) => {
        const open = t.status === "open" || t.status === "in_progress";
        const overdue = open && t.dueAt && new Date(t.dueAt).getTime() < now;
        return (
          <li key={t.id}>
            <Card className="!p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[var(--foreground)]">
                    {humanize(t.type)} ·{" "}
                    <Link href={`/accounts/${t.accountId}`} className="hover:text-[var(--red-active)]">
                      {accountNames.get(t.accountId) ?? "Account"}
                    </Link>
                  </p>
                  <p className="text-sm text-[var(--muted)]">{t.instruction ?? "No instruction"}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Owner {peopleNames.get(t.ownerUserId) ?? "—"} · Due {t.dueAt ? formatDate(t.dueAt) : "—"} ({t.timezone})
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {overdue ? <Badge tone="red">Overdue</Badge> : null}
                  {t.priority !== "normal" ? <Badge tone={t.priority === "urgent" || t.priority === "high" ? "amber" : "default"}>{humanize(t.priority)}</Badge> : null}
                  <StatusBadge status={t.status} />
                </div>
              </div>
              {open && canEdit ? (
                pending?.taskId === t.id ? (
                  <form
                    className="mt-3 space-y-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void submit(
                        t.id,
                        pending.kind === "complete"
                          ? { status: "completed", outcome: text }
                          : { status: "cancelled", cancelReason: text },
                      );
                    }}
                  >
                    <label className="block text-xs font-semibold text-[var(--muted)]">
                      {pending.kind === "complete" ? "Outcome (required)" : "Cancellation reason (required)"}
                      <input autoFocus className={inputClass} value={text} onChange={(e) => setText(e.target.value)} />
                    </label>
                    <FormError message={error} />
                    <div className="flex gap-2">
                      <Button type="submit" variant="primary" disabled={!text.trim()}>
                        {pending.kind === "complete" ? "Complete task" : "Cancel task"}
                      </Button>
                      <Button variant="ghost" onClick={() => setPending(null)}>
                        Back
                      </Button>
                    </div>
                    {pending.kind === "complete" ? (
                      <p className="text-xs text-[var(--muted)]">
                        Completing records activity only. It does not change pipeline stage or log a meeting.
                      </p>
                    ) : null}
                  </form>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {t.status === "open" ? (
                      <Button onClick={() => void submit(t.id, { status: "in_progress" })}>Start</Button>
                    ) : null}
                    <Button variant="primary" onClick={() => setPending({ taskId: t.id, kind: "complete" })}>
                      Complete…
                    </Button>
                    <Button variant="ghost" onClick={() => setPending({ taskId: t.id, kind: "cancel" })}>
                      Cancel…
                    </Button>
                  </div>
                )
              ) : !open ? (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {t.status === "completed" ? `Outcome: ${t.outcome}` : `Cancelled: ${t.cancelReason}`}
                </p>
              ) : null}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
