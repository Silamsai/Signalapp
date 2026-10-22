"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useWorkspace } from "@/hooks/useWorkspace";
import { listAccounts, type Account } from "@/lib/api/accounts";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { TableWrap } from "@/components/ui/TableWrap";

export default function PipelinePage() {
  const { workspaceId, loading, error } = useWorkspace();
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    if (!workspaceId) return;
    void listAccounts(workspaceId).then((r) => setAccounts(r.accounts));
  }, [workspaceId]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader
        eyebrow="Pipeline"
        title="Pipeline"
        description="Acceptance is independent of opportunity stage and tasks."
      />
      <TableWrap>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--table-head)] text-[12px] font-medium text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Research</th>
              <th className="px-4 py-3">Fit</th>
              <th className="px-4 py-3">Next</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-b border-[var(--line)] last:border-0">
                <td className="px-4 py-3 font-semibold">
                  <Link href={`/accounts/${a.id}`} className="hover:text-[var(--red-active)]">
                    {a.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={a.acceptanceState} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={a.researchState} />
                </td>
                <td className="px-4 py-3">{a.fitScore ?? "—"}</td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  <Link href={`/accounts/${a.id}/qualification`} className="text-[var(--red-active)]">
                    Review brief
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </div>
  );
}
