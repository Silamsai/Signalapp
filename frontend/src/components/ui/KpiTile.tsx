import { Card } from "./Card";

export function KpiTile({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="!p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-[32px] font-semibold leading-none tracking-tight text-[var(--foreground)]">
        {value}
      </p>
    </Card>
  );
}
