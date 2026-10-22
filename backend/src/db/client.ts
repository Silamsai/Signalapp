import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { getEnv } from "../config/env.js";
import * as schema from "./schema/index.js";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;
  const { DATABASE_URL } = getEnv();
  const sql = neon(DATABASE_URL);
  _db = drizzle(sql, { schema });
  return _db;
}

export type Db = ReturnType<typeof getDb>;
