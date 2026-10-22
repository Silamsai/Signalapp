"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ResearchRunStatus } from "@/components/research/ResearchRunStatus";
import { useWorkspace } from "@/hooks/useWorkspace";
import { createAccount } from "@/lib/api/accounts";
import { startResearchRun } from "@/lib/api/research";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import Link from "next/link";

export default function SearchPage() {
  const { workspaceId, loading, error } = useWorkspace();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [brief, setBrief] = useState(
    "Find companies with facility expansion, infrastructure hiring, or server refresh signals.",
  );
  const [runId, setRunId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account discovery"
        title="Find prospects"
        description="Create an account and queue Exa research. Structured targeting comes from Settings."
        actions={
          <Link href="/settings/offer">
            <Button variant="secondary">Edit targeting</Button>
          </Link>
        }
      />

      <Card accent className="max-w-2xl space-y-4">
        <label className="block text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
          Research brief
          <textarea
            className="mt-2 w-full rounded-[7px] border border-[var(--input-border)] px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-[var(--foreground)]"
            rows={4}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
          />
        </label>
        <p className="text-xs text-[var(--muted)]">
          Free text is kept as a brief. Matching uses workspace territory, industries, and offer
          filters — unsupported filters are shown in Settings.
        </p>
        <div className="flex flex-wrap gap-2">
          <Chip>Infrastructure expansion</Chip>
          <Chip>Hiring / refresh</Chip>
          <Chip>Live Exa search</Chip>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-[var(--muted)]">
            Company name
            <input
              className="mt-1.5 w-full rounded-[7px] border border-[var(--input-border)] px-3 py-2 text-sm font-normal text-[var(--foreground)]"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="block text-xs font-semibold text-[var(--muted)]">
            Domain (optional)
            <input
              className="mt-1.5 w-full rounded-[7px] border border-[var(--input-border)] px-3 py-2 text-sm font-normal text-[var(--foreground)]"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          </label>
        </div>

        <Button
          variant="primary"
          disabled={busy || !name.trim()}
          onClick={async () => {
            if (!workspaceId) return;
            setBusy(true);
            setErr(null);
            setMsg(null);
            try {
              const { account } = await createAccount(workspaceId, {
                name: name.trim(),
                domain: domain || undefined,
              });
              const { researchRunId } = await startResearchRun(workspaceId, {
                query: `${brief} ${name}`.trim(),
                accountId: account.id,
                budget: 3,
                idempotencyKey: `search-${account.id}-${Date.now()}`,
              });
              setRunId(researchRunId);
              setMsg(`Account ${account.name} created; research queued.`);
            } catch (ex) {
              setErr(ex instanceof Error ? ex.message : "Failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          Find opportunities
        </Button>
      </Card>

      {msg ? <p className="text-sm text-[var(--foreground)]">{msg}</p> : null}
      {err ? <ErrorState message={err} /> : null}
      <ResearchRunStatus runId={runId} workspaceId={workspaceId} />
    </div>
  );
}
