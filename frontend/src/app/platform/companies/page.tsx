"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, FormError, inputClass } from "@/components/ui/Field";
import { CompaniesTable } from "@/components/platform/CompaniesTable";
import { createCompany, getPlatformOverview, type PlatformCompany } from "@/lib/api/platform";
import { PasswordInput } from "@/components/ui/PasswordInput";

const EMPTY = { companyName: "", workspaceName: "", adminEmail: "", adminName: "", adminPassword: "" };

export default function PlatformCompaniesPage() {
  const [companies, setCompanies] = useState<PlatformCompany[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ company: string; email: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setCompanies((await getPlatformOverview()).companies);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load companies");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (error) return <ErrorState message={error} />;
  if (!companies) return <LoadingState />;

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  const shown = companies.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Companies"
        description="Each company is a separate tenant with its own workspaces, members and data."
        actions={
          !adding ? (
            <Button variant="primary" onClick={() => setAdding(true)}>
              Add company
            </Button>
          ) : null
        }
      />

      {created ? (
        <div role="status" className="rounded-[10px] border border-[var(--line)] bg-white p-4 text-sm">
          <p className="font-semibold">Added {created.company}.</p>
          <p className="mt-1">
            {created.email} can sign in now with the password you set. They can change it under Settings → Password.
          </p>
        </div>
      ) : null}

      {adding ? (
        <Card accent>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setFormError(null);
              setCreated(null);
              try {
                const res = await createCompany({
                  companyName: form.companyName,
                  workspaceName: form.workspaceName || undefined,
                  adminEmail: form.adminEmail,
                  adminName: form.adminName || undefined,
                  adminPassword: form.adminPassword,
                });
                setCreated({ company: form.companyName, email: res.adminEmail });
                setForm(EMPTY);
                setAdding(false);
                await refresh();
              } catch (err) {
                setFormError(err instanceof Error ? err.message : "Could not add the company");
              } finally {
                setBusy(false);
              }
            }}
          >
            <h2 className="text-[15px]">Add a company</h2>
            <p className="text-sm text-[var(--muted)]">
              Creates the company, its first workspace and its tenant admin. The tenant admin then adds their own team.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Company name">
                <input id="company-name" required className={inputClass} value={form.companyName} onChange={set("companyName")} placeholder="e.g. Northbridge Systems" />
              </Field>
              <Field label="First workspace (optional)">
                <input id="company-workspace" className={inputClass} value={form.workspaceName} onChange={set("workspaceName")} placeholder="Default Workspace" />
              </Field>
              <Field label="Tenant admin email">
                <input id="company-admin-email" type="email" required className={inputClass} value={form.adminEmail} onChange={set("adminEmail")} placeholder="e.g. priya@northbridge.co.uk" />
              </Field>
              <Field label="Tenant admin name (optional)">
                <input id="company-admin-name" className={inputClass} value={form.adminName} onChange={set("adminName")} placeholder="e.g. Priya Shah" />
              </Field>
              <Field label="Tenant admin password" hint="At least 8 characters. They can change it later in Settings.">
                <PasswordInput id="company-admin-password" required minLength={8} autoComplete="new-password" value={form.adminPassword} onChange={set("adminPassword")} placeholder="Set their password" />
              </Field>
            </div>
            <FormError message={formError} />
            <div className="flex gap-2">
              <Button type="submit" variant="primary" disabled={busy || !form.companyName || !form.adminEmail || form.adminPassword.length < 8}>
                {busy ? "Adding…" : "Add company"}
              </Button>
              <Button variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card>
        <label className="block w-full max-w-sm text-xs font-semibold text-[var(--muted)]">
          Search companies
          <input id="company-search" className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Company name" />
        </label>
        <div className="mt-4">
          <CompaniesTable companies={shown} empty={q ? "No company matches that name." : "No companies yet."} />
        </div>
      </Card>
    </div>
  );
}
