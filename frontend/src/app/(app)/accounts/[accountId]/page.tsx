"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../../../../components/layout/PageHeader";
import { StatusBadge } from "../../../../components/common/StatusBadge";
import { EvidenceList } from "../../../../components/research/EvidenceList";
import { ScoreBreakdown } from "../../../../components/research/ScoreBreakdown";
import { AcceptanceActions } from "../../../../components/qualification/AcceptanceActions";
import { ResearchRunStatus } from "../../../../components/research/ResearchRunStatus";
import { useWorkspace } from "../../../../hooks/useWorkspace";
import { getBrief } from "../../../../lib/api/accounts";
import { startResearchRun } from "../../../../lib/api/research";
import { me } from "../../../../lib/auth/session";
import { LoadingState } from "../../../../components/common/LoadingState";
import { ErrorState } from "../../../../components/common/ErrorState";
import { api } from "../../../../lib/api/client";

export default function AccountBriefPage() {
  const params = useParams();
  const accountId = String(params.accountId);
  const { workspaceId, loading, error } = useWorkspace();
  const [brief, setBrief] = useState<Record<string, unknown> | null>(null);
  const [userId, setUserId] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    const data = await getBrief(accountId, workspaceId);
    setBrief(data);
  }, [accountId, workspaceId]);

  useEffect(() => {
    void me().then((r) => setUserId(r.user.id)).catch(() => undefined);
    void refresh();
  }, [refresh]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!brief) return <LoadingState label="Loading brief…" />;

  const account = brief.account as {
    name: string;
    domain: string | null;
    researchState: string;
    acceptanceState: string;
    fitScore: number | null;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={account.name}
        description={account.domain ?? "No domain"}
        actions={
          <>
            <Link
              href={`/accounts/${accountId}/evidence`}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm"
            >
              Evidence
            </Link>
            <Link
              href={`/accounts/${accountId}/qualification`}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm"
            >
              Qualification
            </Link>
            <button
              type="button"
              className="rounded bg-teal-800 px-3 py-1.5 text-sm text-white"
              onClick={async () => {
                if (!workspaceId) return;
                setLocalError(null);
                try {
                  const { researchRunId } = await startResearchRun(workspaceId, {
                    query: `${account.name} infrastructure OR datacenter OR server refresh`,
                    accountId,
                    budget: 3,
                  });
                  setRunId(researchRunId);
                } catch (e) {
                  setLocalError(e instanceof Error ? e.message : "Research failed");
                }
              }}
            >
              Run research
            </button>
            <button
              type="button"
              className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              onClick={async () => {
                if (!workspaceId) return;
                await api(`/v1/accounts/${accountId}/drafts?workspaceId=${workspaceId}`, {
                  method: "POST",
                  body: JSON.stringify({}),
                });
                window.location.href = "/outreach/drafts";
              }}
            >
              Generate draft
            </button>
          </>
        }
      />
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={account.researchState} />
        <StatusBadge status={account.acceptanceState} />
        <span className="text-sm text-slate-600">Fit {account.fitScore ?? "—"}</span>
      </div>
      {localError ? <ErrorState message={localError} /> : null}
      <ResearchRunStatus runId={runId} workspaceId={workspaceId} />
      <ScoreBreakdown signals={(brief.signals as never[]) ?? []} />
      <EvidenceList items={((brief.evidence as never[]) ?? []).slice(0, 5)} />
      {workspaceId && userId ? (
        <AcceptanceActions
          accountId={accountId}
          workspaceId={workspaceId}
          ownerUserId={userId}
          onDone={refresh}
        />
      ) : null}
    </div>
  );
}
