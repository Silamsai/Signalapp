"use client";

import { Card } from "../ui/Card";

export function MergeCandidates({
  candidates,
}: {
  candidates: Array<{ id: string; reason: string; accountIdA: string; accountIdB: string }>;
}) {
  if (!candidates.length) return null;
  return (
    <Card className="border-[var(--badge-amber-bg)] bg-[var(--badge-amber-bg)]">
      <h2 className="text-[15px] text-[var(--badge-amber-fg)]">Merge candidates</h2>
      <ul className="mt-2 space-y-2 text-sm text-[var(--badge-amber-fg)]">
        {candidates.map((c) => (
          <li key={c.id}>
            {c.reason} ({c.accountIdA} ↔ {c.accountIdB})
          </li>
        ))}
      </ul>
    </Card>
  );
}
