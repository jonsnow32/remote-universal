/**
 * IR Code Library Types
 *
 * These types model the raw IR code database — a separate, lazily loaded
 * layer below the device catalog.  While `CommandDefinition` stores one
 * IR payload per command, the IR Library can hold multiple codeset variants
 * for a model (different regional remotes, firmware generations, etc.) and
 * is the primary import target for open-source datasets such as:
 *
 *   - IRDB (https://github.com/probonopd/irdb) — 570k+ codes
 *   - Flipper Zero IR assets — 50k+ codes
 *   - Global Caché Codebase — Pronto Hex archive
 *
 * Typical flow:
 *   IRBrand → IRCodeset → IRCode[]
 *        ↓ matched to DeviceModel
 *        ↓ best IRCode exported to CommandDefinition.ir_pronto
 *
 * The library lives in its own SQLite database or a bundled `.db` file so
 * it can be replaced / updated independently of the user's paired devices.
 */

// ─── IR Brand ──────────────────────────────────────────────────────────────

/**
 * A brand entry in the IR code library.
 *
 * Note: `IRBrand` is *not* the same as `Brand` in Catalog.ts.
 * IR library brands come from third-party datasets and may use
 * different naming conventions.  Use `catalog_brand_id` to link
 * back to the canonical `Brand` record.
 */
export interface IRBrand {
  /** Unique id within the IR library, e.g. 'irdb:samsung' */
  id: string;
  /** Brand name as it appears in the source dataset, e.g. 'SAMSUNG' */
  name: string;
  /** Device category this brand entry covers */
  category: string;
  /** FK → Brand.id in the catalog (null until matched) */
  catalog_brand_id?: string;
  /** Source dataset identifier */
  source: 'irdb' | 'flipper' | 'gc' | 'pronto_db' | 'manual';
  /**
   * Optional priority within the same brand+category.
   * Higher = preferable (more complete, more reliable).
   */
  priority: number;
  /** Cached count of all IRCode rows under this brand */
  code_count: number;
  /** Unix timestamp (seconds) — when this dataset snapshot was imported */
  imported_at: number;
}

// ─── IR Codeset ────────────────────────────────────────────────────────────

/**
 * A set of IR codes that belongs to a group of models.
 *
 * `model_pattern` is a glob-style string matching model numbers:
 *   '*'         → all models of this brand/category
 *   'QN*'       → all QLED QN-series
 *   'QN85B'     → exact model match
 *   '2020-2023' → year-range suffix match
 *
 * When resolving the best codeset for a model, prefer:
 *   1. Exact `model_range` match
 *   2. Highest `match_confidence`
 *   3. Highest `ir_brand.priority`
 */
export interface IRCodeset {
  /** Unique id, e.g. 'irdb:samsung:tv:00042' */
  id: string;
  /** FK → IRBrand.id */
  brand_id: string;
  /**
   * Glob pattern for matching model numbers.
   * Null = applies to all models of this brand+category.
   */
  model_pattern?: string;
  /**
   * FK → DeviceModel.id in the catalog once matched.
   * Null until the match is confirmed.
   */
  catalog_model_id?: string;
  /**
   * Confidence score 0.0–1.0 for the catalog model match.
   * 1.0 = confirmed by OEM, 0.0 = unmatched.
   */
  match_confidence: number;
  /**
   * The IR modulation protocol name.
   * e.g. 'NEC', 'RC5', 'RC6', 'Samsung32', 'Mitsubishi', 'RAW'
   */
  protocol_name?: string;
  /** Carrier frequency in Hz (default 38000) */
  carrier_frequency_hz: number;
  /** Source dataset */
  source: 'irdb' | 'flipper' | 'gc' | 'pronto_db' | 'manual';
  /** Opaque identifier from the source dataset for deduplication */
  source_id?: string;
  /** Unix timestamp (seconds) — when this codeset was imported */
  imported_at: number;
}

// ─── IR Code ───────────────────────────────────────────────────────────────

/**
 * A single IR code within a codeset.
 *
 * Stores the payload in three formats when available:
 *   - `pronto_hex`   (most portable — preferred for transmission)
 *   - `raw_pattern`  (microsecond on/off pairs, JSON int[])
 *   - Protocol-decoded fields (`address`, `command`, `bit_count`)
 *     for NEC / Samsung / RC5 / RC6 etc.
 *
 * At least one of `pronto_hex` or `raw_pattern` must be non-null.
 */
export interface IRCode {
  /** UUID v4 (generated on import) */
  id: string;
  /** FK → IRCodeset.id */
  codeset_id: string;
  /**
   * Normalised function name, e.g. 'POWER_ON', 'VOL_UP', 'NUM_3'.
   * Normalised to UPPER_SNAKE_CASE from dataset-specific naming.
   */
  function_name: string;
  /** Display name as it appears in the source dataset */
  function_label?: string;
  /** High-level grouping, e.g. 'power', 'volume', 'navigation' */
  function_category?: string;
  /** Pronto Hex encoded signal (preferred format) */
  pronto_hex?: string;
  /**
   * Raw signal JSON: alternating on/off durations in microseconds.
   * e.g. [9000, 4500, 562, 562, ...]
   */
  raw_pattern?: string;
  /** Carrier frequency override (falls back to IRCodeset.carrier_frequency_hz) */
  raw_frequency_hz?: number;
  /** Protocol-decoded address field (for NEC/RC5/RC6/Samsung) */
  address?: number;
  /** Protocol-decoded command field */
  command?: number;
  /** Number of bits in the protocol frame */
  bit_count?: number;
}

// ─── Import batch metadata ─────────────────────────────────────────────────

/**
 * Metadata about a dataset import run.
 * Used for incremental updates and rollback.
 */
export interface IRImportBatch {
  /** UUID v4 */
  id: string;
  /** Source dataset */
  source: 'irdb' | 'flipper' | 'gc' | 'pronto_db' | 'manual';
  /** Opaque version tag (git commit SHA, dataset release name, etc.) */
  version: string;
  /** Number of brands imported */
  brands_count: number;
  /** Number of codesets imported */
  codesets_count: number;
  /** Number of individual IR codes imported */
  codes_count: number;
  /** Whether this batch is the currently active snapshot */
  is_active: boolean;
  /** Unix timestamp (seconds) */
  imported_at: number;
}
