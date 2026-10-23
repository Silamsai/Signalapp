"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { RequireCap } from "@/components/common/RequireCap";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import {
  getAcceptanceGates,
  getOffer,
  saveAcceptanceGates,
  saveOffer,
} from "@/lib/api/settings";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, FormError, FormNotice, humanize, inputClass } from "@/components/ui/Field";

const list = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

function OfferSettings({ workspaceId }: { workspaceId: string }) {
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState<number | undefined>();
  const [form, setForm] = useState({
    offering: "",
    buyerRoles: "",
    industries: "",
    companySizes: "",
    territory: "",
    exclusions: "",
    eventWindowDays: "",
    naturalLanguageBrief: "",
  });
  const [structured, setStructured] = useState<Record<string, unknown> | null>(null);
  const [unsupported, setUnsupported] = useState<string[]>([]);
  const [gates, setGates] = useState<string[]>([]);
  const [fieldKeys, setFieldKeys] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [gateNotice, setGateNotice] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getOffer(workspaceId), getAcceptanceGates(workspaceId)])
      .then(([r, g]) => {
        const o = r.offer;
        if (o) {
          setVersion(o.version);
          setForm({
            offering: o.offering,
            buyerRoles: o.buyerRoles.join(", "),
            industries: o.industries.join(", "),
            companySizes: o.companySizes.join(", "),
            territory: o.territory.join(", "),
            exclusions: o.exclusions.join(", "),
            eventWindowDays: String(o.eventWindowDays),
            naturalLanguageBrief: o.naturalLanguageBrief ?? "",
          });
          setStructured(o.structuredQuery);
          setUnsupported(o.unsupportedFilters);
        }
        setGates(g.gates.requiredKnownFields);
        setFieldKeys(g.fieldKeys);
        setLoaded(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load settings"));
  }, [workspaceId]);

  if (!loaded) return error ? <ErrorState message={error} /> : <LoadingState />;
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Offer & targeting"
        description="What you sell and who to look for. Discovery and research use these as defaults; anything that can't be applied as a filter is listed rather than silently ignored."
      />
      <Card accent>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setNotice(null);
            try {
              const res = await saveOffer(workspaceId, {
                offering: form.offering,
                buyerRoles: list(form.buyerRoles),
                industries: list(form.industries),
                companySizes: list(form.companySizes),
                territory: list(form.territory),
                exclusions: list(form.exclusions),
                eventWindowDays: Number(form.eventWindowDays) || 90,
                naturalLanguageBrief: form.naturalLanguageBrief || undefined,
                expectedVersion: version,
              });
              setVersion((v) => (v ?? 0) + 1);
              setForm((f) => ({ ...f, territory: res.territory.join(", ") }));
              setStructured(res.structuredQuery);
              setUnsupported(res.unsupportedFilters);
              setNotice("Saved.");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not save");
            }
          }}
        >
          <Field label="Offering">
            <input
              className={inputClass}
              required
              value={form.offering}
              onChange={set("offering")}
              placeholder="e.g. Enterprise servers and managed infrastructure"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Territory">
              <input className={inputClass} value={form.territory} onChange={set("territory")} placeholder="e.g. United Kingdom, Ireland" />
            </Field>
            <Field label="Industries">
              <input className={inputClass} value={form.industries} onChange={set("industries")} placeholder="e.g. Financial Services, Healthcare" />
            </Field>
            <Field label="Buyer roles">
              <input className={inputClass} value={form.buyerRoles} onChange={set("buyerRoles")} placeholder="e.g. CIO, Head of Infrastructure" />
            </Field>
            <Field label="Company sizes (employees)">
              <input className={inputClass} value={form.companySizes} onChange={set("companySizes")} placeholder="e.g. 200-1000, 1000+" />
            </Field>
            <Field label="Exclusions (domains to never return)">
              <input className={inputClass} value={form.exclusions} onChange={set("exclusions")} placeholder="e.g. competitor.com, existingclient.co.uk" />
            </Field>
            <Field label="Event window (days, older = stale)">
              <input
                className={inputClass}
                inputMode="numeric"
                value={form.eventWindowDays}
                onChange={set("eventWindowDays")}
                placeholder="e.g. 90"
              />
            </Field>
          </div>
          <Field label="Natural-language brief">
            <textarea
              className={inputClass}
              rows={3}
              value={form.naturalLanguageBrief}
              onChange={set("naturalLanguageBrief")}
              placeholder="e.g. UK banks and insurers expanding data centres or refreshing servers"
            />
          </Field>
          <FormError message={error} />
          <FormNotice message={notice} />
          <Button type="submit" variant="primary">
            Save targeting
          </Button>
        </form>

        {unsupported.length ? (
          <div role="alert" className="mt-4 rounded-[7px] bg-[var(--badge-amber-bg)] p-3 text-sm text-[var(--badge-amber-fg)]">
            <p className="font-semibold">Not applied as filters:</p>
            <ul className="mt-1 list-disc pl-5">
              {unsupported.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {structured && (structured as { fromBrief?: unknown }).fromBrief ? (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-semibold">How the brief was understood</summary>
            <pre className="mt-2 overflow-auto rounded bg-[var(--chip-bg)] p-3 text-xs">
              {JSON.stringify((structured as { fromBrief: unknown }).fromBrief, null, 2)}
            </pre>
          </details>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-[16px]">Acceptance gates</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Brief fields that must be known (not &quot;unknown&quot;) before a reviewer can accept. Reviewed evidence, an owner, a
          next action and no active suppression are always required. Unknown budget doesn&apos;t block acceptance unless you
          tick it here.
        </p>
        <div className="mt-3 grid gap-1.5 text-sm sm:grid-cols-3">
          {fieldKeys.map((k) => (
            <label key={k} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={gates.includes(k)}
                onChange={(e) => setGates((g) => (e.target.checked ? [...g, k] : g.filter((x) => x !== k)))}
              />
              {humanize(k)}
            </label>
          ))}
        </div>
        <Button
          className="mt-3"
          onClick={async () => {
            setGateNotice(null);
            try {
              await saveAcceptanceGates(workspaceId, gates);
              setGateNotice("Acceptance gates saved.");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not save gates");
            }
          }}
        >
          Save gates
        </Button>
        <FormNotice message={gateNotice} />
      </Card>
    </div>
  );
}

export default function OfferSettingsPage() {
  return <RequireCap cap="manage_settings">{(workspaceId) => <OfferSettings workspaceId={workspaceId} />}</RequireCap>;
}
