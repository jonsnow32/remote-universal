/**
 * CatalogRepository
 *
 * Type-safe read/write access to Layer 1 catalog tables:
 *   brands, device_models, command_definitions, catalog_layouts
 *
 * Instantiate once per database handle and share across the app.
 *
 * ```ts
 * const db = await SQLite.openDatabaseAsync('catalog.db');
 * await initCatalogDatabase(db);
 * const catalog = new CatalogRepository(db);
 *
 * const layout = await catalog.layouts.resolve(
 *   'samsung.qled-qn85b-2022',   // modelId
 *   'samsung',                    // brandId
 *   'tv',                         // category fallback
 * );
 * ```
 */

import type { Database, DatabaseRow } from './Database';
import type { Brand, DeviceModel, CommandDefinition, CatalogLayout, DeviceCategory } from '../types/Catalog';
import { parseCatalogLayout } from '../types/Catalog';
import type { RemoteLayoutDefinition } from '../types/RemoteLayout';

// ─── Helpers ───────────────────────────────────────────────────────────────

function now(): number {
  return Math.floor(Date.now() / 1000);
}

function jsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// ─── Row mappers ───────────────────────────────────────────────────────────

function rowToBrand(row: DatabaseRow): Brand {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    logo_uri: (row.logo_uri as string) ?? undefined,
    country: (row.country as string) ?? undefined,
    website: (row.website as string) ?? undefined,
    canonical_id: (row.canonical_id as string) ?? undefined,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  };
}

function rowToDeviceModel(row: DatabaseRow): DeviceModel {
  return {
    id: row.id as string,
    brand_id: row.brand_id as string,
    model_number: row.model_number as string,
    model_name: row.model_name as string,
    category: row.category as DeviceCategory,
    year_from: (row.year_from as number) ?? undefined,
    year_to: (row.year_to as number) ?? undefined,
    protocols: jsonParse(row.protocols as string, []),
    capabilities: jsonParse(row.capabilities as string, []),
    thumbnail_uri: (row.thumbnail_uri as string) ?? undefined,
    source: row.source as Brand['created_at'] extends number ? never : DeviceModel['source'],
    catalog_version: (row.catalog_version as string) ?? undefined,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  };
}

function rowToCommandDefinition(row: DatabaseRow): CommandDefinition {
  return {
    id: row.id as string,
    model_id: row.model_id as string | null,
    brand_id: (row.brand_id as string) ?? undefined,
    name: row.name as string,
    label: row.label as string,
    icon: (row.icon as string) ?? undefined,
    capability: (row.capability as CommandDefinition['capability']) ?? undefined,
    sort_order: (row.sort_order as number) ?? undefined,
    ir_pronto: (row.ir_pronto as string) ?? undefined,
    ir_raw: (row.ir_raw as string) ?? undefined,
    ir_frequency: (row.ir_frequency as number) ?? undefined,
    ir_protocol: (row.ir_protocol as string) ?? undefined,
    wifi_method: (row.wifi_method as string) ?? undefined,
    wifi_endpoint: (row.wifi_endpoint as string) ?? undefined,
    wifi_payload: (row.wifi_payload as string) ?? undefined,
    wifi_headers: (row.wifi_headers as string) ?? undefined,
    ble_service_uuid: (row.ble_service_uuid as string) ?? undefined,
    ble_char_uuid: (row.ble_char_uuid as string) ?? undefined,
    ble_value: (row.ble_value as string) ?? undefined,
    ble_write_type: (row.ble_write_type as CommandDefinition['ble_write_type']) ?? undefined,
    matter_cluster: (row.matter_cluster as number) ?? undefined,
    matter_command: (row.matter_command as number) ?? undefined,
    matter_payload: (row.matter_payload as string) ?? undefined,
    matter_endpoint: (row.matter_endpoint as number) ?? undefined,
    homekit_service: (row.homekit_service as string) ?? undefined,
    homekit_characteristic: (row.homekit_characteristic as string) ?? undefined,
    homekit_value: (row.homekit_value as string) ?? undefined,
  };
}

