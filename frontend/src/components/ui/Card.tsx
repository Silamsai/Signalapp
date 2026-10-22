export function Card({
  children,
  className = "",
  accent = false,
}: {
  children: React.ReactNode;
  className?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-[10px] border border-[var(--line)] bg-white p-[25px] ${
        accent ? "border-t-[3px] border-t-[var(--red)]" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
