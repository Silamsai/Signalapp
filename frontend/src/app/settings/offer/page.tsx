"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getOffer, saveOffer } from "@/lib/api/settings";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function OfferSettingsPage() {
  const { workspaceId, loading, error } = useWorkspace();
  const [offering, setOffering] = useState("");
  const [territory, setTerritory] = useState("UK, IE");
  const [industries, setIndustries] = useState("");
  const [brief, setBrief] = useState("");
  const [unsupported, setUnsupported] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    void getOffer(workspaceId).then((r) => {
      const o = r.offer;
      if (!o) return;
      setOffering(String(o.offering ?? ""));
      setTerritory(((o.territory as string[]) ?? []).join(", "));
      setIndustries(((o.industries as string[]) ?? []).join(", "));
      setBrief(String(o.naturalLanguageBrief ?? ""));
      setUnsupported((o.unsupportedFilters as string[]) ?? []);
    });
  }, [workspaceId]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!workspaceId) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Offer & targeting"
        title="Make every signal relevant"
        description="Configure offering, territory, industries, and natural-language brief. Unsupported filters are shown, never silently ignored."
      />
      <Card accent className="max-w-xl space-y-3">
        <label className="block text-xs font-semibold text-[var(--muted)]">
          Offering
          <input
            className="mt-1.5 w-full rounded-[7px] border border-[var(--input-border)] px-3 py-2 text-sm font-normal text-[var(--foreground)]"
            value={offering}
            onChange={(e) => setOffering(e.target.value)}
          />
        </label>
        <label className="block text-xs font-semibold text-[var(--muted)]">
          Territory (comma-separated)
          <input
            className="mt-1.5 w-full rounded-[7px] border border-[var(--input-border)] px-3 py-2 text-sm font-normal text-[var(--foreground)]"
            value={territory}
            onChange={(e) => setTerritory(e.target.value)}
          />
        </label>
        <label className="block text-xs font-semibold text-[var(--muted)]">
          Industries
          <input
            className="mt-1.5 w-full rounded-[7px] border border-[var(--input-border)] px-3 py-2 text-sm font-normal text-[var(--foreground)]"
            value={industries}
            onChange={(e) => setIndustries(e.target.value)}
          />
        </label>
        <label className="block text-xs font-semibold text-[var(--muted)]">
          Natural-language brief
          <textarea
            className="mt-1.5 w-full rounded-[7px] border border-[var(--input-border)] px-3 py-2 text-sm font-normal text-[var(--foreground)]"
            rows={4}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
          />
        </label>
        <Button
          variant="primary"
          onClick={async () => {
            const res = await saveOffer(workspaceId, {
              offering,
              territory: territory
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
              industries: industries
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
              buyerRoles: [],
              companySizes: [],
              exclusions: [],
              naturalLanguageBrief: brief,
            });
            setUnsupported(res.unsupportedFilters);
            setMsg("Saved");
          }}
        >
          Save targeting
        </Button>
        {msg ? <p className="text-sm text-[var(--badge-green-fg)]">{msg}</p> : null}
        {unsupported.length ? (
          <div className="rounded-[7px] border border-[var(--badge-amber-bg)] bg-[var(--badge-amber-bg)] p-3 text-sm text-[var(--badge-amber-fg)]">
            Unsupported filters:
            <ul className="mt-1 list-disc pl-5">
              {unsupported.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
