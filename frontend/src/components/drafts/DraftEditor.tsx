"use client";

import { useState } from "react";
import { api } from "../../lib/api/client";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

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
    <Card className="space-y-3">
      {draft.staleWarning ? (
        <p className="text-sm text-[var(--badge-amber-fg)]">
          Stale source warning — review citations before use.
        </p>
      ) : null}
      <label className="block text-xs font-semibold text-[var(--muted)]">
        Subject
        <input
          className="mt-1 w-full rounded-[7px] border border-[var(--input-border)] px-2 py-2 text-sm font-normal text-[var(--foreground)]"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </label>
      <label className="block text-xs font-semibold text-[var(--muted)]">
        Message draft
        <textarea
          className="mt-1 w-full rounded-[7px] border border-[var(--input-border)] px-2 py-2 font-mono text-sm font-normal text-[var(--foreground)]"
          rows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      <Button
        variant="primary"
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
      </Button>
      {msg ? <p className="text-xs text-[var(--muted)]">{msg}</p> : null}
    </Card>
  );
}
