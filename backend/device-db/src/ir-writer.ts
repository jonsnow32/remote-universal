/**
 * Supabase writer for the IR code library tables.
 *
 * Takes raw IRRawEntry[] (from Flipper + IRDB parsers) and UPSERTs:
 *   ir_brands → ir_codesets → ir_codes
 *
 * Each unique (brand_slug, category) pair becomes one ir_brands row.
 * Each unique file_path becomes one ir_codesets row.
 * Each IRRawEntry becomes one ir_codes row.
 */

import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { IRRawEntry } from './types';
import { normaliseBrand, normaliseCategory } from './normalise';
import { protocolToPronto, PROTOCOL_CARRIER_HZ } from './parsers/prontoEncode';

const UPSERT_CHUNK = 500;

// ─── Row shapes ───────────────────────────────────────────────────────────────

interface IRBrandRow {
  id: string;
  name: string;
  category: string;
  catalog_brand_id: string;
  priority: number;
  code_count: number;
}

interface IRCodesetRow {
  id: string;
  brand_id: string;
  model_pattern: string | null;
  protocol_name: string | null;
  carrier_frequency_hz: number;
  source: string;
  match_confidence: number;
}

interface IRCodeRow {
  id: string;
  codeset_id: string;
  function_name: string;
  function_label: string | null;
  pronto_hex: string | null;
  raw_pattern: string | null;
  raw_frequency_hz: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Stable short hash from a string (8 hex chars). */
function shortHash(s: string): string {
  return crypto.createHash('sha1').update(s).digest('hex').slice(0, 8);
}

/** Make a human label from a snake_case function name. */
function functionLabel(name: string): string {
  return name
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/** Most common value in an array, or fallback when array is empty. */
function mostCommon<T>(arr: T[], fallback: T): T {
  if (arr.length === 0) return fallback;
  const freq = new Map<string, { val: T; count: number }>();
  for (const v of arr) {
    const key = String(v);
    const entry = freq.get(key);
    if (entry) entry.count++;
    else freq.set(key, { val: v, count: 1 });
  }
  let best = arr[0] as T;
  let bestCount = 0;
  for (const { val, count } of freq.values()) {
    if (count > bestCount) { best = val; bestCount = count; }
  }
  return best;
}

async function upsertChunked(
  client: SupabaseClient,
  table: string,
  rows: object[],
  onConflict: string,
): Promise<string[]> {
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK);
    const { error } = await client
      .from(table)
      .upsert(chunk, { onConflict, ignoreDuplicates: false });
    if (error) errors.push(`${table}[${i}]: ${error.message}`);
  }
  return errors;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function writeIREntries(
  entries: IRRawEntry[],
  client: SupabaseClient | undefined,
  dryRun = false,
): Promise<{ brands: number; codesets: number; codes: number; errors: string[] }> {
  const errors: string[] = [];

  // ── Group entries by file_path (one codeset per file) ────────────────────
  const byFile = new Map<string, IRRawEntry[]>();
  for (const e of entries) {
    const arr = byFile.get(e.file_path) ?? [];
    arr.push(e);
    byFile.set(e.file_path, arr);
  }

  // ── Build ir_brands rows ─────────────────────────────────────────────────
  // id = "{brand_slug}-{category}", e.g. "samsung-tv"
  const brandMap = new Map<string, IRBrandRow>();

  for (const fileEntries of byFile.values()) {
    if (fileEntries.length === 0) continue;
    const first = fileEntries[0]!;
    const brand = normaliseBrand(first.brand_raw);
    const category = normaliseCategory(first.category_raw);
    const id = `${brand.slug}-${category}`;

    if (!brandMap.has(id)) {
      brandMap.set(id, {
        id,
        name: brand.name,
        category,
        catalog_brand_id: brand.slug,
        priority: 0,
        code_count: 0,
      });
    }
  }

  // ── Build ir_codesets + ir_codes rows ────────────────────────────────────
  const codesetRows: IRCodesetRow[] = [];
  const codeRows: IRCodeRow[] = [];

  for (const [filePath, fileEntries] of byFile) {
    if (fileEntries.length === 0) continue;
    const first = fileEntries[0]!;
    const brand = normaliseBrand(first.brand_raw);
    const category = normaliseCategory(first.category_raw);
    const brandId = `${brand.slug}-${category}`;

    // Derive model pattern: prefer explicit hint (e.g. SmartIR supportedModels),
    // otherwise strip all known IR-source extensions from the filename.
    const modelPattern = first.model_hint
      ?? ((filePath.split(/[/\\]/).pop() ?? '')
           .replace(/\.ir$|\.csv$|\.json$/, '')
           .replace(/,/g, '_') || null);

    // Derive dominant protocol and frequency for this codeset
    const protocols = fileEntries
      .map(e => e.protocol)
      .filter((p): p is string => !!p);
    const freqs = fileEntries
      .map(e => e.frequency)
      .filter((f): f is number => f !== undefined && !isNaN(f));

    // Fall back to protocol-specific carrier when no explicit frequency in source data
    // (Flipper "parsed" entries carry no frequency field — use known protocol defaults)
    const dominantProtocol = mostCommon(protocols, null as unknown as string) || null;
    let codesetFreq = mostCommon(freqs, 0);
    if (codesetFreq === 0 && dominantProtocol) {
      codesetFreq = PROTOCOL_CARRIER_HZ[dominantProtocol.toUpperCase()] ?? 38_000;
    } else if (codesetFreq === 0) {
      codesetFreq = 38_000;
    }

    const codesetId = shortHash(`${brandId}/${filePath}`);

    codesetRows.push({
      id: codesetId,
      brand_id: brandId,
      model_pattern: modelPattern,
      protocol_name: dominantProtocol,
      carrier_frequency_hz: codesetFreq,
      source: first.source,
      match_confidence: modelPattern ? 0.5 : 0.3,
    });

    // Build ir_codes rows for each signal in this file
    for (const e of fileEntries) {
      if (!e.function_name) continue;

      const funcName = e.function_name.toUpperCase();
      const codeId = `${codesetId}_${funcName}`;

      // Build pronto hex
      let prontoHex: string | null = e.pronto ?? null;
      if (!prontoHex && e.type === 'parsed' && e.protocol && e.address && e.command) {
        // Encode protocol+address+command → Pronto Hex so the signal is not discarded.
        // Supported: NEC, NEC42, Samsung32, RC5/RC5X, Sony12/15/20
        prontoHex = protocolToPronto(e.protocol, e.address, e.command);
      }

      // Build raw pattern
      let rawPattern: string | null = null;
      let rawFrequency: number | null = null;
      if (e.type === 'raw' && e.raw_data && e.raw_data.length > 0) {
        rawPattern = JSON.stringify(e.raw_data);
        rawFrequency = e.frequency ?? 38000;
      }

      if (!prontoHex && !rawPattern) continue; // skip signals with no usable payload

      codeRows.push({
        id: codeId,
        codeset_id: codesetId,
        function_name: funcName,
        function_label: functionLabel(e.function_name),
        pronto_hex: prontoHex,
        raw_pattern: rawPattern,
        raw_frequency_hz: rawFrequency,
      });
    }
  }

  // Update code_count on brand rows
  const codesetCountByBrand = new Map<string, number>();
  for (const cs of codesetRows) {
    codesetCountByBrand.set(cs.brand_id, (codesetCountByBrand.get(cs.brand_id) ?? 0) + 1);
  }
  for (const [id, row] of brandMap) {
    row.code_count = codesetCountByBrand.get(id) ?? 0;
  }

  const brandRows = Array.from(brandMap.values());

  if (!dryRun && client) {
    // Ensure catalog brand stubs exist before writing ir_brands (FK constraint)
    const brandStubs = brandRows.map(b => ({
      id:         b.catalog_brand_id,
      name:       b.name,
      slug:       b.catalog_brand_id,
      created_at: Math.floor(Date.now() / 1000),
      updated_at: Math.floor(Date.now() / 1000),
    }));
    await upsertChunked(client, 'brands', brandStubs, 'id');

    const e1 = await upsertChunked(client, 'ir_brands',   brandRows,   'id');
    const e2 = await upsertChunked(client, 'ir_codesets', codesetRows, 'id');
    // Deduplicate code rows by id (same codeset may have duplicate function names)
    const codeMap = new Map<string, IRCodeRow>();
    for (const row of codeRows) codeMap.set(row.id, row);
    const dedupedCodes = Array.from(codeMap.values());
    const e3 = await upsertChunked(client, 'ir_codes', dedupedCodes, 'id');
    errors.push(...e1, ...e2, ...e3);
  }

  return {
    brands:   brandRows.length,
    codesets: codesetRows.length,
    codes:    codeRows.length,
    errors,
  };
}
