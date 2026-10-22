"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DraftEditor } from "@/components/drafts/DraftEditor";
import { useWorkspace } from "@/hooks/useWorkspace";
import { api } from "@/lib/api/client";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

type Draft = {
  id: string;
  subject: string | null;
  body: string;
  staleWarning: number;
  version: number;
  accountId: string;
  evidenceIdsJson?: string;
};

export default function DraftsPage() {
  const { workspaceId, loading, error } = useWorkspace();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [channel] = useState<"email">("email");

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
        eyebrow="Outreach studio"
        title="Outreach studio"
        description="Edit before use. Draft creation does not initiate dispatch."
      />

      <div className="flex gap-2">
        <Badge tone={channel === "email" ? "red" : "default"}>Email</Badge>
        <Badge tone="default">LinkedIn · later</Badge>
      </div>

      {!drafts.length ? (
        <EmptyState
          title="No drafts"
          detail="Generate a draft from an account brief (Prepare outreach)."
        />
      ) : (
        drafts.map((d) => (
          <div key={d.id} className="space-y-3">
            <Card className="!py-3">
              <p className="text-xs text-[var(--muted)]">Account {d.accountId}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Grounding this message
              </p>
              <p className="mt-1 text-sm text-[var(--foreground)]">
                Cited evidence IDs are attached to this draft. Review the account brief before
                sending externally.
              </p>
            </Card>
            <DraftEditor draft={d} workspaceId={workspaceId} onSaved={refresh} />
          </div>
        ))
      )}
    </div>
  );
}
