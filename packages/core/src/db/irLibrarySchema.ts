/**
 * Layer 3 — IR Code Library SQL schema.
 *
 * A separate, lazily loaded database for raw IR codes sourced from:
 *   - IRDB (https://github.com/probonopd/irdb)  — 570k+ codes
 *   - Flipper Zero IR assets                      — 50k+ codes
 *   - Global Caché Codebase                       — Pronto Hex archive
 *   - Manually learned codes                      — captured on-device
 *
 * This DB is independent of the user DB and catalog DB so it can be
 * replaced or updated via OTA without affecting user-paired devices.
 *
 * Run `initIRLibraryDatabase(db)` once on open (safe to call repeatedly).
 *
 * Tables: ir_brands, ir_codesets, ir_codes, ir_import_batches
 */

import type { Database } from './Database';

const IR_LIBRARY_DDL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ─── ir_brands ─────────────────────────────────────────────────────────────
-- One row per brand+category combination from a source dataset.
-- Multiple rows may map to the same catalog Brand (different sources).
CREATE TABLE IF NOT EXISTS ir_brands (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  category         TEXT NOT NULL,
  catalog_brand_id TEXT,               -- FK → brands.id in catalog DB (nullable until matched)
  source           TEXT NOT NULL,      -- 'irdb' | 'flipper' | 'gc' | 'pronto_db' | 'manual'
  priority         INTEGER NOT NULL DEFAULT 0,
  code_count       INTEGER NOT NULL DEFAULT 0,
  imported_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ir_brands_catalog_brand
  ON ir_brands(catalog_brand_id);

CREATE INDEX IF NOT EXISTS idx_ir_brands_source_category
  ON ir_brands(source, category);

-- ─── ir_codesets ───────────────────────────────────────────────────────────
-- A codeset is a group of IR codes associated with a model range.
-- model_pattern uses glob-style matching (NULL or '*' = all models).
CREATE TABLE IF NOT EXISTS ir_codesets (
  id                   TEXT PRIMARY KEY,
  brand_id             TEXT NOT NULL REFERENCES ir_brands(id) ON DELETE CASCADE,
  model_pattern        TEXT,           -- NULL | '*' | 'QN*' | 'QN85B' | '2020-2023'
  catalog_model_id     TEXT,           -- FK → device_models.id once matched
  match_confidence     REAL NOT NULL DEFAULT 0.0,   -- 0.0–1.0
  protocol_name        TEXT,           -- 'NEC' | 'RC5' | 'RC6' | 'Samsung32' | 'RAW'
  carrier_frequency_hz INTEGER NOT NULL DEFAULT 38000,
  source               TEXT NOT NULL,
  source_id            TEXT,           -- opaque ID from source dataset for deduplication
  imported_at          INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ir_codesets_brand
  ON ir_codesets(brand_id);

CREATE INDEX IF NOT EXISTS idx_ir_codesets_catalog_model
  ON ir_codesets(catalog_model_id);

CREATE INDEX IF NOT EXISTS idx_ir_codesets_confidence
  ON ir_codesets(brand_id, match_confidence DESC);

-- ─── ir_codes ──────────────────────────────────────────────────────────────
-- Individual IR code entries. At least one of pronto_hex / raw_pattern must
-- be non-null. Pronto Hex is preferred for transmission.
CREATE TABLE IF NOT EXISTS ir_codes (
  id                TEXT PRIMARY KEY,
  codeset_id        TEXT NOT NULL REFERENCES ir_codesets(id) ON DELETE CASCADE,
  function_name     TEXT NOT NULL,     -- normalised UPPER_SNAKE_CASE, e.g. 'POWER_ON'
  function_label    TEXT,              -- display name from source dataset
  function_category TEXT,              -- 'power' | 'volume' | 'navigation' | ...
  pronto_hex        TEXT,              -- "0000 006D 0022 0000 ..."
  raw_pattern       TEXT,              -- JSON int[] of microsecond on/off durations
  raw_frequency_hz  INTEGER,           -- overrides codeset carrier if set
  address           INTEGER,           -- protocol-decoded address (NEC/RC5/RC6/Samsung32)
  ir_command        INTEGER,           -- protocol-decoded command byte
  bit_count         INTEGER            -- protocol frame size
);

CREATE INDEX IF NOT EXISTS idx_ir_codes_codeset
  ON ir_codes(codeset_id);

CREATE INDEX IF NOT EXISTS idx_ir_codes_function
  ON ir_codes(codeset_id, function_name);

-- ─── ir_import_batches ─────────────────────────────────────────────────────
-- Tracks each dataset import for incremental updates and rollback.
CREATE TABLE IF NOT EXISTS ir_import_batches (
  id             TEXT PRIMARY KEY,
  source         TEXT NOT NULL,
  version        TEXT NOT NULL,
  brands_count   INTEGER NOT NULL DEFAULT 0,
  codesets_count INTEGER NOT NULL DEFAULT 0,
  codes_count    INTEGER NOT NULL DEFAULT 0,
  is_active      INTEGER NOT NULL DEFAULT 0,  -- boolean 0/1
  imported_at    INTEGER NOT NULL
);
`;

/**
 * Initialise the IR Library database schema.
 * Safe to call on every launch — all statements use IF NOT EXISTS.
 */
export async function initIRLibraryDatabase(db: Database): Promise<void> {
  await db.execAsync(IR_LIBRARY_DDL);
}
