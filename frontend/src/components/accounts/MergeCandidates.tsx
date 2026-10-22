"use client";

import { useState } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { FormError } from "../ui/Field";
import { resolveMergeCandidate, type MergeCandidate } from "@/lib/api/accounts";

function label(a?: MergeCandidate["accountA"]) {
  if (!a) return "Unknown account";
  return [a.name, a.domain, a.country].filter(Boolean).join(" · ");
}

export function MergeCandidates({
  workspaceId,
  candidates,
  onResolved,
}: {
  workspaceId: string;
  candidates: MergeCandidate[];
  onResolved?: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!candidates.length) return null;

  async function resolve(id: string, action: "merge" | "keep_separate" | "reject", keepAccountId?: string) {
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
    <Card className="border-[var(--badge-amber-bg)]">
      <h2 className="text-[15px]">Possible duplicates ({candidates.length})</h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        A shared domain or name doesn&apos;t always mean the same legal entity — subsidiaries can share both. Merging keeps
        the history of the merged record.
      </p>
      <ul className="mt-3 space-y-4 text-sm">
        {candidates.map((c) => (
          <li key={c.id} className="space-y-2 border-t border-[var(--line)] pt-3 first:border-0 first:pt-0">
            <p className="text-xs text-[var(--muted)]">{c.reason}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <p>
                <span className="font-semibold">A:</span> {label(c.accountA)}
              </p>
              <p>
                <span className="font-semibold">B:</span> {label(c.accountB)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busyId === c.id} onClick={() => resolve(c.id, "merge", c.accountIdA)}>
                Merge into A
              </Button>
              <Button disabled={busyId === c.id} onClick={() => resolve(c.id, "merge", c.accountIdB)}>
                Merge into B
              </Button>
              <Button variant="ghost" disabled={busyId === c.id} onClick={() => resolve(c.id, "keep_separate")}>
                They&apos;re different companies
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <FormError message={error} />
    </Card>
  );
}
