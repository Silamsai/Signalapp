export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[12px] font-bold uppercase tracking-[1.5px] text-[var(--red)]">
      {children}
    </p>
  );
}
