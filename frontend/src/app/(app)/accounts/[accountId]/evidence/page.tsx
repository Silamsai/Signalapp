"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "../../../../../components/layout/PageHeader";
import { EvidenceList } from "../../../../../components/research/EvidenceList";
import { ScoreBreakdown } from "../../../../../components/research/ScoreBreakdown";
import { useWorkspace } from "../../../../../hooks/useWorkspace";
import { getBrief } from "../../../../../lib/api/accounts";
import { LoadingState } from "../../../../../components/common/LoadingState";
import { ErrorState } from "../../../../../components/common/ErrorState";

export default function EvidencePage() {
  const params = useParams();
  const accountId = String(params.accountId);
  const { workspaceId, loading, error } = useWorkspace();
  const [brief, setBrief] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    void getBrief(accountId, workspaceId).then(setBrief);
  }, [accountId, workspaceId]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!brief) return <LoadingState />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Evidence"
        description="Source URL, publisher, excerpt, event/discovery/check dates. Observed facts stay separate from hypotheses."
      />
      <ScoreBreakdown signals={(brief.signals as never[]) ?? []} />
      <EvidenceList items={(brief.evidence as never[]) ?? []} />
    </div>
  );
}
