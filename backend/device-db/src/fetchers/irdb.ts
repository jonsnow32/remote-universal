/**
 * Fetcher for IRDB and Flipper Zero IR databases.
 *
 * IRDB (probonopd/irdb) — actual on-disk layout:
 *   codes/<Brand>/<Category>/<device>,<subdevice>,<count>.csv
 *   e.g. codes/Samsung/TV/7,7.csv
 *
 * Flipper IRDB (Lucaslhm/Flipper-IRDB) — actual on-disk layout:
 *   <Category>/<Brand>/<Model>.ir
 *   e.g. TVs/Samsung/QN55.ir
 *   Categories: TVs, ACs, Cable_Boxes, DVD_Players, Audio_and_Video_Receivers,
 *               Projectors, Streaming_Devices
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { Dirent } from 'fs';
import type { FetchResult } from '../types';

const execAsync = promisify(exec);

/** Flipper IRDB category folder names (exact, case-sensitive) */
const FLIPPER_CATEGORIES = [
  'TVs',
  'ACs',
  'Cable_Boxes',
  'DVD_Players',
  'Audio_and_Video_Receivers',
  'Projectors',
  'Streaming_Devices',
];

/** Substrings to match IRDB subcategory folder names — keeps only AV-related entries */
const IRDB_CATEGORY_WHITELIST = /\bTV\b|television|DTV|HDTV|plasma|LCD|LED|OLED|projection|blu.?ray|dvd|satellite|cable|STB|projector/i;

const FLIPPER_IRDB_ZIP =
  'https://github.com/Lucaslhm/Flipper-IRDB/archive/refs/heads/main.zip';

const PROBONOPD_IRDB_ZIP =
  'https://github.com/probonopd/irdb/archive/refs/heads/master.zip';

// ─── Flipper IRDB ─────────────────────────────────────────────────────────

/**
 * Downloads and extracts the Flipper IRDB repository, then returns one
 * FetchResult per .ir file found under the given category folders.
 */
export async function fetchFlipperIRDB(
  cacheDir: string,
  verbose = false
): Promise<FetchResult[]> {
  const zipPath = path.join(cacheDir, 'flipper-irdb.zip');
  const extractDir = path.join(cacheDir, 'flipper-irdb-main');

  // Skip re-download if already extracted today
  try {
    await fs.access(extractDir);
    if (verbose) console.log('[flipper] Using cached extraction at', extractDir);
  } catch {
    if (verbose) console.log('[flipper] Downloading Flipper IRDB...');
    await downloadFile(FLIPPER_IRDB_ZIP, zipPath);
    await fs.mkdir(extractDir, { recursive: true });
    await execAsync(`unzip -q -o "${zipPath}" -d "${cacheDir}"`);
    if (verbose) console.log('[flipper] Extraction complete');
  }

  const results: FetchResult[] = [];
  // GitHub ZIP unpacks as: {cacheDir}/Flipper-IRDB-main/  (on macOS case-insensitive fs
  // this is the same directory as extractDir since mkdir created 'flipper-irdb-main' first)
  const repoRoot = extractDir; // categories are direct children of this folder

  // Walk known category directories
  for (const cat of FLIPPER_CATEGORIES) {
    const catPath = path.join(repoRoot, cat);
    let brands: string[];
    try {
      const entries: Dirent[] = await fs.readdir(catPath, { withFileTypes: true });
      brands = entries.filter((e: Dirent) => e.isDirectory()).map((e: Dirent) => e.name);
    } catch {
      continue; // category folder may not exist
    }

    for (const brand of brands) {
      const brandPath = path.join(catPath, brand);
      let files: string[];
      try {
        const entries: string[] = await fs.readdir(brandPath);
        files = entries.filter((f: string) => f.endsWith('.ir'));
      } catch {
        continue;
      }

      for (const file of files) {
        const filePath = path.join(brandPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        results.push({
          source: 'flipper',
          brand,
          category: cat,
          cacheFile: filePath,
          content,
          fetchedAt: Date.now(),
        });
      }
    }
  }

  if (verbose) console.log(`[flipper] Collected ${results.length} .ir files`);
  return results;
}

// ─── IRDB (probonopd) ─────────────────────────────────────────────────────

/**
 * Downloads and extracts the probonopd IRDB, then returns one FetchResult
 * per CSV file under the configured categories.
 */
export async function fetchIRDB(
  cacheDir: string,
  verbose = false
): Promise<FetchResult[]> {
  const zipPath = path.join(cacheDir, 'probonopd-irdb.zip');
  // GitHub ZIP extracts as irdb-master/ directly under cacheDir
  const sentinelDir = path.join(cacheDir, 'irdb-master');

  try {
    await fs.access(sentinelDir);
    if (verbose) console.log('[irdb] Using cached extraction at', sentinelDir);
  } catch {
    if (verbose) console.log('[irdb] Downloading IRDB...');
    await downloadFile(PROBONOPD_IRDB_ZIP, zipPath);
    await execAsync(`unzip -q -o "${zipPath}" -d "${cacheDir}"`);
    if (verbose) console.log('[irdb] Extraction complete');
  }

  const results: FetchResult[] = [];
  // Actual layout: codes/<Brand>/<Category>/<device>,<subdevice>,<count>.csv
  const codesDir = path.join(cacheDir, 'irdb-master', 'codes');

  let brands: string[];
  try {
    const entries: Dirent[] = await fs.readdir(codesDir, { withFileTypes: true });
    brands = entries.filter((e: Dirent) => e.isDirectory()).map((e: Dirent) => e.name);
  } catch {
    if (verbose) console.warn('[irdb] codes dir not found:', codesDir);
    return [];
  }

  for (const brand of brands) {
    const brandPath = path.join(codesDir, brand);
    let categories: string[];
    try {
      const entries: Dirent[] = await fs.readdir(brandPath, { withFileTypes: true });
      categories = entries.filter((e: Dirent) => e.isDirectory()).map((e: Dirent) => e.name);
    } catch {
      continue;
    }

    for (const cat of categories) {
      if (!IRDB_CATEGORY_WHITELIST.test(cat)) continue; // skip non-AV categories
      const catPath = path.join(brandPath, cat);
      let files: string[];
      try {
        const entries: string[] = await fs.readdir(catPath);
        files = entries.filter((f: string) => f.endsWith('.csv'));
      } catch {
        continue;
      }

      for (const file of files) {
        const filePath = path.join(catPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        results.push({
          source: 'irdb',
          brand,
          category: cat,
          cacheFile: filePath,
          content,
          fetchedAt: Date.now(),
        });
      }
    }
  }

  if (verbose) console.log(`[irdb] Collected ${results.length} CSV files`);
  return results;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function downloadFile(url: string, dest: string): Promise<void> {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'remote-universal-device-db/1.0',
      ...(process.env['GITHUB_TOKEN']
        ? { Authorization: `Bearer ${process.env['GITHUB_TOKEN']}` }
        : {}),
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  await fs.writeFile(dest, Buffer.from(buffer));
}
