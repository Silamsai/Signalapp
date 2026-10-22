"use client";

export function MergeCandidates({
  candidates,
}: {
  candidates: Array<{ id: string; reason: string; accountIdA: string; accountIdB: string }>;
}) {
  if (!candidates.length) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h2 className="text-sm font-semibold text-amber-950">Merge candidates</h2>
      <ul className="mt-2 space-y-2 text-sm text-amber-900">
        {candidates.map((c) => (
          <li key={c.id}>
            {c.reason} ({c.accountIdA} ↔ {c.accountIdB})
          </li>
        ))}
      </ul>
    </div>
  );
}
