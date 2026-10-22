"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentType } from "react";
import { logout } from "../../lib/auth/session";
import { SubNav, type SubNavItem } from "../ui/SubNav";
import { NotificationBell } from "./NotificationBell";
import {
  IconAccounts,
  IconDiscover,
  IconLogout,
  IconOutreach,
  IconReports,
  IconSettings,
} from "./NavIcons";

const primary: Array<{
  href: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  match: (pathname: string) => boolean;
}> = [
  {
    href: "/discover",
    label: "Discover",
    Icon: IconDiscover,
    match: (p) => p.startsWith("/discover"),
  },
  {
    href: "/accounts",
    label: "Accounts",
    Icon: IconAccounts,
    match: (p) => p.startsWith("/accounts"),
  },
  {
    href: "/outreach",
    label: "Outreach",
    Icon: IconOutreach,
    match: (p) => p.startsWith("/outreach"),
  },
  {
    href: "/reports/outcomes",
    label: "Reports",
    Icon: IconReports,
    match: (p) => p.startsWith("/reports"),
  },
  {
    href: "/settings/offer",
    label: "Settings",
    Icon: IconSettings,
    match: (p) => p.startsWith("/settings"),
  },
];

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
          : pathname.includes("/monitors")
            ? "Accounts / Monitors"
            : pathname.match(/\/accounts\/[^/]+/)
              ? "Accounts / Account brief"
              : "Accounts / Watchlist",
      subItems: [
        { href: "/accounts", label: "Watchlist & imports", exact: true },
        { href: "/accounts/acceptance", label: "Sales acceptance" },
        { href: "/accounts/pipeline", label: "Pipeline" },
        { href: "/accounts/monitors", label: "Monitors" },
      ],
    };
  }
  if (pathname.startsWith("/outreach")) {
    return {
      crumb: pathname.includes("/drafts")
        ? "Outreach / Drafts"
        : pathname.includes("/campaigns")
          ? "Outreach / Campaigns"
          : pathname.includes("/replies")
            ? "Outreach / Replies"
            : "Outreach / SDR queue",
      subItems: [
        { href: "/outreach", label: "SDR queue", exact: true },
        { href: "/outreach/campaigns", label: "Campaigns" },
        { href: "/outreach/drafts", label: "Drafts" },
        { href: "/outreach/replies", label: "Replies" },
      ],
    };
  }
  if (pathname.startsWith("/reports")) {
    return {
      crumb: pathname.includes("/score-models")
        ? "Reports / Score models"
        : "Reports / Outcomes",
      subItems: [
        { href: "/reports/outcomes", label: "Review decisions" },
        { href: "/reports/score-models", label: "Score models" },
      ],
    };
  }
  if (pathname.startsWith("/settings")) {
    return {
      crumb: pathname.includes("/connections")
        ? "Settings / Connections"
        : pathname.includes("/sending")
          ? "Settings / Sending accounts"
          : pathname.includes("/members")
            ? "Settings / Members"
            : pathname.includes("/how-it-works")
              ? "Settings / How it works"
              : "Settings / Offer & targeting",
      subItems: [
        { href: "/settings/offer", label: "Offer & targeting" },
        { href: "/settings/members", label: "Members" },
        { href: "/settings/connections", label: "Connections & usage" },
        { href: "/settings/sending", label: "Sending accounts" },
        { href: "/settings/how-it-works", label: "How it works" },
      ],
    };
  }
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
      <aside className="fixed inset-y-0 left-0 z-30 flex w-[var(--sidebar-width)] flex-col border-r border-[var(--line)] bg-[#fbfcfd]">
        <div className="px-5 pb-4 pt-5">
          <Link href="/discover" className="flex items-center gap-3" prefetch>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[var(--navy)] text-sm font-bold text-white shadow-sm">
              S
            </span>
            <span className="text-[15px] font-bold tracking-tight text-[var(--foreground)]">
              SignalApp
            </span>
          </Link>
        </div>

        <div className="mx-3 mb-3 rounded-[10px] border border-[var(--line)] bg-white px-3.5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
            Workspace
          </p>
          <p className="mt-1 truncate text-[13px] font-semibold text-[var(--foreground)]">
            {workspaceName ?? "SignalApp"}
          </p>
        </div>

        <nav aria-label="Primary" className="flex flex-1 flex-col gap-0.5 px-3">
          {primary.map((item) => {
            const active = item.match(pathname);
            const Icon = item.Icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={`group flex items-center gap-3 rounded-[9px] px-3 py-2.5 text-[13.5px] font-medium transition-colors ${
                  active
                    ? "bg-[var(--red-tint)] text-[var(--red-active)]"
                    : "text-[#3d4a57] hover:bg-white hover:text-[var(--foreground)]"
                }`}
              >
                <Icon
                  className={`shrink-0 ${active ? "text-[var(--red-active)]" : "text-[#7a8794] group-hover:text-[var(--foreground)]"}`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-[var(--line)] p-3">
          <div className="mb-2 flex items-center gap-3 rounded-[9px] px-2 py-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--navy)] text-[11px] font-bold text-white">
              SA
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">
                SignalApp
              </p>
              <p className="truncate text-[11px] text-[var(--muted)]">Signed in</p>
            </div>
          </div>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-[9px] px-3 py-2.5 text-left text-[13.5px] font-medium text-[#3d4a57] transition-colors hover:bg-white hover:text-[var(--red-active)]"
            onClick={async () => {
              await logout();
              router.push("/login");
            }}
          >
            <IconLogout className="shrink-0 text-[#7a8794]" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="ml-[var(--sidebar-width)] min-h-screen">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-white px-8 py-3.5">
          <p className="text-sm font-medium text-[var(--muted)]">{crumb}</p>
          <NotificationBell />
        </header>

        <div className="mx-auto max-w-[1450px] px-[34px] py-8">
          <SubNav items={subItems} />
          {children}
        </div>
      </div>
    </div>
  );
}
