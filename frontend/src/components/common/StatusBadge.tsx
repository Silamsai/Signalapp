import { Badge } from "../ui/Badge";

const map: Record<string, { tone: "default" | "green" | "amber" | "blue" | "red"; label?: string }> =
  {
    draft: { tone: "default", label: "Draft" },
    ready_for_review: { tone: "amber", label: "Ready for review" },
    accepted: { tone: "green", label: "Accepted" },
    needs_research: { tone: "amber", label: "Needs research" },
    rejected: { tone: "red", label: "Rejected" },
    unresearched: { tone: "default", label: "Unresearched" },
    researching: { tone: "blue", label: "Researching" },
    researched: { tone: "green", label: "Researched" },
    failed: { tone: "red", label: "Failed" },
    open: { tone: "blue", label: "Open" },
    in_progress: { tone: "amber", label: "In progress" },
    completed: { tone: "green", label: "Completed" },
    cancelled: { tone: "default", label: "Cancelled" },
    queued: { tone: "default", label: "Queued" },
    running: { tone: "blue", label: "Running" },
    retrying: { tone: "amber", label: "Retrying" },
    no_results: { tone: "default", label: "No results" },
    prepared: { tone: "default", label: "Prepared (not shared)" },
    shared: { tone: "blue", label: "Shared" },
    acknowledged: { tone: "green", label: "Acknowledged" },
    returned: { tone: "amber", label: "Returned" },
    closed: { tone: "default", label: "Closed" },
    fresh: { tone: "green", label: "Fresh" },
    stale: { tone: "amber", label: "Stale" },
    date_unknown: { tone: "amber", label: "Event date unknown" },
  };

export function StatusBadge({ status }: { status: string }) {
  const meta = map[status] ?? { tone: "default" as const };
  const label = meta.label ?? status.replaceAll("_", " ");
  return <Badge tone={meta.tone}>{label}</Badge>;
}
