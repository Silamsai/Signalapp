"use client";

import { useResearchRun } from "../../hooks/useResearchRun";
import { StatusBadge } from "../common/StatusBadge";

export function ResearchRunStatus({
  runId,
  workspaceId,
}: {
  runId: string | null;
  workspaceId: string | null;
}) {
  const { status, progress, error } = useResearchRun(runId, workspaceId);
  if (!runId) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm" aria-live="polite">
      <div className="flex items-center gap-2">
        <span className="font-medium text-slate-800">Research run</span>
        {status ? <StatusBadge status={status} /> : null}
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded bg-slate-100">
        <div className="h-full bg-teal-600 transition-all" style={{ width: `${progress}%` }} />
      </div>
      {error ? <p className="mt-2 text-red-700">{error}</p> : null}
    </div>
  );
}
