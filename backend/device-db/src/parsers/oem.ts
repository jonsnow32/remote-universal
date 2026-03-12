/**
 * OEM device schema parser.
 *
 * The OEM fetcher already returns data in OEMRawDevice shape (in JSON).
 * This module deserialises and lightly validates that JSON.
 */

import type { FetchResult, OEMRawDevice } from '../types';

export function parseOEMFetchResult(result: FetchResult): OEMRawDevice[] {
  try {
    const parsed = JSON.parse(result.content) as unknown;
    if (!Array.isArray(parsed)) {
      console.warn(`[parser/oem] Expected array from source=${result.source}`);
      return [];
    }
    return parsed.filter(isOEMRawDevice);
  } catch (err) {
    console.error(`[parser/oem] JSON parse error for source=${result.source}:`, err);
    return [];
  }
}

function isOEMRawDevice(v: unknown): v is OEMRawDevice {
  if (!v || typeof v !== 'object') return false;
  const d = v as Record<string, unknown>;
  return (
    typeof d['source'] === 'string' &&
    typeof d['manufacturer'] === 'string' &&
    typeof d['model_number'] === 'string' &&
    Array.isArray(d['commands'])
  );
}
