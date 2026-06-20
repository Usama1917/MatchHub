import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// `connectionTimeoutMillis` makes a saturated/unreachable database fail fast
// instead of hanging until the serverless function hits its maxDuration. On
// Vercel keep `PG_POOL_MAX` low (and point DATABASE_URL at a connection pooler,
// e.g. Supabase pgbouncer on port 6543) so concurrent invocations don't exhaust
// the database's direct connection limit.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX ?? 10),
  connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS ?? 5000),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
