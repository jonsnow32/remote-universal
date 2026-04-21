#!/usr/bin/env ts-node
/**
 * Export IR + Catalog database tables from Supabase → bundled SQLite asset files.
 *
 * Usage:
 *   pnpm db:export-sqlite            # full export (requires SUPABASE_URL + KEY)
 *   pnpm db:export-sqlite --schema   # schema-only (no data, used as placeholder)
 *
 * Output:
 *   apps/remote-universal/assets/ir.db       — IR codes (~84 MB)
 *   apps/remote-universal/assets/catalog.db  — brands + device models (lightweight)
 *
 * Run this whenever the IR code database or device catalog is updated.
 * Then rebuild the app.
 */

import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import { config as dotenvConfig } from 'dotenv';
import { hasSupabaseCredentials, getSupabaseClient } from './db';

dotenvConfig({ path: path.resolve(__dirname, '../.env') });

const IR_OUTPUT_PATH = path.resolve(
  __dirname,
  '../../../apps/remote-universal/assets/ir.db',
);

const CATALOG_OUTPUT_PATH = path.resolve(
  __dirname,
  '../../../apps/remote-universal/assets/catalog.db',
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

const CATALOG_DDL = `
  CREATE TABLE IF NOT EXISTS catalog_brands (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    slug      TEXT NOT NULL,
    logo_uri  TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS catalog_models (
    id           TEXT PRIMARY KEY,
    brand_id     TEXT NOT NULL,
    model_number TEXT NOT NULL,
    model_name   TEXT,
    protocols    TEXT NOT NULL DEFAULT '[]',
    category     TEXT,
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_catalog_models_brand    ON catalog_models(brand_id);
  CREATE INDEX IF NOT EXISTS idx_catalog_models_category ON catalog_models(category);

  CREATE TABLE IF NOT EXISTS catalog_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
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

interface CatalogBrand {
  id: string;
  name: string;
  slug: string;
  logo_uri: string | null;
}

interface CatalogModel {
  id: string;
  brand_id: string;
  model_number: string;
  model_name: string | null;
  protocols: string[] | string;
  category: string | null;
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

function openFreshDb(filePath: string, ddl: string): InstanceType<typeof Database> {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.exec(ddl);
  return db;
}

function closeWithCheckpoint(db: InstanceType<typeof Database>, label: string, filePath: string): void {
  db.pragma('wal_checkpoint(FULL)');
  db.close();
  const stats = fs.statSync(filePath);
  console.log(`\n✅ ${label} exported → ${filePath}`);
  console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
}

async function main(): Promise<void> {
  const irDb = openFreshDb(IR_OUTPUT_PATH, DDL);
  const catalogDb = openFreshDb(CATALOG_OUTPUT_PATH, CATALOG_DDL);

  if (SCHEMA_ONLY) {
    irDb.close();
    catalogDb.close();
    console.log(`✅ Placeholder ir.db created (schema only, ${fs.statSync(IR_OUTPUT_PATH).size} bytes)`);
    console.log(`✅ Placeholder catalog.db created (schema only, ${fs.statSync(CATALOG_OUTPUT_PATH).size} bytes)`);
    console.log(`   Run 'pnpm db:export-sqlite' to populate with real data.`);
    return;
  }

  if (!hasSupabaseCredentials()) {
    console.warn('⚠️  No Supabase credentials — creating schema-only placeholders.');
    irDb.close();
    catalogDb.close();
    console.log(`✅ Placeholder ir.db created (${fs.statSync(IR_OUTPUT_PATH).size} bytes)`);
    console.log(`✅ Placeholder catalog.db created (${fs.statSync(CATALOG_OUTPUT_PATH).size} bytes)`);
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
  const insertBrand = irDb.prepare<IRBrand>(
    `INSERT OR REPLACE INTO ir_brands
     (id, name, category, catalog_brand_id, priority, code_count)
     VALUES (@id, @name, @category, @catalog_brand_id, @priority, @code_count)`,
  );
  irDb.transaction((rows: IRBrand[]) => rows.forEach(r => insertBrand.run(r)))(brands);
  console.log(`${brands.length} rows`);

  // ── ir_codesets ──────────────────────────────────────────────────────────
  process.stdout.write('  → Fetching ir_codesets... ');
  const codesets = await fetchAllPages<IRCodeset>(
    supabase,
    'ir_codesets',
    'id, brand_id, model_pattern, protocol_name, carrier_frequency_hz, source, match_confidence',
  );
  const insertCodeset = irDb.prepare<IRCodeset>(
    `INSERT OR REPLACE INTO ir_codesets
     (id, brand_id, model_pattern, protocol_name, carrier_frequency_hz, source, match_confidence)
     VALUES (@id, @brand_id, @model_pattern, @protocol_name, @carrier_frequency_hz, @source, @match_confidence)`,
  );
  irDb.transaction((rows: IRCodeset[]) => rows.forEach(r => insertCodeset.run(r)))(codesets);
  console.log(`${codesets.length} rows`);

  // ── ir_codes ─────────────────────────────────────────────────────────────
  process.stdout.write('  → Fetching ir_codes (may be large)... ');
  const codes = await fetchAllPages<IRCode>(
    supabase,
    'ir_codes',
    'id, codeset_id, function_name, function_label, pronto_hex, raw_pattern, raw_frequency_hz',
  );
  const insertCode = irDb.prepare<IRCode>(
    `INSERT OR REPLACE INTO ir_codes
     (id, codeset_id, function_name, function_label, pronto_hex, raw_pattern, raw_frequency_hz)
     VALUES (@id, @codeset_id, @function_name, @function_label, @pronto_hex, @raw_pattern, @raw_frequency_hz)`,
  );
  // Insert in batches of 5000 for speed
  const BATCH = 5000;
  for (let i = 0; i < codes.length; i += BATCH) {
    const batch = codes.slice(i, i + BATCH);
    irDb.transaction((rows: IRCode[]) => rows.forEach(r => insertCode.run(r)))(batch);
    process.stdout.write(`\r  → Inserting ir_codes: ${Math.min(i + BATCH, codes.length)}/${codes.length}`);
  }
  console.log(`\n  ✓ ${codes.length} rows`);

  closeWithCheckpoint(irDb, 'ir.db', IR_OUTPUT_PATH);

  // ── Catalog: brands ──────────────────────────────────────────────────────
  console.log('\n── Catalog ──────────────────────────────────────────────');
  process.stdout.write('  → Fetching brands... ');
  const catalogBrands = await fetchAllPages<CatalogBrand>(
    supabase, 'brands', 'id, name, slug, logo_uri',
  );
  const insertCatBrand = catalogDb.prepare(
    `INSERT OR REPLACE INTO catalog_brands (id, name, slug, logo_uri, updated_at)
     VALUES (@id, @name, @slug, @logo_uri, datetime('now'))`,
  );
  catalogDb.transaction((rows: CatalogBrand[]) => rows.forEach(r => insertCatBrand.run(r)))(catalogBrands);
  console.log(`${catalogBrands.length} rows`);

  // ── Catalog: device_models ───────────────────────────────────────────────
  process.stdout.write('  → Fetching device_models... ');
  const catalogModels = await fetchAllPages<CatalogModel>(
    supabase, 'device_models', 'id, brand_id, model_number, model_name, protocols, category',
  );
  const insertCatModel = catalogDb.prepare(
    `INSERT OR REPLACE INTO catalog_models (id, brand_id, model_number, model_name, protocols, category, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
  );
  catalogDb.transaction((rows: CatalogModel[]) => {
    for (const r of rows) {
      const protocols = Array.isArray(r.protocols) ? JSON.stringify(r.protocols) : (r.protocols ?? '[]');
      insertCatModel.run(r.id, r.brand_id, r.model_number, r.model_name, protocols, r.category);
    }
  })(catalogModels);
  console.log(`${catalogModels.length} rows`);

  closeWithCheckpoint(catalogDb, 'catalog.db', CATALOG_OUTPUT_PATH);

  console.log('\n   Rebuild the app to bundle the updated databases.');
}

main().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});
