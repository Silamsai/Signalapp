"use client";

import { useCallback, useEffect, useState } from "react";
import { getResearchRun } from "../lib/api/research";

export function useResearchRun(runId: string | null, workspaceId: string | null) {
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!runId || !workspaceId) return;
    const { researchRun } = await getResearchRun(runId, workspaceId);
    setStatus(researchRun.status);
    setProgress(researchRun.progressPct);
    setError(researchRun.errorMessage);
  }, [runId, workspaceId]);

  useEffect(() => {
    if (!runId || !workspaceId) return;
    void refresh();
    const t = setInterval(() => {
      void refresh();
    }, 2000);
    return () => clearInterval(t);
  }, [runId, workspaceId, refresh]);

  return { status, progress, error, refresh };
}
