/**
 * IRLibraryRepository
 *
 * Type-safe read/write access to Layer 3 IR Library tables:
 *   ir_brands, ir_codesets, ir_codes, ir_import_batches
 *
 * The primary entry point for consumers is `IRLibraryRepository.resolveCode()`:
 *
 * ```ts
 * const db = await SQLite.openDatabaseAsync('ir_library.db');
 * await initIRLibraryDatabase(db);
 * const lib = new IRLibraryRepository(db);
 *
 * const code = await lib.resolveCode({
 *   catalogBrandId: 'samsung',
 *   category: 'tv',
 *   modelNumber: 'QN85B',
 *   functionName: 'POWER',
 * });
 * // → IRCode with pronto_hex, or null if not found
 * ```
 */

import type { Database, DatabaseRow } from './Database';
import type { IRBrand, IRCodeset, IRCode, IRImportBatch } from '../types/IRLibrary';

// ─── Helpers ───────────────────────────────────────────────────────────────

function now(): number {
  return Math.floor(Date.now() / 1000);
}

// ─── Row mappers ───────────────────────────────────────────────────────────

function rowToIRBrand(row: DatabaseRow): IRBrand {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as string,
    catalog_brand_id: (row.catalog_brand_id as string) ?? undefined,
    source: row.source as IRBrand['source'],
    priority: row.priority as number,
    code_count: row.code_count as number,
    imported_at: row.imported_at as number,
  };
}

function rowToIRCodeset(row: DatabaseRow): IRCodeset {
  return {
    id: row.id as string,
    brand_id: row.brand_id as string,
    model_pattern: (row.model_pattern as string) ?? undefined,
    catalog_model_id: (row.catalog_model_id as string) ?? undefined,
    match_confidence: row.match_confidence as number,
    protocol_name: (row.protocol_name as string) ?? undefined,
    carrier_frequency_hz: row.carrier_frequency_hz as number,
    source: row.source as IRCodeset['source'],
    source_id: (row.source_id as string) ?? undefined,
    imported_at: row.imported_at as number,
  };
}

function rowToIRCode(row: DatabaseRow): IRCode {
  return {
    id: row.id as string,
    codeset_id: row.codeset_id as string,
    function_name: row.function_name as string,
    function_label: (row.function_label as string) ?? undefined,
    function_category: (row.function_category as string) ?? undefined,
    pronto_hex: (row.pronto_hex as string) ?? undefined,
    raw_pattern: (row.raw_pattern as string) ?? undefined,
    raw_frequency_hz: (row.raw_frequency_hz as number) ?? undefined,
    address: (row.address as number) ?? undefined,
    command: (row.ir_command as number) ?? undefined,
    bit_count: (row.bit_count as number) ?? undefined,
  };
}

// ─── Glob pattern matching ─────────────────────────────────────────────────

/**
 * Matches a device model number against a codeset model_pattern.
 *
 * Supported pattern forms:
 *   null / '' / '*'    → matches everything
 *   'QN*'              → prefix glob (model starts with 'QN')
 *   '*B'               → suffix glob (model ends with 'B')
 *   'QN85B'            → exact match
 *   '2020-2023'        → year-range (model number parsed as 4-digit year)
 *
 * Returns a score [0,1]: 1.0 = exact, 0.7 = glob, 0.3 = wildcard.
 * Returns -1 if the pattern _does not_ match.
 */
function matchModelPattern(modelNumber: string, pattern: string | undefined | null): number {
  if (!pattern || pattern === '*') return 0.3;

  const model = modelNumber.toUpperCase().trim();
  const pat = pattern.toUpperCase().trim();

  // Exact match
  if (model === pat) return 1.0;

  // Prefix glob: "QN*"
  if (pat.endsWith('*') && !pat.startsWith('*')) {
    const prefix = pat.slice(0, -1);
    return model.startsWith(prefix) ? 0.7 : -1;
  }

  // Suffix glob: "*B"
  if (pat.startsWith('*') && !pat.endsWith('*')) {
    const suffix = pat.slice(1);
    return model.endsWith(suffix) ? 0.7 : -1;
  }

  // Contains glob: "*OLED*"
  if (pat.startsWith('*') && pat.endsWith('*')) {
    const middle = pat.slice(1, -1);
    return model.includes(middle) ? 0.6 : -1;
  }

  // Year range: "2020-2023"
  const yearRange = pat.match(/^(\d{4})-(\d{4})$/);
  if (yearRange) {
    const modelYear = parseInt(model.slice(-4), 10);
    const from = parseInt(yearRange[1], 10);
    const to = parseInt(yearRange[2], 10);
    if (!isNaN(modelYear) && modelYear >= from && modelYear <= to) return 0.65;
    return -1;
  }

  return -1;
}

