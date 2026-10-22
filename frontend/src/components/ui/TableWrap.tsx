export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[9px] border border-[var(--line)] bg-white">
      {children}
    </div>
  );
}
