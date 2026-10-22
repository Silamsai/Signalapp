"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { TaskQueue } from "@/components/tasks/TaskQueue";
import { TaskForm } from "@/components/tasks/TaskForm";
import { RequireCap } from "@/components/common/RequireCap";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { useWorkspace } from "@/hooks/useWorkspace";
import { usePersistentState } from "@/hooks/usePersistentState";
import { listTasks, patchTask, type Task, type TaskFilters } from "@/lib/api/tasks";
import { listAccounts, listPeople, type Account } from "@/lib/api/accounts";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";

function SdrQueue({ workspaceId }: { workspaceId: string }) {
  const { can, role, user } = useWorkspace();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [people, setPeople] = useState<Array<{ userId: string; name: string }>>([]);
  const [filters, setFilters] = usePersistentState<TaskFilters>(`${workspaceId}:tasks:filters`, { status: "open" });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [t, a] = await Promise.all([listTasks(workspaceId, filters), listAccounts(workspaceId)]);
      setTasks(t.tasks);
      setAccounts(a.accounts);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load tasks");
    }
  }, [workspaceId, filters]);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    void listPeople(workspaceId)
      .then((r) => setPeople(r.people))
      .catch(() => setPeople(user ? [{ userId: user.id, name: user.name }] : []));
  }, [workspaceId, user]);

  const accountNames = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const peopleNames = useMemo(() => new Map(people.map((p) => [p.userId, p.name])), [people]);
  const set = (k: keyof TaskFilters, v: string) => setFilters((f) => ({ ...f, [k]: v || undefined }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="SDR follow-through"
        title={role === "sdr" ? "My queue" : "SDR queue"}
        description="Research, call, email and follow-up tasks owned by named people. Nothing here sends messages — record what you did and the outcome."
        actions={
          can("tasks") ? (
            <Button variant="primary" onClick={() => setShowForm((s) => !s)}>
              {showForm ? "Close" : "New task"}
            </Button>
          ) : null
        }
      />
      {showForm ? (
        <TaskForm
          workspaceId={workspaceId}
          accounts={accounts}
          onCreated={() => {
            setShowForm(false);
            void refresh();
          }}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-4" role="group" aria-label="Task filters">
        {role !== "sdr" ? (
          <Field label="Owner">
            <select className={inputClass} value={filters.ownerUserId ?? ""} onChange={(e) => set("ownerUserId", e.target.value)}>
              <option value="">Everyone</option>
              {people.map((p) => (
                <option key={p.userId} value={p.userId}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="Status">
          <select className={inputClass} value={filters.status ?? ""} onChange={(e) => set("status", e.target.value)}>
            <option value="">Any</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>
        <Field label="Due">
          <select className={inputClass} value={filters.due ?? ""} onChange={(e) => set("due", e.target.value)}>
            <option value="">Any time</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due within 24 hours</option>
            <option value="week">Due within 7 days</option>
          </select>
        </Field>
        <Field label="Priority">
          <select className={inputClass} value={filters.priority ?? ""} onChange={(e) => set("priority", e.target.value)}>
            <option value="">Any</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </Field>
      </div>

      {error ? <ErrorState message={error} /> : null}
      {tasks === null ? (
        <LoadingState label="Loading tasks…" />
      ) : (
        <TaskQueue
          tasks={tasks}
          accountNames={accountNames}
          peopleNames={peopleNames}
          canEdit={can("tasks")}
          onUpdate={async (taskId, body) => {
            await patchTask(taskId, { workspaceId, ...body });
            await refresh();
          }}
        />
      )}
    </div>
  );
}

export default function OutreachPage() {
  return <RequireCap cap="view_tasks">{(workspaceId) => <SdrQueue workspaceId={workspaceId} />}</RequireCap>;
}
