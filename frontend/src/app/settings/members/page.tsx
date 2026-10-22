"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  grantMembership,
  listMemberships,
  revokeMembership,
  type MembershipRow,
} from "@/lib/api/memberships";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const ROLES = [
  "tenant_admin",
  "researcher",
  "sdr",
  "sales_reviewer",
  "partner",
  "analyst",
] as const;

export default function MembersPage() {
  const { workspaceId, loading, error } = useWorkspace();
  const [rows, setRows] = useState<MembershipRow[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("researcher");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    const res = await listMemberships(workspaceId);
    setRows(res.memberships);
  }, [workspaceId]);

  useEffect(() => {
    void refresh().catch((err) =>
      setLocalError(err instanceof Error ? err.message : "Failed to load"),
    );
  }, [refresh]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!workspaceId) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Access"
        title="Workspace members"
        description="Grant explicit workspace access. Revoked users lose subsequent access immediately."
      />
      <Card>
        <h2 className="text-[15px]">Invite / grant</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input
            className="rounded-[7px] border border-[var(--input-border)] px-2 py-2 text-sm"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="rounded-[7px] border border-[var(--input-border)] px-2 py-2 text-sm"
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="rounded-[7px] border border-[var(--input-border)] px-2 py-2 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <Button
          className="mt-3"
          disabled={busy || !email}
          onClick={async () => {
            setBusy(true);
            setLocalError(null);
            setTempPassword(null);
            try {
              const res = await grantMembership(workspaceId, {
                email,
                name: name || undefined,
                role,
              });
              if (res.temporaryPassword) setTempPassword(res.temporaryPassword);
              setEmail("");
              setName("");
              await refresh();
            } catch (err) {
              setLocalError(err instanceof Error ? err.message : "Grant failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          Grant access
        </Button>
        {tempPassword ? (
          <p className="mt-2 text-sm text-[var(--foreground)]">
            Temporary password for new user: <code>{tempPassword}</code>
          </p>
        ) : null}
        {localError ? <p className="mt-2 text-sm text-[var(--red-active)]">{localError}</p> : null}
      </Card>
      <Card>
        <h2 className="text-[15px]">Active members</h2>
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {rows.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-medium">{m.name}</p>
                <p className="text-[var(--muted)]">
                  {m.email} · {m.role}
                </p>
              </div>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await revokeMembership(workspaceId, m.id);
                    await refresh();
                  } catch (err) {
                    setLocalError(err instanceof Error ? err.message : "Revoke failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Revoke
              </Button>
            </li>
          ))}
          {!rows.length ? (
            <li className="py-3 text-sm text-[var(--muted)]">No active members.</li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}
