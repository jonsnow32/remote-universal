/**
 * device-db service entry point.
 *
 * Usage:
 *   pnpm --filter @remote/device-db start             # daemon with cron scheduler
 *   pnpm --filter @remote/device-db crawl             # run full pipeline once and exit
 *   ts-node src/index.ts --run-once --dry-run          # parse only, no DB writes
 *   ts-node src/index.ts --run-once --dry-run --skip-fetch  # test normaliser only
 *
 * Environment variables (see .env.example):
 *   SUPABASE_URL          — Supabase project URL
 *   SUPABASE_SERVICE_KEY  — Supabase service role key (bypasses RLS)
 *   GITHUB_TOKEN          — GitHub PAT for higher rate limits (optional)
 *   CRAWL_CACHE_DIR       — Local cache dir (default: /tmp/crawl)
 *   SNAPSHOT_DIR          — Snapshot output dir (default: /tmp/snapshots)
 *   VERBOSE               — Set to "1" for verbose logging
 */

// Load .env from this package dir first, then fall back to monorepo root
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

import { getSupabaseClient, hasSupabaseCredentials } from './db';
import { runPipeline } from './pipeline';
import { startScheduler } from './scheduler';
import type { SupabaseClient } from '@supabase/supabase-js';

const verbose  = process.env['VERBOSE'] === '1';
const runOnce  = process.argv.includes('--run-once');
const dryRun   = process.argv.includes('--dry-run');
const skipFetch = process.argv.includes('--skip-fetch');

async function main(): Promise<void> {
  // Only get Supabase client when we actually need it (not dry-run)
  let client: SupabaseClient | undefined;
  if (!dryRun) {
    if (!hasSupabaseCredentials()) {
      console.error(
        '[device-db] ERROR: Supabase credentials not configured.\n' +
        '  Copy backend/device-db/.env.example to backend/device-db/.env\n' +
        '  and set SUPABASE_URL + SUPABASE_SERVICE_KEY.\n' +
        '\n' +
        '  To run without writing to Supabase (parse + normalise only):\n' +
        '    npx ts-node src/index.ts --run-once --dry-run'
      );
      process.exit(1);
    }
    client = getSupabaseClient();
  }

  if (runOnce) {
    const mode = dryRun ? 'dry-run (no DB writes)' : 'full';
    console.log(`[device-db] Running pipeline once [${mode}]…`);

    const results = await runPipeline(client, { verbose, dryRun, skipFetch });
    const total = results.reduce(
      (acc, r) => ({ models: acc.models + r.written, errors: acc.errors + r.errors.length }),
      { models: 0, errors: 0 }
    );

    console.log(
      `[device-db] Pipeline complete — models: ${total.models}, errors: ${total.errors}`
    );
    if (dryRun) {
      console.log('[device-db] Dry-run: no data was written to Supabase.');
    }
    process.exit(total.errors > 0 ? 1 : 0);
  } else {
    if (dryRun) {
      console.error('[device-db] --dry-run only makes sense with --run-once');
      process.exit(1);
    }
    console.log('[device-db] Starting scheduler daemon…');
    startScheduler(client!, verbose);
    process.on('SIGTERM', () => {
      console.log('[device-db] Graceful shutdown');
      process.exit(0);
    });
  }
}

main().catch(err => {
  console.error('[device-db] Fatal error:', err);
  process.exit(1);
});

