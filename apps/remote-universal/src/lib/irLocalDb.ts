/**
 * Local SQLite implementation of the IR code lookup API.
 *
 * This module mirrors the query logic in backend/api/src/routes/ir.ts but runs
 * entirely on-device using a bundled SQLite database (assets/ir.db).
 *
 * Lifecycle:
 *   1. App.tsx wraps the tree with <SQLiteProvider>.
 *   2. An IRDbBridge component inside the provider calls _initIRLocalDb(db).
 *   3. From that point on, all irApi.ts calls use local SQLite — zero network.
 *
 * If the DB is not yet initialised (before bridge mounts) every function throws
 * so irApi.ts can catch and fall back to the HTTP API.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  IRBrandEntry,
  IRCodeset,
  IRCodeEntry,
  IRResolveResult,
} from './irApi';

// ─── Singleton ────────────────────────────────────────────────────────────────

let _db: SQLiteDatabase | null = null;

/** Called once from App.tsx → IRDbBridge after the SQLiteProvider mounts. */
export function _initIRLocalDb(db: SQLiteDatabase): void {
  _db = db;
}

/** True once the DB is ready. Used by irApi.ts to decide the code path. */
export function isIRLocalDbReady(): boolean {
  return _db !== null;
}

function requireDb(): SQLiteDatabase {
  if (!_db) throw new Error('IRLocalDb: not initialised');
  return _db;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build SQL IN-list placeholder: placeholders(3) → "?,?,?" */
function ph(count: number): string {
  return Array(count).fill('?').join(',');
}

// ─── Model-pattern scoring (mirrors backend scoreModelPattern) ────────────────

function scoreModelPattern(modelNumber: string, pattern: string | null | undefined): number {
  if (!pattern || pattern === '*') return 0.3;
  const m = modelNumber.toUpperCase().trim();
  const p = pattern.toUpperCase().trim();
  if (m === p) return 1.0;
  // prefix wildcard: "QN85*"
  if (p.endsWith('*') && !p.startsWith('*') && m.startsWith(p.slice(0, -1))) return 0.7;
  // suffix wildcard: "*QN85"
  if (p.startsWith('*') && !p.endsWith('*') && m.endsWith(p.slice(1))) return 0.7;
  // contains wildcard: "*QN85*"
  if (p.startsWith('*') && p.endsWith('*') && m.includes(p.slice(1, -1))) return 0.6;
  return -1; // no match
}

// ─── Function aliases (mirrors backend FUNCTION_ALIASES) ─────────────────────

const FUNCTION_ALIASES: Record<string, string[]> = {
  POWER:        ['POWER', 'POWER_TOGGLE', 'BTN_POWER', 'KEY_POWER', 'ON_OFF', 'PWR'],
  POWER_ON:     ['POWER_ON', 'ON', 'KEY_POWER_ON'],
  POWER_OFF:    ['POWER_OFF', 'OFF', 'KEY_POWER_OFF', 'STANDBY'],
  VOLUME_UP:    ['VOL_UP', 'VOLUME_UP', 'VOL+', 'KEY_VOLUMEUP'],
  VOLUME_DOWN:  ['VOL_DOWN', 'VOLUME_DOWN', 'VOL-', 'KEY_VOLUMEDOWN'],
  MUTE:         ['MUTE', 'MUTE_TOGGLE', 'KEY_MUTE'],
  CHANNEL_UP:   ['CH_UP', 'CHANNEL_UP', 'CH+', 'KEY_CHANNELUP'],
  CHANNEL_DOWN: ['CH_DOWN', 'CHANNEL_DOWN', 'CH-', 'KEY_CHANNELDOWN'],
  DPAD_UP:      ['UP', 'ARROW_UP', 'KEY_UP', 'DPAD_UP'],
  DPAD_DOWN:    ['DOWN', 'ARROW_DOWN', 'KEY_DOWN', 'DPAD_DOWN'],
  DPAD_LEFT:    ['LEFT', 'ARROW_LEFT', 'KEY_LEFT', 'DPAD_LEFT'],
  DPAD_RIGHT:   ['RIGHT', 'ARROW_RIGHT', 'KEY_RIGHT', 'DPAD_RIGHT'],
  DPAD_OK:      ['OK', 'ENTER', 'SELECT', 'KEY_OK', 'KEY_ENTER'],
  BACK:         ['BACK', 'RETURN', 'KEY_BACK', 'KEY_RETURN'],
  HOME:         ['HOME', 'KEY_HOME', 'KEY_HOMEPAGE'],
  MENU:         ['MENU', 'KEY_MENU', 'SETTINGS'],
  INPUT:        ['INPUT', 'SOURCE', 'INPUT_SELECT', 'KEY_INPUT'],
  TEMP_UP:      ['TEMP_UP', 'TEMPERATURE_UP', 'TEMP_INC', 'TEMP_INCREASE', 'WARMER'],
  TEMP_DOWN:    ['TEMP_DOWN', 'TEMPERATURE_DOWN', 'TEMP_DEC', 'TEMP_DECREASE', 'COOLER'],
  MODE_COOL:    ['MODE_COOL', 'COOL', 'COOL_MODE', 'SET_COOL', 'AC_COOL'],
  MODE_HEAT:    ['MODE_HEAT', 'HEAT', 'HEAT_MODE', 'SET_HEAT', 'AC_HEAT'],
  MODE_DRY:     ['MODE_DRY', 'DRY', 'DRY_MODE', 'SET_DRY', 'DEHUMIDIFY'],
  MODE_FAN:     ['MODE_FAN', 'FAN_ONLY', 'FAN_MODE', 'SET_FAN_ONLY'],
  MODE_AUTO:    ['MODE_AUTO', 'AUTO', 'AUTO_MODE', 'SET_AUTO'],
  FAN_AUTO:     ['FAN_AUTO', 'FAN_SPEED_AUTO', 'FAN_AUTOMATIC', 'FAN_SPEED_0'],
  FAN_LOW:      ['FAN_LOW', 'FAN_QUIET', 'FAN_SPEED_1', 'FAN_SPEED_LOW'],
  FAN_MED:      ['FAN_MED', 'FAN_MEDIUM', 'FAN_SPEED_3', 'FAN_SPEED_MED'],
  FAN_HIGH:     ['FAN_HIGH', 'FAN_MAX', 'FAN_SPEED_5', 'FAN_SPEED_HIGH'],
  SWING_ON:     ['SWING_ON', 'SWING_AUTO', 'SWING_VERTICAL_ON', 'LOUVER_ON', 'VANE_ON'],
  SWING_OFF:    ['SWING_OFF', 'SWING_VERTICAL_OFF', 'LOUVER_OFF', 'VANE_OFF'],
};

function expandAliases(name: string): string[] {
  const upper = name.toUpperCase();
  return FUNCTION_ALIASES[upper] ?? [upper, `BTN_${upper}`, `KEY_${upper}`];
}

// ─── IR payload builder ───────────────────────────────────────────────────────

type CodeRow = {
  pronto_hex: string | null;
  raw_pattern: string | null;
  raw_frequency_hz: number | null;
};

function buildPayload(row: CodeRow): IRResolveResult {
  if (row.pronto_hex) return { payload: row.pronto_hex, format: 'pronto_hex' };
  if (row.raw_pattern) {
    const freq = row.raw_frequency_hz ?? 38000;
    return {
      payload: JSON.stringify({ frequency: freq, pattern: JSON.parse(row.raw_pattern) }),
      format: 'raw_json',
    };
  }
  return { payload: null, format: null };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchIRBrands(category?: string): Promise<IRBrandEntry[]> {
  const d = requireDb();
  if (category) {
    return d.getAllSync<IRBrandEntry>(
      'SELECT id, name, category, catalog_brand_id, priority, code_count FROM ir_brands WHERE category = ? ORDER BY priority DESC, name ASC',
      [category],
    );
  }
  return d.getAllSync<IRBrandEntry>(
    'SELECT id, name, category, catalog_brand_id, priority, code_count FROM ir_brands ORDER BY priority DESC, name ASC',
    [],
  );
}

export async function fetchIRCodesets(
  brand: string,
  category: string,
  model?: string,
): Promise<IRCodeset[]> {
  const d = requireDb();

  const irBrands = d.getAllSync<{ id: string }>(
    'SELECT id FROM ir_brands WHERE catalog_brand_id = ? AND category = ?',
    [brand, category],
  );
  if (irBrands.length === 0) return [];

  const brandIds = irBrands.map(b => b.id);
  const codesets = d.getAllSync<IRCodeset>(
    `SELECT id, brand_id, model_pattern, protocol_name, carrier_frequency_hz, source, match_confidence
     FROM ir_codesets WHERE brand_id IN (${ph(brandIds.length)})
     ORDER BY match_confidence DESC LIMIT 100`,
    brandIds,
  );

  if (!model) return codesets;

  return codesets
    .map(cs => ({ ...cs, _score: scoreModelPattern(model, cs.model_pattern) }))
    .filter(cs => (cs._score ?? -1) >= 0)
    .sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
}

export async function fetchIRCodes(codesetId: string): Promise<IRCodeEntry[]> {
  return requireDb().getAllSync<IRCodeEntry>(
    'SELECT id, codeset_id, function_name, function_label, pronto_hex, raw_pattern, raw_frequency_hz FROM ir_codes WHERE codeset_id = ? ORDER BY function_name',
    [codesetId],
  );
}

export async function resolveIRCommand(params: {
  brand: string;
  category: string;
  model?: string;
  command: string;
  codesetId?: string;
}): Promise<IRResolveResult> {
  const d = requireDb();
  const { brand, category, model, command, codesetId } = params;
  const aliases = expandAliases(command);

  // ── Fast path: known codeset ─────────────────────────────────────────────
  if (codesetId) {
    const code = d.getFirstSync<CodeRow>(
      `SELECT pronto_hex, raw_pattern, raw_frequency_hz FROM ir_codes
       WHERE codeset_id = ? AND function_name IN (${ph(aliases.length)}) LIMIT 1`,
      [codesetId, ...aliases],
    );
    if (code) return { ...buildPayload(code), codesetId };
  }

  // ── Slow path: find best-matching codeset ────────────────────────────────
  const irBrands = d.getAllSync<{ id: string }>(
    'SELECT id FROM ir_brands WHERE catalog_brand_id = ? AND category = ?',
    [brand, category],
  );
  if (irBrands.length === 0) return { payload: null, format: null };

  const brandIds = irBrands.map(b => b.id);
  const codesets = d.getAllSync<{ id: string; model_pattern: string | null }>(
    `SELECT id, model_pattern FROM ir_codesets WHERE brand_id IN (${ph(brandIds.length)})
     ORDER BY match_confidence DESC LIMIT 50`,
    brandIds,
  );

  const ranked = codesets
    .map(cs => ({ id: cs.id, score: scoreModelPattern(model ?? '', cs.model_pattern) }))
    .filter(cs => cs.score >= 0)
    .sort((a, b) => b.score - a.score);

  for (const { id: csId } of ranked) {
    const code = d.getFirstSync<CodeRow>(
      `SELECT pronto_hex, raw_pattern, raw_frequency_hz FROM ir_codes
       WHERE codeset_id = ? AND function_name IN (${ph(aliases.length)}) LIMIT 1`,
      [csId, ...aliases],
    );
    if (code) return { ...buildPayload(code), codesetId: csId };
  }

  return { payload: null, format: null };
}
