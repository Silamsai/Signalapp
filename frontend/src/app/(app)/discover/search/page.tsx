"use client";

import { useState } from "react";
import { PageHeader } from "../../../../components/layout/PageHeader";
import { ResearchRunStatus } from "../../../../components/research/ResearchRunStatus";
import { useWorkspace } from "../../../../hooks/useWorkspace";
import { createAccount } from "../../../../lib/api/accounts";
import { startResearchRun } from "../../../../lib/api/research";
import { ErrorState } from "../../../../components/common/ErrorState";
import { LoadingState } from "../../../../components/common/LoadingState";

export default function SearchPage() {
  const { workspaceId, loading, error } = useWorkspace();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [query, setQuery] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search"
        description="Create an account and queue an Exa research run. Requires EXA_API_KEY on the backend."
      />
      <form
        className="max-w-xl space-y-3 rounded-lg border border-slate-200 bg-white p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!workspaceId) return;
          setErr(null);
          setMsg(null);
          try {
            const { account } = await createAccount(workspaceId, {
              name,
              domain: domain || undefined,
            });
            const q =
              query ||
              `${name} infrastructure expansion OR server refresh OR hiring infrastructure`;
            const { researchRunId } = await startResearchRun(workspaceId, {
              query: q,
              accountId: account.id,
              budget: 3,
              idempotencyKey: `search-${account.id}-${Date.now()}`,
            });
            setRunId(researchRunId);
            setMsg(`Account ${account.name} created; research queued.`);
          } catch (ex) {
            setErr(ex instanceof Error ? ex.message : "Failed");
          }
        }}
      >
        <input
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Company name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Domain (optional)"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
        />
        <textarea
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          rows={3}
          placeholder="Research query (optional — defaults from company name)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="rounded bg-teal-800 px-3 py-2 text-sm text-white">
          Discover & research
        </button>
      </form>
      {msg ? <p className="text-sm text-slate-700">{msg}</p> : null}
      {err ? <ErrorState message={err} /> : null}
      <ResearchRunStatus runId={runId} workspaceId={workspaceId} />
    </div>
  );
}
