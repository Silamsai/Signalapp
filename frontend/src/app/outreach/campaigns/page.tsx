"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useWorkspace } from "@/hooks/useWorkspace";
import { createCampaign, listCampaigns } from "@/lib/api/phase234";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default function CampaignsPage() {
  const { workspaceId, loading, error } = useWorkspace();
  const [campaigns, setCampaigns] = useState<Array<Record<string, unknown>>>([]);
  const [name, setName] = useState("");

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    const res = await listCampaigns(workspaceId);
    setCampaigns(res.campaigns);
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
        eyebrow="Outreach studio"
        title="Campaigns"
        description="Create, approve, and launch sequences. Sending uses the simulated mailbox provider."
      />

      <Card className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[220px] flex-1 text-xs font-semibold text-[var(--muted)]">
          Campaign name
          <input
            className="mt-1.5 w-full rounded-[7px] border border-[var(--input-border)] px-3 py-2 text-sm font-normal text-[var(--foreground)]"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Q2 infrastructure outreach"
          />
        </label>
        <Button
          variant="primary"
          disabled={!name.trim()}
          onClick={async () => {
            const res = await createCampaign(workspaceId, { name });
            setName("");
            window.location.href = `/outreach/campaigns/${res.campaign.id}`;
          }}
        >
          Create campaign
        </Button>
      </Card>

      {campaigns.length === 0 ? (
        <EmptyState title="No campaigns" detail="Create a draft to start the approval flow." />
      ) : (
        <div className="grid gap-3">
          {campaigns.map((c) => (
            <Link
              key={String(c.id)}
              href={`/outreach/campaigns/${c.id}`}
              className="rounded-[10px] border border-[var(--line)] bg-white p-4 hover:border-[var(--red)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{String(c.name)}</p>
                  <p className="text-xs text-[var(--muted)]">{String(c.objective ?? "—")}</p>
                </div>
                <Badge>{String(c.state)}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
