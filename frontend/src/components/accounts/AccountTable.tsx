"use client";

import Link from "next/link";
import type { Account } from "../../lib/api/accounts";
import { StatusBadge } from "../common/StatusBadge";

export function AccountTable({ accounts }: { accounts: Account[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
          <tr>
            <th className="px-4 py-3 font-medium">Account</th>
            <th className="px-4 py-3 font-medium">Domain</th>
            <th className="px-4 py-3 font-medium">Research</th>
            <th className="px-4 py-3 font-medium">Acceptance</th>
            <th className="px-4 py-3 font-medium">Fit</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-3">
                <Link href={`/accounts/${a.id}`} className="font-medium text-teal-800 hover:underline">
                  {a.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-600">{a.domain ?? "—"}</td>
              <td className="px-4 py-3">
                <StatusBadge status={a.researchState} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={a.acceptanceState} />
              </td>
              <td className="px-4 py-3 text-slate-700">{a.fitScore ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
