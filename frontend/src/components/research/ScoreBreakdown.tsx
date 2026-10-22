import type { Signal } from "../../lib/api/accounts";
import { Card } from "../ui/Card";

const NOTE_LABELS: Record<string, string> = {
  event_date_unknown: "Event date unknown",
  contradiction: "Contradictory sources",
};

export function ScoreBreakdown({ signals }: { signals: Signal[] }) {
  if (!signals.length) return null;
  return (
    <Card>
      <h3 className="text-[15px]">Explainable priority</h3>
      <p className="mt-1 text-xs text-[var(--muted)]">
        A prioritization heuristic from fit, recency and source quality — not a purchase probability. Missing
        evidence never raises the score.
      </p>
      <table className="mt-3 w-full text-left text-sm">
        <thead className="text-xs text-[var(--muted)]">
          <tr>
            <th className="py-1 font-medium">Signal</th>
            <th className="py-1 font-medium">Fit</th>
            <th className="py-1 font-medium">Recency</th>
            <th className="py-1 font-medium">Quality</th>
            <th className="py-1 font-medium">Flags</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((s) => (
            <tr key={s.id} className="border-t border-[var(--line)]">
              <td className="py-1.5 font-semibold">{s.kind.replace(/_/g, " ")}</td>
              <td className="py-1.5">{s.fitComponent ?? "—"}</td>
              <td className="py-1.5">{s.recencyComponent ?? "—"}</td>
              <td className="py-1.5">{s.qualityComponent ?? "—"}</td>
              <td className="py-1.5 text-[var(--badge-amber-fg)]">
                {s.unknownNote ? (NOTE_LABELS[s.unknownNote] ?? s.unknownNote) : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
