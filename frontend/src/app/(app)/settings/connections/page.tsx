"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "../../../../components/layout/PageHeader";
import { useWorkspace } from "../../../../hooks/useWorkspace";
import { getConnections } from "../../../../lib/api/settings";
import { LoadingState } from "../../../../components/common/LoadingState";
import { ErrorState } from "../../../../components/common/ErrorState";

export default function ConnectionsPage() {
  const { workspaceId, loading, error } = useWorkspace();
  const [data, setData] = useState<Awaited<ReturnType<typeof getConnections>> | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    void getConnections(workspaceId).then(setData);
  }, [workspaceId]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connections & usage"
        description="Provider status and per-tenant research caps. API keys never appear in the browser."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Exa research</h2>
          <p className="mt-2 text-sm text-slate-700">
            Status:{" "}
            <strong>{data.research.configured ? "Configured" : "Not configured"}</strong>
          </p>
          {!data.research.configured ? (
            <p className="mt-2 text-sm text-amber-800">
              Set <code className="rounded bg-slate-100 px-1">EXA_API_KEY</code> in{" "}
              <code className="rounded bg-slate-100 px-1">backend/.env</code> and restart the API
              + worker.
            </p>
          ) : null}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Research usage</h2>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {data.usage.usedMonthly} / {data.usage.quotaMonthly}
          </p>
          <p className="text-sm text-slate-600">Monthly units reserved/used</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 opacity-80">
          <h2 className="font-semibold text-slate-900">CRM</h2>
          <p className="mt-2 text-sm text-slate-600">Phase {data.crm.phase} — not enabled</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 opacity-80">
          <h2 className="font-semibold text-slate-900">Sending / campaigns</h2>
          <p className="mt-2 text-sm text-slate-600">Phase {data.sending.phase} — disabled</p>
        </div>
      </div>
    </div>
  );
}
