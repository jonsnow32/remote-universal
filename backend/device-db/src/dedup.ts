/**
 * Deduplication stage.
 *
 * Two entries are considered duplicates when they share the same
 * brand_slug + normalised model_number.
 *
 * When duplicates are found, we merge their command lists, preferring
 * entries from higher-priority sources:
 *   flipper > irdb > samsung_api > lg_api > sony_api > …
 */

import type { NormalisedModelEntry, NormalisedCommand, SourceId } from './types';

const SOURCE_PRIORITY: Record<SourceId, number> = {
  flipper:       1,
  irdb:          2,
  smartir:       2,
  samsung_api:   3,
  lg_api:        3,
  sony_api:      3,
  roku_ecp:      3,
  hisense_api:   4,
  vizio_api:     4,
  philips_api:   4,
  panasonic_api: 4,
  android_tv:    4,
  fire_tv:       4,
  ha_components: 5,
};

function sourcePriority(id: SourceId): number {
  return SOURCE_PRIORITY[id] ?? 9;
}

/** Build the canonical dedup key for a model entry. */
export function dedupeKey(entry: NormalisedModelEntry): string {
  const brand = entry.brand_slug.toLowerCase();
  const model = entry.model_number.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${brand}:${model}`;
}

export function deduplicateEntries(
  entries: NormalisedModelEntry[]
): NormalisedModelEntry[] {
  const byKey = new Map<string, NormalisedModelEntry[]>();

  for (const entry of entries) {
    const key = dedupeKey(entry);
    const arr = byKey.get(key) ?? [];
    arr.push({ ...entry, dedupe_key: key });
    byKey.set(key, arr);
  }

  const results: NormalisedModelEntry[] = [];
  for (const group of byKey.values()) {
    results.push(mergeGroup(group));
  }
  return results;
}

function mergeGroup(group: NormalisedModelEntry[]): NormalisedModelEntry {
  if (group.length === 1) return group[0]!;

  // Sort by source priority (lower = preferred)
  const sorted = [...group].sort(
    (a, b) => sourcePriority(a.source) - sourcePriority(b.source)
  );
  const primary = sorted[0]!;

  // Merge command lists: primary commands take precedence; supplement from others
  const cmdMap = new Map<string, NormalisedCommand>();
  // Load secondary sources first so primary overwrites
  for (const entry of sorted.slice(1).reverse()) {
    for (const cmd of entry.commands) {
      if (!cmdMap.has(cmd.name)) {
        cmdMap.set(cmd.name, cmd);
      }
    }
  }
  // Primary source overwrites everything
  for (const cmd of primary.commands) {
    cmdMap.set(cmd.name, cmd);
  }

  // Merge capabilities + protocols
  const protocols = Array.from(
    new Set(sorted.flatMap(e => e.protocols))
  );
  const capabilities = Array.from(
    new Set(sorted.flatMap(e => e.capabilities))
  );

  return {
    ...primary,
    protocols,
    capabilities,
    commands: Array.from(cmdMap.values()),
  };
}