// ─── POWER function-name aliases ───────────────────────────────────────────

/**
 * IR datasets use wildly different names for the same function.
 * This map normalises the most common aliasing.
 */
const FUNCTION_ALIASES: Record<string, string[]> = {
  POWER:         ['POWER', 'POWER_TOGGLE', 'BTN_POWER', 'KEY_POWER', 'ON_OFF', 'PWR'],
  POWER_ON:      ['POWER_ON', 'ON', 'KEY_POWER_ON', 'BTN_POWER_ON'],
  POWER_OFF:     ['POWER_OFF', 'OFF', 'KEY_POWER_OFF', 'BTN_POWER_OFF', 'STANDBY'],
  VOL_UP:        ['VOL_UP', 'VOLUME_UP', 'VOL+', 'KEY_VOLUMEUP'],
  VOL_DOWN:      ['VOL_DOWN', 'VOLUME_DOWN', 'VOL-', 'KEY_VOLUMEDOWN'],
  MUTE:          ['MUTE', 'MUTE_TOGGLE', 'KEY_MUTE'],
  CH_UP:         ['CH_UP', 'CHANNEL_UP', 'CH+', 'KEY_CHANNELUP', 'PROG_UP'],
  CH_DOWN:       ['CH_DOWN', 'CHANNEL_DOWN', 'CH-', 'KEY_CHANNELDOWN', 'PROG_DOWN'],
  UP:            ['UP', 'ARROW_UP', 'KEY_UP', 'DPAD_UP', 'CURSOR_UP'],
  DOWN:          ['DOWN', 'ARROW_DOWN', 'KEY_DOWN', 'DPAD_DOWN', 'CURSOR_DOWN'],
  LEFT:          ['LEFT', 'ARROW_LEFT', 'KEY_LEFT', 'DPAD_LEFT', 'CURSOR_LEFT'],
  RIGHT:         ['RIGHT', 'ARROW_RIGHT', 'KEY_RIGHT', 'DPAD_RIGHT', 'CURSOR_RIGHT'],
  OK:            ['OK', 'ENTER', 'SELECT', 'KEY_OK', 'KEY_ENTER'],
  BACK:          ['BACK', 'RETURN', 'KEY_BACK', 'KEY_RETURN', 'PREVIOUS'],
  HOME:          ['HOME', 'KEY_HOME', 'KEY_HOMEPAGE'],
  MENU:          ['MENU', 'KEY_MENU', 'SETTINGS'],
  INPUT:         ['INPUT', 'SOURCE', 'INPUT_SELECT', 'KEY_INPUT', 'KEY_TV'],
};

/**
 * Expand a normalised function name to all aliases that should be searched.
 */
function expandFunctionNames(name: string): string[] {
  const upper = name.toUpperCase();
  const aliases = FUNCTION_ALIASES[upper];
  if (aliases) return aliases;
  // Return the name itself + a few common prefix variants
  return [upper, `BTN_${upper}`, `KEY_${upper}`];
}

// ─── IRBrandRepository ─────────────────────────────────────────────────────

