import { and, eq } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import {
  accountIdentities,
  accounts,
  importJobs,
  mergeCandidates,
} from "../../db/schema/index.js";
import { parseCsv } from "../../utils/csv.js";
import { newId } from "../../utils/ids.js";
import { isSuppressed } from "../../services/suppressions.js";

function normalizeDomain(raw?: string): string | null {
  if (!raw) return null;
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? "";
  return d || null;
}

export async function handleCsvImport(payload: { importJobId: string; csvText: string }) {
  const db = getDb();
  const [job] = await db
    .select()
    .from(importJobs)
    .where(eq(importJobs.id, payload.importJobId))
    .limit(1);
  if (!job) return;

  await db.update(importJobs).set({ status: "running" }).where(eq(importJobs.id, job.id));

  const { rows, errors: parseErrors } = parseCsv(payload.csvText);
  const rowErrors: string[] = [...parseErrors];
  let success = 0;

  // Limit rows for Phase 1
  if (rows.length > 5000) {
    await db
      .update(importJobs)
      .set({
        status: "failed",
        rowErrorsJson: JSON.stringify(["CSV exceeds 5000 row limit"]),
        completedAt: new Date(),
      })
      .where(eq(importJobs.id, job.id));
    return;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = row.name || row.company || row.account;
    if (!name) {
      rowErrors.push(`Row ${i + 2}: missing name/company`);
      continue;
    }
    const domain = normalizeDomain(row.domain || row.website || row.url);
    const country = row.country || null;

    try {
      if (domain && (await isSuppressed(job.workspaceId, domain))) {
        rowErrors.push(`Row ${i + 2}: domain ${domain} is suppressed (skipped)`);
        continue;
      }
      if (domain) {
        const dup = await db
          .select()
          .from(accounts)
          .where(
            and(eq(accounts.workspaceId, job.workspaceId), eq(accounts.domain, domain)),
          )
          .limit(1);
        if (dup[0] && dup[0].name.toLowerCase() !== name.toLowerCase()) {
          const accountId = newId("acc");
          await db.insert(accounts).values({
            id: accountId,
            tenantId: job.tenantId,
            workspaceId: job.workspaceId,
            name,
            domain,
            country,
            researchState: "unresearched",
            acceptanceState: "draft",
          });
          await db.insert(mergeCandidates).values({
            id: newId("mrg"),
            tenantId: job.tenantId,
            workspaceId: job.workspaceId,
            accountIdA: dup[0].id,
            accountIdB: accountId,
            reason: `Similar domain ${domain} with different legal/display name`,
          });
          success++;
          continue;
        }
        if (dup[0]) {
          rowErrors.push(`Row ${i + 2}: duplicate domain ${domain} (skipped)`);
          continue;
        }
      }

      const accountId = newId("acc");
      await db.insert(accounts).values({
        id: accountId,
        tenantId: job.tenantId,
        workspaceId: job.workspaceId,
        name,
        domain,
        country,
        legalName: row.legal_name || row.legalname || null,
        researchState: "unresearched",
        acceptanceState: "draft",
      });
      if (domain) {
        await db.insert(accountIdentities).values({
          id: newId("aid"),
          tenantId: job.tenantId,
          workspaceId: job.workspaceId,
          accountId,
          kind: "domain",
          value: domain,
        });
      }
      success++;
    } catch (e) {
      rowErrors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  await db
    .update(importJobs)
    .set({
      status: "completed",
      totalRows: rows.length,
      successRows: success,
      errorRows: rowErrors.length,
      rowErrorsJson: JSON.stringify(rowErrors.slice(0, 200)),
      completedAt: new Date(),
    })
    .where(eq(importJobs.id, job.id));
}
