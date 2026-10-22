"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { RequireCap } from "@/components/common/RequireCap";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { getOutcomes, type Outcomes } from "@/lib/api/settings";
import { usePersistentState } from "@/hooks/usePersistentState";
import { KpiTile } from "@/components/ui/KpiTile";
import { Card } from "@/components/ui/Card";
import { Field, humanize, inputClass } from "@/components/ui/Field";

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function OutcomesView({ workspaceId }: { workspaceId: string }) {
  const [from, setFrom] = usePersistentState(`${workspaceId}:outcomes:from`, isoDay(new Date(Date.now() - 90 * 86400000)));
  const [to, setTo] = usePersistentState(`${workspaceId}:outcomes:to`, isoDay(new Date()));
  const [data, setData] = useState<Outcomes | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    getOutcomes(workspaceId, new Date(`${from}T00:00:00Z`).toISOString(), new Date(`${to}T23:59:59Z`).toISOString())
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load outcomes"));
  }, [workspaceId, from, to]);

  const m = data?.metrics;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports"
        title="Outcomes"
        description="Event-based counts for the selected cohort. Every number reconciles to recorded decisions, reviews, activities and handoffs."
      />
      <div className="grid max-w-md gap-3 sm:grid-cols-2" role="group" aria-label="Cohort dates">
        <Field label="From">
          <input type="date" className={inputClass} value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <input type="date" className={inputClass} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      {error ? <ErrorState message={error} /> : null}
      {!data || !m ? (
        !error ? <LoadingState /> : null
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile label="Research-reviewed accounts" value={m.uniqueResearchReviewedAccounts} />
            <KpiTile label="Sales-accepted briefs" value={m.explicitSalesAccepted} />
            <KpiTile
              label={`Acceptance rate (of ${data.denominators.accountsWithReviewerDecision})`}
              value={m.acceptanceRate == null ? "—" : `${Math.round(m.acceptanceRate * 100)}%`}
            />
            <KpiTile label="Returned / rejected" value={`${m.returnedDecisions} / ${m.rejectedDecisions}`} />
            <KpiTile label="Completed SDR actions" value={m.completedSdrActions} />
            <KpiTile label="Partner handoffs (shared)" value={`${m.partnerHandoffsPrepared} (${m.partnerHandoffsShared})`} />
            <KpiTile label={`CRM opportunities (${data.currency})`} value={m.crmOpportunities ?? "Not connected"} />
            <KpiTile label="Meetings" value={m.meetings ?? "Not connected"} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <h2 className="text-[16px]">Completed activity by task type</h2>
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {Object.entries(data.breakdowns.activityByTaskType).map(([k, v]) => (
                    <tr key={k} className="border-t border-[var(--line)]">
                      <th scope="row" className="py-1.5 text-left font-medium">
                        {humanize(k)}
                      </th>
                      <td className="py-1.5 text-right">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card>
              <h2 className="text-[16px]">Research quality</h2>
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {Object.entries(data.breakdowns.researchQuality).map(([k, v]) => (
                    <tr key={k} className="border-t border-[var(--line)]">
                      <th scope="row" className="py-1.5 text-left font-medium">
                        {humanize(k)}
                      </th>
                      <td className="py-1.5 text-right">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          <Card className="text-sm">
            <h2 className="text-[16px]">How these numbers are counted</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-[var(--muted)]">
              <li>Cohort: {new Date(data.cohort.from).toLocaleDateString()} – {new Date(data.cohort.to).toLocaleDateString()}</li>
              <li>Date basis: {data.cohort.dateBasis}</li>
              <li>Repeated decisions: {data.cohort.decisionRule}</li>
              <li>Currency: {data.currency} · Attribution: {m.attribution}</li>
              {data.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}

export default function OutcomesPage() {
  return <RequireCap cap="view_outcomes">{(workspaceId) => <OutcomesView workspaceId={workspaceId} />}</RequireCap>;
}
