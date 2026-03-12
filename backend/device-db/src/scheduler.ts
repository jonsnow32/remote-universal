/**
 * Cron scheduler for the device-db crawl pipeline.
 *
 * Schedules one job per enabled source in SOURCE_REGISTRY.
 * Each job runs the full pipeline restricted to that single source,
 * so a failure in one source does not affect others.
 */

import cron from 'node-cron';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SOURCE_REGISTRY } from './types';
import { runPipeline } from './pipeline';

export function startScheduler(client: SupabaseClient | undefined, verbose = false): void {
  let activeJobs = 0;

  for (const source of SOURCE_REGISTRY) {
    if (!source.enabled) continue;

    cron.schedule(source.schedule, async () => {
      if (activeJobs > 0 && !verbose) {
        console.log(`[scheduler] Skipping ${source.id} — another job is running`);
        return;
      }
      activeJobs++;
      console.log(`[scheduler] Starting job: ${source.label} (${source.id})`);
      const start = Date.now();

      try {
        await runPipeline(client, { sources: [source.id], verbose });
        console.log(`[scheduler] ${source.id} done in ${Date.now() - start}ms`);
      } catch (err) {
        console.error(`[scheduler] ${source.id} failed:`, err);
      } finally {
        activeJobs--;
      }
    });

    if (verbose) {
      console.log(`[scheduler] Registered: ${source.label} — ${source.schedule}`);
    }
  }

  console.log(`[scheduler] ${SOURCE_REGISTRY.filter(s => s.enabled).length} jobs scheduled`);
}
