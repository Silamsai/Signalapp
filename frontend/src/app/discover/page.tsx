"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { RequireCap } from "@/components/common/RequireCap";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { OpportunityFeed } from "@/components/accounts/OpportunityFeed";
import { KpiTile } from "@/components/ui/KpiTile";
import { Button } from "@/components/ui/Button";
import { listAccounts, type Account } from "@/lib/api/accounts";

function Feed({ workspaceId }: { workspaceId: string }) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [minScore, setMinScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAccounts(workspaceId)
      .then((r) => setAccounts(r.accounts))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load"));
  }, [workspaceId]);

  const feed = useMemo(() => {
    let rows = (accounts ?? []).filter((a) => a.researchState === "researched");
    if (minScore != null) rows = rows.filter((a) => (a.fitScore ?? 0) >= minScore);
    return [...rows].sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0));
  }, [accounts, minScore]);

  if (error) return <ErrorState message={error} />;
  if (!accounts) return <LoadingState />;

  const unresearched = accounts.filter((a) => a.researchState === "unresearched" || a.researchState === "failed").length;

  return (
    <div>
      <PageHeader
        eyebrow="Opportunity feed"
        title="Reasons to start a conversation"
        description="Researched accounts ranked by fit, recency and evidence quality. Scores help you prioritise; they are not purchase probabilities."
        actions={
          <Link href="/discover/search">
            <Button variant="primary">Find prospects</Button>
          </Link>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiTile label="Researched accounts" value={feed.length} />
        <KpiTile label="Ready for review" value={accounts.filter((a) => a.acceptanceState === "ready_for_review").length} />
        <KpiTile label="Still to research" value={unresearched} />
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Minimum priority">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Minimum priority</span>
        {[null, 50, 70, 85].map((n) => (
          <button
            key={String(n)}
            type="button"
            aria-pressed={minScore === n}
            onClick={() => setMinScore(n)}
            className={`rounded-[7px] border px-3 py-1.5 text-sm font-medium ${
              minScore === n
                ? "border-[var(--red-tint)] bg-[var(--red-tint)] text-[var(--red-active)]"
                : "border-[var(--line)] bg-white text-[var(--muted)]"
            }`}
          >
            {n == null ? "All" : n}
          </button>
        ))}
      </div>
      <OpportunityFeed accounts={feed} />
    </div>
  );
}

export default function DiscoverPage() {
  return <RequireCap cap="discover">{(workspaceId) => <Feed workspaceId={workspaceId} />}</RequireCap>;
}
