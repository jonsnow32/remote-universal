/**
 * Layer 1 — Static Device Catalog SQL schema.
 *
 * Run once via `initCatalogDatabase(db)` on app launch (or after an OTA
 * catalog update) to ensure all tables exist.
 *
 * Tables: brands, device_models, command_definitions, catalog_layouts
 *
 * All columns use SQLite affinity rules:
 *   TEXT  → strings / JSON arrays stored as text
 *   INTEGER → booleans (0/1), timestamps (Unix seconds), integers
 *   REAL  → floating-point (match_confidence)
 */

import type { Database } from './Database';

const CATALOG_DDL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ─── brands ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brands (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  logo_uri     TEXT,
  country      TEXT,
  website      TEXT,
  canonical_id TEXT REFERENCES brands(id),
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

-- ─── device_models ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS device_models (
  id              TEXT PRIMARY KEY,
  brand_id        TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  model_number    TEXT NOT NULL,
  model_name      TEXT NOT NULL,
  category        TEXT NOT NULL,
  year_from       INTEGER,
  year_to         INTEGER,
  protocols       TEXT NOT NULL DEFAULT '[]',
  capabilities    TEXT NOT NULL DEFAULT '[]',
  thumbnail_uri   TEXT,
  source          TEXT NOT NULL DEFAULT 'community',
  catalog_version TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_device_models_brand_category
  ON device_models(brand_id, category);

CREATE INDEX IF NOT EXISTS idx_device_models_model_number
  ON device_models(model_number);

-- FTS5 for model search (supports "SONY KD-65A80" style queries)
CREATE VIRTUAL TABLE IF NOT EXISTS device_models_fts USING fts5(
  id UNINDEXED,
  model_number,
  model_name,
  content='device_models',
  content_rowid='rowid'
);

-- ─── command_definitions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS command_definitions (
  id                     TEXT PRIMARY KEY,
  model_id               TEXT REFERENCES device_models(id) ON DELETE CASCADE,
  brand_id               TEXT REFERENCES brands(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  label                  TEXT NOT NULL,
  icon                   TEXT,
  capability             TEXT,
  sort_order             INTEGER DEFAULT 0,

  -- IR
  ir_pronto              TEXT,
  ir_raw                 TEXT,
  ir_frequency           INTEGER,
  ir_protocol            TEXT,

  -- Wi-Fi / HTTP
  wifi_method            TEXT,
  wifi_endpoint          TEXT,
  wifi_payload           TEXT,
  wifi_headers           TEXT,

  -- BLE
  ble_service_uuid       TEXT,
  ble_char_uuid          TEXT,
  ble_value              TEXT,
  ble_write_type         TEXT,

  -- Matter
  matter_cluster         INTEGER,
  matter_command         INTEGER,
  matter_payload         TEXT,
  matter_endpoint        INTEGER DEFAULT 1,

  -- HomeKit
  homekit_service        TEXT,
  homekit_characteristic TEXT,
  homekit_value          TEXT,

  -- Constraint: must belong to either a model or a brand (not both null)
  CHECK (model_id IS NOT NULL OR brand_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_command_definitions_model_name
  ON command_definitions(model_id, name);

CREATE INDEX IF NOT EXISTS idx_command_definitions_brand_name
  ON command_definitions(brand_id, name)
  WHERE model_id IS NULL;

-- ─── catalog_layouts ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS catalog_layouts (
  id            TEXT PRIMARY KEY,
  model_id      TEXT REFERENCES device_models(id) ON DELETE CASCADE,
  brand_id      TEXT REFERENCES brands(id) ON DELETE CASCADE,
  category      TEXT,
  name          TEXT NOT NULL,
  columns       INTEGER NOT NULL DEFAULT 4,
  sections_json TEXT NOT NULL DEFAULT '[]',
  is_default    INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_catalog_layouts_model
  ON catalog_layouts(model_id, is_default);

CREATE INDEX IF NOT EXISTS idx_catalog_layouts_brand_category
  ON catalog_layouts(brand_id, category, is_default)
  WHERE model_id IS NULL;
`;

/**
 * Initialise (or migrate) the Layer 1 static catalog database.
 * Safe to call on every app launch — all statements use `IF NOT EXISTS`.
 */
export async function initCatalogDatabase(db: Database): Promise<void> {
  await db.execAsync(CATALOG_DDL);
}