export class IRBrandRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<IRBrand | null> {
    const row = await this.db.getFirstAsync<DatabaseRow>(
      'SELECT * FROM ir_brands WHERE id = ?',
      [id],
    );
    return row ? rowToIRBrand(row) : null;
  }

  async findByCatalogBrandId(catalogBrandId: string): Promise<IRBrand[]> {
    const rows = await this.db.getAllAsync<DatabaseRow>(
      'SELECT * FROM ir_brands WHERE catalog_brand_id = ? ORDER BY priority DESC',
      [catalogBrandId],
    );
    return rows.map(rowToIRBrand);
  }

  async findByCategory(category: string): Promise<IRBrand[]> {
    const rows = await this.db.getAllAsync<DatabaseRow>(
      'SELECT * FROM ir_brands WHERE category = ? ORDER BY priority DESC',
      [category],
    );
    return rows.map(rowToIRBrand);
  }

  async findByCatalogBrandAndCategory(catalogBrandId: string, category: string): Promise<IRBrand[]> {
    const rows = await this.db.getAllAsync<DatabaseRow>(
      `SELECT * FROM ir_brands
       WHERE catalog_brand_id = ? AND category = ?
       ORDER BY priority DESC`,
      [catalogBrandId, category],
    );
    return rows.map(rowToIRBrand);
  }

  async linkToCatalogBrand(irBrandId: string, catalogBrandId: string): Promise<void> {
    await this.db.runAsync(
      'UPDATE ir_brands SET catalog_brand_id = ? WHERE id = ?',
      [catalogBrandId, irBrandId],
    );
  }

  async upsertMany(brands: IRBrand[]): Promise<void> {
    for (const b of brands) {
      await this.db.runAsync(
        `INSERT INTO ir_brands (id, name, category, catalog_brand_id, source, priority, code_count, imported_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name             = excluded.name,
           catalog_brand_id = COALESCE(excluded.catalog_brand_id, ir_brands.catalog_brand_id),
           priority         = excluded.priority,
           code_count       = excluded.code_count,
           imported_at      = excluded.imported_at`,
        [b.id, b.name, b.category, b.catalog_brand_id ?? null, b.source, b.priority, b.code_count, b.imported_at],
      );
    }
  }
}

// ─── IRCodesetRepository ───────────────────────────────────────────────────

