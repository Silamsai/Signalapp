import { runMonitor } from "../../services/monitors.js";

export async function handleMonitorRun(data: { monitorId: string }) {
  await runMonitor(data.monitorId);
}
