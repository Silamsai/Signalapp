"use client";

import Link from "next/link";
import type { Account } from "../../lib/api/accounts";
import { StatusBadge } from "../common/StatusBadge";
import { TableWrap } from "../ui/TableWrap";

export function AccountTable({ accounts }: { accounts: Account[] }) {
  return (
    <TableWrap>
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-[var(--line)] bg-[var(--table-head)] text-[12px] font-medium text-[var(--muted)]">
          <tr>
            <th className="px-4 py-3">Account</th>
            <th className="px-4 py-3">Domain</th>
            <th className="px-4 py-3">Research</th>
            <th className="px-4 py-3">Acceptance</th>
            <th className="px-4 py-3">Fit</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id} className="border-b border-[var(--line)] last:border-0">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-[var(--navy)] text-xs font-bold text-white">
                    {a.name.slice(0, 1).toUpperCase()}
                  </span>
                  <Link
                    href={`/accounts/${a.id}`}
                    className="font-semibold text-[var(--foreground)] hover:text-[var(--red-active)]"
                  >
                    {a.name}
                  </Link>
                </div>
              </td>
              <td className="px-4 py-3 text-[var(--muted)]">{a.domain ?? "—"}</td>
              <td className="px-4 py-3">
                <StatusBadge status={a.researchState} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={a.acceptanceState} />
              </td>
              <td className="px-4 py-3 font-medium">{a.fitScore ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}
