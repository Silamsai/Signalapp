"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { Card } from "@/components/ui/Card";
import { CompaniesTable } from "@/components/platform/CompaniesTable";
import { ROLE_LABELS } from "@/lib/auth/capabilities";
import { getPlatformOverview, type PlatformOverview } from "@/lib/api/platform";

const ROLE_ORDER = ["tenant_admin", "researcher", "sales_reviewer", "sdr", "partner", "analyst"];

/** Platform overview: totals across every company, role mix, research usage and newest companies. */
export default function PlatformOverviewPage() {
  const [data, setData] = useState<PlatformOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPlatformOverview()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the overview"));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;

  const roleTotals: Record<string, number> = {};
  let used = 0;
  let quota = 0;
  for (const c of data.companies) {
    for (const [r, n] of Object.entries(c.membersByRole)) roleTotals[r] = (roleTotals[r] ?? 0) + n;
    used += c.researchUsedMonthly;
    quota += c.researchQuotaMonthly;
  }
  const recent = [...data.companies].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const nearLimit = data.companies.filter((c) => c.researchQuotaMonthly && c.researchUsedMonthly / c.researchQuotaMonthly >= 0.9);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Overview"
        description="Every customer company on SignalApp, as counts only. Their accounts, evidence and briefs stay private to each company."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {(
          [
            ["Companies", data.totals.companies],
            ["Workspaces", data.totals.workspaces],
            ["Active members", data.totals.members],
            ["Accounts", data.totals.accounts],
            ["Research units this month", `${used} / ${quota}`],
          ] as const
        ).map(([label, n]) => (
          <Card key={label} className="!p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{n}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-[15px]">Members by role</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Active memberships across all companies.</p>
          <ul className="mt-3 divide-y divide-[var(--line)] text-sm">
            {ROLE_ORDER.map((r) => (
              <li key={r} className="flex justify-between py-2">
                <span>{ROLE_LABELS[r]}</span>
                <span className="font-semibold tabular-nums">{roleTotals[r] ?? 0}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="text-[15px]">Needs attention</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Companies at 90% or more of their monthly research units.</p>
          {nearLimit.length ? (
            <ul className="mt-3 divide-y divide-[var(--line)] text-sm">
              {nearLimit.map((c) => (
                <li key={c.id} className="flex justify-between py-2">
                  <span>{c.name}</span>
                  <span className="font-semibold tabular-nums text-[var(--red-active)]">
                    {c.researchUsedMonthly} / {c.researchQuotaMonthly}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[var(--badge-green-fg)]">All companies are within their research limits.</p>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px]">Newest companies</h2>
          <Link href="/platform/companies" className="text-sm font-medium text-[var(--red-active)] hover:underline">
            View all companies →
          </Link>
        </div>
        <div className="mt-3">
          <CompaniesTable
            companies={recent}
            empty={
              <>
                No companies yet.{" "}
                <Link href="/platform/companies" className="text-[var(--red-active)] hover:underline">
                  Add the first one
                </Link>
                .
              </>
            }
          />
        </div>
      </Card>
    </div>
  );
}
