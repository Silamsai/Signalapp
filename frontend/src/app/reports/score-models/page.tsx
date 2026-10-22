"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  activateScoreModel,
  createScoreModel,
  evaluateScoreModel,
  listScoreModels,
  rollbackScoreModel,
} from "@/lib/api/phase234";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default function ScoreModelsPage() {
  const { workspaceId, loading, error } = useWorkspace();
  const [models, setModels] = useState<Array<Record<string, unknown>>>([]);
  const [name, setName] = useState("Fit calibration");
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    const res = await listScoreModels(workspaceId);
    setModels(res.models);
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
        eyebrow="Optimization"
        title="Score models"
        description="Versioned ranking rules. Evaluate on held-out acceptance data before activation. Rollback anytime."
      />
      {msg ? <p className="text-sm text-[var(--badge-green-fg)]">{msg}</p> : null}

      <Card className="flex flex-wrap items-end gap-3 max-w-xl">
        <label className="block min-w-[200px] flex-1 text-xs font-semibold text-[var(--muted)]">
          Model name
          <input
            className="mt-1.5 w-full rounded-[7px] border border-[var(--input-border)] px-3 py-2 text-sm font-normal"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <Button
          variant="primary"
          onClick={async () => {
            await createScoreModel(workspaceId, { name });
            setMsg("Candidate model created");
            void refresh();
          }}
        >
          Create candidate
        </Button>
      </Card>

      <div className="grid gap-3">
        {models.map((m) => {
          const evals = (m.evals as Array<Record<string, unknown>>) ?? [];
          const latest = evals[0];
          return (
            <Card key={String(m.id)}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {String(m.name)} · v{String(m.version)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{String(m.notes ?? "")}</p>
                  {latest ? (
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Held-out {String(latest.heldOutSize)} · precision{" "}
                      {latest.precisionPct == null ? "—" : `${latest.precisionPct}%`} · recall{" "}
                      {latest.recallPct == null ? "—" : `${latest.recallPct}%`}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-[var(--muted)]">No evaluation yet</p>
                  )}
                </div>
                <Badge
                  tone={
                    m.status === "active" ? "green" : m.status === "rolled_back" ? "amber" : "default"
                  }
                >
                  {String(m.status)}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await evaluateScoreModel(workspaceId, String(m.id));
                    setMsg("Evaluation complete");
                    void refresh();
                  }}
                >
                  Evaluate
                </Button>
                <Button
                  variant="primary"
                  onClick={async () => {
                    try {
                      await activateScoreModel(workspaceId, String(m.id));
                      setMsg("Model activated");
                      void refresh();
                    } catch (e) {
                      setMsg(e instanceof Error ? e.message : "Activate failed");
                    }
                  }}
                >
                  Activate
                </Button>
                {m.status === "active" ? (
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      await rollbackScoreModel(workspaceId, String(m.id));
                      setMsg("Rolled back");
                      void refresh();
                    }}
                  >
                    Rollback
                  </Button>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
