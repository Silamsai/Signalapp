export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="rounded-[10px] border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center">
      <p className="text-base font-semibold text-[var(--foreground)]">{title}</p>
      {detail ? <p className="mt-2 text-sm text-[var(--muted)]">{detail}</p> : null}
    </div>
  );
}
