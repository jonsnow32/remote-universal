/**
 * Fetcher orchestrator.
 *
 * Resolves which sources to run, invokes the correct fetcher,
 * and returns raw FetchResult[] for the parse stage.
 */

import fs from 'fs/promises';
import path from 'path';
import type { FetchResult, OEMRawDevice, SourceId, PipelineOptions } from '../types';
import { fetchFlipperIRDB, fetchIRDB } from './irdb';
import { fetchSmartIR } from './smartir';
import { allOEMSchemas } from './oem';

const DEFAULT_CACHE_DIR = process.env['CRAWL_CACHE_DIR'] ?? '/tmp/crawl';

/**
 * Returns the daily sub-directory inside cacheDir so each day's fetch is
 * isolated and previous runs can be replayed without re-downloading.
 */
export function todayCacheDir(base = DEFAULT_CACHE_DIR): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(base, date);
}

// ─── IRDB fetchers ────────────────────────────────────────────────────────

export async function runIRDBFetch(
  opts: PipelineOptions = {}
): Promise<FetchResult[]> {
  const cacheDir = todayCacheDir(opts.cacheDir);
  await fs.mkdir(cacheDir, { recursive: true });

  if (opts.skipFetch) {
    return loadCachedResults(cacheDir, 'irdb');
  }
  return fetchIRDB(cacheDir, opts.verbose);
}

export async function runFlipperFetch(
  opts: PipelineOptions = {}
): Promise<FetchResult[]> {
  const cacheDir = todayCacheDir(opts.cacheDir);
  await fs.mkdir(cacheDir, { recursive: true });

  if (opts.skipFetch) {
    return loadCachedResults(cacheDir, 'flipper');
  }
  return fetchFlipperIRDB(cacheDir, opts.verbose);
}

// ─── SmartIR fetcher ──────────────────────────────────────────────────────

/**
 * Clones / updates the SmartIR repo and returns one FetchResult per
 * climate JSON file.  The git repo lives in a stable `repos/smartir`
 * directory under the base cache dir (NOT date-prefixed) so it is
 * reused across daily runs and only updated via `git pull`.
 */
export async function runSmartIRFetch(
  opts: PipelineOptions = {}
): Promise<FetchResult[]> {
  const baseDir = opts.cacheDir ?? DEFAULT_CACHE_DIR;
  await fs.mkdir(baseDir, { recursive: true });

  if (opts.skipFetch) {
    // When skipping fetch, re-read whatever the last clone has on disk.
    return fetchSmartIR(baseDir, false);
  }
  return fetchSmartIR(baseDir, opts.verbose);
}

// ─── OEM static schemas ───────────────────────────────────────────────────

/**
 * Returns all static OEM schemas as a synthetic FetchResult so they pass
 * through the same parse → normalise pipeline as IR data.
 * The `content` field carries JSON-serialised OEMRawDevice[].
 */
export function runOEMFetch(sources?: SourceId[]): FetchResult[] {
  const all = allOEMSchemas();
  const filtered = sources
    ? all.filter(d => !sources.length || sources.includes(d.source))
    : all;

  // Group by source for cleaner result objects
  const bySource = new Map<SourceId, OEMRawDevice[]>();
  for (const device of filtered) {
    const arr = bySource.get(device.source) ?? [];
    arr.push(device);
    bySource.set(device.source, arr);
  }

  const results: FetchResult[] = [];
  for (const [src, devices] of bySource) {
    results.push({
      source: src,
      cacheFile: `oem-schema:${src}`,
      content: JSON.stringify(devices),
      fetchedAt: Date.now(),
    });
  }
  return results;
}

// ─── Generic orchestrator ─────────────────────────────────────────────────

export interface FetchBatch {
  oemResults: FetchResult[];
  irdbResults: FetchResult[];
  flipperResults: FetchResult[];
  smartirResults: FetchResult[];
}

export async function fetchAll(opts: PipelineOptions = {}): Promise<FetchBatch> {
  const sources = opts.sources;
  const verbose = opts.verbose ?? false;

  const runOEM      = !sources || sources.some(s => isOEMSource(s));
  const runIRDB     = !sources || sources.includes('irdb');
  const runFlipper  = !sources || sources.includes('flipper');
  const runSmartIR  = !sources || sources.includes('smartir');

  if (verbose) {
    console.log('[fetch] Starting fetch batch', {
      oem: runOEM, irdb: runIRDB, flipper: runFlipper, smartir: runSmartIR,
    });
  }

  const [oemResults, irdbResults, flipperResults, smartirResults] = await Promise.all([
    runOEM     ? Promise.resolve(runOEMFetch(sources)) : Promise.resolve([]),
    runIRDB    ? runIRDBFetch(opts)                    : Promise.resolve([]),
    runFlipper ? runFlipperFetch(opts)                 : Promise.resolve([]),
    runSmartIR ? runSmartIRFetch(opts)                 : Promise.resolve([]),
  ]);

  if (verbose) {
    console.log(`[fetch] Done — OEM:${oemResults.length} IRDB:${irdbResults.length} Flipper:${flipperResults.length} SmartIR:${smartirResults.length}`);
  }

  return { oemResults, irdbResults, flipperResults, smartirResults };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const OEM_SOURCES: SourceId[] = [
  'samsung_api', 'lg_api', 'sony_api', 'philips_api', 'panasonic_api',
  'hisense_api', 'vizio_api', 'roku_ecp', 'android_tv', 'fire_tv',
];

function isOEMSource(id: SourceId): boolean {
  return OEM_SOURCES.includes(id);
}

/** Re-load previously written FetchResult manifests from the cache dir. */
async function loadCachedResults(
  cacheDir: string,
  source: SourceId
): Promise<FetchResult[]> {
  const manifestPath = path.join(cacheDir, `${source}-manifest.json`);
  try {
    const raw = await fs.readFile(manifestPath, 'utf-8');
    return JSON.parse(raw) as FetchResult[];
  } catch {
    return [];
  }
}
