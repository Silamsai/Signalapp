"use client";

import { useCallback, useEffect, useState } from "react";
import { listHandoffs, transitionHandoff } from "@/lib/api/phase234";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export function HandoffPanel({
  accountId,
  workspaceId,
  ownerUserId,
}: {
  accountId: string;
  workspaceId: string;
  ownerUserId: string;
}) {
  const [handoffs, setHandoffs] = useState<Array<Record<string, unknown>>>([]);
  const [org, setOrg] = useState("");
  const [reason, setReason] = useState("");
  const [returnReason, setReturnReason] = useState("");

  const refresh = useCallback(async () => {
    const res = await listHandoffs(accountId, workspaceId);
    setHandoffs(res.handoffs);
  }, [accountId, workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Card>
      <h2 className="text-[16px]">Partner handoff</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Prepared → Shared → Acknowledged / Returned → Closed. Sharing does not grant access until
        shared.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <input
          className="rounded-[7px] border border-[var(--input-border)] px-3 py-2 text-sm"
          placeholder="Receiving organization"
          value={org}
          onChange={(e) => setOrg(e.target.value)}
        />
        <input
          className="rounded-[7px] border border-[var(--input-border)] px-3 py-2 text-sm"
          placeholder="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <Button
        className="mt-3"
        variant="secondary"
        disabled={!org.trim() || !reason.trim()}
        onClick={async () => {
          await api(`/v1/accounts/${accountId}/handoffs?workspaceId=${workspaceId}`, {
            method: "POST",
            body: JSON.stringify({
              receivingOrg: org,
              internalOwnerUserId: ownerUserId,
              permittedFields: ["name", "domain", "brief"],
              reason,
            }),
          });
          setOrg("");
          setReason("");
          void refresh();
        }}
      >
        Prepare handoff
      </Button>

      <ul className="mt-5 space-y-3">
        {handoffs.map((h) => (
          <li
            key={String(h.id)}
            className="rounded-[8px] border border-[var(--line)] bg-[var(--chip-bg)] p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{String(h.receivingOrg)}</p>
                <p className="text-xs text-[var(--muted)]">{String(h.reason)}</p>
              </div>
              <Badge>{String(h.state)}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {h.state === "prepared" ? (
                <Button
                  variant="primary"
                  onClick={async () => {
                    await api(`/v1/handoffs/${h.id}/share`, {
                      method: "POST",
                      body: JSON.stringify({
                        workspaceId,
                        granteeEmail: "partner@example.com",
                      }),
                    });
                    void refresh();
                  }}
                >
                  Share
                </Button>
              ) : null}
              {h.state === "shared" || h.state === "acknowledged" ? (
                <>
                  {h.state === "shared" ? (
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        await transitionHandoff(String(h.id), {
                          workspaceId,
                          toState: "acknowledged",
                        });
                        void refresh();
                      }}
                    >
                      Acknowledge
                    </Button>
                  ) : null}
                  <input
                    className="min-w-[160px] flex-1 rounded-[7px] border border-[var(--input-border)] px-2 py-1.5 text-xs"
                    placeholder="Return reason"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      await transitionHandoff(String(h.id), {
                        workspaceId,
                        toState: "returned",
                        returnReason,
                      });
                      setReturnReason("");
                      void refresh();
                    }}
                  >
                    Return
                  </Button>
                  {h.state === "acknowledged" ? (
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        await transitionHandoff(String(h.id), {
                          workspaceId,
                          toState: "closed",
                        });
                        void refresh();
                      }}
                    >
                      Close
                    </Button>
                  ) : null}
                </>
              ) : null}
              {h.state === "returned" ? (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await transitionHandoff(String(h.id), {
                      workspaceId,
                      toState: "closed",
                    });
                    void refresh();
                  }}
                >
                  Close
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
