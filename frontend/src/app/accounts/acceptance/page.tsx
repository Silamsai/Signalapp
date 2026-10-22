"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { AccountTable } from "@/components/accounts/AccountTable";
import { useWorkspace } from "@/hooks/useWorkspace";
import { listAccounts, type Account } from "@/lib/api/accounts";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { KpiTile } from "@/components/ui/KpiTile";

export default function AcceptanceQueuePage() {
  const { workspaceId, loading, error } = useWorkspace();
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    if (!workspaceId) return;
    void listAccounts(workspaceId).then((r) => setAccounts(r.accounts));
  }, [workspaceId]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  const ready = accounts.filter((a) => a.acceptanceState === "ready_for_review");
  const accepted = accounts.filter((a) => a.acceptanceState === "accepted").length;
  const returned = accounts.filter((a) => a.acceptanceState === "needs_research").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sales acceptance"
        title="Sales acceptance"
        description="Reviewer queue for Ready for review. Open an account to accept, return, or reject."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiTile label="Ready for review" value={ready.length} />
        <KpiTile label="Accepted" value={accepted} />
        <KpiTile label="Needs research" value={returned} />
      </div>
      <AccountTable accounts={ready} />
    </div>
  );
}
