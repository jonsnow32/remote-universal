/**
 * Static Device Catalog Types
 *
 * These types represent the read-only, normalized device catalog — brand
 * definitions, device models, command definitions, and layout definitions.
 * The catalog is either bundled with the app or fetched from the backend
 * `device-db` service, then cached locally in SQLite.
 *
 * Catalog data is shared across all users and never user-modified directly.
 * User customisations are stored in UserData.ts.
 */

import type { SupportedProtocol, DeviceCapability } from './Device';
import type { RemoteLayoutDefinition } from './RemoteLayout';

// ─── Device Categories ─────────────────────────────────────────────────────

export type DeviceCategory =
  | 'tv'
  | 'ac'
  | 'speaker'
  | 'light'
  | 'fan'
  | 'projector'
  | 'set_top_box'
  | 'streaming_stick'
  | 'soundbar'
  | 'receiver'
  | 'dvd_bluray'
  | 'hub'
  | 'other';

// ─── Catalog Source ────────────────────────────────────────────────────────

/**
 * Where a catalog entry originated from.
 * - `official`   OEM-supplied command data
 * - `irdb`       Open-source IRDB dataset
 * - `flipper`    Flipper Zero IR library
 * - `community`  Community-contributed via the remote-universal repo
 * - `manual`     Manually captured by the user
 */
export type CatalogSource = 'official' | 'irdb' | 'flipper' | 'community' | 'manual';

// ─── Brand ─────────────────────────────────────────────────────────────────

/**
 * A device brand/manufacturer.
 *
 * One brand may appear under multiple slugs (e.g. 'samsung', 'samsung-tv',
 * 'samsung-audio') — use `canonical_id` to point to the primary record.
 */
export interface Brand {
  /** Stable unique identifier, e.g. 'samsung' */
  id: string;
  /** Display name, e.g. 'Samsung' */
  name: string;
  /** URL-safe slug, e.g. 'samsung' */
  slug: string;
  /** Local asset URI or remote HTTPS URL */
  logo_uri?: string;
  /** ISO 3166-1 alpha-2 country of HQ, e.g. 'KR' */
  country?: string;
  /** Brand website */
  website?: string;
  /** If this record is an alias, points to the primary brand id */
  canonical_id?: string;
  /** Unix timestamp (seconds) */
  created_at: number;
  /** Unix timestamp (seconds) */
  updated_at: number;
}

// ─── Device Model ──────────────────────────────────────────────────────────

/**
 * A specific device model from a brand.
 *
 * One record covers a model that may span multiple years when the
 * command set is identical (use `year_from` / `year_to`).
 *
 * The `protocols` array is ordered — the first entry is the preferred
 * protocol for this model (matches the runtime `CommandDispatcher` logic).
 */
export interface DeviceModel {
  /**
   * Stable unique id, e.g. 'samsung.qled-qn85b-2022'
   * Format: '<brand_slug>.<model_slug>[-<year>]'
   */
  id: string;
  /** FK → Brand.id */
  brand_id: string;
  /** Official model number, e.g. 'QN85B' */
  model_number: string;
  /** Human-readable model name, e.g. 'QLED 85" QN85B' */
  model_name: string;
  /** Product category */
  category: DeviceCategory;
  /** First model year (inclusive), e.g. 2022 */
  year_from?: number;
  /** Last model year (inclusive). Null = still current production. */
  year_to?: number;
  /** Ordered protocols (first = preferred) */
  protocols: SupportedProtocol[];
  /** Device capabilities for this model */
  capabilities: DeviceCapability[];
  /** Thumbnail image — local asset URI or remote HTTPS URL */
  thumbnail_uri?: string;
  /** Origin of this catalog entry */
  source: CatalogSource;
  /** Opaque version string for OTA catalog updates */
  catalog_version?: string;
  /** Unix timestamp (seconds) */
  created_at: number;
  /** Unix timestamp (seconds) */
  updated_at: number;
}

// ─── Command Definition ────────────────────────────────────────────────────

/**
 * Commands are stored with per-protocol payloads in a single row.
 * All protocol payload fields are optional — only the supported protocols
 * for the model will have values.
 *
 * A command can belong to a specific model (`model_id`) or be a generic
 * brand-level command (`model_id` null, `brand_id` set) that applies to
 * all models of that brand which support the command name.
 */
