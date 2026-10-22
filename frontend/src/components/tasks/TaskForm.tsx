"use client";

import { useState } from "react";
import { createTask } from "../../lib/api/tasks";

export function TaskForm({
  workspaceId,
  accountId,
  ownerUserId,
  onCreated,
}: {
  workspaceId: string;
  accountId: string;
  ownerUserId: string;
  onCreated: () => void;
}) {
  const [type, setType] = useState("research");
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          await createTask({
            workspaceId,
            accountId,
            type,
            ownerUserId,
            instruction,
            confirmFollowUp: type === "follow_up" ? true : undefined,
          });
          setInstruction("");
          onCreated();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed");
        }
      }}
    >
      <h3 className="text-sm font-semibold">New task</h3>
      <select
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        value={type}
        onChange={(e) => setType(e.target.value)}
      >
        <option value="research">Research</option>
        <option value="call">Call</option>
        <option value="email">Email</option>
        <option value="follow_up">Follow-up</option>
      </select>
      <textarea
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        rows={2}
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="Instruction"
      />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button type="submit" className="rounded bg-teal-800 px-3 py-1.5 text-sm text-white">
        Create task
      </button>
      <p className="text-xs text-slate-500">Phase 1 does not dispatch calls or messages.</p>
    </form>
  );
}
