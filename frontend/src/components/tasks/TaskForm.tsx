"use client";

import { useState } from "react";
import { createTask } from "../../lib/api/tasks";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

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
    <Card>
      <form
        className="space-y-3"
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
        <h3 className="text-[15px]">New task</h3>
        <select
          className="w-full rounded-[7px] border border-[var(--input-border)] px-2 py-2 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="research">Research</option>
          <option value="call">Call</option>
          <option value="email">Email</option>
          <option value="follow_up">Follow-up</option>
        </select>
        <textarea
          className="w-full rounded-[7px] border border-[var(--input-border)] px-2 py-2 text-sm"
          rows={2}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Action brief"
        />
        {error ? <p className="text-sm text-[var(--red-active)]">{error}</p> : null}
        <Button type="submit" variant="primary">
          Create task
        </Button>
        <p className="text-xs text-[var(--muted)]">
          Phase 1 does not dispatch calls or messages.
        </p>
      </form>
    </Card>
  );
}
