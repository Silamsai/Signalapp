"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { listNotifications, markNotificationRead } from "@/lib/api/phase234";
import { Badge } from "@/components/ui/Badge";

export function NotificationBell() {
  const { workspaceId } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await listNotifications(workspaceId);
      setItems(res.notifications);
    } catch {
      /* ignore transient errors while navigating */
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    void refresh();
    const t = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(t);
  }, [workspaceId, refresh]);

  const unread = items.filter((n) => !n.readAt).length;

  return (
    <div className="relative">
      <button
        type="button"
        className="relative rounded-[7px] px-2.5 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--chip-bg)] hover:text-[var(--foreground)]"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        Alerts
        {unread > 0 ? (
          <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--red)] px-1 text-[11px] font-semibold text-white">
            {unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-[10px] border border-[var(--line)] bg-white p-2 shadow-lg">
          <p className="px-2 py-1.5 text-xs font-semibold text-[var(--muted)]">Notifications</p>
          {items.length === 0 ? (
            <p className="px-2 py-4 text-sm text-[var(--muted)]">No alerts yet.</p>
          ) : (
            <ul className="max-h-72 overflow-auto">
              {items.slice(0, 12).map((n) => (
                <li key={String(n.id)}>
                  <button
                    type="button"
                    className="w-full rounded-[6px] px-2 py-2 text-left hover:bg-[var(--chip-bg)]"
                    onClick={async () => {
                      await markNotificationRead(String(n.id));
                      void refresh();
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {String(n.title)}
                      </p>
                      {!n.readAt ? <Badge tone="red">New</Badge> : null}
                    </div>
                    {n.body ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-[var(--muted)]">
                        {String(n.body)}
                      </p>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
