"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EvidenceList } from "@/components/research/EvidenceList";
import { ScoreBreakdown } from "@/components/research/ScoreBreakdown";
import { AcceptanceActions } from "@/components/qualification/AcceptanceActions";
import { ResearchRunStatus } from "@/components/research/ResearchRunStatus";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getBrief } from "@/lib/api/accounts";
import { startResearchRun } from "@/lib/api/research";
import { me } from "@/lib/auth/session";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

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
    void me()
      .then((r) => setUserId(r.user.id))
      .catch(() => undefined);
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
    <div className="mx-auto max-w-[790px] space-y-5">
      <PageHeader
        eyebrow="Account intelligence"
        title={account.name}
        description={account.domain ?? "No domain"}
        actions={
          <>
            <Link href={`/accounts/${accountId}/evidence`}>
              <Button variant="secondary">Evidence</Button>
            </Link>
            <Link href={`/accounts/${accountId}/qualification`}>
              <Button variant="secondary">Qualification</Button>
            </Link>
            <Button
              variant="primary"
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
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                if (!workspaceId) return;
                await api(`/v1/accounts/${accountId}/drafts?workspaceId=${workspaceId}`, {
                  method: "POST",
                  body: JSON.stringify({}),
                });
                window.location.href = "/outreach/drafts";
              }}
            >
              Prepare outreach →
            </Button>
          </>
        }
      />

      <Card className="!py-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={account.researchState} />
          <StatusBadge status={account.acceptanceState} />
          <span className="text-sm text-[var(--muted)]">
            Priority {account.fitScore ?? "—"} / 100
          </span>
        </div>
      </Card>

      {localError ? <ErrorState message={localError} /> : null}
      <ResearchRunStatus runId={runId} workspaceId={workspaceId} />
      <ScoreBreakdown signals={(brief.signals as never[]) ?? []} />
      <div>
        <h2 className="mb-3 text-[16px]">Trigger evidence</h2>
        <EvidenceList items={((brief.evidence as never[]) ?? []).slice(0, 5)} />
      </div>
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
