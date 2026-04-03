/**
 * Full pipeline orchestrator.
 *
 * Ties together: fetch → parse → normalise → dedup → write → snapshot
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PipelineOptions,
  PipelineResult,
  SourceId,
  FetchResult,
  OEMRawDevice,
  IRRawEntry,
  NormalisedModelEntry,
} from './types';
import { fetchAll } from './fetchers/index';
import { parseFlipperIR, parseIRDBCSV } from './parsers/irdb';
import { parseOEMFetchResult } from './parsers/oem';
import { normaliseOEMDevice, normaliseIREntries } from './normalise';
import { deduplicateEntries } from './dedup';
import { writeEntries } from './writer';
import { writeIREntries } from './ir-writer';
import { exportSnapshot } from './snapshot';
import crypto from 'crypto';

export async function runPipeline(
  client: SupabaseClient | undefined,
  opts: PipelineOptions = {}
): Promise<PipelineResult[]> {
  const startAll = Date.now();
  opts.verbose && console.log('[pipeline] Starting crawl pipeline', opts);

  // ──────────────────────────────────────────────────────────────────────
  // Stage 1: Fetch
  // ──────────────────────────────────────────────────────────────────────
  const { oemResults, irdbResults, flipperResults } = await fetchAll(opts);

  // ──────────────────────────────────────────────────────────────────────
  // Stage 2 + 3: Parse → Normalise
  // ──────────────────────────────────────────────────────────────────────

  // OEM devices
  const oemDevices: OEMRawDevice[] = [];
  for (const r of oemResults) {
    oemDevices.push(...parseOEMFetchResult(r));
  }
  const normalisedOEM: NormalisedModelEntry[] = oemDevices.map(normaliseOEMDevice);

  // IR entries — collect, then normalise by grouping per file
  const irEntries: IRRawEntry[] = [];
  for (const r of flipperResults) {
    irEntries.push(...parseFlipperIR(r));
  }
  for (const r of irdbResults) {
    irEntries.push(...parseIRDBCSV(r));
  }
  const normalisedIR: NormalisedModelEntry[] = normaliseIREntries(irEntries);

  const allNormalised: NormalisedModelEntry[] = [...normalisedOEM, ...normalisedIR];

  opts.verbose && console.log(
    `[pipeline] Normalised: OEM=${normalisedOEM.length} IR=${normalisedIR.length}`
  );

  // ──────────────────────────────────────────────────────────────────────
  // Stage 4: Deduplicate
  // ──────────────────────────────────────────────────────────────────────
  const deduplicated = deduplicateEntries(allNormalised);

  opts.verbose && console.log(
    `[pipeline] After dedup: ${deduplicated.length} (from ${allNormalised.length})`
  );

  // ──────────────────────────────────────────────────────────────────────
  // Stage 5: Filter by requested sources (if any)
  // ──────────────────────────────────────────────────────────────────────
  const toWrite = opts.sources
    ? deduplicated.filter(e => opts.sources!.includes(e.source))
    : deduplicated;

  // ──────────────────────────────────────────────────────────────────────
  // Stage 6: Write to Supabase
  // ──────────────────────────────────────────────────────────────────────
  const version = buildVersion();
  const isDryRun = opts.dryRun || !client;
  const writeStats = await writeEntries(toWrite, client, version, isDryRun);

  opts.verbose && console.log(
    `[pipeline] Written: brands=${writeStats.brands} models=${writeStats.models} commands=${writeStats.commands}`
  );

  // ──────────────────────────────────────────────────────────────────────
  // Stage 6b: Write IR library tables (ir_brands / ir_codesets / ir_codes)
  // ──────────────────────────────────────────────────────────────────────
  const irWriteStats = await writeIREntries(irEntries, client, isDryRun);
  writeStats.errors.push(...irWriteStats.errors);

  opts.verbose && console.log(
    `[pipeline] IR library written: brands=${irWriteStats.brands} codesets=${irWriteStats.codesets} codes=${irWriteStats.codes}`
  );

  // ──────────────────────────────────────────────────────────────────────
  // Stage 7: Snapshot (skip in dry-run)
  // ──────────────────────────────────────────────────────────────────────
  if (!isDryRun && client) {
    try {
      const snapshotDir = process.env['SNAPSHOT_DIR'] ?? '/tmp/snapshots';
      await exportSnapshot(client, version, snapshotDir);
    } catch (err) {
      console.error('[pipeline] Snapshot export failed:', err);
      writeStats.errors.push(`Snapshot: ${String(err)}`);
    }
  }

  const durationMs = Date.now() - startAll;
  console.log(`[pipeline] Done in ${durationMs}ms — errors: ${writeStats.errors.length}`);

  // Return a per-source breakdown
  return buildResults(toWrite, writeStats, durationMs);
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function buildVersion(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const hash = crypto.randomBytes(3).toString('hex');
  return `${date}-${hash}`;
}

function buildResults(
  entries: NormalisedModelEntry[],
  writeStats: { brands: number; models: number; commands: number; errors: string[] },
  durationMs: number
): PipelineResult[] {
  const sourceModels = new Map<SourceId, number>();
  for (const e of entries) {
    sourceModels.set(e.source, (sourceModels.get(e.source) ?? 0) + 1);
  }

  const results: PipelineResult[] = [];
  for (const [source, count] of sourceModels) {
    results.push({
      source,
      fetchedAt: Date.now(),
      parsed:       count,
      normalised:   count,
      deduplicated: count,
      written:      count,
      errors:       writeStats.errors.filter(e => e.includes(source)),
      durationMs,
    });
  }
  return results;
}
