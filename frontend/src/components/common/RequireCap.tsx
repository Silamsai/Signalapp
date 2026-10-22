"use client";

import type { ReactNode } from "react";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { Capability } from "../../lib/auth/capabilities";
import { ErrorState } from "./ErrorState";
import { LoadingState } from "./LoadingState";

/** Page guard: shows a clear "no access" state instead of a failing page. */
export function RequireCap({
  cap,
  anyOf,
  children,
}: {
  cap?: Capability;
  anyOf?: Capability[];
  children: (workspaceId: string) => ReactNode;
}) {
  const { workspaceId, loading, error, can } = useWorkspace();
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!workspaceId) return null;
  const allowed = (cap ? can(cap) : true) && (anyOf ? anyOf.some((c) => can(c)) : true);
  if (!allowed) {
    return (
      <div
        role="alert"
        className="rounded-[10px] border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center"
      >
        <p className="text-base font-semibold text-[var(--foreground)]">You don&apos;t have access to this page</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Your role in this workspace doesn&apos;t include it. Ask a workspace admin if you need access.
        </p>
      </div>
    );
  }
  return <>{children(workspaceId)}</>;
}
