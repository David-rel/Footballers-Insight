#!/usr/bin/env node

/**
 * Drop all tables and recreate with UUID schema
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { Pool } from "pg";

loadEnv({ path: ".env.local" });
loadEnv();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "❌ DATABASE_URL is not set. Export it before running this script."
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : undefined,
});

async function resetDatabase() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    console.log("🗑️  Dropping existing tables...");

    // Drop tables in correct order (companies first due to foreign key)
    await client.query("DROP TABLE IF EXISTS companies CASCADE");
    await client.query("DROP TABLE IF EXISTS users CASCADE");

    // Drop triggers and functions
    await client.query(
      "DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE"
    );

    console.log("✅ Tables dropped");

    // Read and execute schema
    const schemaPath = resolve(process.cwd(), "db", "schema.sql");
    const sql = readFileSync(schemaPath, "utf8");

    console.log("📝 Applying new schema with UUIDs...");
    await client.query(sql);

    await client.query("COMMIT");
    console.log(
      "✅ Database reset and schema applied successfully with UUIDs!"
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Reset failed:");
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

resetDatabase().catch((error) => {
  console.error("❌ Unexpected error during reset:");
  console.error(error);
  process.exit(1);
});