function rowToCatalogLayout(row: DatabaseRow): CatalogLayout {
  return {
    id: row.id as string,
    model_id: (row.model_id as string) ?? null,
    brand_id: (row.brand_id as string) ?? undefined,
    category: (row.category as DeviceCategory) ?? undefined,
    name: row.name as string,
    columns: row.columns as number,
    sections_json: row.sections_json as string,
    is_default: (row.is_default as number) === 1,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  };
}

// ─── BrandRepository ──────────────────────────────────────────────────────

export class BrandRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Brand | null> {
    const row = await this.db.getFirstAsync<DatabaseRow>(
      'SELECT * FROM brands WHERE id = ?',
      [id],
    );
    return row ? rowToBrand(row) : null;
  }

  async findBySlug(slug: string): Promise<Brand | null> {
    const row = await this.db.getFirstAsync<DatabaseRow>(
      'SELECT * FROM brands WHERE slug = ?',
      [slug],
    );
    return row ? rowToBrand(row) : null;
  }

  async listCanonical(): Promise<Brand[]> {
    const rows = await this.db.getAllAsync<DatabaseRow>(
      'SELECT * FROM brands WHERE canonical_id IS NULL ORDER BY name ASC',
    );
    return rows.map(rowToBrand);
  }

  async upsert(brand: Brand): Promise<void> {
    const ts = now();
    await this.db.runAsync(
      `INSERT INTO brands (id, name, slug, logo_uri, country, website, canonical_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         slug = excluded.slug,
         logo_uri = excluded.logo_uri,
         country = excluded.country,
         website = excluded.website,
         canonical_id = excluded.canonical_id,
         updated_at = excluded.updated_at`,
      [
        brand.id,
        brand.name,
        brand.slug,
        brand.logo_uri ?? null,
        brand.country ?? null,
        brand.website ?? null,
        brand.canonical_id ?? null,
        brand.created_at ?? ts,
        ts,
      ],
    );
  }

  async upsertMany(brands: Brand[]): Promise<void> {
    for (const brand of brands) {
      await this.upsert(brand);
    }
  }
}

// ─── DeviceModelRepository ───────────────────────────────────────────────

export class DeviceModelRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<DeviceModel | null> {
    const row = await this.db.getFirstAsync<DatabaseRow>(
      'SELECT * FROM device_models WHERE id = ?',
      [id],
    );
    return row ? rowToDeviceModel(row) : null;
  }

  async findByBrand(brandId: string): Promise<DeviceModel[]> {
    const rows = await this.db.getAllAsync<DatabaseRow>(
      'SELECT * FROM device_models WHERE brand_id = ? ORDER BY model_name ASC',
      [brandId],
    );
    return rows.map(rowToDeviceModel);
  }

  async findByBrandAndCategory(brandId: string, category: DeviceCategory): Promise<DeviceModel[]> {
    const rows = await this.db.getAllAsync<DatabaseRow>(
      'SELECT * FROM device_models WHERE brand_id = ? AND category = ? ORDER BY model_name ASC',
      [brandId, category],
    );
    return rows.map(rowToDeviceModel);
  }

  /**
   * Full-text search on model_number and model_name.
   * Requires the FTS5 virtual table from catalogSchema.
   */
  async search(query: string): Promise<DeviceModel[]> {
    const rows = await this.db.getAllAsync<DatabaseRow>(
      `SELECT dm.* FROM device_models dm
       JOIN device_models_fts fts ON dm.id = fts.id
       WHERE device_models_fts MATCH ?
       ORDER BY rank`,
      [query],
    );
    return rows.map(rowToDeviceModel);
  }

  async upsert(model: DeviceModel): Promise<void> {
    const ts = now();
    await this.db.runAsync(
      `INSERT INTO device_models
         (id, brand_id, model_number, model_name, category,
          year_from, year_to, protocols, capabilities,
          thumbnail_uri, source, catalog_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         model_number    = excluded.model_number,
         model_name      = excluded.model_name,
         category        = excluded.category,
         year_from       = excluded.year_from,
         year_to         = excluded.year_to,
         protocols       = excluded.protocols,
         capabilities    = excluded.capabilities,
         thumbnail_uri   = excluded.thumbnail_uri,
         source          = excluded.source,
         catalog_version = excluded.catalog_version,
         updated_at      = excluded.updated_at`,
      [
        model.id,
        model.brand_id,
        model.model_number,
        model.model_name,
        model.category,
        model.year_from ?? null,
        model.year_to ?? null,
        JSON.stringify(model.protocols),
        JSON.stringify(model.capabilities),
        model.thumbnail_uri ?? null,
        model.source,
        model.catalog_version ?? null,
        model.created_at ?? ts,
        ts,
      ],
    );
  }

  async upsertMany(models: DeviceModel[]): Promise<void> {
    for (const model of models) {
      await this.upsert(model);
    }
  }
}

