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

export function EvidenceList({ items }: { items: EvidenceRow[] }) {
  if (!items.length) {
    return <p className="text-sm text-[var(--muted)]">No cited evidence yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((e) => (
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
          </Card>
        </li>
      ))}
    </ul>
  );
}
