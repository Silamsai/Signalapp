"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "../../../../components/layout/PageHeader";
import { StatusBadge } from "../../../../components/common/StatusBadge";
import { useWorkspace } from "../../../../hooks/useWorkspace";
import { listAccounts, type Account } from "../../../../lib/api/accounts";
import { LoadingState } from "../../../../components/common/LoadingState";
import { ErrorState } from "../../../../components/common/ErrorState";

const STAGES = ["draft", "ready_for_review", "accepted", "needs_research", "rejected"];

export default function PipelinePage() {
  const { workspaceId, loading, error } = useWorkspace();
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    if (!workspaceId) return;
    void listAccounts(workspaceId).then((r) => setAccounts(r.accounts));
  }, [workspaceId]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader
        title="Pipeline"
        description="Acceptance is independent of opportunity stage and tasks."
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {STAGES.map((stage) => (
          <div key={stage} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <StatusBadge status={stage} />
              <span className="text-xs text-slate-500">
                {accounts.filter((a) => a.acceptanceState === stage).length}
              </span>
            </div>
            <ul className="space-y-2 text-sm">
              {accounts
                .filter((a) => a.acceptanceState === stage)
                .map((a) => (
                  <li key={a.id} className="text-slate-800">
                    {a.name}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
