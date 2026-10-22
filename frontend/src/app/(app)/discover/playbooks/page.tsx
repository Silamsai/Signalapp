"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "../../../../components/layout/PageHeader";
import { useWorkspace } from "../../../../hooks/useWorkspace";
import { getOffer } from "../../../../lib/api/settings";
import { LoadingState } from "../../../../components/common/LoadingState";
import { ErrorState } from "../../../../components/common/ErrorState";

export default function PlaybooksPage() {
  const { workspaceId, loading, error } = useWorkspace();
  const [playbooks, setPlaybooks] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    if (!workspaceId) return;
    void getOffer(workspaceId).then((r) => setPlaybooks(r.playbooks as Array<Record<string, unknown>>));
  }, [workspaceId]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader
        title="Playbooks"
        description="Versioned templates for infrastructure, recruitment, and managed IT. Executed playbook version is stored with each research run."
      />
      <ul className="space-y-3">
        {playbooks.map((p) => (
          <li key={String(p.id)} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="font-medium text-slate-900">{String(p.name)}</p>
            <p className="text-sm text-slate-600">
              {String(p.templateKey)} · v{String(p.version)}
            </p>
          </li>
        ))}
        {!playbooks.length ? (
          <p className="text-sm text-slate-600">No playbooks seeded yet. Run backend db:seed.</p>
        ) : null}
      </ul>
    </div>
  );
}
