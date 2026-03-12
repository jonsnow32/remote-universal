/**
 * Migration runner for device-db.
 *
 * Usage:
 *   pnpm --filter @remote/device-db migrate          # apply all pending migrations
 *   pnpm --filter @remote/device-db migrate:dry      # print SQL without applying
 *   ts-node src/migrate.ts --dry-run
 *
 * Requirements:
 *   Option A — Direct Postgres connection (recommended):
 *     Set SUPABASE_DB_URL in .env to the connection string from
 *     Supabase Dashboard → Settings → Database → Connection string (URI).
 *     Requires: pnpm add pg @types/pg
 *
 *   Option B — Manual paste:
 *     Run with --dry-run; the SQL is printed to stdout.
 *     Paste it into Supabase Dashboard → SQL Editor.
 */

import path from 'path';
import fs from 'fs/promises';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');
const DRY_RUN = process.argv.includes('--dry-run');

async function getMigrationFiles(): Promise<string[]> {
  const files = await fs.readdir(MIGRATIONS_DIR);
  return files
    .filter(f => f.endsWith('.sql'))
    .sort(); // alphabetical == numeric since we use 001_, 002_ prefix
}

async function applyMigrations(): Promise<void> {
  const files = await getMigrationFiles();

  if (files.length === 0) {
    console.log('[migrate] No migration files found in', MIGRATIONS_DIR);
    return;
  }

  console.log(`[migrate] Found ${files.length} migration file(s):`);
  for (const f of files) console.log(`  • ${f}`);

  // ── Collect all SQL ──────────────────────────────────────────────────────
  const sqlBlocks: { file: string; sql: string }[] = [];
  for (const file of files) {
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf-8');
    sqlBlocks.push({ file, sql });
  }

  if (DRY_RUN) {
    console.log('\n[migrate] DRY RUN — SQL that would be applied:\n');
    console.log('─'.repeat(72));
    for (const { file, sql } of sqlBlocks) {
      console.log(`\n-- === ${file} ===\n`);
      console.log(sql);
    }
    console.log('─'.repeat(72));
    console.log('\n[migrate] To apply, paste the SQL above into:');
    console.log('  Supabase Dashboard → SQL Editor → New query');
    console.log('\nOr set SUPABASE_DB_URL in .env and run without --dry-run.');
    return;
  }

  // ── Apply via direct Postgres connection ──────────────────────────────────
  let dbUrl = process.env['SUPABASE_DB_URL'];

  // Auto-construct from SUPABASE_URL + DB_PASS if SUPABASE_DB_URL is absent
  if (!dbUrl) {
    const supabaseUrl = process.env['SUPABASE_URL'];
    const dbPass = process.env['DB_PASS'];
    if (supabaseUrl && dbPass) {
      const ref = new URL(supabaseUrl).hostname.split('.')[0]; // "glodilldtusvursprqia"
      const encodedPass = encodeURIComponent(dbPass);
      dbUrl = `postgresql://postgres:${encodedPass}@db.${ref}.supabase.co:5432/postgres`;
      console.log(`[migrate] Constructed DB URL from SUPABASE_URL + DB_PASS (ref: ${ref})`);
    }
  }

  if (!dbUrl) {
    console.error(
      '[migrate] ERROR: SUPABASE_DB_URL is not set.\n' +
      '\n' +
      'To apply migrations automatically, add to backend/device-db/.env:\n' +
      '  SUPABASE_DB_URL=postgresql://postgres:PASSWORD@db.YOUR_REF.supabase.co:5432/postgres\n' +
      '\n' +
      'Find it in: Supabase Dashboard → Settings → Database → Connection string (URI)\n' +
      '\n' +
      'Or run dry-run to get the SQL and paste it manually:\n' +
      '  npx ts-node src/migrate.ts --dry-run'
    );
    process.exit(1);
  }

  // Dynamically require pg so the service still works without it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pg: any;
  try {
    pg = require('pg');
  } catch {
    console.error(
      '[migrate] The "pg" package is not installed.\n' +
      'Run: pnpm --filter @remote/device-db add pg @types/pg\n' +
      'Then retry: pnpm --filter @remote/device-db migrate'
    );
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('[migrate] Connected to Postgres');

  try {
    // Ensure tracking table exists
    await client.query(`
      create table if not exists public._migrations (
        name       text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    for (const { file, sql } of sqlBlocks) {
      const { rows } = await client.query(
        'select 1 from public._migrations where name = $1',
        [file]
      );
      if (rows.length > 0) {
        console.log(`[migrate] Skip ${file} (already applied)`);
        continue;
      }
      console.log(`[migrate] Applying ${file}…`);
      await client.query(sql);
      await client.query(
        'insert into public._migrations (name) values ($1)',
        [file]
      );
      console.log(`[migrate] ✓ ${file}`);
    }
    console.log('[migrate] All migrations applied successfully.');
  } finally {
    await client.end();
  }
}

applyMigrations().catch(err => {
  console.error('[migrate] Fatal:', err);
  process.exit(1);
});
