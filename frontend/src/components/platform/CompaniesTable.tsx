import { ROLE_LABELS } from "@/lib/auth/capabilities";
import { formatDate } from "@/lib/utils/dates";
import type { PlatformCompany } from "@/lib/api/platform";

/** Counts-only company table shared by Overview (recent) and Companies (all). */
export function CompaniesTable({ companies, empty }: { companies: PlatformCompany[]; empty: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-[var(--muted)]">
          <tr className="border-b border-[var(--line)]">
            <th className="py-2 pr-4 font-semibold">Company</th>
            <th className="py-2 pr-4 font-semibold">Workspaces</th>
            <th className="py-2 pr-4 font-semibold">Members</th>
            <th className="py-2 pr-4 font-semibold">Accounts</th>
            <th className="py-2 pr-4 font-semibold">Research this month</th>
            <th className="py-2 font-semibold">Joined</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--line)] tabular-nums">
          {companies.map((c) => {
            const pct = c.researchQuotaMonthly ? Math.min(100, (c.researchUsedMonthly / c.researchQuotaMonthly) * 100) : 0;
            return (
              <tr key={c.id}>
                <td className="py-3 pr-4 font-medium">{c.name}</td>
                <td className="py-3 pr-4">{c.workspaces}</td>
                <td className="py-3 pr-4">
                  {c.members}
                  {c.members ? (
                    <span className="block text-xs text-[var(--muted)]">
                      {Object.entries(c.membersByRole)
                        .map(([r, n]) => `${n} ${ROLE_LABELS[r] ?? r}`)
                        .join(" · ")}
                    </span>
                  ) : null}
                </td>
                <td className="py-3 pr-4">{c.accounts}</td>
                <td className="py-3 pr-4">
                  {c.researchUsedMonthly} / {c.researchQuotaMonthly} units
                  <span className="mt-1 block h-1.5 w-28 overflow-hidden rounded-full bg-[var(--chip-bg)]" aria-hidden>
                    <span
                      className={`block h-full rounded-full ${pct >= 90 ? "bg-[var(--red)]" : "bg-[var(--navy)]"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                </td>
                <td className="py-3">{formatDate(c.createdAt)}</td>
              </tr>
            );
          })}
          {!companies.length ? (
            <tr>
              <td colSpan={6} className="py-3 text-[var(--muted)]">
                {empty}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
