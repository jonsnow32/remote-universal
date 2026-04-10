/**
 * Parser for SmartIR climate JSON files.
 *
 * SmartIR stores one JSON file per "codeset" (remote model or model family).
 * Each file contains a full AC control matrix:
 *
 *   {
 *     "manufacturer": "Daikin",
 *     "supportedModels": ["FTX35GV1B"],
 *     "commandsEncoding": "Base64",   // Broadlink Base64 format
 *     "operationModes": ["cool","heat","auto","dry","fan_only"],
 *     "fanModes": ["auto","low","mid","high"],
 *     "commands": {
 *       "off": "<base64>",
 *       "cool": {
 *         "auto": { "16": "<base64>", "17": "<base64>", ... },
 *         "low":  { "16": "<base64>", ... }
 *       },
 *       ...
 *     }
 *   }
 *
 * Broadlink Base64 wire format (0x26 = IR):
 *   Byte 0:   0x26  — IR protocol marker
 *   Byte 1:   repeat count (0–2, irrelevant for storage)
 *   Bytes 2-3 little-endian uint16 = total byte count (N) of the pulse data section
 *   Bytes 4 .. 4+N-1: variable-length pulse data (32768 Hz clock, ~30.52 µs/tick):
 *     - Non-zero byte B: one pulse of B ticks
 *     - Zero byte:       extended — next 2 bytes (uint16 LE) give the tick count
 *                        (all 3 bytes count toward N)
 *   (Up to 2 optional trailing bytes 0x0D 0x05 beyond 4+N — ignored)
 *
 * Output: one IRRawEntry per (off | mode × fan × temp) combination.
 * Function names follow the pattern:  OFF | COOL_AUTO_16 | HEAT_HIGH_25 ...
 */

import type { FetchResult, IRRawEntry } from '../types';

// ─── Broadlink Base64 → raw µs array ─────────────────────────────────────

/**
 * Decodes a Broadlink-encoded IR command (Base64) into raw microsecond
 * timing values (alternating mark/space, starting with mark).
 *
 * Broadlink wire format (0x26 = IR):
 *   Byte 0:   0x26  — IR protocol marker
 *   Byte 1:   repeat count (irrelevant for storage)
 *   Bytes 2-3 little-endian uint16 = N total bytes of pulse data at offset 4
 *   Bytes 4 .. 4+N-1: pulse data, variable-length encoding:
 *     - Non-zero byte B: duration = B × (1,000,000 / 32,768) µs  (~30.52 µs/tick)
 *     - Zero byte:       extended — next 2 bytes are uint16 LE tick count
 *                        (N counts all three bytes toward the total)
 *
 * Returns null for non-IR packets or malformed data.
 */
export function broadlinkToRaw(b64: string): number[] | null {
  let buf: Buffer;
  try {
    buf = Buffer.from(b64, 'base64');
  } catch {
    return null;
  }

  // Must start with Broadlink IR protocol byte 0x26
  if (buf.length < 6 || buf[0] !== 0x26) return null;

  // Byte count of the pulse data section (not pulse count per se).
  const byteCount = buf.readUInt16LE(2);
  const dataEnd = 4 + byteCount;
  if (buf.length < dataEnd) return null;

  const raw: number[] = [];
  let i = 4;
  while (i < dataEnd) {
    const b = buf[i]!;
    if (b === 0) {
      // Extended encoding: next 2 bytes are uint16 LE tick count
      if (i + 2 >= dataEnd) break;
      const extTicks = buf.readUInt16LE(i + 1);
      raw.push(Math.round((extTicks * 1_000_000) / 32_768));
      i += 3;
    } else {
      raw.push(Math.round((b * 1_000_000) / 32_768));
      i += 1;
    }
  }

  // A valid IR signal needs at least a few pulses
  return raw.length >= 4 ? raw : null;
}

// ─── SmartIR JSON parser ─────────────────────────────────────────────────

interface SmartIRJson {
  manufacturer?: string;
  supportedModels?: string[];
  supportedController?: string;
  commandsEncoding?: string;
  minTemperature?: number;
  maxTemperature?: number;
  precision?: number;
  operationModes?: string[];
  fanModes?: string[];
  /** Nested object: mode→fan→temp→base64 OR top-level "off"→base64 */
  commands?: Record<string, unknown>;
}

/**
 * Parse one SmartIR climate JSON file into IRRawEntry[].
 */
export function parseSmartIR(result: FetchResult): IRRawEntry[] {
  let json: SmartIRJson;
  try {
    json = JSON.parse(result.content) as SmartIRJson;
  } catch {
    return [];
  }

  // Only handle Broadlink Base64 encoded files
  const encoding = (json.commandsEncoding ?? '').toLowerCase();
  if (encoding !== 'base64') return [];

  if (!json.commands) return [];

  const brand = json.manufacturer ?? result.brand ?? 'Unknown';
  const filePath = result.cacheFile;
  // Use explicit model list when available; fall back to the numeric file ID.
  const modelHint = json.supportedModels && json.supportedModels.length > 0
    ? json.supportedModels.join(',')
    : undefined;
  const entries: IRRawEntry[] = [];

  /**
   * Adds one IRRawEntry if the Broadlink Base64 signal decodes successfully.
   */
  function addEntry(name: string, signal: unknown): void {
    if (typeof signal !== 'string' || !signal) return;
    const raw = broadlinkToRaw(signal);
    if (!raw) return;

    entries.push({
      source: 'smartir',
      brand_raw: brand,
      category_raw: 'AC',
      file_path: filePath,
      function_name: name.toUpperCase(),
      type: 'raw',
      frequency: 38_000,
      raw_data: raw,
      ...(modelHint !== undefined ? { model_hint: modelHint } : {}),
    });
  }

  /**
   * Walk the commands object.  SmartIR files follow one of two patterns:
   *   A) mode → fanMode → temp → base64   (most common)
   *   B) temp → mode → fanMode → base64   (rare)
   *   C) flat: commandName → base64       (e.g. "off")
   *
   * We detect nesting depth by checking value types.
   */
  for (const [key1, val1] of Object.entries(json.commands)) {
    if (typeof val1 === 'string') {
      // Level 1 leaf — flat command (e.g. "off", "on")
      addEntry(key1, val1);
    } else if (typeof val1 === 'object' && val1 !== null) {
      for (const [key2, val2] of Object.entries(val1 as Record<string, unknown>)) {
        if (typeof val2 === 'string') {
          // Level 2 leaf — e.g. mode → temp
          addEntry(`${key1}_${key2}`, val2);
        } else if (typeof val2 === 'object' && val2 !== null) {
          for (const [key3, val3] of Object.entries(val2 as Record<string, unknown>)) {
            if (typeof val3 === 'string') {
              // Level 3 leaf — e.g. mode → fan → temp
              addEntry(`${key1}_${key2}_${key3}`, val3);
            }
          }
        }
      }
    }
  }

  return entries;
}
