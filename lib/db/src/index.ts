import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export async function ensureDatabaseExists(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL!;
  let url: URL;
  try {
    url = new URL(dbUrl);
  } catch {
    return;
  }

  const targetDb = decodeURIComponent(url.pathname.slice(1));
  const adminUrl = new URL(dbUrl);
  adminUrl.pathname = "/postgres";

  const adminPool = new Pool({ connectionString: adminUrl.toString() });
  try {
    const result = await adminPool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [targetDb],
    );
    if ((result.rowCount ?? 0) === 0) {
      await adminPool.query(
        `CREATE DATABASE "${targetDb.replace(/"/g, '""')}"`,
      );
      console.log(`Database "${targetDb}" created successfully`);
    }
  } catch (err) {
    console.warn(
      `Note: Could not auto-create database: ${err instanceof Error ? err.message : err}`,
    );
  } finally {
    await adminPool.end().catch(() => {});
  }
}

export async function runMigrations(migrationsFolder: string): Promise<void> {
  await migrate(db, { migrationsFolder });
}

export * from "./schema";
