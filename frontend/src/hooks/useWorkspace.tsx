"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { listWorkspaces } from "../lib/auth/session";
import { ApiError } from "../lib/api/client";

const KEY = "signal_workspace_id";

type WorkspaceState = {
  workspaceId: string | null;
  workspaceName: string | null;
  role: string | null;
  loading: boolean;
  error: string | null;
  unauthorized: boolean;
  refresh: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceState | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { workspaces } = await listWorkspaces();
      const stored = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
      const selected = workspaces.find((w) => w.id === stored) ?? workspaces[0] ?? null;
      if (selected) {
        localStorage.setItem(KEY, selected.id);
        setWorkspaceId(selected.id);
        setWorkspaceName(selected.name);
        setRole(selected.role);
        setError(null);
        setUnauthorized(false);
      } else {
        setWorkspaceId(null);
        setError("No workspace membership");
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setUnauthorized(true);
        setError(null);
        setWorkspaceId(null);
      } else {
        setError(e instanceof Error ? e.message : "Failed to load workspaces");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      workspaceId,
      workspaceName,
      role,
      loading,
      error,
      unauthorized,
      refresh,
    }),
    [workspaceId, workspaceName, role, loading, error, unauthorized, refresh],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return ctx;
}
