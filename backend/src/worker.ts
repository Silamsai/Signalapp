import { getEnv } from "./config/env.js";
import { getBoss, JOB_IMPORT, JOB_RESEARCH } from "./jobs/queue.js";
import { handleCsvImport } from "./jobs/handlers/csvImport.js";
import { handleResearchRun } from "./jobs/handlers/researchRun.js";

async function main() {
  getEnv();
  const boss = await getBoss();
  await boss.createQueue(JOB_RESEARCH);
  await boss.createQueue(JOB_IMPORT);

  await boss.work<{ researchRunId: string }>(JOB_RESEARCH, { includeMetadata: true }, async ([job]) => {
    if (!job) return;
    await handleResearchRun(job.data, {
      retryCount: job.retryCount ?? 0,
      retryLimit: job.retryLimit ?? 0,
    });
  });

  await boss.work(JOB_IMPORT, async ([job]) => {
    await handleCsvImport(job.data as { importJobId: string; csvText: string });
  });

  console.log("Signal worker listening for research-run, csv-import");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
