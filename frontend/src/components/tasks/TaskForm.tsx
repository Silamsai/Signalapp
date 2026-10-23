"use client";

import { useEffect, useState } from "react";
import { createTask, type Task } from "../../lib/api/tasks";
import { listPeople, type Account } from "../../lib/api/accounts";
import { useWorkspace } from "../../hooks/useWorkspace";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Field, FormError, inputClass } from "../ui/Field";

const BROWSER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export function TaskForm({
  workspaceId,
  accountId,
  accounts,
  onCreated,
}: {
  workspaceId: string;
  /** Fixed account (account page) — or choose from `accounts` */
  accountId?: string;
  accounts?: Account[];
  onCreated: () => void;
}) {
  const { user, role } = useWorkspace();
  const [people, setPeople] = useState<Array<{ userId: string; name: string }>>([]);
  const [chosenAccount, setChosenAccount] = useState(accountId ?? "");
  const [type, setType] = useState<Task["type"]>("research");
  const [ownerUserId, setOwnerUserId] = useState(user?.id ?? "");
  const [due, setDue] = useState("");
  const [timezone, setTimezone] = useState(BROWSER_TZ);
  const [priority, setPriority] = useState<Task["priority"]>("normal");
  const [instruction, setInstruction] = useState("");
  const [confirmFollowUp, setConfirmFollowUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listPeople(workspaceId)
      .then((r) => setPeople(r.people))
      .catch(() => setPeople(user ? [{ userId: user.id, name: user.name }] : []));
  }, [workspaceId, user]);
  useEffect(() => {
    if (!ownerUserId && user) setOwnerUserId(user.id);
  }, [user, ownerUserId]);

  const target = accountId ?? chosenAccount;

  return (
    <Card>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setBusy(true);
          try {
            await createTask({
              workspaceId,
              accountId: target,
              type,
              ownerUserId,
              dueAt: due ? new Date(due).toISOString() : undefined,
              timezone,
              priority,
              instruction: instruction || undefined,
              confirmFollowUp: type === "follow_up" ? confirmFollowUp : undefined,
              idempotencyKey: `${target}-${type}-${ownerUserId}-${due}-${instruction}`.slice(0, 200),
            });
            setInstruction("");
            setDue("");
            setConfirmFollowUp(false);
            onCreated();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        <h3 className="text-[15px]">New task</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {!accountId ? (
            <Field label="Account">
              <select className={inputClass} value={chosenAccount} onChange={(e) => setChosenAccount(e.target.value)}>
                <option value="">Choose an account…</option>
                {(accounts ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="Type">
            <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as Task["type"])}>
              <option value="research">Research</option>
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="follow_up">Follow-up</option>
            </select>
          </Field>
          <Field label="Owner">
            <select
              className={inputClass}
              value={ownerUserId}
              disabled={role === "sdr"}
              onChange={(e) => setOwnerUserId(e.target.value)}
            >
              {people.map((p) => (
                <option key={p.userId} value={p.userId}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select className={inputClass} value={priority} onChange={(e) => setPriority(e.target.value as Task["priority"])}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </Field>
          <Field label="Due">
            <input type="datetime-local" className={inputClass} value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <Field label="Timezone">
            <input className={inputClass} value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="e.g. Europe/London" />
          </Field>
        </div>
        <Field label="Instruction">
          <textarea
            className={inputClass}
            rows={2}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g. Call the Head of Infrastructure about the Leeds expansion"
          />
        </Field>
        {type === "follow_up" ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={confirmFollowUp} onChange={(e) => setConfirmFollowUp(e.target.checked)} />
            I confirm this follow-up should be created
          </label>
        ) : null}
        <FormError message={error} />
        <Button
          type="submit"
          variant="primary"
          disabled={busy || !target || !ownerUserId || (type === "follow_up" && !confirmFollowUp)}
        >
          Create task
        </Button>
        <p className="text-xs text-[var(--muted)]">
          Tasks record work only — nothing is called, emailed or sent from SignalApp.
        </p>
      </form>
    </Card>
  );
}
