import PgBoss from "pg-boss";
import { getDirectDatabaseUrl } from "../config/env.js";

export const JOB_RESEARCH = "research-run";
export const JOB_IMPORT = "csv-import";

let boss: PgBoss | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (boss) return boss;
  // Direct connection for durable job worker sessions
  const b = new PgBoss({
    connectionString: getDirectDatabaseUrl(),
    application_name: "signal-jobs",
  });
  b.on("error", (err) => console.error("[pg-boss]", err.message));
  await b.start();
  boss = b;
  return boss;
}

export async function enqueueResearchRun(researchRunId: string) {
  const b = await getBoss();
  await b.createQueue(JOB_RESEARCH);
  await b.send(JOB_RESEARCH, { researchRunId }, {
    retryLimit: 3,
    retryBackoff: true,
    expireInMinutes: 30,
  });
}

export async function enqueueCsvImport(importJobId: string, csvText: string) {
  const b = await getBoss();
  await b.createQueue(JOB_IMPORT);
  await b.send(JOB_IMPORT, { importJobId, csvText }, {
    retryLimit: 2,
    expireInMinutes: 60,
  });
}
