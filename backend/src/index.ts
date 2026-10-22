import { getEnv } from "./config/env.js";
import { buildApp } from "./app.js";

async function main() {
  const env = getEnv();
  const app = await buildApp();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  console.log(`Signal API listening on :${env.PORT}`);
  console.log(`Exa configured: ${Boolean(env.EXA_API_KEY?.trim())}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
