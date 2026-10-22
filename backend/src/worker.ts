import { getEnv } from "./config/env.js";
import {
  getBoss,
  JOB_CAMPAIGN_DISPATCH,
  JOB_IMPORT,
  JOB_MONITOR,
  JOB_RESEARCH,
  enqueueCampaignDispatch,
} from "./jobs/queue.js";
import { handleCsvImport } from "./jobs/handlers/csvImport.js";
import { handleResearchRun } from "./jobs/handlers/researchRun.js";
import { handleMonitorRun } from "./jobs/handlers/monitorRun.js";
import { handleCampaignDispatch } from "./jobs/handlers/campaignDispatch.js";

async function main() {
  getEnv();
  const boss = await getBoss();
  await boss.createQueue(JOB_RESEARCH);
  await boss.createQueue(JOB_IMPORT);
  await boss.createQueue(JOB_MONITOR);
  await boss.createQueue(JOB_CAMPAIGN_DISPATCH);

  await boss.work(JOB_RESEARCH, async ([job]) => {
    await handleResearchRun(job.data as { researchRunId: string });
  });

  await boss.work(JOB_IMPORT, async ([job]) => {
    await handleCsvImport(job.data as { importJobId: string; csvText: string });
  });

  await boss.work(JOB_MONITOR, async ([job]) => {
    await handleMonitorRun(job.data as { monitorId: string });
  });

  await boss.work(JOB_CAMPAIGN_DISPATCH, async () => {
    await handleCampaignDispatch();
  });

  // Poll due campaign enrollments every minute
  setInterval(() => {
    void enqueueCampaignDispatch().catch((err) =>
      console.error("[campaign-dispatch]", err instanceof Error ? err.message : err),
    );
  }, 60_000);

  console.log(
    "Signal worker listening for research-run, csv-import, monitor-run, campaign-dispatch",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
