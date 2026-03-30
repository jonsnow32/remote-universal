/**
 * Client for IR code lookup.
 *
 * Strategy: use the bundled local SQLite database (irLocalDb) when it has been
 * initialised (i.e. after the SQLiteProvider in App.tsx mounts).  Falls back to
 * the backend HTTP API if the local DB is not yet ready or has no data — useful
 * during development before running the export script.
 */
import { getApiBaseUrl } from './apiUrl';
import {
  isIRLocalDbReady,
  fetchIRBrands as localFetchIRBrands,
  fetchIRCodesets as localFetchIRCodesets,
  fetchIRCodes as localFetchIRCodes,
  resolveIRCommand as localResolveIRCommand,
} from './irLocalDb';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IRBrandEntry {
  id: string;
  name: string;
  category: string;
  catalog_brand_id: string | null;
  priority: number;
  code_count: number;
}

export interface IRCodeset {
  id: string;
  brand_id: string;
  model_pattern: string | null;
  protocol_name: string | null;
  carrier_frequency_hz: number;
  source: string;
  match_confidence: number;
  _score?: number;
}

export interface IRCodeEntry {
  id: string;
  codeset_id: string;
  function_name: string;
  function_label: string | null;
  pronto_hex: string | null;
  raw_pattern: string | null;
  raw_frequency_hz: number | null;
}

export interface IRResolveResult {
  payload: string | null;
  format: 'pronto_hex' | 'raw_json' | null;
  codesetId?: string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const base = await getApiBaseUrl();
  const res = await fetch(`${base}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`IR API ${path} → HTTP ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const base = await getApiBaseUrl();
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`IR API POST ${path} → HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Public functions ─────────────────────────────────────────────────────────

/** List brands that have IR codes for a given device category. */
export async function fetchIRBrands(category?: string): Promise<IRBrandEntry[]> {
  if (isIRLocalDbReady()) {
    return localFetchIRBrands(category);
  }
  const qs = category ? `?category=${encodeURIComponent(category)}` : '';
  const data = await get<{ brands: IRBrandEntry[] }>(`/api/ir/brands${qs}`);
  return data.brands;
}

/**
 * List codesets for a brand+category, ranked by model pattern match.
 * Pass `model` (e.g. "QN85B") for better ranking.
 */
export async function fetchIRCodesets(
  brand: string,
  category: string,
  model?: string,
): Promise<IRCodeset[]> {
  if (isIRLocalDbReady()) {
    return localFetchIRCodesets(brand, category, model);
  }
  const params = new URLSearchParams({ brand, category });
  if (model) params.set('model', model);
  const data = await get<{ codesets: IRCodeset[] }>(`/api/ir/codesets?${params.toString()}`);
  return data.codesets;
}

/** List all IR command codes in a codeset (for display / brute-force). */
export async function fetchIRCodes(codesetId: string): Promise<IRCodeEntry[]> {
  if (isIRLocalDbReady()) {
    return localFetchIRCodes(codesetId);
  }
  const data = await get<{ codes: IRCodeEntry[] }>(
    `/api/ir/codes?codesetId=${encodeURIComponent(codesetId)}`,
  );
  return data.codes;
}

/**
 * Resolve a semantic command (e.g. "POWER_TOGGLE") into an IR payload.
 * Uses codesetId for fast lookup when available; falls back to brand+model search.
 *
 * Returns null payload when the command is not found in any matching codeset.
 */
export async function resolveIRCommand(params: {
  brand: string;
  category: string;
  model?: string;
  command: string;
  codesetId?: string;
}): Promise<IRResolveResult> {
  if (isIRLocalDbReady()) {
    return localResolveIRCommand(params);
  }
  try {
    const result = await post<IRResolveResult>('/api/ir/resolve', params);
    return result;
  } catch (err) {
    // 404 is expected when command not in DB — propagate as null payload
    if (err instanceof Error && err.message.includes('HTTP 404')) {
      return { payload: null, format: null };
    }
    throw err;
  }
}
