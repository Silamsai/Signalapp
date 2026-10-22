"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../../../../components/layout/PageHeader";
import { DraftEditor } from "../../../../components/drafts/DraftEditor";
import { useWorkspace } from "../../../../hooks/useWorkspace";
import { api } from "../../../../lib/api/client";
import { LoadingState } from "../../../../components/common/LoadingState";
import { ErrorState } from "../../../../components/common/ErrorState";
import { EmptyState } from "../../../../components/common/EmptyState";

type Draft = {
  id: string;
  subject: string | null;
  body: string;
  staleWarning: number;
  version: number;
  accountId: string;
};

export default function DraftsPage() {
  const { workspaceId, loading, error } = useWorkspace();
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    const res = await api<{ drafts: Draft[] }>(`/v1/workspaces/${workspaceId}/drafts`);
    setDrafts(res.drafts);
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!workspaceId) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Drafts"
        description="Cited factual claims only. Draft creation does not initiate dispatch."
      />
      {!drafts.length ? (
        <EmptyState title="No drafts" detail="Generate a draft from an account brief." />
      ) : (
        drafts.map((d) => (
          <div key={d.id} className="space-y-2">
            <p className="text-xs text-slate-500">Account {d.accountId}</p>
            <DraftEditor draft={d} workspaceId={workspaceId} onSaved={refresh} />
          </div>
        ))
      )}
    </div>
  );
}
