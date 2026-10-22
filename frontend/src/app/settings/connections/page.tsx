"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getConnections } from "@/lib/api/settings";
import { getEntitlements, patchEntitlements } from "@/lib/api/phase234";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default function ConnectionsPage() {
  const { workspaceId, loading, error } = useWorkspace();
  const [data, setData] = useState<Awaited<ReturnType<typeof getConnections>> | null>(null);
  const [ent, setEnt] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    void getConnections(workspaceId).then(setData);
    void getEntitlements(workspaceId).then((r) => setEnt(r.entitlements));
  }, [workspaceId]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!data || !workspaceId) return <LoadingState />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Connections & usage"
        title="Connections & usage"
        description="Research usage, monitors, sending entitlements. CRM sync is not configured in this deployment."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[16px]">Research</h2>
            <Badge tone={data.research.configured ? "green" : "amber"}>
              {data.research.configured ? "Configured" : "Not configured"}
            </Badge>
          </div>
          <p className="mt-2 text-[28px] font-semibold tracking-tight">
            {data.usage.usedMonthly} / {data.usage.quotaMonthly}
          </p>
          <p className="text-sm text-[var(--muted)]">Monthly research units</p>
        </Card>

        <Card>
          <h2 className="text-[16px]">CRM</h2>
          <div className="mt-2">
            <Badge tone="default">Skipped</Badge>
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {data.crm.note ?? "CRM sync is not enabled."}
          </p>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[16px]">Sending</h2>
            <Badge tone={data.sending.enabled ? "green" : "amber"}>
              {data.sending.enabled ? "Enabled" : "Off"}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Provider: {data.sending.provider ?? "simulated"} · Accounts:{" "}
            {data.sending.accounts ?? 0} · Domains: {data.sending.domains ?? 0}
          </p>
        </Card>

        <Card>
          <h2 className="text-[16px]">Entitlements / kill switches</h2>
          {ent ? (
            <div className="mt-3 space-y-2 text-sm">
              <label className="flex items-center justify-between gap-2">
                <span>Research kill switch</span>
                <input
                  type="checkbox"
                  checked={Boolean(ent.researchKillSwitch)}
                  onChange={async (e) => {
                    const res = await patchEntitlements(workspaceId, {
                      researchKillSwitch: e.target.checked,
                    });
                    setEnt(res.entitlements);
                  }}
                />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span>Sending kill switch</span>
                <input
                  type="checkbox"
                  checked={Boolean(ent.sendingKillSwitch)}
                  onChange={async (e) => {
                    const res = await patchEntitlements(workspaceId, {
                      sendingKillSwitch: e.target.checked,
                    });
                    setEnt(res.entitlements);
                  }}
                />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span>Monitors enabled</span>
                <input
                  type="checkbox"
                  checked={Boolean(ent.monitorsEnabled)}
                  onChange={async (e) => {
                    const res = await patchEntitlements(workspaceId, {
                      monitorsEnabled: e.target.checked,
                    });
                    setEnt(res.entitlements);
                  }}
                />
              </label>
              <p className="text-[var(--muted)]">
                Send usage: {String(ent.sendUsedMonthly)} / {String(ent.sendQuotaMonthly)}
              </p>
              <Button
                variant="ghost"
                onClick={async () => {
                  const res = await getEntitlements(workspaceId);
                  setEnt(res.entitlements);
                }}
              >
                Refresh
              </Button>
            </div>
          ) : (
            <LoadingState />
          )}
        </Card>
      </div>
    </div>
  );
}
