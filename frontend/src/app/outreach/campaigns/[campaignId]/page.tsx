"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useWorkspace } from "@/hooks/useWorkspace";
import { listAccounts } from "@/lib/api/accounts";
import {
  campaignAction,
  getCampaign,
  getSending,
  saveCampaignDraft,
} from "@/lib/api/phase234";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default function CampaignDetailPage() {
  const params = useParams();
  const campaignId = String(params.campaignId);
  const { workspaceId, loading, error } = useWorkspace();
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [subject, setSubject] = useState("Infrastructure capacity conversation");
  const [bodyHtml, setBodyHtml] = useState(
    "<p>Hi — we noticed recent infrastructure activity and wanted to share a short brief.</p><p>{{opt_out}}</p>",
  );
  const [delayHours, setDelayHours] = useState(48);
  const [sendingAccountId, setSendingAccountId] = useState("");
  const [audience, setAudience] = useState<Array<{ accountId: string; email: string }>>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    const d = await getCampaign(workspaceId, campaignId);
    setDetail(d);
    const accounts = await listAccounts(workspaceId);
    const sending = await getSending(workspaceId);
    const enabled = sending.accounts.find((a) => a.enabled);
    if (enabled) setSendingAccountId(String(enabled.id));
    setAudience(
      accounts.accounts.slice(0, 10).map((a) => ({
        accountId: a.id,
        email: a.domain ? `contact@${a.domain}` : `contact+${a.id.slice(-6)}@example.com`,
      })),
    );
  }, [workspaceId, campaignId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!workspaceId || !detail) return <LoadingState />;

  const campaign = detail.campaign as Record<string, unknown>;
  const enrollments = (detail.enrollments as Array<Record<string, unknown>>) ?? [];

  async function act(action: "submit" | "approve" | "launch" | "pause") {
    setLocalError(null);
    try {
      const d = await campaignAction(workspaceId!, campaignId, action);
      setDetail(d);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Action failed");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        eyebrow="Campaign"
        title={String(campaign.name)}
        description="Draft → submit → approve → launch. Eligibility is rechecked at launch and before each send."
        actions={<Badge>{String(campaign.state)}</Badge>}
      />
      {localError ? <ErrorState message={localError} /> : null}

      <Card className="space-y-3">
        <h2 className="text-[16px]">Compose</h2>
        <label className="block text-xs font-semibold text-[var(--muted)]">
          Subject
          <input
            className="mt-1.5 w-full rounded-[7px] border border-[var(--input-border)] px-3 py-2 text-sm"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </label>
        <label className="block text-xs font-semibold text-[var(--muted)]">
          Body (HTML)
          <textarea
            className="mt-1.5 w-full rounded-[7px] border border-[var(--input-border)] px-3 py-2 text-sm"
            rows={5}
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
          />
        </label>
        <label className="block text-xs font-semibold text-[var(--muted)]">
          Follow-up delay (hours, 0 = single email)
          <input
            type="number"
            className="mt-1.5 w-40 rounded-[7px] border border-[var(--input-border)] px-3 py-2 text-sm"
            value={delayHours}
            onChange={(e) => setDelayHours(Number(e.target.value))}
          />
        </label>
        <p className="text-xs text-[var(--muted)]">
          Audience preview: {audience.length} recipients (accepted accounts preferred at launch).
          Sending account: {sendingAccountId || "none enabled — configure under Settings → Sending"}
        </p>
        <Button
          variant="secondary"
          onClick={async () => {
            setLocalError(null);
            try {
              const d = await saveCampaignDraft(workspaceId, campaignId, {
                subject,
                bodyHtml,
                audience,
                delayHours,
                sendingAccountId: sendingAccountId || undefined,
              });
              setDetail(d);
            } catch (e) {
              setLocalError(e instanceof Error ? e.message : "Save failed");
            }
          }}
        >
          Save draft version
        </Button>
      </Card>

      <Card>
        <h2 className="text-[16px]">Workflow</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void act("submit")}>
            Submit for approval
          </Button>
          <Button variant="secondary" onClick={() => void act("approve")}>
            Approve
          </Button>
          <Button variant="primary" onClick={() => void act("launch")}>
            Launch
          </Button>
          <Button variant="ghost" onClick={() => void act("pause")}>
            Pause
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="text-[16px]">Enrollments</h2>
        {enrollments.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">None until launch.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {enrollments.map((e) => (
              <li key={String(e.id)} className="flex justify-between gap-2 border-b border-[var(--line)] py-2">
                <span>{String(e.email)}</span>
                <Badge>{String(e.status)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