export interface CommandDefinition {
  /** Unique id, e.g. 'samsung.qled-qn85b-2022.power_on' */
  id: string;
  /** FK → DeviceModel.id. Null = brand-level generic command. */
  model_id: string | null;
  /** FK → Brand.id. Required when model_id is null. */
  brand_id?: string;
  /**
   * Machine-readable command name, e.g. 'power_on', 'vol_up', 'ch_3'.
   * Used as lookup key in CommandDispatcher.
   */
  name: string;
  /** Display label, e.g. 'Power On', 'Vol +', '3' */
  label: string;
  /** Icon name (SF Symbols / Material Icons), e.g. 'power' */
  icon?: string;
  /** High-level grouping for this command */
  capability?: DeviceCapability;
  /** Within a capability group, display sort order */
  sort_order?: number;

  // ── IR ──────────────────────────────────────────────────────────────────
  /** Pronto Hex encoded IR signal, e.g. '0000 006C 0022 ...' */
  ir_pronto?: string;
  /**
   * Raw IR pattern JSON: { frequency: number (Hz), pattern: number[] }
   * where pattern is an alternating on/off sequence in microseconds.
   */
  ir_raw?: string;
  /** Carrier frequency in Hz (default 38000). Stored separately for quick access. */
  ir_frequency?: number;
  /** IR protocol name, e.g. 'NEC', 'RC5', 'Samsung32' */
  ir_protocol?: string;

  // ── Wi-Fi / HTTP ─────────────────────────────────────────────────────────
  /** HTTP method, e.g. 'POST', 'GET' */
  wifi_method?: string;
  /** Endpoint path or template, e.g. '/api/v2/device/{id}/command' */
  wifi_endpoint?: string;
  /**
   * JSON body template. Use {value} placeholder for dynamic values.
   * e.g. '{"key":"volumeUp","value":null}'
   */
  wifi_payload?: string;
  /** Required HTTP headers as JSON object, e.g. '{"Content-Type":"application/json"}' */
  wifi_headers?: string;

  // ── BLE ──────────────────────────────────────────────────────────────────
  /** BLE service UUID */
  ble_service_uuid?: string;
  /** BLE characteristic UUID to write to */
  ble_char_uuid?: string;
  /** Base64-encoded GATT value */
  ble_value?: string;
  /** BLE write type: 'withResponse' | 'withoutResponse' */
  ble_write_type?: 'withResponse' | 'withoutResponse';

  // ── Matter ────────────────────────────────────────────────────────────────
  /** Matter cluster ID (decimal) */
  matter_cluster?: number;
  /** Matter command ID (decimal) */
  matter_command?: number;
  /** JSON payload for Matter command */
  matter_payload?: string;
  /** Matter endpoint number (default 1) */
  matter_endpoint?: number;

  // ── HomeKit ───────────────────────────────────────────────────────────────
  /** HomeKit service type, e.g. 'Lightbulb', 'Thermostat' */
  homekit_service?: string;
  /** HomeKit characteristic, e.g. 'On', 'Brightness' */
  homekit_characteristic?: string;
  /** JSON-serialized value to write */
  homekit_value?: string;
}

// ─── Layout Definition ─────────────────────────────────────────────────────

/**
 * A remote layout stored in the catalog.
 * Wraps `RemoteLayoutDefinition` with catalog metadata.
 *
 * A layout can be model-specific (`model_id` set) or shared across a
 * category (`model_id` null, `category` set).
 */
export interface CatalogLayout {
  /** Unique id, e.g. 'samsung.tv.default' */
  id: string;
  /** FK → DeviceModel.id. Null = shared/generic layout. */
  model_id: string | null;
  /** Category this layout applies to when model_id is null */
  category?: DeviceCategory;
  /** FK → Brand.id. Null = universal layout. */
  brand_id?: string;
  /** Descriptive name, e.g. 'Default TV Remote' */
  name: string;
  /** Number of grid columns (typically 4–6) */
  columns: number;
  /** JSON-serialised RemoteLayoutDefinition.sections */
  sections_json: string;
  /** True if this is the default layout to load for the model/category */
  is_default: boolean;
  /** Unix timestamp (seconds) */
  created_at: number;
  /** Unix timestamp (seconds) */
  updated_at: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Deserialise a `CatalogLayout` into a full `RemoteLayoutDefinition`.
 */
export function parseCatalogLayout(layout: CatalogLayout): RemoteLayoutDefinition {
  return {
    id: layout.id,
    name: layout.name,
    columns: layout.columns,
    sections: JSON.parse(layout.sections_json),
  };
}
