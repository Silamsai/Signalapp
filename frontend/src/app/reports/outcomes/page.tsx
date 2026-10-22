"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getOutcomes } from "@/lib/api/settings";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { KpiTile } from "@/components/ui/KpiTile";
import { Card } from "@/components/ui/Card";

export default function OutcomesPage() {
  const { workspaceId, loading, error } = useWorkspace();
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    void getOutcomes(workspaceId).then(setData);
  }, [workspaceId]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;

  const metrics = data.metrics as Record<string, number | null>;
  const denominators = data.denominators as Record<string, number>;
  const cohort = data.cohort as { from: string; to: string };
  const notes = data.notes as string[];
  const currency = (data.currency as string) || "GBP";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Review decisions"
        title="Outcomes"
        description={`Cohort ${new Date(cohort.from).toLocaleDateString()} – ${new Date(cohort.to).toLocaleDateString()}. Currency ${currency}. Denominators disclosed.`}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(metrics).map(([k, v]) => (
          <KpiTile
            key={k}
            label={k.replace(/([A-Z])/g, " $1")}
            value={
              v == null
                ? "—"
                : typeof v === "number" && k.includes("Rate")
                  ? `${(v * 100).toFixed(0)}%`
                  : v
            }
          />
        ))}
      </div>
      <Card className="text-sm text-[var(--foreground)]">
        <p>
          Currency: {currency} · Accounts with reviewer decision:{" "}
          {denominators.accountsWithReviewerDecision} · Researched:{" "}
          {denominators.researchedAccounts}
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-[var(--muted)]">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
