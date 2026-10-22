"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "./AppShell";
import { LoadingState } from "../common/LoadingState";
import { useWorkspace } from "../../hooks/useWorkspace";

/** Shared shell for authenticated workspace routes (Discover, Accounts, etc.). */
export function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { workspaceId, loading, error, unauthorized, workspaceName } = useWorkspace();

  useEffect(() => {
    if (unauthorized) router.replace("/login");
  }, [unauthorized, router]);

  if (unauthorized) {
    return <LoadingState label="Redirecting to sign in…" />;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <LoadingState label="Loading workspace…" />
      </div>
    );
  }

  if (error && !workspaceId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
        <p className="text-sm text-[var(--red)]" role="alert">
          {error}
        </p>
      </div>
    );
  }

  return <AppShell workspaceName={workspaceName}>{children}</AppShell>;
}
