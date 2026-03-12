/**
 * Pipeline types for the device-db crawl and import service.
 *
 * Data flows through these stages:
 *   Fetch → Parse → Normalise → Deduplicate → Match → Write → Snapshot
 */

// ─── Source Registry ──────────────────────────────────────────────────────

export type SourceId =
  | 'samsung_api'
  | 'lg_api'
  | 'sony_api'
  | 'philips_api'
  | 'panasonic_api'
  | 'hisense_api'
  | 'vizio_api'
  | 'roku_ecp'
  | 'android_tv'
  | 'fire_tv'
  | 'irdb'
  | 'flipper'
  | 'ha_components';

export interface SourceConfig {
  id: SourceId;
  label: string;
  /** Crawl tier — lower = higher priority and more frequent refresh */
  tier: 1 | 2 | 3;
  enabled: boolean;
  /** Cron schedule string (node-cron format) */
  schedule: string;
}

export const SOURCE_REGISTRY: SourceConfig[] = [
  { id: 'irdb',         label: 'IRDB (probonopd)',      tier: 1, enabled: true,  schedule: '0 2 * * 0' },   // weekly Sunday 02:00
  { id: 'flipper',      label: 'Flipper Zero IRDB',     tier: 1, enabled: true,  schedule: '0 3 * * 0' },   // weekly Sunday 03:00
  { id: 'samsung_api',  label: 'Samsung SmartThings',   tier: 2, enabled: true,  schedule: '0 1 * * 1' },   // Monday 01:00
  { id: 'lg_api',       label: 'LG ThinQ / WebOS',      tier: 2, enabled: true,  schedule: '0 1 * * 2' },
  { id: 'sony_api',     label: 'Sony BRAVIA',           tier: 2, enabled: true,  schedule: '0 1 * * 3' },
  { id: 'roku_ecp',     label: 'Roku ECP',              tier: 2, enabled: true,  schedule: '0 1 * * 4' },
  { id: 'hisense_api',  label: 'Hisense RemoteNow',     tier: 3, enabled: true,  schedule: '0 2 * * 1' },
  { id: 'vizio_api',    label: 'Vizio SmartCast',       tier: 3, enabled: true,  schedule: '0 2 * * 2' },
  { id: 'philips_api',  label: 'Philips JointSpace',    tier: 3, enabled: true,  schedule: '0 2 * * 3' },
  { id: 'panasonic_api',label: 'Panasonic Viera NCTRL', tier: 3, enabled: true,  schedule: '0 2 * * 4' },
  { id: 'android_tv',   label: 'Android TV',            tier: 2, enabled: true,  schedule: '0 1 * * 5' },
  { id: 'ha_components',label: 'Home Assistant',        tier: 3, enabled: false, schedule: '0 4 * * 0' },
];

// ─── Stage 1: Fetch ───────────────────────────────────────────────────────

export interface FetchResult {
  source: SourceId;
  /** Optional brand context when fetching brand-specific data (e.g. IRDB sub-folder) */
  brand?: string;
  /** Category context (e.g. 'TV', 'AC') */
  category?: string;
  /** Path to the cached file on disk */
  cacheFile: string;
  /** Raw fetched content */
  content: string;
  /** Unix timestamp ms */
  fetchedAt: number;
}

// ─── Stage 2: Parse ───────────────────────────────────────────────────────

export type ControlType =
  | 'ir'
  | 'wifi_rest'
  | 'wifi_ws'
  | 'soap'
  | 'adb'
  | 'ecp'
  | 'ble';

export interface OEMRawCommand {
  name: string;
  /** HTTP method for REST/SOAP commands */
  method?: string;
  /** Endpoint path or WebSocket URI */
  endpoint?: string;
  /** Request body / payload */
  payload?: string;
  /** HTTP headers as JSON string */
  headers?: string;
  /** Sony IRCC Base64-encoded IR code */
  ircc_code?: string;
  /** Android TV ADB keyevent integer */
  adb_keycode?: number;
  /** Roku ECP key name (e.g. 'VolumeUp') */
  ecp_key?: string;
  /** SOAP action header */
  soap_action?: string;
  /** SOAP body fragment */
  soap_body?: string;
}

export interface OEMRawDevice {
  source: SourceId;
  manufacturer: string;
  model_number: string;
  model_name: string;
  series?: string;
  category: string;
  year?: number;
  control_type: ControlType;
  capabilities?: string[];
  commands: OEMRawCommand[];
}

/** Entry from a raw IR database (IRDB / Flipper) */
export interface IRRawEntry {
  source: SourceId;
  brand_raw: string;
  category_raw: string;
  /** Original file path for debugging / dedup */
  file_path: string;
  function_name: string;
  type: 'parsed' | 'raw';
  /** For type='parsed' */
  protocol?: string;
  /** Address bytes e.g. "07 00 00 00" */
  address?: string;
  /** Command bytes e.g. "02 00 00 00" */
  command?: string;
  /** For type='raw' */
  frequency?: number;
  /** Raw timing pattern in µs (alternating on/off) */
  raw_data?: number[];
  /** Pronto hex string when pre-encoded in source */
  pronto?: string;
}

// ─── Stage 3: Normalise ───────────────────────────────────────────────────

export interface NormalisedCommand {
  name: string;
  label: string;
  capability?: string;
  sort_order?: number;
  // IR
  ir_pronto?: string;
  ir_protocol?: string;
  ir_frequency?: number;
  ir_raw?: string;
  // WiFi / REST
  wifi_method?: string;
  wifi_endpoint?: string;
  wifi_payload?: string;
  wifi_headers?: string;
  // ADB (Android TV)
  adb_keycode?: number;
  // ECP (Roku)
  ecp_key?: string;
  // SOAP
  soap_action?: string;
  soap_body?: string;
}

export interface NormalisedModelEntry {
  source: SourceId;
  brand_slug: string;
  brand_name: string;
  brand_country?: string;
  model_number: string;
  model_name: string;
  /** Normalised DeviceCategory string */
  category: string;
  year_from?: number;
  year_to?: number;
  protocols: string[];
  capabilities: string[];
  commands: NormalisedCommand[];
  /** Set during dedup — canonical key used to merge duplicates */
  dedupe_key?: string;
}

/** Entry after brand + model IDs have been resolved */
export interface MatchedEntry extends NormalisedModelEntry {
  brand_id: string;
  model_id: string;
  match_confidence: number;
}

// ─── Pipeline run options ─────────────────────────────────────────────────

export interface PipelineOptions {
  sources?: SourceId[];
  cacheDir?: string;
  dryRun?: boolean;
  skipFetch?: boolean;
  verbose?: boolean;
}

export interface PipelineResult {
  source: SourceId;
  fetchedAt: number;
  parsed: number;
  normalised: number;
  deduplicated: number;
  written: number;
  errors: string[];
  durationMs: number;
}
