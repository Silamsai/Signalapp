"use client";

import { useEffect, useState } from "react";
import { listWorkspaces } from "../lib/auth/session";

const KEY = "signal_workspace_id";

export function useWorkspace() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { workspaces } = await listWorkspaces();
        if (cancelled) return;
        const stored = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
        const selected =
          workspaces.find((w) => w.id === stored) ?? workspaces[0] ?? null;
        if (selected) {
          localStorage.setItem(KEY, selected.id);
          setWorkspaceId(selected.id);
          setRole(selected.role);
        } else {
          setError("No workspace membership");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load workspaces");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { workspaceId, role, loading, error };
}
