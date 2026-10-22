import { defineConfig } from "@neon/config/v1";

/**
 * Neon IaC for the Signal API (lives next to the database client).
 * Run CLI from backend/: `neon link` / `neon deploy` / `neon env pull --file .env`
 */
export default defineConfig({
  auth: false,
  branch: (branch) => {
    if (branch.isDefault) return {};
    if (!branch.exists) return { ttl: "7d" };
    return {};
  },
});
