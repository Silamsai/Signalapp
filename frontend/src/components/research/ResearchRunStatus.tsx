"use client";

import { useResearchRun } from "../../hooks/useResearchRun";
import type { ResearchRun } from "../../lib/api/research";
import { StatusBadge } from "../common/StatusBadge";
import { Card } from "../ui/Card";

const ERROR_TEXT: Record<string, string> = {
  provider_timeout: "The research provider timed out.",
  provider_rate_limited: "The research provider is rate-limiting requests.",
  provider_unavailable: "The research provider is temporarily unavailable.",
  provider_auth: "The research provider rejected the configured API key. An admin needs to check it.",
  suppressed: "This account is suppressed, so research was cancelled and not charged.",
};

/** Distinct queued / running / retrying / no-results / failed / completed states (spec §9). */
export function ResearchRunStatus({
  runId,
  workspaceId,
  onFinished,
}: {
  runId: string | null;
  workspaceId: string | null;
  onFinished?: (run: ResearchRun) => void;
}) {
  const { run, pollError } = useResearchRun(runId, workspaceId, onFinished);
  if (!runId) return null;
  const status = run?.status ?? "queued";
  const noResults = status === "completed" && run?.result?.noResults;

  return (
    <Card className="!p-4 text-sm" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-[var(--foreground)]">
          {run?.mode === "discovery" ? "Discovery run" : "Research run"}
        </span>
        <StatusBadge status={noResults ? "no_results" : status} />
        {run?.budgetActual != null ? (
          <span className="text-xs text-[var(--muted)]">{run.budgetActual} research units used</span>
        ) : run ? (
          <span className="text-xs text-[var(--muted)]">{run.budgetReserved} units reserved</span>
        ) : null}
      </div>
      {status === "queued" || status === "running" || status === "retrying" ? (
        <div className="mt-2 h-2 overflow-hidden rounded bg-[var(--chip-bg)]" role="progressbar" aria-valuenow={run?.progressPct ?? 0} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-[var(--red)] transition-all" style={{ width: `${run?.progressPct ?? 5}%` }} />
        </div>
      ) : null}
      {status === "retrying" ? (
        <p className="mt-2 text-[var(--badge-amber-fg)]">
          {ERROR_TEXT[run?.errorCode ?? ""] ?? "Temporary provider problem"} Retrying automatically — you will not be charged twice.
        </p>
      ) : null}
      {noResults ? (
        <p className="mt-2 text-[var(--muted)]">
          No sources found. This is not evidence that nothing is happening — try a broader query later.
        </p>
      ) : null}
      {status === "completed" && run?.result && !noResults ? (
        <p className="mt-2 text-[var(--muted)]">
          {run.mode === "discovery"
            ? `${run.result.rows?.length ?? 0} companies found · ${run.result.unmatched ?? 0} articles not tied to one company · ${run.result.skippedSuppressed ?? 0} suppressed skipped`
            : `${run.result.evidenceCreated ?? 0} new evidence items · ${run.result.duplicatesSkipped ?? 0} duplicates skipped`}
        </p>
      ) : null}
      {status === "failed" || status === "cancelled" ? (
        <p className="mt-2 text-[var(--red-active)]">
          {ERROR_TEXT[run?.errorCode ?? ""] ?? run?.errorMessage ?? "Research failed."}
        </p>
      ) : null}
      {pollError ? <p className="mt-2 text-[var(--red-active)]">{pollError}</p> : null}
    </Card>
  );
}
