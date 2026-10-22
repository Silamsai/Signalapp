import { and, eq } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import {
  accountIdentities,
  accounts,
  importJobs,
  mergeCandidates,
} from "../../db/schema/index.js";
import { CSV_MAX_ROWS, parseCsv } from "../../utils/csv.js";
import { newId } from "../../utils/ids.js";
import { companyNameKey, normalizeCountry, normalizeDomain } from "../../utils/normalize.js";
import { activeSuppressionSet, normalizeSuppressionValue } from "../../services/suppressions.js";

export const IMPORT_FIELDS = ["name", "domain", "country", "legal_name"] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export type ColumnMapping = Partial<Record<ImportField, string>>;

/** Header aliases used when the user does not map a column explicitly. */
const ALIASES: Record<ImportField, string[]> = {
  name: ["name", "company", "company name", "account", "account name", "organisation", "organization"],
  domain: ["domain", "website", "url", "web", "company domain"],
  country: ["country", "country code", "location country"],
  legal_name: ["legal_name", "legal name", "legalname", "registered name"],
};

export function resolveMapping(headers: string[], mapping?: ColumnMapping): Record<ImportField, string | null> {
  const out = {} as Record<ImportField, string | null>;
  for (const field of IMPORT_FIELDS) {
    const explicit = mapping?.[field]?.trim().toLowerCase();
    if (explicit) {
      out[field] = headers.includes(explicit) ? explicit : null;
    } else {
      out[field] = ALIASES[field].find((a) => headers.includes(a)) ?? null;
    }
  }
  return out;
}

export async function handleCsvImport(payload: {
  importJobId: string;
  csvText: string;
  mapping?: ColumnMapping;
}) {
  const db = getDb();
  const [job] = await db
    .select()
    .from(importJobs)
    .where(eq(importJobs.id, payload.importJobId))
    .limit(1);
  if (!job || job.status === "completed") return;

  await db.update(importJobs).set({ status: "running" }).where(eq(importJobs.id, job.id));

  const fail = async (message: string) => {
    await db
      .update(importJobs)
      .set({ status: "failed", rowErrorsJson: JSON.stringify([message]), completedAt: new Date() })
      .where(eq(importJobs.id, job.id));
  };

  const { headers, rows, rowLines, errors: parseErrors } = parseCsv(payload.csvText);
  if (!headers.length) return fail(parseErrors[0] ?? "No valid header row");
  if (rows.length > CSV_MAX_ROWS) return fail(`CSV exceeds ${CSV_MAX_ROWS} row limit`);

  const cols = resolveMapping(headers, payload.mapping);
  if (!cols.name) {
    return fail(`No company name column found. Columns in file: ${headers.join(", ")}`);
  }

  const rowErrors: string[] = [...parseErrors];
  let success = 0;
  let mergeCount = 0;
  const suppressed = await activeSuppressionSet(job.workspaceId);

  // Existing workspace accounts for duplicate detection (domain + normalized name)
  const existing = await db
    .select({ id: accounts.id, name: accounts.name, domain: accounts.domain })
    .from(accounts)
    .where(and(eq(accounts.workspaceId, job.workspaceId), eq(accounts.tenantId, job.tenantId)));
  const byDomain = new Map<string, { id: string; name: string }>();
  const byName = new Map<string, { id: string; name: string; domain: string | null }>();
  for (const a of existing) {
    if (a.domain) byDomain.set(a.domain, a);
    byName.set(companyNameKey(a.name), a);
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const where = `Line ${rowLines[i]}`;
    const name = row[cols.name]?.trim();
    if (!name) {
      rowErrors.push(`${where}: missing company name`);
      continue;
    }
    if (name.length > 300) {
      rowErrors.push(`${where}: company name longer than 300 characters`);
      continue;
    }
    const rawDomain = cols.domain ? row[cols.domain] : "";
    const domain = normalizeDomain(rawDomain);
    if (rawDomain && !domain) {
      rowErrors.push(`${where}: "${rawDomain.slice(0, 80)}" is not a valid domain (imported without domain)`);
    }
    const rawCountry = cols.country ? row[cols.country] : "";
    const country = normalizeCountry(rawCountry);
    if (rawCountry && !country) {
      rowErrors.push(`${where}: unknown country "${rawCountry.slice(0, 40)}" (imported without country)`);
    }
    const legalName = (cols.legal_name ? row[cols.legal_name] : "") || null;

    try {
      if (domain && suppressed.has(normalizeSuppressionValue(domain))) {
        rowErrors.push(`${where}: ${domain} is suppressed (skipped)`);
        continue;
      }

      const nameKey = companyNameKey(name);
      const domainDup = domain ? byDomain.get(domain) : undefined;
      const nameDup = byName.get(nameKey);

      // Same domain and identical name → plain duplicate. A different legal name on the
      // same domain (e.g. "Holdings" vs "Ltd") may be a subsidiary, so it goes to review.
      if (domainDup && domainDup.name.trim().toLowerCase() === name.toLowerCase()) {
        rowErrors.push(`${where}: duplicate of existing account "${domainDup.name}" (skipped)`);
        continue;
      }

      const accountId = newId("acc");
      await db.insert(accounts).values({
        id: accountId,
        tenantId: job.tenantId,
        workspaceId: job.workspaceId,
        name,
        domain,
        country,
        legalName,
        source: "import",
        researchState: "unresearched",
        acceptanceState: "draft",
      });
      if (domain && !domainDup) {
        await db
          .insert(accountIdentities)
          .values({
            id: newId("aid"),
            tenantId: job.tenantId,
            workspaceId: job.workspaceId,
            accountId,
            kind: "domain",
            value: domain,
          })
          .onConflictDoNothing();
      }

      // Ambiguous duplicates are presented for review, never silently merged (gate 4)
      const dup = domainDup ?? nameDup;
      if (dup) {
        await db.insert(mergeCandidates).values({
          id: newId("mrg"),
          tenantId: job.tenantId,
          workspaceId: job.workspaceId,
          accountIdA: dup.id,
          accountIdB: accountId,
          reason: domainDup
            ? `Same domain ${domain} with a different name ("${domainDup.name}" vs "${name}") — possible subsidiary`
            : `Same company name as "${dup.name}" with ${domain ? `different domain ${domain}` : "no domain"}`,
        });
        mergeCount++;
      }

      if (domain && !byDomain.has(domain)) byDomain.set(domain, { id: accountId, name });
      if (!byName.has(nameKey)) byName.set(nameKey, { id: accountId, name, domain });
      success++;
    } catch (e) {
      rowErrors.push(`${where}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  await db
    .update(importJobs)
    .set({
      status: "completed",
      totalRows: rows.length,
      successRows: success,
      errorRows: rowErrors.length,
      rowErrorsJson: JSON.stringify(
        mergeCount
          ? [`${mergeCount} possible duplicate(s) sent to merge review`, ...rowErrors].slice(0, 500)
          : rowErrors.slice(0, 500),
      ),
      completedAt: new Date(),
    })
    .where(eq(importJobs.id, job.id));
}