// ─── CommandDefinitionRepository ─────────────────────────────────────────

export class CommandDefinitionRepository {
  constructor(private readonly db: Database) {}

  async findByModel(modelId: string): Promise<CommandDefinition[]> {
    const rows = await this.db.getAllAsync<DatabaseRow>(
      `SELECT * FROM command_definitions
       WHERE model_id = ?
       ORDER BY sort_order ASC, name ASC`,
      [modelId],
    );
    return rows.map(rowToCommandDefinition);
  }

  /**
   * Resolve a single command for a model, falling back to brand-level
   * generic commands when no model-specific entry exists.
   */
  async resolve(
    commandName: string,
    modelId: string,
    brandId: string,
  ): Promise<CommandDefinition | null> {
    // 1. Model-specific
    const specific = await this.db.getFirstAsync<DatabaseRow>(
      'SELECT * FROM command_definitions WHERE model_id = ? AND name = ?',
      [modelId, commandName],
    );
    if (specific) return rowToCommandDefinition(specific);

    // 2. Brand-level generic (model_id IS NULL)
    const generic = await this.db.getFirstAsync<DatabaseRow>(
      'SELECT * FROM command_definitions WHERE brand_id = ? AND model_id IS NULL AND name = ?',
      [brandId, commandName],
    );
    return generic ? rowToCommandDefinition(generic) : null;
  }

