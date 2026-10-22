import { formatDate } from "../../lib/utils/dates";

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
    return <p className="text-sm text-slate-600">No cited evidence yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((e) => (
        <li key={e.id} className="rounded-lg border border-slate-200 bg-white p-4">
          <a
            href={e.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-teal-800 hover:underline"
          >
            {e.sourceTitle || e.sourceUrl}
          </a>
          {e.publisher ? <p className="text-xs text-slate-500">{e.publisher}</p> : null}
          {e.excerpt ? <p className="mt-2 text-sm text-slate-700">{e.excerpt}</p> : null}
          <dl className="mt-3 grid gap-1 text-xs text-slate-500 sm:grid-cols-3">
            <div>
              <dt className="font-medium">Event</dt>
              <dd>{formatDate(e.eventDate)}</dd>
            </div>
            <div>
              <dt className="font-medium">Discovered</dt>
              <dd>{formatDate(e.discoveredAt)}</dd>
            </div>
            <div>
              <dt className="font-medium">Checked</dt>
              <dd>{formatDate(e.checkedAt)}</dd>
            </div>
          </dl>
          {e.matchRationale ? (
            <p className="mt-2 text-xs text-slate-600">Match: {e.matchRationale}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
