import { samsungTVLayout } from './samsung';
import { lgTVLayout } from './lg';
import { daikinACLayout } from './daikin';
import { allUniversalLayouts } from './universal';
import type { RemoteLayoutDefinition } from '@remote/core';

/** All brand-specific layouts. Checked before universal fallbacks. */
export const allBrandLayouts: RemoteLayoutDefinition[] = [
  samsungTVLayout,
  lgTVLayout,
  daikinACLayout,
];

/** Combined registry: brand layouts first, then universal fallbacks. */
const ALL_LAYOUTS: RemoteLayoutDefinition[] = [
  ...allBrandLayouts,
  ...allUniversalLayouts,
];

/**
 * Look up a layout by id. Searches brand layouts first, then universal.
 * If `preferredId` is not found (or undefined), tries `fallbackId`.
 */
export function findLayout(
  preferredId: string | undefined,
  fallbackId: string,
): RemoteLayoutDefinition | undefined {
  if (preferredId) {
    const match = ALL_LAYOUTS.find(l => l.id === preferredId);
    if (match) return match;
  }
  return ALL_LAYOUTS.find(l => l.id === fallbackId);
}
