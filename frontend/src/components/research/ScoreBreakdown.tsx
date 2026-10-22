import { Card } from "../ui/Card";

type Signal = {
  id: string;
  kind: string;
  fitComponent: number | null;
  recencyComponent: number | null;
  qualityComponent: number | null;
  unknownNote: string | null;
};

export function ScoreBreakdown({ signals }: { signals: Signal[] }) {
  if (!signals.length) return null;
  return (
    <Card>
      <h3 className="text-[15px]">Explainable priority</h3>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Prioritization heuristics — not purchase probability. Missing evidence does not inflate
        confidence.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {signals.map((s) => (
          <li key={s.id} className="flex flex-wrap gap-3 text-[var(--foreground)]">
            <span className="font-semibold">{s.kind}</span>
            <span>fit {s.fitComponent ?? 0}</span>
            <span>recency {s.recencyComponent ?? 0}</span>
            <span>quality {s.qualityComponent ?? 0}</span>
            {s.unknownNote ? (
              <span className="text-[var(--badge-amber-fg)]">{s.unknownNote}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
