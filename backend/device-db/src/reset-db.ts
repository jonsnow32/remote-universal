/**
 * Truncates all device-db tables in Supabase (IR + catalog).
 * Uses the same DB connection logic as migrate.ts.
 *
 * Usage:
 *   ts-node src/reset-db.ts
 */

import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

async function main() {
  let dbUrl = process.env['SUPABASE_DB_URL'];

  if (!dbUrl) {
    const supabaseUrl = process.env['SUPABASE_URL'];
    const dbPass = process.env['DB_PASS'];
    if (supabaseUrl && dbPass) {
      const ref = new URL(supabaseUrl).hostname.split('.')[0];
      const encodedPass = encodeURIComponent(dbPass);
      dbUrl = `postgresql://postgres:${encodedPass}@db.${ref}.supabase.co:5432/postgres`;
      console.log(`[reset-db] Constructed DB URL (ref: ${ref})`);
    }
  }

  if (!dbUrl) {
    console.error('[reset-db] ERROR: SUPABASE_DB_URL or SUPABASE_URL+DB_PASS must be set.');
    process.exit(1);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pg = require('pg');
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('[reset-db] Connected to Postgres');

  try {
    // Truncate in FK-safe order (children before parents)
    await client.query(`
      truncate table
        public.ir_codes,
        public.ir_codesets,
        public.ir_brands,
        public.command_definitions,
        public.device_models,
        public.brands
      restart identity cascade;
    `);
    console.log('[reset-db] ✓ All tables truncated');
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('[reset-db] Fatal:', err.message);
  process.exit(1);
});
