"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getResearchRun, type ResearchRun } from "../lib/api/research";

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

/** Polls a research run until it reaches a terminal state. */
export function useResearchRun(
  runId: string | null,
  workspaceId: string | null,
  onFinished?: (run: ResearchRun) => void,
) {
  const [run, setRun] = useState<ResearchRun | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;

  const refresh = useCallback(async () => {
    if (!runId || !workspaceId) return null;
    try {
      const { researchRun } = await getResearchRun(runId, workspaceId);
      setRun(researchRun);
      setPollError(null);
      return researchRun;
    } catch (e) {
      setPollError(e instanceof Error ? e.message : "Could not load run status");
      return null;
    }
  }, [runId, workspaceId]);

  useEffect(() => {
    setRun(null);
    if (!runId || !workspaceId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      const r = await refresh();
      if (stopped) return;
      if (r && TERMINAL.has(r.status)) {
        finishedRef.current?.(r);
        return;
      }
      timer = setTimeout(tick, 2000);
    };
    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [runId, workspaceId, refresh]);

  return { run, pollError, refresh };
}
