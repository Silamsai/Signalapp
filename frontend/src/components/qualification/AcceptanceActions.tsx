"use client";

import { useState } from "react";
import { api } from "../../lib/api/client";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

export function AcceptanceActions({
  accountId,
  workspaceId,
  ownerUserId,
  expectedVersion,
  onDone,
}: {
  accountId: string;
  workspaceId: string;
  ownerUserId: string;
  expectedVersion?: number;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [nextAction, setNextAction] = useState("SDR outreach");

  async function transition(toState: string, extra: Record<string, string | number> = {}) {
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/accounts/${accountId}/acceptance-decisions?workspaceId=${workspaceId}`, {
        method: "POST",
        body: JSON.stringify({
          toState,
          expectedVersion,
          ...extra,
        }),
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transition failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h3 className="text-[15px]">Sales acceptance</h3>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Requires evidence, accountable owner, and next action. Concurrent updates use account version.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button disabled={busy} variant="secondary" onClick={() => transition("ready_for_review")}>
          Submit for review
        </Button>
        <Button
          disabled={busy}
          variant="primary"
          onClick={() =>
            transition("accepted", {
              ownerUserId,
              nextAction: nextAction || "SDR outreach",
            })
          }
        >
          Accept
        </Button>
        <Button
          disabled={busy}
          variant="secondary"
          onClick={() =>
            transition("needs_research", {
              reasonCategory: reason || "incomplete_evidence",
            })
          }
        >
          Return
        </Button>
        <Button
          disabled={busy}
          variant="ghost"
          onClick={() =>
            transition("rejected", {
              reasonCategory: reason || "not_a_fit",
            })
          }
        >
          Reject
        </Button>
      </div>
      <input
        className="mt-3 w-full rounded-[7px] border border-[var(--input-border)] px-2 py-2 text-sm"
        placeholder="Next action (required for accept)"
        value={nextAction}
        onChange={(e) => setNextAction(e.target.value)}
      />
      <input
        className="mt-2 w-full rounded-[7px] border border-[var(--input-border)] px-2 py-2 text-sm"
        placeholder="Reason category (return/reject)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      {error ? <p className="mt-2 text-sm text-[var(--red-active)]">{error}</p> : null}
    </Card>
  );
}
