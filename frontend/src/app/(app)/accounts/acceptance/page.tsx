"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "../../../../components/layout/PageHeader";
import { AccountTable } from "../../../../components/accounts/AccountTable";
import { useWorkspace } from "../../../../hooks/useWorkspace";
import { listAccounts, type Account } from "../../../../lib/api/accounts";
import { LoadingState } from "../../../../components/common/LoadingState";
import { ErrorState } from "../../../../components/common/ErrorState";

export default function AcceptanceQueuePage() {
  const { workspaceId, loading, error } = useWorkspace();
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    if (!workspaceId) return;
    void listAccounts(workspaceId).then((r) =>
      setAccounts(r.accounts.filter((a) => a.acceptanceState === "ready_for_review")),
    );
  }, [workspaceId]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader
        title="Sales acceptance"
        description="Reviewer queue: Ready for review. Open an account to accept, return, or reject."
      />
      <AccountTable accounts={accounts} />
    </div>
  );
}
