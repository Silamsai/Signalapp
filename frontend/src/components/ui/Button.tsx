import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary:
    "bg-[var(--red)] text-white hover:bg-[var(--red-hover)] border-transparent font-semibold",
  secondary:
    "bg-white text-[var(--foreground)] border-[var(--line)] hover:bg-[var(--chip-bg)] font-medium",
  ghost:
    "bg-transparent text-[var(--muted)] border-transparent hover:bg-[var(--chip-bg)] hover:text-[var(--foreground)] font-medium",
  quiet:
    "bg-transparent text-[var(--muted)] border-transparent hover:text-[var(--red-active)] font-medium",
} as const;

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
}) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-[7px] border px-3.5 py-2 text-sm disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
