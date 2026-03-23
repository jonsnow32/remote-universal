import { samsungTVLayout } from './samsung';
import { lgTVLayout } from './lg';
import { daikinACLayout } from './daikin';
import { allUniversalLayouts } from './universal';
import type { RemoteLayoutDefinition } from '@remote/core';
import type { DeviceType } from '@remote/core';

/** All brand-specific layouts. Checked before universal fallbacks. */
export const allBrandLayouts: RemoteLayoutDefinition[] = [
  samsungTVLayout,
  lgTVLayout,
  daikinACLayout,
];

/** Combined registry: brand layouts first, then universal fallbacks. */
export const ALL_LAYOUTS: RemoteLayoutDefinition[] = [
  ...allBrandLayouts,
  ...allUniversalLayouts,
];

/**
 * Returns all layouts (brand-specific first, then universal) that match
 * the given device type. Use this to populate a layout picker.
 */
export function getLayoutsForDeviceType(deviceType: DeviceType): RemoteLayoutDefinition[] {
  return ALL_LAYOUTS.filter(l => l.deviceType === deviceType);
}

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
