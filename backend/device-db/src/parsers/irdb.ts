/**
 * Parser for Flipper Zero .ir files and probonopd IRDB CSV files.
 *
 * Flipper .ir format (one file = one device/model):
 *   Filetype: IR signals file
 *   Version: 1
 *   #
 *   name: Power
 *   type: parsed
 *   protocol: NEC
 *   address: 07 00 00 00
 *   command: 02 00 00 00
 *   #
 *   name: Volume_Up
 *   type: raw
 *   frequency: 38000
 *   duty_cycle: 0.33
 *   data: 9042 4490 580 560 580 ...
 *
 * IRDB CSV format (probonopd):
 *   One Pronto hex string per line (no headers, no function names).
 *   File name encodes device/subdevice/count: "<dev>,<subdev>,<n>.csv"
 */

import path from 'path';
import type { FetchResult, IRRawEntry } from '../types';

// ─── Flipper .ir parser ───────────────────────────────────────────────────

/**
 * Parse the content of a Flipper .ir file into individual IRRawEntry records.
 */
export function parseFlipperIR(result: FetchResult): IRRawEntry[] {
  const entries: IRRawEntry[] = [];
  const filePath = result.cacheFile;
  const brand = result.brand ?? path.dirname(filePath).split(path.sep).slice(-2, -1)[0] ?? 'Unknown';
  const category = result.category ?? 'Other';

  // Split by signal boundary marker '#'
  const blocks = result.content.split(/^#\s*$/m);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const fields: Record<string, string> = {};

    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim().toLowerCase();
      const val = line.slice(colonIdx + 1).trim();
      fields[key] = val;
    }

    // Skip header block (Filetype: IR signals file) and empty blocks
    if (!fields['name'] || fields['filetype']) continue;

    const signalType = (fields['type'] ?? 'parsed') as 'parsed' | 'raw';

    if (signalType === 'parsed') {
      entries.push({
        source: 'flipper',
        brand_raw: brand,
        category_raw: category,
        file_path: filePath,
        function_name: sanitizeFunctionName(fields['name'] ?? ''),
        type: 'parsed',
        protocol: fields['protocol'],
        address: fields['address'],
        command: fields['command'],
      });
    } else if (signalType === 'raw') {
      const rawData = (fields['data'] ?? '')
        .split(/\s+/)
        .filter(s => s.length > 0)
        .map(Number)
        .filter(n => !isNaN(n));

      entries.push({
        source: 'flipper',
        brand_raw: brand,
        category_raw: category,
        file_path: filePath,
        function_name: sanitizeFunctionName(fields['name'] ?? ''),
        type: 'raw',
        frequency: Number(fields['frequency'] ?? 38000),
        raw_data: rawData,
      });
    }
  }

  return entries;
}

// ─── IRDB CSV parser ──────────────────────────────────────────────────────

/**
 * Parse a probonopd IRDB CSV file. Since the format has no function names,
 * we assign generic names by position (func_0, func_1, …).
 * Pronto hex strings are stored as-is in the pronto field.
 */
export function parseIRDBCSV(result: FetchResult): IRRawEntry[] {
  const entries: IRRawEntry[] = [];
  const filePath = result.cacheFile;
  const brand = result.brand ?? 'Unknown';
  const category = result.category ?? 'Other';

  const lines = result.content
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#'));

  lines.forEach((line, idx) => {
    // Skip the header line if present
    if (idx === 0 && line.toLowerCase().includes('frequency')) return;

    // Two possible CSV formats:
    //   Format A (pronto hex): "0000 006C 0022 ..."
    //   Format B (columnar):   "56000,NEC,49,49,16,0x10EF906F"

    if (line.startsWith('0000') || line.startsWith('0001')) {
      // Format A — Pronto hex
      entries.push({
        source: 'irdb',
        brand_raw: brand,
        category_raw: category,
        file_path: filePath,
        function_name: `func_${idx}`,
        type: 'parsed',
        pronto: line,
      });
      return;
    }

    const cols = line.split(',');
    if (cols.length >= 5) {
      // Format B — columnar: Frequency,Encoding,Device,Sub-Device,Function,Hex
      const frequency = parseInt(cols[0] ?? '', 10);
      const protocol = cols[1]?.trim() ?? '';
      const funcCode = parseInt(cols[4] ?? '', 10);
      const hexVal = cols[5]?.trim() ?? '';

      entries.push({
        source: 'irdb',
        brand_raw: brand,
        category_raw: category,
        file_path: filePath,
        function_name: `func_${funcCode}_${idx}`,
        type: 'parsed',
        protocol: protocol || undefined,
        frequency: isNaN(frequency) ? undefined : frequency,
        pronto: hexVal && hexVal.startsWith('0x')
          ? hexToPronto(hexVal, frequency, protocol)
          : undefined,
      });
    }
  });

  return entries;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function sanitizeFunctionName(name: string): string {
  return name
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase();
}

/**
 * Very minimal NEC Pronto conversion from a raw hex value.
 * Full Pronto encoding is complex; this produces a best-effort string for
 * NEC-family codes that can be rendered in the UI debug view.
 * Production use should run the app-side IRCommandResolver decode path.
 */
function hexToPronto(
  hex: string,
  frequency: number,
  _protocol: string
): string | undefined {
  if (!hex.startsWith('0x')) return undefined;
  const freq = isNaN(frequency) ? 38000 : frequency;
  const freqCode = Math.round(1000000 / (freq * 0.241246));
  const freqHex = freqCode.toString(16).padStart(4, '0');
  // Minimal Pronto header for learned IR (type 0100)
  return `0100 ${freqHex} 0000 0000 ${hex.slice(2).padStart(8, '0')}`;
}
