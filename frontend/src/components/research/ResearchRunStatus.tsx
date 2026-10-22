"use client";

import { useResearchRun } from "../../hooks/useResearchRun";
import { StatusBadge } from "../common/StatusBadge";
import { Card } from "../ui/Card";

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
    <Card className="!p-4 text-sm" aria-live="polite">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-[var(--foreground)]">Research run</span>
        {status ? <StatusBadge status={status} /> : null}
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded bg-[var(--chip-bg)]">
        <div
          className="h-full bg-[var(--red)] transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      {error ? <p className="mt-2 text-[var(--red-active)]">{error}</p> : null}
    </Card>
  );
}
