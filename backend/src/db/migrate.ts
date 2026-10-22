import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Migrations need a direct (unpooled) TCP connection — not neon-http
const url =
  process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL or DATABASE_URL_UNPOOLED is required");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(__dirname, "migrations");

const pool = new pg.Pool({ connectionString: url });
const db = drizzle(pool);

try {
  await migrate(db, { migrationsFolder });
  console.log("Migrations applied from", migrationsFolder);
  console.log(
    "Using",
    process.env.DATABASE_URL_UNPOOLED ? "DATABASE_URL_UNPOOLED" : "DATABASE_URL",
  );
} finally {
  await pool.end();
}