export class IRCodesetRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<IRCodeset | null> {
    const row = await this.db.getFirstAsync<DatabaseRow>(
      'SELECT * FROM ir_codesets WHERE id = ?',
      [id],
    );
    return row ? rowToIRCodeset(row) : null;
  }

  async findByBrand(brandId: string): Promise<IRCodeset[]> {
    const rows = await this.db.getAllAsync<DatabaseRow>(
      'SELECT * FROM ir_codesets WHERE brand_id = ? ORDER BY match_confidence DESC',
      [brandId],
    );
    return rows.map(rowToIRCodeset);
  }

  async findByCatalogModel(catalogModelId: string): Promise<IRCodeset[]> {
    const rows = await this.db.getAllAsync<DatabaseRow>(
      'SELECT * FROM ir_codesets WHERE catalog_model_id = ? ORDER BY match_confidence DESC',
      [catalogModelId],
    );
    return rows.map(rowToIRCodeset);
  }

  /**
   * Find the best matching codeset for a device model.
   *
   * Algorithm (in-JS glob matching after fetching brand's codesets):
   *   1. Exact model_pattern match (score = 1.0 × match_confidence)
   *   2. Prefix/suffix/contains glob match (score = 0.7 × match_confidence)
   *   3. Wildcard (NULL / '*') — score = 0.3 × (1 + brand priority)
   *
   * @param irBrandIds  One or more ir_brands.id values for this brand+category
   * @param modelNumber The device model number to match against
   */
  async findBestForModel(irBrandIds: string[], modelNumber: string): Promise<IRCodeset | null> {
    if (irBrandIds.length === 0) return null;

    const placeholders = irBrandIds.map(() => '?').join(', ');
    const rows = await this.db.getAllAsync<DatabaseRow>(
      `SELECT cs.*, ib.priority AS brand_priority
       FROM ir_codesets cs
       JOIN ir_brands ib ON ib.id = cs.brand_id
       WHERE cs.brand_id IN (${placeholders})
       ORDER BY cs.match_confidence DESC`,
      irBrandIds,
    );

    let bestCodeset: IRCodeset | null = null;
    let bestScore = -1;

    for (const row of rows) {
      const codeset = rowToIRCodeset(row);
      const brandPriority = (row.brand_priority as number) ?? 0;
      const patternScore = matchModelPattern(modelNumber, codeset.model_pattern);

      if (patternScore < 0) continue; // pattern does not match

      const score = patternScore * (0.5 + codeset.match_confidence * 0.5) + brandPriority * 0.01;
      if (score > bestScore) {
        bestScore = score;
        bestCodeset = codeset;
      }
    }

    return bestCodeset;
  }

  /**
   * Returns all codesets for brand+category sorted by confidence × priority.
   * Used for brute-force mode when no exact model match exists.
   *
   * @param irBrandIds  ir_brands.id list for this brand+category
   * @param limit       Maximum number of codesets to return (default 20)
   */
  async findForBruteForce(irBrandIds: string[], limit = 20): Promise<IRCodeset[]> {
    if (irBrandIds.length === 0) return [];

    const placeholders = irBrandIds.map(() => '?').join(', ');
    const rows = await this.db.getAllAsync<DatabaseRow>(
      `SELECT cs.*
       FROM ir_codesets cs
       JOIN ir_brands ib ON ib.id = cs.brand_id
       WHERE cs.brand_id IN (${placeholders})
       ORDER BY cs.match_confidence DESC, ib.priority DESC
       LIMIT ?`,
      [...irBrandIds, limit],
    );
    return rows.map(rowToIRCodeset);
  }

  async linkToCatalogModel(codesetId: string, catalogModelId: string, confidence: number): Promise<void> {
    await this.db.runAsync(
      'UPDATE ir_codesets SET catalog_model_id = ?, match_confidence = ? WHERE id = ?',
      [catalogModelId, confidence, codesetId],
    );
  }

  async upsertMany(codesets: IRCodeset[]): Promise<void> {
    for (const cs of codesets) {
      await this.db.runAsync(
        `INSERT INTO ir_codesets
           (id, brand_id, model_pattern, catalog_model_id, match_confidence,
            protocol_name, carrier_frequency_hz, source, source_id, imported_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           catalog_model_id     = COALESCE(excluded.catalog_model_id, ir_codesets.catalog_model_id),
           match_confidence     = excluded.match_confidence,
           carrier_frequency_hz = excluded.carrier_frequency_hz,
           imported_at          = excluded.imported_at`,
        [
          cs.id, cs.brand_id, cs.model_pattern ?? null, cs.catalog_model_id ?? null,
          cs.match_confidence, cs.protocol_name ?? null, cs.carrier_frequency_hz,
          cs.source, cs.source_id ?? null, cs.imported_at,
        ],
      );
    }
  }
}

// ─── IRCodeRepository ──────────────────────────────────────────────────────

export class IRCodeRepository {
  constructor(private readonly db: Database) {}

  async findByCodeset(codesetId: string): Promise<IRCode[]> {
    const rows = await this.db.getAllAsync<DatabaseRow>(
      'SELECT * FROM ir_codes WHERE codeset_id = ? ORDER BY function_name',
      [codesetId],
    );
    return rows.map(rowToIRCode);
  }

  /**
   * Find a specific function within a codeset, expanding aliases.
   *
   * @param codesetId     The codeset to search
   * @param functionName  Normalised name, e.g. 'POWER', 'VOL_UP'
   */
  async findByFunction(codesetId: string, functionName: string): Promise<IRCode | null> {
    const aliases = expandFunctionNames(functionName);
    const placeholders = aliases.map(() => '?').join(', ');
    const row = await this.db.getFirstAsync<DatabaseRow>(
      `SELECT * FROM ir_codes
       WHERE codeset_id = ?
         AND function_name IN (${placeholders})
       LIMIT 1`,
      [codesetId, ...aliases],
    );
    return row ? rowToIRCode(row) : null;
  }

