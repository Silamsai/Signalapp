import { Badge } from "../ui/Badge";

const map: Record<string, { tone: "default" | "green" | "amber" | "blue" | "red"; label?: string }> =
  {
    draft: { tone: "default" },
    ready_for_review: { tone: "amber", label: "Ready for review" },
    accepted: { tone: "green", label: "Accepted" },
    needs_research: { tone: "amber", label: "Needs research" },
    rejected: { tone: "red", label: "Rejected" },
    unresearched: { tone: "default", label: "New" },
    researching: { tone: "blue", label: "Researching" },
    researched: { tone: "green", label: "Supported" },
    failed: { tone: "red", label: "Failed" },
    open: { tone: "blue" },
    in_progress: { tone: "amber", label: "In progress" },
    completed: { tone: "green" },
    cancelled: { tone: "default" },
    queued: { tone: "default" },
    running: { tone: "blue" },
  };

export function StatusBadge({ status }: { status: string }) {
  const meta = map[status] ?? { tone: "default" as const };
  const label = meta.label ?? status.replaceAll("_", " ");
  return <Badge tone={meta.tone}>{label}</Badge>;
}
