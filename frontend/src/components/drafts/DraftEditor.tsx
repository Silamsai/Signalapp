"use client";

import { useState } from "react";
import { api } from "../../lib/api/client";

type Draft = {
  id: string;
  subject: string | null;
  body: string;
  staleWarning: number;
  version: number;
};

export function DraftEditor({
  draft,
  workspaceId,
  onSaved,
}: {
  draft: Draft;
  workspaceId: string;
  onSaved: () => void;
}) {
  const [subject, setSubject] = useState(draft.subject ?? "");
  const [body, setBody] = useState(draft.body);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      {draft.staleWarning ? (
        <p className="text-sm text-amber-800">Stale source warning — review citations before use.</p>
      ) : null}
      <input
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />
      <textarea
        className="w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm"
        rows={10}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <button
        type="button"
        className="rounded bg-teal-800 px-3 py-1.5 text-sm text-white"
        onClick={async () => {
          await api(`/v1/drafts/${draft.id}`, {
            method: "PATCH",
            body: JSON.stringify({ workspaceId, subject, body }),
          });
          setMsg("Saved (draft only — no dispatch)");
          onSaved();
        }}
      >
        Save draft
      </button>
      {msg ? <p className="text-xs text-slate-600">{msg}</p> : null}
    </div>
  );
}
