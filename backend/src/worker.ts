import { getEnv } from "./config/env.js";
import { getBoss, JOB_IMPORT, JOB_RESEARCH } from "./jobs/queue.js";
import { handleCsvImport } from "./jobs/handlers/csvImport.js";
import { handleResearchRun } from "./jobs/handlers/researchRun.js";

async function main() {
  getEnv();
  const boss = await getBoss();
  await boss.createQueue(JOB_RESEARCH);
  await boss.createQueue(JOB_IMPORT);

  await boss.work(JOB_RESEARCH, async ([job]) => {
    await handleResearchRun(job.data as { researchRunId: string });
  });

  await boss.work(JOB_IMPORT, async ([job]) => {
    await handleCsvImport(job.data as { importJobId: string; csvText: string });
  });

  console.log("Signal worker listening for research-run and csv-import jobs");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
