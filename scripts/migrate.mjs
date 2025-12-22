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
    await client.query("BEGIN");

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

    // Step 2: Migrate players -> parent_user_id model (backwards-compatible)
    const playersTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'players'
      );
    `);

    if (playersTableExists.rows[0].exists) {
      const hasParentUserId = await client.query(
        `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'players'
            AND column_name = 'parent_user_id'
        ) AS exists;
        `
      );

      if (!hasParentUserId.rows[0].exists) {
        console.log("🔄 Migrating players.user_id -> players.parent_user_id...");

        // Allow legacy user_id to be nullable so new rows don't require it
        await client.query(`
          ALTER TABLE players
          ALTER COLUMN user_id DROP NOT NULL;
        `);

        await client.query(`
          ALTER TABLE players
          ADD COLUMN IF NOT EXISTS parent_user_id UUID REFERENCES users(id) ON DELETE CASCADE;
        `);

        await client.query(`
          ALTER TABLE players
          ADD COLUMN IF NOT EXISTS self_supervised BOOLEAN DEFAULT FALSE;
        `);

        // Backfill parent_user_id from legacy user_id
        await client.query(`
          UPDATE players
          SET parent_user_id = user_id
          WHERE parent_user_id IS NULL AND user_id IS NOT NULL;
        `);

        // Mark legacy records as self-supervised (they were "player users" before)
        await client.query(`
          UPDATE players
          SET self_supervised = TRUE
          WHERE self_supervised IS DISTINCT FROM TRUE
            AND parent_user_id IS NOT NULL
            AND user_id IS NOT NULL
            AND parent_user_id = user_id;
        `);

        // Convert any legacy player users that supervise players into parent users
        await client.query(`
          UPDATE users u
          SET role = 'parent'
          WHERE u.role = 'player'
            AND EXISTS (
              SELECT 1 FROM players p WHERE p.parent_user_id = u.id
            );
        `);

        // Enforce NOT NULL on parent_user_id after backfill
        await client.query(`
          ALTER TABLE players
          ALTER COLUMN parent_user_id SET NOT NULL;
        `);

        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_players_parent_user_id ON players(parent_user_id);
        `);

        console.log("✅ Players migration completed.");
      }
    }

    // Step 3: Apply the new schema (CREATE TABLE IF NOT EXISTS, triggers, indexes, etc.)
    await client.query(sql);
    await client.query("COMMIT");
    console.log("✅ Schema applied successfully.");
  } catch (error) {
    console.error("❌ Migration failed:");
    console.error(error);
    try {
      await client.query("ROLLBACK");
    } catch {}
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
