"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { TaskQueue } from "@/components/tasks/TaskQueue";
import { TaskForm } from "@/components/tasks/TaskForm";
import { useWorkspace } from "@/hooks/useWorkspace";
import { listTasks, patchTask, type Task } from "@/lib/api/tasks";
import { listAccounts, type Account } from "@/lib/api/accounts";
import { me } from "@/lib/auth/session";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { Badge } from "@/components/ui/Badge";

export default function OutreachPage() {
  const { workspaceId, loading, error } = useWorkspace();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [userId, setUserId] = useState("");
  const [accountId, setAccountId] = useState("");

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    const [t, a] = await Promise.all([listTasks(workspaceId), listAccounts(workspaceId)]);
    setTasks(t.tasks);
    setAccounts(a.accounts);
    if (!accountId && a.accounts[0]) setAccountId(a.accounts[0].id);
  }, [workspaceId, accountId]);

  useEffect(() => {
    void me()
      .then((r) => setUserId(r.user.id))
      .catch(() => undefined);
    void refresh();
  }, [refresh]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!workspaceId) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="SDR follow-through"
        title="SDR queue"
        description="Research, call, email, and follow-up tasks. Phase 1 stores activity only — no message dispatch."
        actions={<Badge tone="default">Campaigns · Phase 3</Badge>}
      />
      <label className="block max-w-md text-xs font-semibold text-[var(--muted)]">
        Account for new task
        <select
          className="mt-1.5 w-full rounded-[7px] border border-[var(--input-border)] px-2 py-2 text-sm font-normal text-[var(--foreground)]"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      {accountId && userId ? (
        <TaskForm
          workspaceId={workspaceId}
          accountId={accountId}
          ownerUserId={userId}
          onCreated={refresh}
        />
      ) : null}
      <div>
        <h2 className="mb-3 text-[16px]">Open and completed tasks</h2>
        <TaskQueue
          tasks={tasks}
          onComplete={async (taskId, outcome) => {
            await patchTask(taskId, { workspaceId, status: "completed", outcome });
            await refresh();
          }}
        />
      </div>
    </div>
  );
}
