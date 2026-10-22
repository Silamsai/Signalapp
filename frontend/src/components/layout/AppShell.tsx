"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "../../lib/auth/session";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { SubNav, type SubNavItem } from "../ui/SubNav";

const primary = [
  { href: "/discover", label: "Discover", icon: "⌕" },
  { href: "/accounts", label: "Accounts", icon: "◎" },
  { href: "/outreach", label: "Outreach", icon: "✎" },
  { href: "/reports/outcomes", label: "Reports", icon: "▦" },
  { href: "/settings/offer", label: "Settings", icon: "⚙" },
] as const;

function sectionMeta(pathname: string): {
  crumb: string;
  subItems: SubNavItem[];
} {
  if (pathname.startsWith("/accounts")) {
    return {
      crumb: pathname.includes("/acceptance")
        ? "Accounts / Sales acceptance"
        : pathname.includes("/pipeline")
          ? "Accounts / Pipeline"
          : pathname.match(/\/accounts\/[^/]+/)
            ? "Accounts / Account brief"
            : "Accounts / Watchlist",
      subItems: [
        { href: "/accounts", label: "Watchlist & imports", exact: true },
        { href: "/accounts/acceptance", label: "Sales acceptance" },
        { href: "/accounts/pipeline", label: "Pipeline" },
      ],
    };
  }
  if (pathname.startsWith("/outreach")) {
    return {
      crumb: pathname.includes("/drafts") ? "Outreach / Drafts" : "Outreach / SDR queue",
      subItems: [
        { href: "/outreach", label: "SDR queue", exact: true },
        { href: "/outreach/drafts", label: "Drafts" },
      ],
    };
  }
  if (pathname.startsWith("/reports")) {
    return {
      crumb: "Reports / Outcomes",
      subItems: [{ href: "/reports/outcomes", label: "Review decisions" }],
    };
  }
  if (pathname.startsWith("/settings")) {
    return {
      crumb: pathname.includes("/connections")
        ? "Settings / Connections"
        : pathname.includes("/how-it-works")
          ? "Settings / How it works"
          : "Settings / Offer & targeting",
      subItems: [
        { href: "/settings/offer", label: "Offer & targeting" },
        { href: "/settings/connections", label: "Connections & usage" },
        { href: "/settings/how-it-works", label: "How it works" },
      ],
    };
  }
  // Discover
  return {
    crumb: pathname.includes("/search")
      ? "Discover / Search"
      : pathname.includes("/playbooks")
        ? "Discover / Playbooks"
        : "Discover / Opportunities",
    subItems: [
      { href: "/discover", label: "Opportunities", exact: true },
      { href: "/discover/search", label: "Search" },
      { href: "/discover/playbooks", label: "Playbooks" },
    ],
  };
}

export function AppShell({
  children,
  workspaceName,
}: {
  children: React.ReactNode;
  workspaceName?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { crumb, subItems } = sectionMeta(pathname);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-[var(--sidebar-width)] flex-col border-r border-[var(--line)] bg-white">
        <div className="border-b border-[var(--line)] px-5 py-5">
          <Link href="/discover" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-[6px] bg-[var(--navy)] text-sm font-bold text-white">
              S
            </span>
            <span className="text-[15px] font-bold tracking-tight text-[var(--foreground)]">
              SignalApp
            </span>
          </Link>
        </div>

        <div className="border-b border-[var(--line)] px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
            Client workspace
          </p>
          <p className="mt-1.5 truncate text-sm font-semibold text-[var(--foreground)]">
            {workspaceName ?? "SignalApp"}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Live workspace records</p>
        </div>

        <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 px-3 py-4">
          {primary.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/discover" && pathname.startsWith(item.href)) ||
              (item.href === "/discover" && pathname.startsWith("/discover"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-[14px] font-medium ${
                  active
                    ? "bg-[var(--red-tint)] text-[var(--red-active)]"
                    : "text-[var(--foreground)] hover:bg-[var(--chip-bg)]"
                }`}
              >
                <span className="w-4 text-center opacity-70" aria-hidden>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-[var(--line)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--navy)] text-xs font-bold text-white">
              IS
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">SignalApp</p>
              <p className="truncate text-xs text-[var(--muted)]">Sales enablement</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="ml-[var(--sidebar-width)] min-h-screen">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-white px-8 py-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium text-[var(--muted)]">{crumb}</p>
            <Badge tone="amber">Live · Neon + Exa</Badge>
          </div>
          <Button
            variant="ghost"
            onClick={async () => {
              await logout();
              router.push("/login");
            }}
          >
            Sign out
          </Button>
        </header>

        <div className="mx-auto max-w-[1450px] px-[34px] py-8">
          <SubNav items={subItems} />
          {children}
        </div>
      </div>
    </div>
  );
}
