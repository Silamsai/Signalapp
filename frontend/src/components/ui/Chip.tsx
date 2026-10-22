export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-medium text-[var(--foreground)]">
      {children}
    </span>
  );
}
