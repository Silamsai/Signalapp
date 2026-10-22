"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ResearchRunStatus } from "@/components/research/ResearchRunStatus";
import { RequireCap } from "@/components/common/RequireCap";
import { AccountTable } from "@/components/accounts/AccountTable";
import { useWorkspace } from "@/hooks/useWorkspace";
import { createAccount, listAccounts, type Account } from "@/lib/api/accounts";
import { parseBrief, startResearchRun, type ParsedBrief, type ResearchRun } from "@/lib/api/research";
import { getOffer, type Playbook } from "@/lib/api/settings";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, FormError, humanize, inputClass } from "@/components/ui/Field";

const SIGNALS = ["expansion", "infra_hiring", "refresh", "compute", "procurement"];
const split = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

function SearchView({ workspaceId }: { workspaceId: string }) {
  const { can } = useWorkspace();
  const [brief, setBrief] = useState(
    "UK and Ireland financial services firms announcing data centre expansion or server refresh in the last 3 months",
  );
  const [parsed, setParsed] = useState<ParsedBrief | null>(null);
  const [countries, setCountries] = useState("");
  const [industries, setIndustries] = useState("");
  const [signals, setSignals] = useState<string[]>([]);
  const [windowDays, setWindowDays] = useState("");
  const [budget, setBudget] = useState(5);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [playbookId, setPlaybookId] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [found, setFound] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [addMsg, setAddMsg] = useState<string | null>(null);

  useEffect(() => {
    void getOffer(workspaceId)
      .then((r) => {
        setPlaybooks(r.playbooks);
        setPlaybookId(r.playbooks.find((p) => p.templateKey === "infrastructure")?.id ?? r.playbooks[0]?.id ?? "");
      })
      .catch(() => setPlaybooks([]));
  }, [workspaceId]);

  async function onFinished(run: ResearchRun) {
    const ids = new Set([...(run.result?.candidateAccountIds ?? []), ...(run.result?.alreadyKnownAccountIds ?? [])]);
    if (!ids.size) return setFound([]);
    const { accounts } = await listAccounts(workspaceId);
    setFound(accounts.filter((a) => ids.has(a.id)));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Discover"
        title="Find prospects"
        description="Describe who you're looking for. You'll see how the brief was understood — and anything we can't filter on — before anything runs or uses research units."
      />

      <Card accent className="space-y-4">
        <Field label="Research brief">
          <textarea className={inputClass} rows={3} value={brief} onChange={(e) => setBrief(e.target.value)} />
        </Field>
        <Button
          disabled={busy || !brief.trim()}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const p = await parseBrief(workspaceId, brief);
              setParsed(p);
              setCountries(p.structured.countries.join(", "));
              setIndustries(p.structured.industries.join(", "));
              setSignals(p.structured.signalKinds);
              setWindowDays(p.structured.eventWindowDays ? String(p.structured.eventWindowDays) : "");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not read the brief");
            } finally {
              setBusy(false);
            }
          }}
        >
          Check how the brief is understood
        </Button>

        {parsed ? (
          <div className="space-y-4 border-t border-[var(--line)] pt-4">
            <h2 className="text-[15px]">Confirm or correct the search</h2>
            {parsed.unsupported.length ? (
              <div role="alert" className="rounded-[7px] bg-[var(--badge-amber-bg)] p-3 text-sm text-[var(--badge-amber-fg)]">
                <p className="font-semibold">These parts of the brief can&apos;t be applied as filters:</p>
                <ul className="mt-1 list-disc pl-5">
                  {parsed.unsupported.map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Countries (ISO codes)" hint="Empty = workspace territory from Settings">
                <input className={inputClass} value={countries} onChange={(e) => setCountries(e.target.value)} />
              </Field>
              <Field label="Industries">
                <input className={inputClass} value={industries} onChange={(e) => setIndustries(e.target.value)} />
              </Field>
              <Field label="Event window (days)" hint="Empty = workspace default">
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={windowDays}
                  onChange={(e) => setWindowDays(e.target.value.replace(/\D/g, ""))}
                />
              </Field>
              <Field label="Playbook">
                <select className={inputClass} value={playbookId} onChange={(e) => setPlaybookId(e.target.value)}>
                  {playbooks.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} v{p.version}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <fieldset>
              <legend className="text-xs font-semibold text-[var(--muted)]">Signals</legend>
              <div className="mt-1 flex flex-wrap gap-3 text-sm">
                {SIGNALS.map((s) => (
                  <label key={s} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={signals.includes(s)}
                      onChange={(e) => setSignals((x) => (e.target.checked ? [...x, s] : x.filter((y) => y !== s)))}
                    />
                    {humanize(s)}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field
              label={`Results to fetch (max ${budget} research units)`}
              hint={`Monthly usage: ${parsed.usage.usedMonthly} of ${parsed.usage.quotaMonthly} units used. Unused units are refunded.`}
            >
              <input
                type="range"
                min={1}
                max={10}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="mt-2 w-full max-w-xs"
              />
            </Field>
            <Button
              variant="primary"
              disabled={busy || !can("discover")}
              onClick={async () => {
                setBusy(true);
                setError(null);
                setFound([]);
                try {
                  const { researchRunId } = await startResearchRun(workspaceId, {
                    mode: "discovery",
                    query: brief,
                    brief,
                    budget,
                    playbookVersionId: playbookId || undefined,
                    filters: {
                      countries: countries ? split(countries).map((c) => c.toUpperCase()) : undefined,
                      industries: industries ? split(industries) : undefined,
                      signalKinds: signals,
                      eventWindowDays: windowDays ? Number(windowDays) : undefined,
                    },
                  });
                  setRunId(researchRunId);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not start discovery");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Find companies
            </Button>
          </div>
        ) : null}
        <FormError message={error} />
      </Card>

      <ResearchRunStatus runId={runId} workspaceId={workspaceId} onFinished={(r) => void onFinished(r)} />
      {found.length ? (
        <div className="space-y-2">
          <h2 className="text-[16px]">Candidate accounts</h2>
          <p className="text-sm text-[var(--muted)]">
            These are unresearched. Open one and run research to collect cited evidence before qualifying it.
          </p>
          <AccountTable accounts={found} />
        </div>
      ) : null}

      {can("import") ? (
        <Card className="space-y-3">
          <h2 className="text-[15px]">Add a company you already know</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Company name">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Domain (optional)">
              <input className={inputClass} value={domain} onChange={(e) => setDomain(e.target.value)} />
            </Field>
          </div>
          <Button
            disabled={!name.trim()}
            onClick={async () => {
              setAddMsg(null);
              try {
                const { account } = await createAccount(workspaceId, { name: name.trim(), domain: domain.trim() || undefined });
                setName("");
                setDomain("");
                setAddMsg(account.id);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not add account");
              }
            }}
          >
            Add to watchlist
          </Button>
          {addMsg ? (
            <p role="status" className="text-sm">
              Added.{" "}
              <Link href={`/accounts/${addMsg}`} className="text-[var(--red-active)] underline">
                Open it to run research
              </Link>
            </p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

export default function SearchPage() {
  return <RequireCap cap="discover">{(workspaceId) => <SearchView workspaceId={workspaceId} />}</RequireCap>;
}