  async upsert(cmd: CommandDefinition): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO command_definitions
         (id, model_id, brand_id, name, label, icon, capability, sort_order,
          ir_pronto, ir_raw, ir_frequency, ir_protocol,
          wifi_method, wifi_endpoint, wifi_payload, wifi_headers,
          ble_service_uuid, ble_char_uuid, ble_value, ble_write_type,
          matter_cluster, matter_command, matter_payload, matter_endpoint,
          homekit_service, homekit_characteristic, homekit_value)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         label                  = excluded.label,
         icon                   = excluded.icon,
         capability             = excluded.capability,
         sort_order             = excluded.sort_order,
         ir_pronto              = excluded.ir_pronto,
         ir_raw                 = excluded.ir_raw,
         ir_frequency           = excluded.ir_frequency,
         ir_protocol            = excluded.ir_protocol,
         wifi_method            = excluded.wifi_method,
         wifi_endpoint          = excluded.wifi_endpoint,
         wifi_payload           = excluded.wifi_payload,
         wifi_headers           = excluded.wifi_headers,
         ble_service_uuid       = excluded.ble_service_uuid,
         ble_char_uuid          = excluded.ble_char_uuid,
         ble_value              = excluded.ble_value,
         ble_write_type         = excluded.ble_write_type,
         matter_cluster         = excluded.matter_cluster,
         matter_command         = excluded.matter_command,
         matter_payload         = excluded.matter_payload,
         matter_endpoint        = excluded.matter_endpoint,
         homekit_service        = excluded.homekit_service,
         homekit_characteristic = excluded.homekit_characteristic,
         homekit_value          = excluded.homekit_value`,
      [
        cmd.id,
        cmd.model_id ?? null,
        cmd.brand_id ?? null,
        cmd.name,
        cmd.label,
        cmd.icon ?? null,
        cmd.capability ?? null,
        cmd.sort_order ?? 0,
        cmd.ir_pronto ?? null,
        cmd.ir_raw ?? null,
        cmd.ir_frequency ?? null,
        cmd.ir_protocol ?? null,
        cmd.wifi_method ?? null,
        cmd.wifi_endpoint ?? null,
        cmd.wifi_payload ?? null,
        cmd.wifi_headers ?? null,
        cmd.ble_service_uuid ?? null,
        cmd.ble_char_uuid ?? null,
        cmd.ble_value ?? null,
        cmd.ble_write_type ?? null,
        cmd.matter_cluster ?? null,
        cmd.matter_command ?? null,
        cmd.matter_payload ?? null,
        cmd.matter_endpoint ?? null,
        cmd.homekit_service ?? null,
        cmd.homekit_characteristic ?? null,
        cmd.homekit_value ?? null,
      ],
    );
  }

  async upsertMany(commands: CommandDefinition[]): Promise<void> {
    for (const cmd of commands) {
      await this.upsert(cmd);
    }
  }
}

// ─── CatalogLayoutRepository ─────────────────────────────────────────────

export class CatalogLayoutRepository {
  constructor(private readonly db: Database) {}

  // ── Reads ──────────────────────────────────────────────────────────────

  async findById(id: string): Promise<CatalogLayout | null> {
    const row = await this.db.getFirstAsync<DatabaseRow>(
      'SELECT * FROM catalog_layouts WHERE id = ?',
      [id],
    );
    return row ? rowToCatalogLayout(row) : null;
  }

  /** All layouts (default first, then others) for a specific device model. */
  async findByModel(modelId: string): Promise<CatalogLayout[]> {
    const rows = await this.db.getAllAsync<DatabaseRow>(
      `SELECT * FROM catalog_layouts
       WHERE model_id = ?
       ORDER BY is_default DESC, name ASC`,
      [modelId],
    );
    return rows.map(rowToCatalogLayout);
  }

  /**
   * All layouts that apply to a brand+category combination but are NOT
   * model-specific (i.e. `model_id IS NULL`).
   * Used as fallback when no model-specific layout exists.
   */
  async findByBrandAndCategory(
    brandId: string,
    category: DeviceCategory,
  ): Promise<CatalogLayout[]> {
    const rows = await this.db.getAllAsync<DatabaseRow>(
      `SELECT * FROM catalog_layouts
       WHERE brand_id = ? AND category = ? AND model_id IS NULL
       ORDER BY is_default DESC, name ASC`,
      [brandId, category],
    );
    return rows.map(rowToCatalogLayout);
  }

  /**
   * Universal layouts for a category (no brand, no model).
   * Last-resort fallback.
   */
  async findByCategory(category: DeviceCategory): Promise<CatalogLayout[]> {
    const rows = await this.db.getAllAsync<DatabaseRow>(
      `SELECT * FROM catalog_layouts
       WHERE category = ? AND model_id IS NULL AND brand_id IS NULL
       ORDER BY is_default DESC, name ASC`,
      [category],
    );
    return rows.map(rowToCatalogLayout);
  }

  // ── Resolution ────────────────────────────────────────────────────────

  /**
   * Resolve the best `RemoteLayoutDefinition` for a device following the
   * three-tier fallback chain documented in §10.2:
   *
   *   1. Model-specific default layout  (`model_id` = modelId, `is_default` = 1)
   *   2. Brand + category default layout (`brand_id` = brandId, `category` = category, `model_id` IS NULL)
   *   3. Universal category layout      (`brand_id` IS NULL, `category` = category)
   *
   * Returns `null` when no layout is found at any level.
   */
  async resolve(
    modelId: string,
    brandId: string,
    category: DeviceCategory,
  ): Promise<RemoteLayoutDefinition | null> {
    // Tier 1 — model-specific default
    const modelDefault = await this.db.getFirstAsync<DatabaseRow>(
      `SELECT * FROM catalog_layouts
       WHERE model_id = ? AND is_default = 1
       LIMIT 1`,
      [modelId],
    );
    if (modelDefault) return parseCatalogLayout(rowToCatalogLayout(modelDefault));

    // Tier 2 — any model layout (non-default)
    const modelAny = await this.db.getFirstAsync<DatabaseRow>(
      `SELECT * FROM catalog_layouts
       WHERE model_id = ?
       ORDER BY is_default DESC
       LIMIT 1`,
      [modelId],
    );
    if (modelAny) return parseCatalogLayout(rowToCatalogLayout(modelAny));

    // Tier 3 — brand + category fallback
    const brandCategory = await this.db.getFirstAsync<DatabaseRow>(
      `SELECT * FROM catalog_layouts
       WHERE brand_id = ? AND category = ? AND model_id IS NULL
       ORDER BY is_default DESC
       LIMIT 1`,
      [brandId, category],
    );
    if (brandCategory) return parseCatalogLayout(rowToCatalogLayout(brandCategory));

    // Tier 4 — universal category layout
    const universal = await this.db.getFirstAsync<DatabaseRow>(
      `SELECT * FROM catalog_layouts
       WHERE category = ? AND model_id IS NULL AND brand_id IS NULL
       ORDER BY is_default DESC
       LIMIT 1`,
      [category],
    );
    if (universal) return parseCatalogLayout(rowToCatalogLayout(universal));

    return null;
  }

  // ── Writes ────────────────────────────────────────────────────────────

  async upsert(layout: CatalogLayout): Promise<void> {
    const ts = now();
    await this.db.runAsync(
      `INSERT INTO catalog_layouts
         (id, model_id, brand_id, category, name, columns, sections_json, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name          = excluded.name,
         columns       = excluded.columns,
         sections_json = excluded.sections_json,
         is_default    = excluded.is_default,
         updated_at    = excluded.updated_at`,
      [
        layout.id,
        layout.model_id ?? null,
        layout.brand_id ?? null,
        layout.category ?? null,
        layout.name,
        layout.columns,
        layout.sections_json,
        layout.is_default ? 1 : 0,
        layout.created_at ?? ts,
        ts,
      ],
    );
  }

  async upsertMany(layouts: CatalogLayout[]): Promise<void> {
    for (const layout of layouts) {
      await this.upsert(layout);
    }
  }

  /**
   * Mark a layout as the default for its model/brand+category scope.
   * Clears `is_default` on any other layout in the same scope first.
   */
  async setDefault(id: string): Promise<void> {
    const row = await this.db.getFirstAsync<DatabaseRow>(
      'SELECT model_id, brand_id, category FROM catalog_layouts WHERE id = ?',
      [id],
    );
    if (!row) return;

    if (row.model_id) {
      // Clear other defaults for the same model
      await this.db.runAsync(
        'UPDATE catalog_layouts SET is_default = 0 WHERE model_id = ? AND id != ?',
        [row.model_id as string, id],
      );
    } else {
      // Clear other defaults for the same brand+category scope
      await this.db.runAsync(
        `UPDATE catalog_layouts
         SET is_default = 0
         WHERE brand_id IS ? AND category IS ? AND model_id IS NULL AND id != ?`,
        [row.brand_id as string | null, row.category as string | null, id],
      );
    }

    await this.db.runAsync(
      'UPDATE catalog_layouts SET is_default = 1 WHERE id = ?',
      [id],
    );
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM catalog_layouts WHERE id = ?', [id]);
  }

  async deleteByModel(modelId: string): Promise<void> {
    await this.db.runAsync(
      'DELETE FROM catalog_layouts WHERE model_id = ?',
      [modelId],
    );
  }
}

// ─── CatalogRepository (facade) ──────────────────────────────────────────

/**
 * Facade that exposes all four catalog sub-repositories from a single object.
 *
 * ```ts
 * const catalog = new CatalogRepository(db);
 * const layout = await catalog.layouts.resolve(modelId, brandId, category);
 * const commands = await catalog.commands.findByModel(modelId);
 * ```
 */
export class CatalogRepository {
  readonly brands: BrandRepository;
  readonly models: DeviceModelRepository;
  readonly commands: CommandDefinitionRepository;
  readonly layouts: CatalogLayoutRepository;

  constructor(db: Database) {
    this.brands = new BrandRepository(db);
    this.models = new DeviceModelRepository(db);
    this.commands = new CommandDefinitionRepository(db);
    this.layouts = new CatalogLayoutRepository(db);
  }
}
