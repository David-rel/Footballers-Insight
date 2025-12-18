#!/usr/bin/env node

/**
 * Apply the SQL in db/schema.sql against the configured DATABASE_URL.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { Pool } from "pg";

// Load .env.local first, then .env
loadEnv({ path: ".env.local" });
loadEnv();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "❌ DATABASE_URL is not set. Export it before running this script."
  );
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
    // Step 1: Check if company_users table exists and migrate data
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'company_users'
      );
    `);

    if (tableExists.rows[0].exists) {
      console.log(
        "🔄 Migrating data from company_users to users.company_id..."
      );

      // Add company_id column to users if it doesn't exist
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
      `);

      // Migrate data: set company_id for all users in company_users
      await client.query(`
        UPDATE users u
        SET company_id = cu.company_id
        FROM company_users cu
        WHERE u.id = cu.user_id
        AND u.company_id IS NULL;
      `);

      // For owners, set their company_id from companies table
      await client.query(`
        UPDATE users u
        SET company_id = c.id
        FROM companies c
        WHERE u.id = c.owner_id
        AND u.company_id IS NULL;
      `);

      console.log("✅ Data migration completed.");

      // Drop the company_users table after migration
      await client.query("DROP TABLE IF EXISTS company_users CASCADE;");
      console.log("✅ Dropped company_users table.");
    }

    // Step 2: Apply the new schema
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
