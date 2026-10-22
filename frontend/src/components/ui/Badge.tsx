const tones = {
  default: "bg-[var(--badge-default-bg)] text-[var(--badge-default-fg)]",
  green: "bg-[var(--badge-green-bg)] text-[var(--badge-green-fg)]",
  amber: "bg-[var(--badge-amber-bg)] text-[var(--badge-amber-fg)]",
  blue: "bg-[var(--badge-blue-bg)] text-[var(--badge-blue-fg)]",
  red: "bg-[var(--red-tint)] text-[var(--red-active)]",
} as const;

export function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: keyof typeof tones;
}) {
  return (
    <span
      className={`inline-flex rounded-[4px] px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
