"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentType } from "react";
import { logout } from "../../lib/auth/session";
import { ROLE_LABELS, type Capability } from "../../lib/auth/capabilities";
import { useWorkspace } from "../../hooks/useWorkspace";
import { SubNav, type SubNavItem } from "../ui/SubNav";
import {
  IconAccounts,
  IconDiscover,
  IconLogout,
  IconOutreach,
  IconReports,
  IconSettings,
} from "./NavIcons";

type Can = (cap: Capability) => boolean;

type Section = {
  key: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  prefix: string;
  /** Section is shown when the member can see at least one sub-view */
  items: Array<SubNavItem & { visible: (can: Can) => boolean; crumb: string }>;
};

const SECTIONS: Section[] = [
  {
    key: "partner",
    label: "Shared with me",
    Icon: IconAccounts,
    prefix: "/partner",
    items: [
      {
        href: "/partner",
        label: "Shared handoffs",
        crumb: "Shared with me",
        visible: (can) => can("acknowledge_handoff") && !can("view_accounts"),
      },
    ],
  },
  {
    key: "discover",
    label: "Discover",
    Icon: IconDiscover,
    prefix: "/discover",
    items: [
      { href: "/discover", label: "Opportunity feed", exact: true, crumb: "Discover / Opportunity feed", visible: (can) => can("discover") },
      { href: "/discover/search", label: "Search", crumb: "Discover / Search", visible: (can) => can("discover") },
      { href: "/discover/playbooks", label: "Playbooks", crumb: "Discover / Playbooks", visible: (can) => can("discover") },
    ],
  },
  {
    key: "accounts",
    label: "Accounts",
    Icon: IconAccounts,
    prefix: "/accounts",
    items: [
      { href: "/accounts", label: "Watchlist & imports", exact: true, crumb: "Accounts / Watchlist", visible: (can) => can("view_accounts") },
      {
        href: "/accounts/acceptance",
        label: "Sales acceptance",
        crumb: "Accounts / Sales acceptance",
        visible: (can) => can("accept") || can("submit_review"),
      },
      { href: "/accounts/pipeline", label: "Pipeline", crumb: "Accounts / Pipeline", visible: (can) => can("view_accounts") },
    ],
  },
  {
    key: "outreach",
    label: "Outreach",
    Icon: IconOutreach,
    prefix: "/outreach",
    items: [
      { href: "/outreach", label: "SDR queue", exact: true, crumb: "Outreach / SDR queue", visible: (can) => can("view_tasks") },
      { href: "/outreach/drafts", label: "Drafts", crumb: "Outreach / Drafts", visible: (can) => can("view_drafts") },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    Icon: IconReports,
    prefix: "/reports",
    items: [
      { href: "/reports/outcomes", label: "Outcomes", crumb: "Reports / Outcomes", visible: (can) => can("view_outcomes") },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    Icon: IconSettings,
    prefix: "/settings",
    items: [
      { href: "/settings/offer", label: "Offer & targeting", crumb: "Settings / Offer & targeting", visible: (can) => can("manage_settings") },
      { href: "/settings/members", label: "Members", crumb: "Settings / Members", visible: (can) => can("manage_membership") },
      { href: "/settings/suppressions", label: "Suppressions", crumb: "Settings / Suppressions", visible: (can) => can("manage_suppressions") },
      {
        href: "/settings/connections",
        label: "Connections & usage",
        crumb: "Settings / Connections & usage",
        visible: (can) => can("manage_settings") || can("research"),
      },
      { href: "/settings/how-it-works", label: "How it works", crumb: "Settings / How it works", visible: () => true },
    ],
  },
];

/** Sections and sub-views this member may use, in navigation order. */
export function visibleSections(can: Can) {
  return SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => i.visible(can)) })).filter((s) => {
    // "How it works" alone does not make Settings a primary destination for partners
    if (s.key === "settings" && !can("view_accounts") && !can("view_outcomes")) return false;
    return s.items.length > 0;
  });
}

/** Landing page for a member: first view their role can use. */
export function homeFor(can: Can): string {
  return visibleSections(can)[0]?.items[0]?.href ?? "/settings/how-it-works";
}

function matches(item: SubNavItem, pathname: string) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { can, role, user, workspaceName, workspaces, workspaceId, selectWorkspace } = useWorkspace();
  const sections = visibleSections(can);
  const current = sections.find((s) => pathname.startsWith(s.prefix));
  const subItems = current?.items ?? [];
  const activeItem =
    [...subItems].sort((a, b) => b.href.length - a.href.length).find((i) => matches(i, pathname)) ?? null;
  const crumb =
    activeItem?.crumb ??
    (pathname.match(/^\/accounts\/[^/]+/) ? "Accounts / Account brief" : current?.label ?? "");
  const initials = (user?.name ?? "?")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-[var(--sidebar-width)] flex-col border-r border-[var(--line)] bg-[#fbfcfd]">
        <div className="px-5 pb-4 pt-5">
          <Link href={homeFor(can)} className="flex items-center gap-3" prefetch>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[var(--navy)] text-sm font-bold text-white">
              S
            </span>
            <span className="text-[15px] font-bold tracking-tight text-[var(--foreground)]">
              SignalApp
            </span>
          </Link>
        </div>

        <div className="mx-3 mb-3 rounded-[10px] border border-[var(--line)] bg-white px-3.5 py-3">
          <label htmlFor="workspace-select" className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
            Workspace
          </label>
          {workspaces.length > 1 ? (
            <select
              id="workspace-select"
              className="mt-1 w-full truncate bg-transparent text-[13px] font-semibold text-[var(--foreground)]"
              value={workspaceId ?? ""}
              onChange={(e) => {
                selectWorkspace(e.target.value);
                // The portal redirects to the first view this role can use there
                router.push("/discover");
              }}
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          ) : (
            <p id="workspace-select" className="mt-1 truncate text-[13px] font-semibold text-[var(--foreground)]">
              {workspaceName ?? "SignalApp"}
            </p>
          )}
        </div>

        <nav aria-label="Primary" className="flex flex-1 flex-col gap-0.5 px-3">
          {sections.map((item) => {
            const active = pathname.startsWith(item.prefix);
            const Icon = item.Icon;
            return (
              <Link
                key={item.key}
                href={item.items[0]!.href}
                prefetch
                aria-current={active ? "page" : undefined}
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
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">
                {user?.name ?? "Signed in"}
              </p>
              <p className="truncate text-[11px] text-[var(--muted)]">{ROLE_LABELS[role ?? ""] ?? role}</p>
            </div>
          </div>
          <Link
            href="/account/password"
            className="mb-1 block rounded-[9px] px-3 py-2 text-[13px] font-medium text-[#3d4a57] hover:bg-white hover:text-[var(--foreground)]"
          >
            Change password
          </Link>
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
        </header>

        <main className="mx-auto max-w-[1450px] px-[34px] py-8">
          {subItems.length > 1 ? <SubNav items={subItems} /> : null}
          {children}
        </main>
      </div>
    </div>
  );
}
