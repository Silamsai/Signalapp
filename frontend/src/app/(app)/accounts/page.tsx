"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "../../../components/layout/PageHeader";
import { AccountTable } from "../../../components/accounts/AccountTable";
import { ImportCsvDialog } from "../../../components/accounts/ImportCsvDialog";
import { MergeCandidates } from "../../../components/accounts/MergeCandidates";
import { useWorkspace } from "../../../hooks/useWorkspace";
import {
  listAccounts,
  listMergeCandidates,
  type Account,
} from "../../../lib/api/accounts";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { EmptyState } from "../../../components/common/EmptyState";

export default function AccountsPage() {
  const { workspaceId, loading, error } = useWorkspace();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [merges, setMerges] = useState<
    Array<{ id: string; reason: string; accountIdA: string; accountIdB: string }>
  >([]);

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    const [a, m] = await Promise.all([
      listAccounts(workspaceId),
      listMergeCandidates(workspaceId),
    ]);
    setAccounts(a.accounts);
    setMerges(m.candidates);
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
        title="Watchlist & imports"
        description="Imported accounts remain unresearched until a research job completes."
        actions={
          <>
            <Link href="/accounts/acceptance" className="rounded border border-slate-300 px-3 py-1.5 text-sm">
              Sales acceptance
            </Link>
            <Link href="/accounts/pipeline" className="rounded border border-slate-300 px-3 py-1.5 text-sm">
              Pipeline
            </Link>
            <button
              type="button"
              className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              onClick={async () => {
                const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
                const res = await fetch(`${base}/v1/workspaces/${workspaceId}/accounts/export`, {
                  credentials: "include",
                });
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "accounts.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export CSV
            </button>
          </>
        }
      />
      <ImportCsvDialog workspaceId={workspaceId} onDone={refresh} />
      <MergeCandidates candidates={merges} />
      {accounts.length ? (
        <AccountTable accounts={accounts} />
      ) : (
        <EmptyState title="No accounts" detail="Import a CSV or discover via Search." />
      )}
    </div>
  );
}
