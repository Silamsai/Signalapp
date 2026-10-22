"use client";

import { useEffect, useState } from "react";
import { listWorkspaces } from "../lib/auth/session";
import { ApiError } from "../lib/api/client";

const KEY = "signal_workspace_id";

export function useWorkspace() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

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
          setWorkspaceName(selected.name);
          setRole(selected.role);
        } else {
          setError("No workspace membership");
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          setUnauthorized(true);
          setError(null);
        } else {
          setError(e instanceof Error ? e.message : "Failed to load workspaces");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { workspaceId, workspaceName, role, loading, error, unauthorized };
}
