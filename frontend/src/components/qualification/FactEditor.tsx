"use client";

import { useState } from "react";
import { api } from "../../lib/api/client";

const FIELDS = [
  "workload_use_case",
  "current_environment",
  "refresh_driver",
  "buying_timeframe",
  "stakeholders",
  "procurement_route",
  "incumbent_partner",
];

export function FactEditor({
  accountId,
  workspaceId,
  version,
  rationale,
  onSaved,
}: {
  accountId: string;
  workspaceId: string;
  version: number;
  rationale?: string | null;
  onSaved: () => void;
}) {
  const [fieldKey, setFieldKey] = useState(FIELDS[0]);
  const [value, setValue] = useState("");
  const [basis, setBasis] = useState("unknown");
  const [note, setNote] = useState(rationale ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await api(`/v1/accounts/${accountId}/qualification?workspaceId=${workspaceId}`, {
            method: "PATCH",
            body: JSON.stringify({
              expectedVersion: version,
              rationale: note,
              facts: [
                {
                  fieldKey,
                  value: value || null,
                  basis,
                  confirmationNote: basis === "prospect_confirmed" ? note : undefined,
                },
              ],
            }),
          });
          onSaved();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Save failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3 className="text-sm font-semibold">Qualification facts</h3>
      <label className="block text-xs font-medium text-slate-600">
        Field
        <select
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={fieldKey}
          onChange={(e) => setFieldKey(e.target.value)}
        >
          {FIELDS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Value (unknown is valid)
        <input
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Leave blank for unknown"
        />
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Basis
        <select
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={basis}
          onChange={(e) => setBasis(e.target.value)}
        >
          <option value="unknown">unknown</option>
          <option value="research_hypothesis">research_hypothesis</option>
          <option value="source_observed">source_observed</option>
          <option value="prospect_confirmed">prospect_confirmed</option>
        </select>
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Rationale / confirmation note
        <textarea
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="rounded bg-teal-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        Save fact
      </button>
    </form>
  );
}
