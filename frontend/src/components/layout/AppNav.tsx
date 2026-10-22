"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "../../lib/auth/session";

const items = [
  { href: "/discover", label: "Discover" },
  { href: "/accounts", label: "Accounts" },
  { href: "/outreach", label: "Outreach" },
  { href: "/reports/outcomes", label: "Reports" },
  { href: "/settings/offer", label: "Settings" },
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-8">
          <Link href="/discover" className="text-lg font-semibold tracking-tight text-teal-800">
            SignalApp
          </Link>
          <nav aria-label="Primary" className="flex flex-wrap gap-1">
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded px-3 py-1.5 text-sm font-medium ${
                    active
                      ? "bg-teal-50 text-teal-900"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <button
          type="button"
          className="text-sm text-slate-600 hover:text-slate-900"
          onClick={async () => {
            await logout();
            router.push("/login");
          }}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