  /**
   * Find the "probe command" for a codeset — used in brute-force mode.
   * Tries POWER commands first (best for testing if a device responds),
   * then falls back to any available code in the codeset.
   */
  async findProbeCode(codesetId: string): Promise<IRCode | null> {
    // Try power commands first
    const powerCode = await this.findByFunction(codesetId, 'POWER');
    if (powerCode) return powerCode;

    const powerOnCode = await this.findByFunction(codesetId, 'POWER_ON');
    if (powerOnCode) return powerOnCode;

    // Fallback: any code with a valid payload
    const row = await this.db.getFirstAsync<DatabaseRow>(
      `SELECT * FROM ir_codes
       WHERE codeset_id = ?
         AND (pronto_hex IS NOT NULL OR raw_pattern IS NOT NULL)
       LIMIT 1`,
      [codesetId],
    );
    return row ? rowToIRCode(row) : null;
  }

  async upsertMany(codes: IRCode[]): Promise<void> {
    for (const c of codes) {
      await this.db.runAsync(
        `INSERT INTO ir_codes
           (id, codeset_id, function_name, function_label, function_category,
            pronto_hex, raw_pattern, raw_frequency_hz, address, ir_command, bit_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           pronto_hex    = COALESCE(excluded.pronto_hex, ir_codes.pronto_hex),
           raw_pattern   = COALESCE(excluded.raw_pattern, ir_codes.raw_pattern),
           function_label = excluded.function_label`,
        [
          c.id, c.codeset_id, c.function_name, c.function_label ?? null,
          c.function_category ?? null, c.pronto_hex ?? null, c.raw_pattern ?? null,
          c.raw_frequency_hz ?? null, c.address ?? null, c.command ?? null, c.bit_count ?? null,
        ],
      );
    }
  }
}

// ─── IRImportBatchRepository ───────────────────────────────────────────────

export class IRImportBatchRepository {
  constructor(private readonly db: Database) {}

  async create(batch: IRImportBatch): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO ir_import_batches
         (id, source, version, brands_count, codesets_count, codes_count, is_active, imported_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batch.id, batch.source, batch.version, batch.brands_count,
        batch.codesets_count, batch.codes_count, batch.is_active ? 1 : 0, batch.imported_at,
      ],
    );
  }

  async setActive(batchId: string): Promise<void> {
    // Deactivate all, then activate target
    await this.db.execAsync('UPDATE ir_import_batches SET is_active = 0');
    await this.db.runAsync(
      'UPDATE ir_import_batches SET is_active = 1 WHERE id = ?',
      [batchId],
    );
  }

  async getActive(): Promise<IRImportBatch | null> {
    const row = await this.db.getFirstAsync<DatabaseRow>(
      'SELECT * FROM ir_import_batches WHERE is_active = 1 LIMIT 1',
    );
    if (!row) return null;
    return {
      id: row.id as string,
      source: row.source as IRImportBatch['source'],
      version: row.version as string,
      brands_count: row.brands_count as number,
      codesets_count: row.codesets_count as number,
      codes_count: row.codes_count as number,
      is_active: row.is_active === 1,
      imported_at: row.imported_at as number,
    };
  }

  async list(): Promise<IRImportBatch[]> {
    const rows = await this.db.getAllAsync<DatabaseRow>(
      'SELECT * FROM ir_import_batches ORDER BY imported_at DESC',
    );
    return rows.map(row => ({
      id: row.id as string,
      source: row.source as IRImportBatch['source'],
      version: row.version as string,
      brands_count: row.brands_count as number,
      codesets_count: row.codesets_count as number,
      codes_count: row.codes_count as number,
      is_active: row.is_active === 1,
      imported_at: row.imported_at as number,
    }));
  }
}

// ─── IRLibraryRepository facade ────────────────────────────────────────────

export interface ResolveCodeParams {
  /** catalog Brand.id (e.g. 'samsung') */
  catalogBrandId: string;
  /** Device category (e.g. 'tv', 'ac') */
  category: string;
  /** Device model number (e.g. 'QN85B', 'UN55TU7000') */
  modelNumber: string;
  /** Normalised function name (e.g. 'POWER', 'VOL_UP') */
  functionName: string;
}

export interface ResolvedIRCode {
  code: IRCode;
  codeset: IRCodeset;
  /** Effective carrier frequency to use for transmission */
  frequencyHz: number;
  /** Effective pronto payload — prefers pronto_hex; falls back to raw JSON */
  payload: string;
}

