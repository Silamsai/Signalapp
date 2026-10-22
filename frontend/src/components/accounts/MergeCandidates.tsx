"use client";

import { useState } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { resolveMergeCandidate } from "@/lib/api/accounts";

export function MergeCandidates({
  workspaceId,
  candidates,
  onResolved,
}: {
  workspaceId: string;
  candidates: Array<{ id: string; reason: string; accountIdA: string; accountIdB: string }>;
  onResolved?: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!candidates.length) return null;

  async function resolve(
    id: string,
    action: "merge" | "keep_separate" | "reject",
    keepAccountId?: string,
  ) {
    setBusyId(id);
    setError(null);
    try {
      await resolveMergeCandidate(workspaceId, id, { action, keepAccountId });
      onResolved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resolve failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="border-[var(--badge-amber-bg)] bg-[var(--badge-amber-bg)]">
      <h2 className="text-[15px] text-[var(--badge-amber-fg)]">Merge candidates</h2>
      <p className="mt-1 text-xs text-[var(--badge-amber-fg)]">
        Review imported duplicates before continuing.
      </p>
      <ul className="mt-2 space-y-3 text-sm text-[var(--badge-amber-fg)]">
        {candidates.map((c) => (
          <li key={c.id} className="space-y-2">
            <p>
              {c.reason} ({c.accountIdA} ↔ {c.accountIdB})
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={busyId === c.id}
                onClick={() => resolve(c.id, "merge", c.accountIdA)}
              >
                Merge → A
              </Button>
              <Button
                variant="secondary"
                disabled={busyId === c.id}
                onClick={() => resolve(c.id, "merge", c.accountIdB)}
              >
                Merge → B
              </Button>
              <Button
                variant="secondary"
                disabled={busyId === c.id}
                onClick={() => resolve(c.id, "keep_separate")}
              >
                Keep separate
              </Button>
              <Button
                variant="ghost"
                disabled={busyId === c.id}
                onClick={() => resolve(c.id, "reject")}
              >
                Reject
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {error ? <p className="mt-2 text-sm text-[var(--red-active)]">{error}</p> : null}
    </Card>
  );
}
