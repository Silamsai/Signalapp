"use client";

import { useState } from "react";
import { getImport, startImport } from "../../lib/api/accounts";
import { readFileAsText } from "../../lib/utils/csv";

export function ImportCsvDialog({
  workspaceId,
  onDone,
}: {
  workspaceId: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">CSV import</h2>
      <p className="mt-1 text-xs text-slate-600">
        Columns: name/company, domain/website, country. Max 5000 rows. Imported accounts start unresearched.
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        className="mt-3 block w-full text-sm"
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          setMessage(null);
          try {
            const csvText = await readFileAsText(file);
            const { importJobId } = await startImport(workspaceId, csvText);
            setMessage(`Import queued (${importJobId}). Waiting…`);
            for (let i = 0; i < 30; i++) {
              await new Promise((r) => setTimeout(r, 1000));
              const { import: job } = await getImport(importJobId, workspaceId);
              if (job.status === "completed" || job.status === "failed") {
                setMessage(
                  `${job.status}: ${job.successRows} ok, ${job.errorRows} errors` +
                    (job.rowErrors?.length ? ` — ${job.rowErrors.slice(0, 3).join("; ")}` : ""),
                );
                onDone();
                break;
              }
            }
          } catch (err) {
            setMessage(err instanceof Error ? err.message : "Import failed");
          } finally {
            setBusy(false);
          }
        }}
      />
      {message ? <p className="mt-2 text-xs text-slate-700" role="status">{message}</p> : null}
    </div>
  );
}
