"use client";

import { useState } from "react";
import { api } from "../../lib/api/client";

export function AcceptanceActions({
  accountId,
  workspaceId,
  ownerUserId,
  onDone,
}: {
  accountId: string;
  workspaceId: string;
  ownerUserId: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function transition(toState: string, extra: Record<string, string> = {}) {
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/accounts/${accountId}/acceptance-decisions?workspaceId=${workspaceId}`, {
        method: "POST",
        body: JSON.stringify({ toState, ...extra }),
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transition failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold">Sales acceptance</h3>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm"
          onClick={() => transition("ready_for_review")}
        >
          Submit for review
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white"
          onClick={() =>
            transition("accepted", {
              ownerUserId,
              nextAction: "SDR outreach",
            })
          }
        >
          Accept
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded border border-orange-300 px-3 py-1.5 text-sm text-orange-900"
          onClick={() =>
            transition("needs_research", {
              reasonCategory: reason || "incomplete_evidence",
            })
          }
        >
          Return
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-800"
          onClick={() =>
            transition("rejected", {
              reasonCategory: reason || "not_a_fit",
            })
          }
        >
          Reject
        </button>
      </div>
      <input
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        placeholder="Reason category (return/reject)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
