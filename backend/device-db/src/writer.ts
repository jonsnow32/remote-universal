/**
 * Supabase writer.
 *
 * Takes de-duplicated NormalisedModelEntry[] and UPSERTs:
 *   brands → device_models → command_definitions
 *
 * Uses the Supabase service role key, so writes bypass Row Level Security.
 * All timestamps are Unix seconds (consistent with the SQLite schema).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalisedModelEntry, NormalisedCommand } from './types';
import type { BrandRow, DeviceModelRow, CommandDefinitionRow } from './db';
import { brandLogoUri } from './normalise';

const UPSERT_CHUNK = 200; // rows per upsert batch to stay under Supabase body limits

export async function writeEntries(
  entries: NormalisedModelEntry[],
  client: SupabaseClient | undefined,
  catalogVersion: string,
  dryRun = false
): Promise<{ brands: number; models: number; commands: number; errors: string[] }> {
  const now = Math.floor(Date.now() / 1000);
  const errors: string[] = [];

  // ── Build unique brand rows ─────────────────────────────────────────────
  const brandMap = new Map<string, BrandRow>();
  for (const entry of entries) {
    if (!brandMap.has(entry.brand_slug)) {
      brandMap.set(entry.brand_slug, {
        id:         entry.brand_slug,
        name:       entry.brand_name,
        slug:       entry.brand_slug,
        logo_uri:   brandLogoUri(entry.brand_slug),
        country:    entry.brand_country,
        created_at: now,
        updated_at: now,
      });
    }
  }

  // ── Write brands ────────────────────────────────────────────────────────
  const brandRows = Array.from(brandMap.values());
  if (!dryRun) {
    const err = await upsertChunked(client, 'brands', brandRows, ['id']);
    errors.push(...err);
  }

  // ── Build model + command rows ──────────────────────────────────────────
  const modelRows: DeviceModelRow[] = [];
  const commandRows: CommandDefinitionRow[] = [];

  for (const entry of entries) {
    const modelId = buildModelId(entry);

    modelRows.push({
      id:              modelId,
      brand_id:        entry.brand_slug,
      model_number:    entry.model_number,
      model_name:      entry.model_name,
      category:        entry.category,
      year_from:       entry.year_from,
      year_to:         entry.year_to,
      protocols:       JSON.stringify(entry.protocols),
      capabilities:    JSON.stringify(entry.capabilities),
      source:          entry.source,
      catalog_version: catalogVersion,
      created_at:      now,
      updated_at:      now,
    });

    for (let i = 0; i < entry.commands.length; i++) {
      const cmd = entry.commands[i]!;
      commandRows.push(buildCommandRow(cmd, modelId, entry.brand_slug, i, now));
    }
  }

  // ── Write device_models ─────────────────────────────────────────────────
  if (!dryRun) {
    const err = await upsertChunked(client, 'device_models', modelRows, ['id']);
    errors.push(...err);
  }

  // ── Write command_definitions ───────────────────────────────────────────
  if (!dryRun) {
    // Deduplicate by id within the batch — keeps last occurrence.
    // (Multiple IR entries for the same model+command name would otherwise
    // cause "ON CONFLICT DO UPDATE command cannot affect row a second time".)
    const cmdMap = new Map<string, CommandDefinitionRow>();
    for (const row of commandRows) cmdMap.set(row.id, row);
    const dedupedCommandRows = Array.from(cmdMap.values());

    const err = await upsertChunked(client, 'command_definitions', dedupedCommandRows, ['id']);
    errors.push(...err);
  }

  return {
    brands:   brandRows.length,
    models:   modelRows.length,
    commands: commandRows.length,
    errors,
  };
}

// ─── Row builders ─────────────────────────────────────────────────────────

function buildModelId(entry: NormalisedModelEntry): string {
  const model = entry.model_number
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${entry.brand_slug}.${model}`;
}

function buildCommandRow(
  cmd: NormalisedCommand,
  modelId: string,
  brandId: string,
  sortIndex: number,
  now: number
): CommandDefinitionRow {
  const id = `${modelId}.${cmd.name}`;

  const row: CommandDefinitionRow = {
    id,
    model_id:   modelId,
    brand_id:   brandId,
    name:       cmd.name,
    label:      cmd.label,
    capability: cmd.capability,
    sort_order: cmd.sort_order ?? sortIndex,
    // IR
    ir_pronto:    cmd.ir_pronto,
    ir_raw:       cmd.ir_raw,
    ir_frequency: cmd.ir_frequency,
    ir_protocol:  cmd.ir_protocol,
    // WiFi
    wifi_method:   cmd.wifi_method,
    wifi_endpoint: cmd.wifi_endpoint,
    wifi_payload:  cmd.wifi_payload,
    wifi_headers:  cmd.wifi_headers,
  };

  // Encode ADB and ECP into the wifi fields so the runtime dispatcher
  // can read them without new schema columns.
  if (cmd.adb_keycode !== undefined) {
    // wifi_method = 'ADB' flag already set by normaliser
    // Store keycode in wifi_payload for app-side dispatch
    row.wifi_payload = String(cmd.adb_keycode);
  }
  if (cmd.ecp_key) {
    row.wifi_payload = JSON.stringify({ ecp_key: cmd.ecp_key });
  }
  if (cmd.soap_action) {
    row.wifi_headers = JSON.stringify({ SOAPAction: cmd.soap_action });
    row.wifi_payload = cmd.soap_body;
  }

  return row;
}

// ─── Chunked upsert helper ────────────────────────────────────────────────

async function upsertChunked(
  client: SupabaseClient | undefined,
  table: string,
  rows: object[],
  onConflict: string[]
): Promise<string[]> {
  if (!client) throw new Error('upsertChunked called without a Supabase client');
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK);
    const { error } = await client
      .from(table)
      .upsert(chunk, {
        onConflict: onConflict.join(','),
        ignoreDuplicates: false,
      });

    if (error) {
      errors.push(`[writer] ${table} chunk ${Math.floor(i / UPSERT_CHUNK)}: ${error.message}`);
      console.error(`[writer] Upsert error on ${table}:`, error.message);
    }
  }
  return errors;
}
