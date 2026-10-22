"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { OpportunityFeed } from "@/components/accounts/OpportunityFeed";
import { KpiTile } from "@/components/ui/KpiTile";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useWorkspace } from "@/hooks/useWorkspace";
import { listAccounts, type Account } from "@/lib/api/accounts";

export default function DiscoverPage() {
  const { workspaceId, loading, error } = useWorkspace();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [minScore, setMinScore] = useState<number | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    void listAccounts(workspaceId).then((r) => setAccounts(r.accounts));
  }, [workspaceId]);

  const researched = useMemo(
    () => accounts.filter((a) => a.researchState === "researched"),
    [accounts],
  );
  const ready = accounts.filter((a) => a.acceptanceState === "ready_for_review").length;
  const gaps = accounts.filter((a) => a.researchState === "unresearched" || a.researchState === "failed")
    .length;

  const feed = useMemo(() => {
    let rows = researched.length ? researched : accounts;
    if (minScore != null) {
      rows = rows.filter((a) => (a.fitScore ?? 0) >= minScore);
    }
    return [...rows].sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0));
  }, [accounts, researched, minScore]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader
        eyebrow="Your opportunity workspace"
        title="Reasons to start a conversation"
        description="Infrastructure expansion and refresh signals from researched accounts."
        actions={
          <Link href="/settings/offer">
            <Button variant="primary">Configure targeting</Button>
          </Link>
        }
      />

      <Card className="mb-6 !py-4">
        <p className="text-sm text-[var(--foreground)]">
          Offer context lives in Settings. Buyers and territory drive discovery and scoring.
        </p>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiTile label="Accounts to review" value={feed.length} />
        <KpiTile label="Ready for acceptance" value={ready} />
        <KpiTile label="Evidence gaps" value={gaps} />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Minimum score
        </span>
        {[null, 70, 80, 90].map((n) => (
          <button
            key={String(n)}
            type="button"
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
