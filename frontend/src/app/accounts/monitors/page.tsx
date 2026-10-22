"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useWorkspace } from "@/hooks/useWorkspace";
import { createMonitor, listMonitors, patchMonitor, runMonitor } from "@/lib/api/phase234";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TableWrap } from "@/components/ui/TableWrap";

export default function MonitorsPage() {
  const { workspaceId, loading, error } = useWorkspace();
  const [monitors, setMonitors] = useState<Array<Record<string, unknown>>>([]);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    const res = await listMonitors(workspaceId);
    setMonitors(res.monitors);
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!workspaceId) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Background monitoring"
        title="Monitors"
        description="Scheduled research watches. Alerts fire only on material, deduplicated changes."
      />

      <Card accent className="max-w-xl space-y-3">
        <h2 className="text-[16px]">Create monitor</h2>
        <label className="block text-xs font-semibold text-[var(--muted)]">
          Name
          <input
            className="mt-1.5 w-full rounded-[7px] border border-[var(--input-border)] px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="UK datacenter expansion"
          />
        </label>
        <label className="block text-xs font-semibold text-[var(--muted)]">
          Query
          <input
            className="mt-1.5 w-full rounded-[7px] border border-[var(--input-border)] px-3 py-2 text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="datacenter expansion OR server refresh UK"
          />
        </label>
        <Button
          variant="primary"
          disabled={!name.trim() || !query.trim()}
          onClick={async () => {
            setMsg(null);
            await createMonitor(workspaceId, { name, query });
            setName("");
            setQuery("");
            setMsg("Monitor created");
            void refresh();
          }}
        >
          Save monitor
        </Button>
        {msg ? <p className="text-sm text-[var(--badge-green-fg)]">{msg}</p> : null}
      </Card>

      {monitors.length === 0 ? (
        <EmptyState title="No monitors yet" detail="Create a watch to get change alerts." />
      ) : (
        <TableWrap>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--table-head)] text-xs text-[var(--muted)]">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Last run</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {monitors.map((m) => (
                <tr key={String(m.id)} className="border-b border-[var(--line)]">
                  <td className="px-4 py-3">
                    <p className="font-medium">{String(m.name)}</p>
                    <p className="text-xs text-[var(--muted)]">{String(m.query)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={m.status === "active" ? "green" : "default"}>
                      {String(m.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {m.lastRunStatus ? String(m.lastRunStatus) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={async () => {
                          const res = await runMonitor(workspaceId, String(m.id));
                          setMsg(`Run: ${String(res.result?.status ?? "done")}`);
                          void refresh();
                        }}
                      >
                        Run now
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          await patchMonitor(workspaceId, String(m.id), {
                            status: m.status === "active" ? "paused" : "active",
                          });
                          void refresh();
                        }}
                      >
                        {m.status === "active" ? "Pause" : "Resume"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  );
}
