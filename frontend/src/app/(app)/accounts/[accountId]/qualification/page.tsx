"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "../../../../../components/layout/PageHeader";
import { FactEditor } from "../../../../../components/qualification/FactEditor";
import { useWorkspace } from "../../../../../hooks/useWorkspace";
import { api } from "../../../../../lib/api/client";
import { LoadingState } from "../../../../../components/common/LoadingState";
import { ErrorState } from "../../../../../components/common/ErrorState";

export default function QualificationPage() {
  const params = useParams();
  const accountId = String(params.accountId);
  const { workspaceId, loading, error } = useWorkspace();
  const [data, setData] = useState<{
    qualification: { version: number; rationale: string | null };
    facts: Array<{ fieldKey: string; value: string | null; basis: string }>;
  } | null>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    const res = await api<{
      qualification: { version: number; rationale: string | null };
      facts: Array<{ fieldKey: string; value: string | null; basis: string }>;
    }>(`/v1/accounts/${accountId}/qualification?workspaceId=${workspaceId}`);
    setData(res);
  }, [accountId, workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!data || !workspaceId) return <LoadingState />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Qualification brief"
        description="Unknown is valid. Do not fabricate budget, vendor, person, or intent."
      />
      <ul className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm">
        {data.facts.map((f, i) => (
          <li key={`${f.fieldKey}-${i}`}>
            <span className="font-medium">{f.fieldKey}</span>: {f.value ?? "unknown"}{" "}
            <span className="text-slate-500">({f.basis})</span>
          </li>
        ))}
        {!data.facts.length ? <li className="text-slate-600">No facts yet.</li> : null}
      </ul>
      <FactEditor
        accountId={accountId}
        workspaceId={workspaceId}
        version={data.qualification.version}
        rationale={data.qualification.rationale}
        onSaved={refresh}
      />
    </div>
  );
}
