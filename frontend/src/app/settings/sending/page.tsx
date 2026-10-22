"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  addDomain,
  addMailbox,
  enableMailbox,
  getSending,
  testMailbox,
  verifyDomain,
} from "@/lib/api/phase234";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default function SendingSettingsPage() {
  const { workspaceId, loading, error } = useWorkspace();
  const [domains, setDomains] = useState<Array<Record<string, unknown>>>([]);
  const [accounts, setAccounts] = useState<Array<Record<string, unknown>>>([]);
  const [domain, setDomain] = useState("signal.example");
  const [mailbox, setMailbox] = useState("outreach@signal.example");
  const [domainId, setDomainId] = useState("");
  const [testTo, setTestTo] = useState("you@company.com");
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    const res = await getSending(workspaceId);
    setDomains(res.domains);
    setAccounts(res.accounts);
    if (!domainId && res.domains[0]) setDomainId(String(res.domains[0].id));
  }, [workspaceId, domainId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!workspaceId) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sending accounts"
        title="Sending accounts"
        description="Simulated domain and mailbox setup. No real OAuth or DNS — verify always succeeds in this mode."
      />
      {msg ? <p className="text-sm text-[var(--badge-green-fg)]">{msg}</p> : null}

      <Card className="space-y-3 max-w-xl">
        <h2 className="text-[16px]">1. Add & verify domain</h2>
        <input
          className="w-full rounded-[7px] border border-[var(--input-border)] px-3 py-2 text-sm"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={async () => {
              const res = await addDomain(workspaceId, domain);
              setDomainId(String(res.domain.id));
              setMsg("Domain added");
              void refresh();
            }}
          >
            Add domain
          </Button>
          <Button
            variant="primary"
            disabled={!domainId}
            onClick={async () => {
              await verifyDomain(workspaceId, domainId);
              setMsg("Domain verified (simulated)");
              void refresh();
            }}
          >
            Verify DNS
          </Button>
        </div>
        <ul className="space-y-1 text-sm">
          {domains.map((d) => (
            <li key={String(d.id)} className="flex items-center justify-between gap-2">
              <button type="button" className="text-left" onClick={() => setDomainId(String(d.id))}>
                {String(d.domain)}
              </button>
              <Badge tone={d.dnsStatus === "verified" ? "green" : "amber"}>
                {String(d.dnsStatus)}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3 max-w-xl">
        <h2 className="text-[16px]">2. Connect mailbox</h2>
        <input
          className="w-full rounded-[7px] border border-[var(--input-border)] px-3 py-2 text-sm"
          value={mailbox}
          onChange={(e) => setMailbox(e.target.value)}
        />
        <Button
          variant="secondary"
          disabled={!domainId}
          onClick={async () => {
            await addMailbox(workspaceId, { domainId, mailbox, displayName: "Signal Outreach" });
            setMsg("Mailbox connected (simulated)");
            void refresh();
          }}
        >
          Add mailbox
        </Button>
        <ul className="space-y-2">
          {accounts.map((a) => (
            <li
              key={String(a.id)}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-[var(--line)] p-3"
            >
              <div>
                <p className="text-sm font-semibold">{String(a.mailbox)}</p>
                <p className="text-xs text-[var(--muted)]">{String(a.connectionState)}</p>
              </div>
              <div className="flex gap-2">
                <Badge tone={a.enabled ? "green" : "default"}>
                  {a.enabled ? "Enabled" : "Disabled"}
                </Badge>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await enableMailbox(workspaceId, String(a.id), !a.enabled);
                    void refresh();
                  }}
                >
                  {a.enabled ? "Disable" : "Enable"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3 max-w-xl">
        <h2 className="text-[16px]">3. Test send</h2>
        <input
          className="w-full rounded-[7px] border border-[var(--input-border)] px-3 py-2 text-sm"
          value={testTo}
          onChange={(e) => setTestTo(e.target.value)}
          placeholder="test recipient"
        />
        <Button
          variant="primary"
          disabled={!accounts[0]}
          onClick={async () => {
            const res = await testMailbox(workspaceId, String(accounts[0]!.id), testTo);
            setMsg(`Test result: ${String(res.result.status)}`);
          }}
        >
          Send test
        </Button>
      </Card>
    </div>
  );
}
