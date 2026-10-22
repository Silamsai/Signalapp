const tones: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  ready_for_review: "bg-amber-100 text-amber-900",
  accepted: "bg-emerald-100 text-emerald-900",
  needs_research: "bg-orange-100 text-orange-900",
  rejected: "bg-red-100 text-red-800",
  unresearched: "bg-slate-100 text-slate-700",
  researching: "bg-sky-100 text-sky-900",
  researched: "bg-teal-100 text-teal-900",
  failed: "bg-red-100 text-red-800",
  open: "bg-sky-100 text-sky-900",
  in_progress: "bg-amber-100 text-amber-900",
  completed: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-slate-200 text-slate-700",
  queued: "bg-slate-100 text-slate-700",
  running: "bg-sky-100 text-sky-900",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = tones[status] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
