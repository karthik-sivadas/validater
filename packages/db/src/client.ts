import { config } from "dotenv";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index.js";

// Load .env from monorepo root if DATABASE_URL not already set
if (!process.env.DATABASE_URL) {
  config({ path: resolve(import.meta.dirname, "../../../.env") });
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
});

export const db = drizzle(pool, { schema });
export type Database = typeof db;
