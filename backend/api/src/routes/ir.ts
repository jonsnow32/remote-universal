/**
 * IR Code Lookup API
 *
 * Queries the ir_brands, ir_codesets, and ir_codes tables in Supabase.
 *
 * Endpoints:
 *   GET /api/ir/brands?category=tv                       — list brands with IR codes
 *   GET /api/ir/codesets?brand=samsung&category=tv&model=QN85B — ranked codesets
 *   GET /api/ir/codes?codesetId=xxx                      — commands in a codeset
 *   POST /api/ir/resolve   { brand, category, model, command } — resolve to Pronto Hex
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getSupabaseClient } from '../lib/supabase';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Simple glob-score for ranking codesets by model pattern match. */
function scoreModelPattern(modelNumber: string, pattern: string | null | undefined): number {
  if (!pattern || pattern === '*') return 0.3;
  const m = modelNumber.toUpperCase().trim();
  const p = pattern.toUpperCase().trim();
  if (m === p) return 1.0;
  if (p.endsWith('*') && !p.startsWith('*') && m.startsWith(p.slice(0, -1))) return 0.7;
  if (p.startsWith('*') && !p.endsWith('*') && m.endsWith(p.slice(1))) return 0.7;
  if (p.startsWith('*') && p.endsWith('*') && m.includes(p.slice(1, -1))) return 0.6;
  return -1;
}

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
  // ── AC commands ──────────────────────────────────────────────────────────
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
  const aliases = FUNCTION_ALIASES[upper];
  return aliases ?? [upper, `BTN_${upper}`, `KEY_${upper}`];
}

// ─── Route plugin ─────────────────────────────────────────────────────────────

