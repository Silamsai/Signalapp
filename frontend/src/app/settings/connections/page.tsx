"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getConnections } from "@/lib/api/settings";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default function ConnectionsPage() {
  const { workspaceId, loading, error } = useWorkspace();
  const [data, setData] = useState<Awaited<ReturnType<typeof getConnections>> | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    void getConnections(workspaceId).then(setData);
  }, [workspaceId]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Connections & usage"
        title="Connections & usage"
        description="Provider status and per-tenant research caps. API keys never appear in the browser."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[16px]">Exa research</h2>
            <Badge tone={data.research.configured ? "green" : "amber"}>
              {data.research.configured ? "Configured" : "Not configured"}
            </Badge>
          </div>
          {!data.research.configured ? (
            <p className="mt-2 text-sm text-[var(--badge-amber-fg)]">
              Set <code className="rounded bg-[var(--chip-bg)] px-1">EXA_API_KEY</code> in{" "}
              <code className="rounded bg-[var(--chip-bg)] px-1">backend/.env</code> and restart
              API + worker.
            </p>
          ) : (
            <p className="mt-2 text-sm text-[var(--muted)]">Live web research adapter enabled.</p>
          )}
        </Card>
        <Card>
          <h2 className="text-[16px]">Research usage</h2>
          <p className="mt-2 text-[32px] font-semibold tracking-tight">
            {data.usage.usedMonthly} / {data.usage.quotaMonthly}
          </p>
          <p className="text-sm text-[var(--muted)]">Monthly units reserved/used</p>
        </Card>
        <Card className="opacity-80">
          <h2 className="text-[16px]">CRM</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Phase {data.crm.phase} — not enabled</p>
        </Card>
        <Card className="opacity-80">
          <h2 className="text-[16px]">Sending / campaigns</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Phase {data.sending.phase} — disabled</p>
        </Card>
      </div>
    </div>
  );
}
