import { getEnv } from "../../config/env.js";
import { SimulatedSendingProvider } from "./simulated.js";
import type { SendingProvider } from "./types.js";

export function getSendingProvider(): SendingProvider {
  const mode = (process.env.SENDING_PROVIDER || "simulated").toLowerCase();
  if (mode !== "simulated") {
    // Only simulated is supported in this phase
    console.warn(`SENDING_PROVIDER=${mode} not supported; using simulated`);
  }
  void getEnv();
  return new SimulatedSendingProvider();
}

export type { SendingProvider } from "./types.js";