export async function irRouter(fastify: FastifyInstance): Promise<void> {

  // ── GET /api/ir/brands ────────────────────────────────────────────────────
  fastify.get<{ Querystring: { category?: string } }>('/brands', async (req, reply) => {
    const { category } = req.query;
    const db = getSupabaseClient();

    let query = db
      .from('ir_brands')
      .select('id, name, category, catalog_brand_id, priority, code_count')
      .order('priority', { ascending: false })
      .order('name');

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query.limit(200);
    if (error) return reply.status(500).send({ error: error.message });
    return reply.send({ brands: data ?? [] });
  });

  // ── GET /api/ir/codesets ──────────────────────────────────────────────────
  // Params: brand (catalog_brand_id), category, model (optional)
  // Returns codesets ranked by model pattern match score.
  fastify.get<{ Querystring: { brand: string; category: string; model?: string } }>(
    '/codesets',
    async (req, reply) => {
      const { brand, category, model } = req.query;
      if (!brand || !category) {
        return reply.status(400).send({ error: 'brand and category are required' });
      }

      const db = getSupabaseClient();

      // Find ir_brand ids that match this catalog brand + category
      const { data: irBrands, error: brandErr } = await db
        .from('ir_brands')
        .select('id')
        .eq('catalog_brand_id', brand)
        .eq('category', category);

      if (brandErr) return reply.status(500).send({ error: brandErr.message });
      if (!irBrands || irBrands.length === 0) {
        return reply.send({ codesets: [] });
      }

      const brandIds = irBrands.map((b: { id: string }) => b.id);

      const { data: codesets, error: csErr } = await db
        .from('ir_codesets')
        .select('id, brand_id, model_pattern, protocol_name, carrier_frequency_hz, source, match_confidence')
        .in('brand_id', brandIds)
        .order('match_confidence', { ascending: false })
        .limit(100);

      if (csErr) return reply.status(500).send({ error: csErr.message });

      let ranked = (codesets ?? []) as Array<{
        id: string;
        brand_id: string;
        model_pattern: string | null;
        protocol_name: string | null;
        carrier_frequency_hz: number;
        source: string;
        match_confidence: number;
        _score?: number;
      }>;

      // Re-rank by model pattern if model number provided
      if (model) {
        ranked = ranked
          .map(cs => ({ ...cs, _score: scoreModelPattern(model, cs.model_pattern) }))
          .filter(cs => cs._score! >= 0)
          .sort((a, b) => b._score! - a._score!);
      }

      return reply.send({ codesets: ranked });
    },
  );

  // ── GET /api/ir/codes ─────────────────────────────────────────────────────
  // Params: codesetId
  // Returns all IR command codes for that codeset.
  fastify.get<{ Querystring: { codesetId: string } }>('/codes', async (req, reply) => {
    const { codesetId } = req.query;
    if (!codesetId) return reply.status(400).send({ error: 'codesetId is required' });

    const db = getSupabaseClient();
    const { data, error } = await db
      .from('ir_codes')
      .select('id, codeset_id, function_name, function_label, pronto_hex, raw_pattern, raw_frequency_hz')
      .eq('codeset_id', codesetId)
      .order('function_name')
      .limit(500);

    if (error) return reply.status(500).send({ error: error.message });
    return reply.send({ codes: data ?? [] });
  });

  // ── POST /api/ir/resolve ──────────────────────────────────────────────────
  // Body: { brand, category, model, command, codesetId? }
  // Returns the Pronto Hex / raw JSON payload for that command.
  const ResolveSchema = z.object({
    brand:     z.string(),
    category:  z.string(),
    model:     z.string().optional().default(''),
    command:   z.string(),
    codesetId: z.string().optional(),
  });

  fastify.post('/resolve', async (req, reply) => {
    const parsed = ResolveSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues });

    const { brand, category, model, command, codesetId } = parsed.data;
    const db = getSupabaseClient();
    const aliases = expandAliases(command);

    // ── Fast path: direct codeset lookup (user already selected codeset) ──
    if (codesetId) {
      const { data: codes } = await db
        .from('ir_codes')
        .select('function_name, pronto_hex, raw_pattern, raw_frequency_hz')
        .eq('codeset_id', codesetId)
        .in('function_name', aliases)
        .limit(1);

      if (codes && codes.length > 0) {
        const code = codes[0] as {
          function_name: string;
          pronto_hex: string | null;
          raw_pattern: string | null;
          raw_frequency_hz: number | null;
        };
        return reply.send(buildPayloadResponse(code));
      }
    }

    // ── Slow path: find best matching codeset for brand+category+model ───
    const { data: irBrands } = await db
      .from('ir_brands')
      .select('id')
      .eq('catalog_brand_id', brand)
      .eq('category', category);

    if (!irBrands || irBrands.length === 0) {
      return reply.status(404).send({ error: 'No IR codes found for this brand/category' });
    }

    const brandIds = (irBrands as { id: string }[]).map(b => b.id);

    const { data: codesets } = await db
      .from('ir_codesets')
      .select('id, model_pattern, match_confidence')
      .in('brand_id', brandIds)
      .order('match_confidence', { ascending: false })
      .limit(50);

    if (!codesets || codesets.length === 0) {
      return reply.status(404).send({ error: 'No codesets found for this brand/category' });
    }

    // Rank codesets by model pattern match
    const rankedIds = (codesets as Array<{ id: string; model_pattern: string | null; match_confidence: number }>)
      .map(cs => ({ id: cs.id, score: scoreModelPattern(model, cs.model_pattern) }))
      .filter(cs => cs.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map(cs => cs.id);

    if (rankedIds.length === 0) {
      return reply.status(404).send({ error: 'No matching codesets for this model' });
    }

    // Try to find the command in ranked codesets
    for (const csId of rankedIds) {
      const { data: codes } = await db
        .from('ir_codes')
        .select('function_name, pronto_hex, raw_pattern, raw_frequency_hz')
        .eq('codeset_id', csId)
        .in('function_name', aliases)
        .limit(1);

      if (codes && codes.length > 0) {
        const code = codes[0] as {
          function_name: string;
          pronto_hex: string | null;
          raw_pattern: string | null;
          raw_frequency_hz: number | null;
        };
        return reply.send({ ...buildPayloadResponse(code), codesetId: csId });
      }
    }

    return reply.status(404).send({ error: `No IR code found for command: ${command}` });
  });
}

// ─── Payload builder ──────────────────────────────────────────────────────────

function buildPayloadResponse(code: {
  function_name: string;
  pronto_hex: string | null;
  raw_pattern: string | null;
  raw_frequency_hz: number | null;
}) {
  if (code.pronto_hex) {
    return { payload: code.pronto_hex, format: 'pronto_hex' };
  }
  if (code.raw_pattern) {
    const freq = code.raw_frequency_hz ?? 38000;
    const payload = JSON.stringify({ frequency: freq, pattern: JSON.parse(code.raw_pattern) });
    return { payload, format: 'raw_json' };
  }
  return { payload: null, format: null };
}
