/**
 * Fetcher for SmartIR climate codes.
 *
 * Clones https://github.com/smartHomeHub/SmartIR once into a stable
 * `repos/smartir` directory and runs `git pull` on subsequent fetches —
 * much cheaper than re-downloading a ZIP archive every day.
 *
 * File layout inside the repo:
 *   codes/climate/<id>.json   — one file per remote model / codeset
 *
 * Each JSON file contains a full AC control matrix encoded as
 * Broadlink Base64 strings (commandsEncoding = "Base64").
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { FetchResult } from '../types';

const execAsync = promisify(exec);

// Hardcoded GitHub HTTPS URL — never user-supplied, so no injection risk.
const SMARTIR_REPO = 'https://github.com/smartHomeHub/SmartIR.git';

/**
 * Fetches SmartIR climate JSON files.
 *
 * @param baseDir  The root cache directory (NOT date-prefixed).
 *                 The git repo will be stored at `<baseDir>/repos/smartir`.
 */
export async function fetchSmartIR(
  baseDir: string,
  verbose = false,
): Promise<FetchResult[]> {
  const repoDir = path.join(baseDir, 'repos', 'smartir');

  // ── Clone or update ───────────────────────────────────────────────────
  const gitMarker = path.join(repoDir, '.git');
  const repoExists = await fs.access(gitMarker).then(() => true).catch(() => false);

  if (repoExists) {
    if (verbose) console.log('[smartir] Updating existing clone at', repoDir);
    try {
      // Safe update: fetch latest shallow history then hard-reset.
      await execAsync(`git -C "${repoDir}" fetch --depth 1 origin`);
      await execAsync(`git -C "${repoDir}" reset --hard origin/HEAD`);
    } catch (err) {
      console.warn('[smartir] git pull failed, re-cloning:', (err as Error).message);
      await fs.rm(repoDir, { recursive: true, force: true });
      await cloneRepo(repoDir, verbose);
    }
  } else {
    await cloneRepo(repoDir, verbose);
  }

  // ── Walk codes/climate/*.json ─────────────────────────────────────────
  const climateDir = path.join(repoDir, 'codes', 'climate');
  let files: string[];
  try {
    files = await fs.readdir(climateDir);
  } catch {
    console.warn('[smartir] codes/climate dir not found:', climateDir);
    return [];
  }

  const results: FetchResult[] = [];
  const now = Date.now();

  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    const filePath = path.join(climateDir, file);
    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch {
      continue;
    }

    // Quick peek at manufacturer for FetchResult.brand
    let brand = 'Unknown';
    try {
      const meta = JSON.parse(content) as { manufacturer?: string };
      brand = meta.manufacturer ?? 'Unknown';
    } catch {
      continue; // malformed JSON — skip
    }

    results.push({
      source: 'smartir',
      brand,
      category: 'AC',
      cacheFile: filePath,
      content,
      fetchedAt: now,
    });
  }

  if (verbose) console.log(`[smartir] Collected ${results.length} climate JSON files`);
  return results;
}

async function cloneRepo(repoDir: string, verbose: boolean): Promise<void> {
  await fs.mkdir(path.dirname(repoDir), { recursive: true });
  if (verbose) console.log('[smartir] Cloning SmartIR (shallow)...');
  await execAsync(`git clone --depth 1 --single-branch "${SMARTIR_REPO}" "${repoDir}"`);
  if (verbose) console.log('[smartir] Clone complete at', repoDir);
}
