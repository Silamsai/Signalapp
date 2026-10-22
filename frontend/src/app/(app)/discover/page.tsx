"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "../../../components/layout/PageHeader";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { AccountTable } from "../../../components/accounts/AccountTable";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { listAccounts, type Account } from "../../../lib/api/accounts";

export default function DiscoverPage() {
  const { workspaceId, loading, error } = useWorkspace();
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    if (!workspaceId) return;
    void listAccounts(workspaceId).then((r) => setAccounts(r.accounts));
  }, [workspaceId]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  const opportunities = accounts
    .filter((a) => a.researchState === "researched")
    .sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0));

  return (
    <div>
      <PageHeader
        title="Opportunity feed"
        description="Prioritized researched accounts with cited evidence. Import or search to grow the feed."
        actions={
          <>
            <Link href="/discover/search" className="rounded border border-slate-300 px-3 py-1.5 text-sm">
              Search
            </Link>
            <Link href="/discover/playbooks" className="rounded border border-slate-300 px-3 py-1.5 text-sm">
              Playbooks
            </Link>
            <Link href="/accounts" className="rounded bg-teal-800 px-3 py-1.5 text-sm text-white">
              Import accounts
            </Link>
          </>
        }
      />
      {opportunities.length ? (
        <AccountTable accounts={opportunities} />
      ) : (
        <p className="text-sm text-slate-600">
          No researched opportunities yet. Import accounts, configure targeting, then run Exa research.
        </p>
      )}
    </div>
  );
}
