export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="px-4 py-8 text-sm text-slate-600">
      {label}
    </div>
  );
}
