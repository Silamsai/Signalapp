"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getCampaign, listCampaigns, listConversations, simulateReply } from "@/lib/api/phase234";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default function RepliesPage() {
  const { workspaceId, loading, error } = useWorkspace();
  const [conversations, setConversations] = useState<Array<Record<string, unknown>>>([]);
  const [enrollmentId, setEnrollmentId] = useState("");
  const [bodyText, setBodyText] = useState("Thanks — can we talk next week?");
  const [enrollments, setEnrollments] = useState<Array<Record<string, unknown>>>([]);

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    const res = await listConversations(workspaceId);
    setConversations(res.conversations);
    const camps = await listCampaigns(workspaceId);
    const all: Array<Record<string, unknown>> = [];
    for (const c of camps.campaigns.slice(0, 5)) {
      const d = await getCampaign(workspaceId, String(c.id));
      const ens = (d.enrollments as Array<Record<string, unknown>>) ?? [];
      all.push(...ens);
    }
    setEnrollments(all);
    if (!enrollmentId && all[0]) setEnrollmentId(String(all[0].id));
  }, [workspaceId, enrollmentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!workspaceId) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inbox"
        title="Replies"
        description="Inbound replies pause remaining sequence steps. Use simulate to test without a real mailbox."
      />

      <Card className="space-y-3">
        <h2 className="text-[16px]">Simulate inbound reply</h2>
        <label className="block text-xs font-semibold text-[var(--muted)]">
          Enrollment
          <select
            className="mt-1.5 w-full rounded-[7px] border border-[var(--input-border)] px-3 py-2 text-sm"
            value={enrollmentId}
            onChange={(e) => setEnrollmentId(e.target.value)}
          >
            <option value="">Select…</option>
            {enrollments.map((e) => (
              <option key={String(e.id)} value={String(e.id)}>
                {String(e.email)} · {String(e.status)}
              </option>
            ))}
          </select>
        </label>
        <textarea
          className="w-full rounded-[7px] border border-[var(--input-border)] px-3 py-2 text-sm"
          rows={3}
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            disabled={!enrollmentId}
            onClick={async () => {
              await simulateReply(workspaceId, { enrollmentId, bodyText, classification: "reply" });
              void refresh();
            }}
          >
            Record reply
          </Button>
          <Button
            variant="secondary"
            disabled={!enrollmentId}
            onClick={async () => {
              await simulateReply(workspaceId, {
                enrollmentId,
                bodyText: "Please unsubscribe",
                classification: "unsubscribe",
              });
              void refresh();
            }}
          >
            Simulate unsubscribe
          </Button>
        </div>
      </Card>

      {conversations.length === 0 ? (
        <EmptyState title="No conversations" detail="Replies appear after simulated or synced inbound mail." />
      ) : (
        <div className="space-y-3">
          {conversations.map((c) => (
            <Card key={String(c.id)}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{String(c.contactEmail)}</p>
                <Badge>{String(c.status)}</Badge>
              </div>
              <ul className="mt-3 space-y-2">
                {((c.replies as Array<Record<string, unknown>>) ?? []).map((r) => (
                  <li key={String(r.id)} className="rounded-[6px] bg-[var(--chip-bg)] px-3 py-2 text-sm">
                    <span className="text-xs font-semibold text-[var(--muted)]">
                      {String(r.classification)} ·{" "}
                    </span>
                    {String(r.bodyText ?? "")}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
