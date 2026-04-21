/**
 * Local SQLite cache for the device catalog (brands + models).
 *
 * Strategy: query local first → if empty, fetch from Supabase → persist locally.
 * The DB is lightweight (no large assets) so it initialises eagerly at app start
 * via <CatalogDatabaseProvider>.
 *
 * Tables:
 *   catalog_brands  (id, name, slug, logo_uri, updated_at)
 *   catalog_models  (id, brand_id, model_number, model_name, protocols, category, updated_at)
 *   catalog_meta    (key, value)          — e.g. last_sync timestamp
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import type { CatalogBrand, CatalogModel } from './catalogApi';

/** Safely coerce protocols from SQLite TEXT to string[]. */
function parseProtocols(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') {
    try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed; } catch {}
  }
  return [];
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _db: SQLiteDatabase | null = null;

/** Called once from CatalogDatabaseProvider after the SQLiteProvider mounts. */
export function _initCatalogLocalDb(db: SQLiteDatabase): void {
  _db = db;
  _ensureTables(db);
}

export function isCatalogLocalDbReady(): boolean {
  return _db !== null;
}

function requireDb(): SQLiteDatabase {
  if (!_db) throw new Error('CatalogLocalDb: not initialised');
  return _db;
}

// ─── Schema bootstrap ─────────────────────────────────────────────────────────

function _ensureTables(db: SQLiteDatabase): void {
  db.execSync(`
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

    CREATE INDEX IF NOT EXISTS idx_catalog_models_brand
      ON catalog_models(brand_id);

    CREATE INDEX IF NOT EXISTS idx_catalog_models_category
      ON catalog_models(category);

    CREATE TABLE IF NOT EXISTS catalog_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ph(count: number): string {
  return Array(count).fill('?').join(',');
}

// ─── Read: Brands ─────────────────────────────────────────────────────────────

export function localFetchAllBrands(): CatalogBrand[] {
  const d = requireDb();
  return d.getAllSync<CatalogBrand>(
    'SELECT id, name, slug, logo_uri FROM catalog_brands ORDER BY name',
    [],
  );
}

export function localFetchBrandsByCategory(category: string): CatalogBrand[] {
  const d = requireDb();
  // Distinct brands that have at least one model in this category
  return d.getAllSync<CatalogBrand>(
    `SELECT DISTINCT b.id, b.name, b.slug, b.logo_uri
     FROM catalog_brands b
     JOIN catalog_models m ON m.brand_id = b.id
     WHERE m.category = ?
     ORDER BY b.name`,
    [category],
  );
}

// ─── Read: Models ─────────────────────────────────────────────────────────────

export function localFetchModelsByBrand(
  brandSlug: string,
  category?: string,
): CatalogModel[] {
  const d = requireDb();
  let sql = `SELECT id, brand_id, model_number, model_name, protocols, category
             FROM catalog_models WHERE brand_id = ?`;
  const params: string[] = [brandSlug];

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  sql += ' ORDER BY model_number';

  return d.getAllSync<{ id: string; brand_id: string; model_number: string; model_name: string | null; protocols: string; category: string | null }>(
    sql,
    params,
  ).map(row => ({
    id: row.id,
    brand_id: row.brand_id,
    model_number: row.model_number,
    model_name: row.model_name,
    category: row.category,
    protocols: parseProtocols(row.protocols),
  }));
}

export function localSearchModels(query: string): CatalogModel[] {
  const d = requireDb();
  const like = `%${query}%`;
  return d.getAllSync<{ id: string; brand_id: string; model_number: string; model_name: string | null; protocols: string; category: string | null }>(
    `SELECT id, brand_id, model_number, model_name, protocols, category
     FROM catalog_models
     WHERE model_number LIKE ? OR model_name LIKE ?
     ORDER BY model_number LIMIT 25`,
    [like, like],
  ).map(row => ({
    id: row.id,
    brand_id: row.brand_id,
    model_number: row.model_number,
    model_name: row.model_name,
    category: row.category,
    protocols: parseProtocols(row.protocols),
  }));
}

// ─── Write: upsert from Supabase ──────────────────────────────────────────────

export function upsertBrands(brands: CatalogBrand[]): void {
  if (brands.length === 0) return;
  const d = requireDb();
  const stmt = d.prepareSync(
    `INSERT OR REPLACE INTO catalog_brands (id, name, slug, logo_uri, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
  );
  try {
    d.execSync('BEGIN');
    for (const b of brands) {
      stmt.executeSync([b.id, b.name, b.slug, b.logo_uri]);
    }
    d.execSync('COMMIT');
  } catch (e) {
    d.execSync('ROLLBACK');
    throw e;
  } finally {
    stmt.finalizeSync();
  }
}

export function upsertModels(models: CatalogModel[]): void {
  if (models.length === 0) return;
  const d = requireDb();
  const stmt = d.prepareSync(
    `INSERT OR REPLACE INTO catalog_models (id, brand_id, model_number, model_name, protocols, category, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
  );
  try {
    d.execSync('BEGIN');
    for (const m of models) {
      stmt.executeSync([
        m.id,
        m.brand_id,
        m.model_number,
        m.model_name,
        JSON.stringify(m.protocols),
        m.category,
      ]);
    }
    d.execSync('COMMIT');
  } catch (e) {
    d.execSync('ROLLBACK');
    throw e;
  } finally {
    stmt.finalizeSync();
  }
}

// ─── Meta helpers ─────────────────────────────────────────────────────────────

export function getMetaValue(key: string): string | null {
  const d = requireDb();
  const row = d.getFirstSync<{ value: string }>('SELECT value FROM catalog_meta WHERE key = ?', [key]);
  return row?.value ?? null;
}

export function setMetaValue(key: string, value: string): void {
  const d = requireDb();
  d.runSync('INSERT OR REPLACE INTO catalog_meta (key, value) VALUES (?, ?)', [key, value]);
}
