import { formatDate } from "../../lib/utils/dates";
import { Card } from "../ui/Card";

type EvidenceRow = {
  id: string;
  excerpt: string | null;
  sourceUrl: string;
  sourceTitle: string | null;
  publisher: string | null;
  eventDate: string | null;
  discoveredAt: string;
  checkedAt: string;
  matchRationale: string | null;
};

type SignalFlag = {
  evidenceId?: string | null;
  unknownNote?: string | null;
};

export function EvidenceList({
  items,
  signals = [],
}: {
  items: EvidenceRow[];
  signals?: SignalFlag[];
}) {
  if (!items.length) {
    return <p className="text-sm text-[var(--muted)]">No cited evidence yet.</p>;
  }

  const flagsByEvidence = new Map<string, string[]>();
  for (const s of signals) {
    if (!s.evidenceId || !s.unknownNote) continue;
    const list = flagsByEvidence.get(s.evidenceId) ?? [];
    list.push(s.unknownNote);
    flagsByEvidence.set(s.evidenceId, list);
  }

  return (
    <ul className="space-y-3">
      {items.map((e) => {
        const flags = flagsByEvidence.get(e.id) ?? [];
        if (!e.eventDate && !flags.includes("event_date_unknown")) {
          flags.push("event_date_unknown");
        }
        return (
          <li key={e.id}>
            <Card className="!p-4">
              <a
                href={e.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[var(--red-active)] hover:underline"
              >
                {e.sourceTitle || e.sourceUrl}
              </a>
              {e.publisher ? <p className="text-xs text-[var(--muted)]">{e.publisher}</p> : null}
              {e.excerpt ? (
                <blockquote className="mt-2 border-l-2 border-[var(--red)] pl-3 text-sm italic text-[var(--foreground)]">
                  {e.excerpt}
                </blockquote>
              ) : null}
              <dl className="mt-3 grid gap-1 text-xs text-[var(--muted)] sm:grid-cols-3">
                <div>
                  <dt className="font-semibold">Event</dt>
                  <dd>{formatDate(e.eventDate)}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Discovered</dt>
                  <dd>{formatDate(e.discoveredAt)}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Checked</dt>
                  <dd>{formatDate(e.checkedAt)}</dd>
                </div>
              </dl>
              {flags.length ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {flags.map((f) => (
                    <li
                      key={f}
                      className="rounded border border-[var(--badge-amber-bg)] bg-[var(--badge-amber-bg)] px-2 py-0.5 text-xs text-[var(--badge-amber-fg)]"
                    >
                      {f === "contradiction"
                        ? "Contradictory fact"
                        : f === "event_date_unknown"
                          ? "Event date unknown"
                          : f}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
