"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "../../../../components/layout/PageHeader";
import { useWorkspace } from "../../../../hooks/useWorkspace";
import { getOutcomes } from "../../../../lib/api/settings";
import { LoadingState } from "../../../../components/common/LoadingState";
import { ErrorState } from "../../../../components/common/ErrorState";

export default function OutcomesPage() {
  const { workspaceId, loading, error } = useWorkspace();
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    void getOutcomes(workspaceId).then(setData);
  }, [workspaceId]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;

  const metrics = data.metrics as Record<string, number | null>;
  const denominators = data.denominators as Record<string, number>;
  const cohort = data.cohort as { from: string; to: string };
  const notes = data.notes as string[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outcomes"
        description={`Cohort ${new Date(cohort.from).toLocaleDateString()} – ${new Date(cohort.to).toLocaleDateString()}. Denominators disclosed.`}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(metrics).map(([k, v]) => (
          <div key={k} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {k.replace(/([A-Z])/g, " $1")}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {v == null ? "—" : typeof v === "number" && k.includes("Rate") ? `${(v * 100).toFixed(0)}%` : v}
            </p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <p>
          Accounts with reviewer decision: {denominators.accountsWithReviewerDecision} · Researched:{" "}
          {denominators.researchedAccounts}
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-600">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
