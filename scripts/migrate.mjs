#!/usr/bin/env node

/**
 * Apply the SQL in db/schema.sql against the configured DATABASE_URL.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { Pool } from "pg";

loadEnv();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL is not set. Export it before running this script.");
  process.exit(1);
}

const schemaPath = resolve(process.cwd(), "db", "schema.sql");

let sql;

try {
  sql = readFileSync(schemaPath, "utf8");
} catch (error) {
  console.error(`❌ Unable to read schema file at ${schemaPath}`);
  console.error(error);
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : undefined,
});

async function runMigration() {
  const client = await pool.connect();

  try {
    await client.query(sql);
    console.log("✅ Schema applied successfully.");
  } catch (error) {
    console.error("❌ Migration failed:");
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch((error) => {
  console.error("❌ Unexpected error during migration:");
  console.error(error);
  process.exit(1);
});
