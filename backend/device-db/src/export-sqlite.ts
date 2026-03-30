#!/usr/bin/env ts-node
/**
 * Export IR database tables from Supabase → bundled SQLite asset file.
 *
 * Usage:
 *   pnpm db:export-sqlite            # full export (requires SUPABASE_URL + KEY)
 *   pnpm db:export-sqlite --schema   # schema-only (no data, used as placeholder)
 *
 * Output: apps/remote-universal/assets/ir.db
 *
 * Run this whenever the IR code database is updated. Then rebuild the app.
 */

import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import { config as dotenvConfig } from 'dotenv';
import { hasSupabaseCredentials, getSupabaseClient } from './db';

dotenvConfig({ path: path.resolve(__dirname, '../.env') });

const OUTPUT_PATH = path.resolve(
  __dirname,
  '../../../apps/remote-universal/assets/ir.db',
);

const SCHEMA_ONLY = process.argv.includes('--schema');

// ─── Schema ───────────────────────────────────────────────────────────────────

const DDL = `
  CREATE TABLE IF NOT EXISTS ir_brands (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    category          TEXT NOT NULL,
    catalog_brand_id  TEXT,
    priority          INTEGER DEFAULT 0,
    code_count        INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS ir_codesets (
    id                    TEXT PRIMARY KEY,
    brand_id              TEXT NOT NULL,
    model_pattern         TEXT,
    protocol_name         TEXT,
    carrier_frequency_hz  INTEGER DEFAULT 38000,
    source                TEXT DEFAULT '',
    match_confidence      REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS ir_codes (
    id               TEXT PRIMARY KEY,
    codeset_id       TEXT NOT NULL,
    function_name    TEXT NOT NULL,
    function_label   TEXT,
    pronto_hex       TEXT,
    raw_pattern      TEXT,
    raw_frequency_hz INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_ir_brands_catalog  ON ir_brands(catalog_brand_id, category);
  CREATE INDEX IF NOT EXISTS idx_ir_brands_category ON ir_brands(category);
  CREATE INDEX IF NOT EXISTS idx_ir_codesets_brand  ON ir_codesets(brand_id);
  CREATE INDEX IF NOT EXISTS idx_ir_codes_codeset   ON ir_codes(codeset_id);
  CREATE INDEX IF NOT EXISTS idx_ir_codes_fn        ON ir_codes(codeset_id, function_name);
`;

// ─── Row types ────────────────────────────────────────────────────────────────

interface IRBrand {
  id: string;
  name: string;
  category: string;
  catalog_brand_id: string | null;
  priority: number;
  code_count: number;
}

interface IRCodeset {
  id: string;
  brand_id: string;
  model_pattern: string | null;
  protocol_name: string | null;
  carrier_frequency_hz: number;
  source: string;
  match_confidence: number;
}

interface IRCode {
  id: string;
  codeset_id: string;
  function_name: string;
  function_label: string | null;
  pronto_hex: string | null;
  raw_pattern: string | null;
  raw_frequency_hz: number | null;
}

// ─── Pagination helper ────────────────────────────────────────────────────────

async function fetchAllPages<T>(
  supabase: ReturnType<typeof getSupabaseClient>,
  table: string,
  columns: string,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(offset, offset + PAGE - 1);

    if (error) throw new Error(`Supabase error on ${table}: ${error.message}`);
    if (!data || data.length === 0) break;

    all.push(...(data as T[]));
    offset += data.length;
    if (data.length < PAGE) break;
  }

  return all;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Ensure output directory exists
  const assetsDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  if (fs.existsSync(OUTPUT_PATH)) {
    fs.unlinkSync(OUTPUT_PATH);
  }

  const db = new Database(OUTPUT_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.exec(DDL);

  if (SCHEMA_ONLY) {
    db.close();
    const size = fs.statSync(OUTPUT_PATH).size;
    console.log(`✅ Placeholder ir.db created (schema only, ${size} bytes)`);
    console.log(`   Run 'pnpm db:export-sqlite' to populate with real data.`);
    return;
  }

  if (!hasSupabaseCredentials()) {
    console.warn('⚠️  No Supabase credentials — creating schema-only placeholder.');
    db.close();
    const size = fs.statSync(OUTPUT_PATH).size;
    console.log(`✅ Placeholder ir.db created (${size} bytes)`);
    return;
  }

  const supabase = getSupabaseClient();

  // ── ir_brands ────────────────────────────────────────────────────────────
  process.stdout.write('  → Fetching ir_brands... ');
  const brands = await fetchAllPages<IRBrand>(
    supabase,
    'ir_brands',
    'id, name, category, catalog_brand_id, priority, code_count',
  );
  const insertBrand = db.prepare<IRBrand>(
    `INSERT OR REPLACE INTO ir_brands
     (id, name, category, catalog_brand_id, priority, code_count)
     VALUES (@id, @name, @category, @catalog_brand_id, @priority, @code_count)`,
  );
  db.transaction((rows: IRBrand[]) => rows.forEach(r => insertBrand.run(r)))(brands);
  console.log(`${brands.length} rows`);

  // ── ir_codesets ──────────────────────────────────────────────────────────
  process.stdout.write('  → Fetching ir_codesets... ');
  const codesets = await fetchAllPages<IRCodeset>(
    supabase,
    'ir_codesets',
    'id, brand_id, model_pattern, protocol_name, carrier_frequency_hz, source, match_confidence',
  );
  const insertCodeset = db.prepare<IRCodeset>(
    `INSERT OR REPLACE INTO ir_codesets
     (id, brand_id, model_pattern, protocol_name, carrier_frequency_hz, source, match_confidence)
     VALUES (@id, @brand_id, @model_pattern, @protocol_name, @carrier_frequency_hz, @source, @match_confidence)`,
  );
  db.transaction((rows: IRCodeset[]) => rows.forEach(r => insertCodeset.run(r)))(codesets);
  console.log(`${codesets.length} rows`);

  // ── ir_codes ─────────────────────────────────────────────────────────────
  process.stdout.write('  → Fetching ir_codes (may be large)... ');
  const codes = await fetchAllPages<IRCode>(
    supabase,
    'ir_codes',
    'id, codeset_id, function_name, function_label, pronto_hex, raw_pattern, raw_frequency_hz',
  );
  const insertCode = db.prepare<IRCode>(
    `INSERT OR REPLACE INTO ir_codes
     (id, codeset_id, function_name, function_label, pronto_hex, raw_pattern, raw_frequency_hz)
     VALUES (@id, @codeset_id, @function_name, @function_label, @pronto_hex, @raw_pattern, @raw_frequency_hz)`,
  );
  // Insert in batches of 5000 for speed
  const BATCH = 5000;
  for (let i = 0; i < codes.length; i += BATCH) {
    const batch = codes.slice(i, i + BATCH);
    db.transaction((rows: IRCode[]) => rows.forEach(r => insertCode.run(r)))(batch);
    process.stdout.write(`\r  → Inserting ir_codes: ${Math.min(i + BATCH, codes.length)}/${codes.length}`);
  }
  console.log(`\n  ✓ ${codes.length} rows`);

  // Checkpoint WAL and close
  db.pragma('wal_checkpoint(FULL)');
  db.close();

  const stats = fs.statSync(OUTPUT_PATH);
  console.log(`\n✅ ir.db exported → ${OUTPUT_PATH}`);
  console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Rebuild the app to bundle the updated database.`);
}

main().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});
