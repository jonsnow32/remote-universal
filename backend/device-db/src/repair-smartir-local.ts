#!/usr/bin/env ts-node
/**
 * One-shot repair script: re-parse all SmartIR climate codes with the
 * corrected broadlinkToRaw() decoder and write them directly into the
 * bundled SQLite asset file (apps/remote-universal/assets/ir.db).
 *
 * Usage:
 *   node -r ts-node/register src/repair-smartir-local.ts
 *
 * Requires: cached SmartIR repo at /tmp/crawl/repos/smartir (run fetch once).
 * Does NOT require Supabase credentials.
 */

import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { runSmartIRFetch } from './fetchers';
import { parseSmartIR } from './parsers/smartirParser';
import { normaliseBrand, normaliseCategory } from './normalise';
import type { IRRawEntry } from './types';

const DB_PATH = path.resolve(__dirname, '../../../apps/remote-universal/assets/ir.db');
const CACHE_DIR = process.env['CRAWL_CACHE_DIR'] ?? '/tmp/crawl';

function shortHash(s: string): string {
  return crypto.createHash('sha1').update(s).digest('hex').slice(0, 8);
}

function functionLabel(name: string): string {
  return name
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

async function main(): Promise<void> {
  console.log('[repair] Loading SmartIR from cache:', CACHE_DIR);
  const fetchResults = await runSmartIRFetch({ cacheDir: CACHE_DIR, skipFetch: true });
  console.log(`[repair] Fetched ${fetchResults.length} SmartIR result files`);

  const entries: IRRawEntry[] = [];
  for (const r of fetchResults) {
    entries.push(...parseSmartIR(r));
  }
  console.log(`[repair] Parsed ${entries.length} IR entries from SmartIR`);

  // Group entries by (brand_slug, category, codeFile)
  const byCodeset = new Map<string, IRRawEntry[]>();
  for (const e of entries) {
    const key = e.file_path;
    const arr = byCodeset.get(key) ?? [];
    arr.push(e);
    byCodeset.set(key, arr);
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = OFF');

  let insertedBrands = 0;
  let insertedCodesets = 0;
  let insertedCodes = 0;
  let skippedCodes = 0;

  const upsertBrand = db.prepare(`
    INSERT INTO ir_brands (id, name, category, catalog_brand_id, priority, code_count)
    VALUES (@id, @name, @category, @catalog_brand_id, @priority, @code_count)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      code_count = excluded.code_count
  `);

  const upsertCodeset = db.prepare(`
    INSERT INTO ir_codesets (id, brand_id, model_pattern, protocol_name, carrier_frequency_hz, source, match_confidence)
    VALUES (@id, @brand_id, @model_pattern, @protocol_name, @carrier_frequency_hz, @source, @match_confidence)
    ON CONFLICT(id) DO UPDATE SET
      model_pattern = excluded.model_pattern,
      carrier_frequency_hz = excluded.carrier_frequency_hz,
      source = excluded.source
  `);

  const upsertCode = db.prepare(`
    INSERT INTO ir_codes (id, codeset_id, function_name, function_label, pronto_hex, raw_pattern, raw_frequency_hz)
    VALUES (@id, @codeset_id, @function_name, @function_label, @pronto_hex, @raw_pattern, @raw_frequency_hz)
    ON CONFLICT(id) DO UPDATE SET
      raw_pattern = excluded.raw_pattern,
      raw_frequency_hz = excluded.raw_frequency_hz,
      pronto_hex = excluded.pronto_hex
  `);

  const runTransaction = db.transaction(() => {
    for (const [cacheFile, grp] of byCodeset) {
      const first = grp[0]!;
      const brandInfo = normaliseBrand(first.brand_raw);
      const brandSlug = brandInfo.slug;
      const cat = normaliseCategory(first.category_raw ?? 'AC');

      // Brand ID matches ir-writer.ts: "<slug>-<category>" (no hash)
      const brandId = `${brandSlug}-${cat}`;
      upsertBrand.run({
        id: brandId,
        name: brandInfo.name,
        category: cat,
        catalog_brand_id: brandSlug,
        priority: 1,
        code_count: grp.length,
      });
      insertedBrands++;

      // Model pattern from model_hint or filename
      const modelPattern = first.model_hint
        ?? ((first.file_path.split(/[/\\]/).pop() ?? '')
             .replace(/\.ir$|\.csv$|\.json$/, '')
             .replace(/,/g, '_') || null);

      // Codeset ID matches ir-writer.ts: shortHash("<brandId>/<filePath>")
      const codesetId = shortHash(`${brandId}/${first.file_path}`);
      const carrierHz = first.frequency ?? 38_000;

      upsertCodeset.run({
        id: codesetId,
        brand_id: brandId,
        model_pattern: modelPattern,
        protocol_name: null,
        carrier_frequency_hz: carrierHz,
        source: 'smartir',
        match_confidence: 0.5,
      });
      insertedCodesets++;

      for (const e of grp) {
        if (!e.raw_data || e.raw_data.length === 0) {
          skippedCodes++;
          continue;
        }
        const codeId = `${codesetId}_${e.function_name.toUpperCase()}`;
        upsertCode.run({
          id: codeId,
          codeset_id: codesetId,
          function_name: e.function_name.toUpperCase(),
          function_label: functionLabel(e.function_name),
          pronto_hex: null,
          raw_pattern: JSON.stringify(e.raw_data),
          raw_frequency_hz: e.frequency ?? carrierHz,
        });
        insertedCodes++;
      }
    }
  });

  runTransaction();

  // Update code_count for all smartir brands
  db.prepare(`
    UPDATE ir_brands
    SET code_count = (
      SELECT COUNT(*) FROM ir_codes c
      JOIN ir_codesets cs ON c.codeset_id = cs.id
      WHERE cs.brand_id = ir_brands.id
    )
    WHERE id IN (
      SELECT DISTINCT cs.brand_id FROM ir_codesets cs WHERE cs.source = 'smartir'
    )
  `).run();

  db.close();

  console.log(`[repair] Done:`);
  console.log(`  brands inserted/updated: ${insertedBrands}`);
  console.log(`  codesets inserted/updated: ${insertedCodesets}`);
  console.log(`  codes inserted/updated: ${insertedCodes}`);
  console.log(`  codes skipped (no raw_data): ${skippedCodes}`);
}

main().catch(err => {
  console.error('[repair] Fatal:', err);
  process.exit(1);
});