export class IRLibraryRepository {
  readonly brands: IRBrandRepository;
  readonly codesets: IRCodesetRepository;
  readonly codes: IRCodeRepository;
  readonly batches: IRImportBatchRepository;

  constructor(private readonly db: Database) {
    this.brands   = new IRBrandRepository(db);
    this.codesets = new IRCodesetRepository(db);
    this.codes    = new IRCodeRepository(db);
    this.batches  = new IRImportBatchRepository(db);
  }

  /**
   * Resolve the best IR code for a specific device + function combination.
   *
   * Resolution order:
   *   1. IR brands linked to catalogBrandId + matching category
   *   2. Best codeset for modelNumber via glob matching
   *   3. The specific function within that codeset (with alias expansion)
   *
   * Returns null if no matching code exists (model not in library).
   */
  async resolveCode(params: ResolveCodeParams): Promise<ResolvedIRCode | null> {
    const { catalogBrandId, category, modelNumber, functionName } = params;

    // 1. Find IR brands for this catalog brand + category
    const irBrands = await this.brands.findByCatalogBrandAndCategory(catalogBrandId, category);
    if (irBrands.length === 0) return null;

    const irBrandIds = irBrands.map(b => b.id);

    // 2. Find best matching codeset for this model
    const codeset = await this.codesets.findBestForModel(irBrandIds, modelNumber);
    if (!codeset) return null;

    // 3. Find the function within that codeset
    const code = await this.codes.findByFunction(codeset.id, functionName);
    if (!code) return null;

    const frequencyHz = code.raw_frequency_hz ?? codeset.carrier_frequency_hz;
    const payload = code.pronto_hex
      ?? JSON.stringify({ frequency: frequencyHz, pattern: JSON.parse(code.raw_pattern ?? '[]') });

    return { code, codeset, frequencyHz, payload };
  }

  /**
   * Returns brute-force candidates for a brand+category — used when the model
   * is not in the library.
   *
   * Each candidate is a top-N codeset with its probe code (POWER command).
   * The caller sends each probe and waits for user confirmation
   * ("Did the device respond?") before trying the next.
   *
   * @param limit  Max number of codesets to return (default 20)
   */
  async getBruteForceProbes(
    catalogBrandId: string,
    category: string,
    limit = 20,
  ): Promise<BruteForceProbe[]> {
    const irBrands = await this.brands.findByCatalogBrandAndCategory(catalogBrandId, category);
    if (irBrands.length === 0) return [];

    const irBrandIds = irBrands.map(b => b.id);
    const candidateCodesets = await this.codesets.findForBruteForce(irBrandIds, limit);
    const probes: BruteForceProbe[] = [];

    for (const codeset of candidateCodesets) {
      const probeCode = await this.codes.findProbeCode(codeset.id);
      if (!probeCode) continue;

      const frequencyHz = probeCode.raw_frequency_hz ?? codeset.carrier_frequency_hz;
      const payload = probeCode.pronto_hex
        ?? JSON.stringify({ frequency: frequencyHz, pattern: JSON.parse(probeCode.raw_pattern ?? '[]') });

      probes.push({
        codesetId: codeset.id,
        probeCodeId: probeCode.id,
        modelPattern: codeset.model_pattern ?? '*',
        confidence: codeset.match_confidence,
        source: codeset.source,
        frequencyHz,
        payload,
      });
    }

    return probes;
  }
}

/** A single brute-force probe candidate returned by `getBruteForceProbes()`. */
export interface BruteForceProbe {
  /** Codeset ID — use this to confirm the match once user verifies */
  codesetId: string;
  /** IR code ID used as the probe signal */
  probeCodeId: string;
  /** Model pattern this codeset covers (for display: "matches QN* series") */
  modelPattern: string;
  /** Confidence 0.0–1.0 from the dataset */
  confidence: number;
  source: string;
  frequencyHz: number;
  /** Pronto Hex or raw JSON — ready to pass to IRModule.transmit() */
  payload: string;
}
