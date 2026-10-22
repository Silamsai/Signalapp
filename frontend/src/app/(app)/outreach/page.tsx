"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../../../components/layout/PageHeader";
import { TaskQueue } from "../../../components/tasks/TaskQueue";
import { TaskForm } from "../../../components/tasks/TaskForm";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { listTasks, patchTask, type Task } from "../../../lib/api/tasks";
import { listAccounts, type Account } from "../../../lib/api/accounts";
import { me } from "../../../lib/auth/session";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";

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
    void me().then((r) => setUserId(r.user.id)).catch(() => undefined);
    void refresh();
  }, [refresh]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!workspaceId) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="SDR queue"
        description="Research, call, email, and follow-up tasks. Phase 1 stores activity only — no message dispatch."
        actions={
          <>
            <Link href="/outreach/drafts" className="rounded border border-slate-300 px-3 py-1.5 text-sm">
              Drafts
            </Link>
            <span className="rounded bg-slate-100 px-3 py-1.5 text-sm text-slate-500" title="Phase 3">
              Campaigns (Phase 3)
            </span>
            <span className="rounded bg-slate-100 px-3 py-1.5 text-sm text-slate-500" title="Phase 3">
              Replies (Phase 3)
            </span>
          </>
        }
      />
      <label className="block max-w-md text-xs font-medium text-slate-600">
        Account for new task
        <select
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
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
      <TaskQueue
        tasks={tasks}
        onComplete={async (taskId, outcome) => {
          await patchTask(taskId, { workspaceId, status: "completed", outcome });
          await refresh();
        }}
      />
    </div>
  );
}
