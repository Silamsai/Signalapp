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
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Score components</h3>
      <p className="mt-1 text-xs text-slate-500">
        Prioritization heuristics — not purchase probability. Missing evidence does not inflate confidence.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {signals.map((s) => (
          <li key={s.id} className="flex flex-wrap gap-3 text-slate-700">
            <span className="font-medium">{s.kind}</span>
            <span>fit {s.fitComponent ?? 0}</span>
            <span>recency {s.recencyComponent ?? 0}</span>
            <span>quality {s.qualityComponent ?? 0}</span>
            {s.unknownNote ? <span className="text-amber-700">{s.unknownNote}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
