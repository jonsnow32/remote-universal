/**
 * useIRResolver
 *
 * Hook that resolves and transmits IR commands for a specific device.
 *
 * Handles three scenarios automatically:
 *   1. Built-in Android IR blaster  → direct transmit via IRModule
 *   2. Command not in DB            → null payload, caller should show brute-force UI
 *   3. No blaster + no hub          → throws 'unavailable'
 *
 * Usage:
 * ```tsx
 * const ir = useIRResolver({ brand: 'samsung', category: 'tv', model: 'QN85B', codesetId });
 * await ir.transmit('POWER_TOGGLE');
 * ```
 */

import { useCallback, useRef } from 'react';
import { IRModule } from '@remote/native-modules';
import { DaikinACStateTracker } from '@remote/device-sdk';
import { resolveIRCommand } from '../lib/irApi';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IRResolverParams {
  brand: string;          // catalog brand slug, e.g. 'samsung'
  category: string;       // device category, e.g. 'tv'
  model?: string;         // model number, e.g. 'QN85B'
  codesetId?: string;     // pre-selected codeset from setup flow
}

export type IRTransmitResult =
  | { status: 'sent'; codesetId?: string }
  | { status: 'not_found'; command: string }
  | { status: 'unavailable'; reason: string };

export interface IRResolverHandle {
  /**
   * Transmit a semantic command name (e.g. 'POWER_TOGGLE', 'VOLUME_UP').
   * Resolves the Pronto Hex from the backend and blasts it.
   */
  transmit(command: string): Promise<IRTransmitResult>;
}

// ─── Resolution cache (per session) ──────────────────────────────────────────

// Avoid re-fetching the same command multiple times per session.
type CacheKey = string; // `${brand}:${category}:${model}:${command}`
const sessionCache = new Map<CacheKey, string | null>();

function cacheKey(params: IRResolverParams, command: string): CacheKey {
  return `${params.brand}:${params.category}:${params.model ?? ''}:${command}`;
}

// ─── Brand-local IR resolvers ─────────────────────────────────────────────────

/**
 * Per-brand local IR encoder map.
 * Keyed by brand slug + category (e.g. 'daikin:ac').
 * Each entry is a function that accepts a command name and returns a Pronto Hex
 * string, or null if the command is not handled locally.
 */
const localResolvers: Record<string, (command: string) => string | null> = {};

// Daikin AC — local state-tracking encoder.
// Used when the backend IR database has no matching code.
const daikinTracker = new DaikinACStateTracker();
localResolvers['daikin:ac'] = (command: string) => daikinTracker.applyCommand(command);

function resolveLocally(
  brand: string,
  category: string,
  command: string,
): string | null {
  const key = `${brand.toLowerCase()}:${category.toLowerCase()}`;
  const resolver = localResolvers[key];
  return resolver ? resolver(command) : null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useIRResolver(params: IRResolverParams): IRResolverHandle {
  // Keep params in a ref so the transmit callback doesn't go stale
  const paramsRef = useRef(params);
  paramsRef.current = params;

  // Guard against concurrent transmit calls (e.g. React StrictMode double-invoke).
  const transmittingRef = useRef(false);

  const transmit = useCallback(async (command: string): Promise<IRTransmitResult> => {
    if (transmittingRef.current) {
      return { status: 'sent' }; // second call is a no-op
    }
    transmittingRef.current = true;
    try {
    // 1. Check hardware availability
    const available = await IRModule.isAvailable();
    if (!available) {
      return {
        status: 'unavailable',
        reason:
          'No IR blaster detected on this device. Connect a Wi-Fi IR hub (e.g. Broadlink) to control this device.',
      };
    }

    const p = paramsRef.current;
    const key = cacheKey(p, command);

    // 2. Check session cache
    let payload: string | null | undefined = sessionCache.get(key);

    if (payload === undefined) {
      // 3a. Try backend resolver
      let backendPayload: string | null = null;
      try {
        const result = await resolveIRCommand({
          brand:     p.brand,
          category:  p.category,
          model:     p.model,
          command,
          codesetId: p.codesetId,
        });
        backendPayload = result.payload;
      } catch {
        // Backend unreachable — fall through to local resolver
      }

      // 3b. Fall back to local brand encoder (e.g. Daikin state-machine)
      payload = backendPayload ?? resolveLocally(p.brand, p.category, command);
      // Only cache backend hits; local codes encode live state and must not be cached
      if (backendPayload !== null) {
        sessionCache.set(key, backendPayload);
      }
    }

    if (!payload) {
      return { status: 'not_found', command };
    }

    // 4. Transmit
    await IRModule.transmit('', payload);
    return { status: 'sent' };
    } finally {
      transmittingRef.current = false;
    }
  }, []);

  return { transmit };
}
