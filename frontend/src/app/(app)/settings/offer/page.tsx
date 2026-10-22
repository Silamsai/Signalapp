"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "../../../../components/layout/PageHeader";
import { useWorkspace } from "../../../../hooks/useWorkspace";
import { getOffer, saveOffer } from "../../../../lib/api/settings";
import { LoadingState } from "../../../../components/common/LoadingState";
import { ErrorState } from "../../../../components/common/ErrorState";

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
        title="Offer & targeting"
        description="Configure offering, territory, industries, and natural-language brief. Unsupported filters are shown, never silently ignored."
        actions={
          <>
            <Link href="/settings/connections" className="rounded border border-slate-300 px-3 py-1.5 text-sm">
              Connections & usage
            </Link>
            <Link href="/settings/how-it-works" className="rounded border border-slate-300 px-3 py-1.5 text-sm">
              How it works
            </Link>
          </>
        }
      />
      <form
        className="max-w-xl space-y-3 rounded-lg border border-slate-200 bg-white p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await saveOffer(workspaceId, {
            offering,
            territory: territory.split(",").map((s) => s.trim()).filter(Boolean),
            industries: industries.split(",").map((s) => s.trim()).filter(Boolean),
            buyerRoles: [],
            companySizes: [],
            exclusions: [],
            naturalLanguageBrief: brief,
          });
          setUnsupported(res.unsupportedFilters);
          setMsg("Saved");
        }}
      >
        <label className="block text-xs font-medium text-slate-600">
          Offering
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={offering}
            onChange={(e) => setOffering(e.target.value)}
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Territory (comma-separated)
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={territory}
            onChange={(e) => setTerritory(e.target.value)}
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Industries
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={industries}
            onChange={(e) => setIndustries(e.target.value)}
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Natural-language brief
          <textarea
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            rows={4}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
          />
        </label>
        <button type="submit" className="rounded bg-teal-800 px-3 py-2 text-sm text-white">
          Save
        </button>
        {msg ? <p className="text-sm text-emerald-800">{msg}</p> : null}
        {unsupported.length ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            Unsupported filters:
            <ul className="mt-1 list-disc pl-5">
              {unsupported.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </form>
    </div>
  );
}
