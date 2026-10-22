"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createHandoff,
  getPartnerView,
  listHandoffFields,
  listHandoffs,
  revokeHandoffAccess,
  shareHandoff,
  transitionHandoff,
  type Handoff,
  type PartnerView,
} from "@/lib/api/handoffs";
import { listPeople } from "@/lib/api/accounts";
import { ApiError } from "@/lib/api/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { formatDate } from "@/lib/utils/dates";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, FormError, humanize, inputClass } from "@/components/ui/Field";

const DEFAULT_FIELDS = ["name", "domain", "reason", "nextAction"];

export function HandoffPanel({
  accountId,
  workspaceId,
  acceptanceState,
}: {
  accountId: string;
  workspaceId: string;
  acceptanceState: string;
}) {
  const { can } = useWorkspace();
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [fields, setFields] = useState<string[]>([]);
  const [people, setPeople] = useState<Array<{ userId: string; name: string }>>([]);
  const [form, setForm] = useState({
    receivingOrg: "",
    receivingUser: "",
    internalOwnerUserId: "",
    reason: "",
    nextAction: "",
    dueAt: "",
  });
  const [permitted, setPermitted] = useState<string[]>(DEFAULT_FIELDS);
  const [conflicts, setConflicts] = useState<string[] | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [preview, setPreview] = useState<{ id: string; view: PartnerView } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await listHandoffs(accountId, workspaceId);
    setHandoffs(res.handoffs);
  }, [accountId, workspaceId]);

  useEffect(() => {
    void refresh();
    void listHandoffFields().then((r) => setFields(r.fields));
    void listPeople(workspaceId)
      .then((r) => setPeople(r.people))
      .catch(() => setPeople([]));
  }, [refresh, workspaceId]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function prepare(acknowledgeConflict: boolean) {
    setBusy(true);
    setError(null);
    try {
      await createHandoff(accountId, workspaceId, {
        ...form,
        dueAt: new Date(form.dueAt).toISOString(),
        permittedFields: permitted,
        acknowledgeConflict,
      });
      setConflicts(null);
      setForm({ receivingOrg: "", receivingUser: "", internalOwnerUserId: "", reason: "", nextAction: "", dueAt: "" });
      await refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConflicts(((err.details as { conflicts?: string[] })?.conflicts) ?? [err.message]);
      } else {
        setError(err instanceof Error ? err.message : "Could not prepare handoff");
      }
    } finally {
      setBusy(false);
    }
  }

  const canPrepare = can("handoff") && acceptanceState === "accepted";
  const formReady =
    form.receivingOrg.trim() &&
    form.receivingUser.trim() &&
    form.internalOwnerUserId &&
    form.reason.trim() &&
    form.nextAction.trim() &&
    form.dueAt &&
    permitted.length;

  return (
    <Card>
      <h2 className="text-[16px]">Partner handoff</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Prepared → Shared → Acknowledged / Returned → Closed. Preparing a handoff only records it: the partner gets no
        access and no notification until a reviewer shares it.
      </p>

      {canPrepare ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void prepare(false);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Receiving organization">
              <input className={inputClass} value={form.receivingOrg} onChange={(e) => setForm({ ...form, receivingOrg: e.target.value })} />
            </Field>
            <Field label="Named recipient (email)" hint="Must be a Partner member of this workspace before sharing.">
              <input
                type="email"
                className={inputClass}
                value={form.receivingUser}
                onChange={(e) => setForm({ ...form, receivingUser: e.target.value })}
              />
            </Field>
            <Field label="Accountable internal owner">
              <select
                className={inputClass}
                value={form.internalOwnerUserId}
                onChange={(e) => setForm({ ...form, internalOwnerUserId: e.target.value })}
              >
                <option value="">Choose a person…</option>
                {people.map((p) => (
                  <option key={p.userId} value={p.userId}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Due date">
              <input type="date" className={inputClass} value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
            </Field>
            <Field label="Reason for handoff">
              <input className={inputClass} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </Field>
            <Field label="Next action for the partner">
              <input className={inputClass} value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} />
            </Field>
          </div>
          <fieldset>
            <legend className="text-xs font-semibold text-[var(--muted)]">Brief fields the partner may see</legend>
            <div className="mt-1.5 grid gap-1 text-sm sm:grid-cols-3">
              {fields.map((f) => (
                <label key={f} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={permitted.includes(f)}
                    onChange={(e) => setPermitted((p) => (e.target.checked ? [...p, f] : p.filter((x) => x !== f)))}
                  />
                  {f === "evidence" ? "Reviewed evidence" : f === "qualification" ? "All qualification facts" : humanize(f)}
                </label>
              ))}
            </div>
          </fieldset>
          {conflicts ? (
            <div role="alert" className="rounded-[7px] bg-[var(--badge-amber-bg)] p-3 text-sm text-[var(--badge-amber-fg)]">
              <p className="font-semibold">Review these conflicts before preparing:</p>
              <ul className="mt-1 list-disc pl-5">
                {conflicts.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <Button className="mt-2" disabled={busy} onClick={() => void prepare(true)}>
                I&apos;ve reviewed these — prepare anyway
              </Button>
            </div>
          ) : null}
          <Button type="submit" variant="secondary" disabled={busy || !formReady}>
            Prepare handoff
          </Button>
        </form>
      ) : can("handoff") ? (
        <p className="mt-3 text-sm text-[var(--muted)]">Only accepted, non-suppressed accounts can be handed off.</p>
      ) : null}

      <FormError message={error} />

      <ul className="mt-5 space-y-3">
        {handoffs.map((h) => {
          const activeGrants = h.grants.filter((g) => !g.revokedAt);
          return (
            <li key={h.id} className="rounded-[8px] border border-[var(--line)] bg-[var(--chip-bg)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    {h.receivingOrg} · {h.receivingUser}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {h.reason} · next: {h.nextAction ?? "—"} · due {formatDate(h.dueAt)}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    Shares: {h.permittedFields.map(humanize).join(", ")}
                    {activeGrants.length ? ` · access: ${activeGrants.map((g) => g.granteeEmail).join(", ")}` : " · no one has access"}
                  </p>
                  {h.returnReason ? <p className="text-xs text-[var(--badge-amber-fg)]">Returned: {h.returnReason}</p> : null}
                </div>
                <StatusBadge status={h.state} />
              </div>
              {can("share_handoff") ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {h.state === "prepared" && h.receivingUser ? (
                    <Button variant="primary" disabled={busy} onClick={() => run(() => shareHandoff(h.id, workspaceId, h.receivingUser!))}>
                      Share with {h.receivingUser}
                    </Button>
                  ) : null}
                  {activeGrants.map((g) => (
                    <Button key={g.granteeEmail} variant="ghost" disabled={busy} onClick={() => run(() => revokeHandoffAccess(h.id, workspaceId, g.granteeEmail))}>
                      Revoke access for {g.granteeEmail}
                    </Button>
                  ))}
                  {h.state === "shared" || h.state === "acknowledged" ? (
                    <>
                      <input
                        aria-label="Return reason"
                        className="min-w-[160px] flex-1 rounded-[7px] border border-[var(--input-border)] bg-white px-2 py-1.5 text-xs"
                        placeholder="Return reason"
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                      />
                      <Button
                        variant="ghost"
                        disabled={busy || !returnReason.trim()}
                        onClick={() =>
                          run(async () => {
                            await transitionHandoff(h.id, { workspaceId, toState: "returned", returnReason });
                            setReturnReason("");
                          })
                        }
                      >
                        Record return
                      </Button>
                    </>
                  ) : null}
                  {h.state === "acknowledged" || h.state === "returned" ? (
                    <Button disabled={busy} onClick={() => run(() => transitionHandoff(h.id, { workspaceId, toState: "closed" }))}>
                      Close
                    </Button>
                  ) : null}
                  <Button
                    variant="quiet"
                    onClick={async () => {
                      if (preview?.id === h.id) return setPreview(null);
                      try {
                        setPreview({ id: h.id, view: await getPartnerView(h.id, workspaceId) });
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Preview failed");
                      }
                    }}
                  >
                    {preview?.id === h.id ? "Hide partner preview" : "Preview what the partner sees"}
                  </Button>
                </div>
              ) : null}
              {preview?.id === h.id ? (
                <pre className="mt-2 max-h-64 overflow-auto rounded bg-white p-2 text-xs">
                  {JSON.stringify({ account: preview.view.account, facts: preview.view.facts, evidence: preview.view.evidence.length + " reviewed item(s)" }, null, 2)}
                </pre>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
