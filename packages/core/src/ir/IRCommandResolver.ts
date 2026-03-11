/**
 * IRCommandResolver
 *
 * Resolves and executes IR commands across three hardware scenarios:
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │  Case 1 — Direct IR blaster  (Android device with IR LED)   │
 *   │    Payload found in catalog or IR library → transmit direct  │
 *   ├─────────────────────────────────────────────────────────────┤
 *   │  Case 2 — WiFi IR hub  (Broadlink, TP-Link, Harmony, etc.)  │
 *   │    No built-in IR → relay payload through registered hub     │
 *   ├─────────────────────────────────────────────────────────────┤
 *   │  Case 3 — Model not in database                             │
 *   │    3a. Brute-force: try POWER codes from brand+category      │
 *   │    3b. Learn mode: record from physical remote               │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Usage:
 * ```ts
 * import { IRModule } from '@remote/native-modules';
 *
 * const resolver = new IRCommandResolver({
 *   library,
 *   catalogCommands,
 *   isBlasterAvailable: () => IRModule.isAvailable(),
 *   blasterTransmit:    (payload) => IRModule.transmit('', payload),
 *   isHubAvailable:     () => hubService.isConnected(),
 *   hubRelay:           (payload, freq) => hubService.transmit(payload, freq),
 * });
 *
 * const resolution = await resolver.resolve({
 *   commandName: 'POWER',
 *   catalogBrandId: 'samsung',
 *   category: 'tv',
 *   modelNumber: 'QN85B',
 *   modelId: 'samsung.qled-qn85b-2022',
 * });
 *
 * if (resolution.strategy === 'direct_blaster' || resolution.strategy === 'hub_relay') {
 *   await resolver.transmit(resolution);
 * }
 * ```
 */

import type { IRLibraryRepository, BruteForceProbe } from '../db/IRLibraryRepository';

// ─── Injected dependencies ─────────────────────────────────────────────────

/**
 * Minimal interface for catalog command lookup.
 * Implemented by `CommandDefinitionRepository` from `@remote/core`.
 */
export interface CatalogCommandLookup {
  /**
   * Returns the IR payload (Pronto Hex) for a command, with fallback:
   *   1. Model-specific command_definition
   *   2. Brand-level command_definition
   *
   * Returns null if not found in catalog.
   */
  resolveIRPayload(
    commandName: string,
    modelId: string | undefined,
    brandId: string,
  ): Promise<string | null>;
}

export interface IRCommandResolverOptions {
  /** IR Library repository for looking up codes beyond the structured catalog */
  library: IRLibraryRepository;

  /**
   * Optional catalog command lookup.
   * If provided, the catalog is tried first before the IR library.
   */
  catalogCommands?: CatalogCommandLookup;

  /**
   * Returns true if the device's built-in IR blaster is available.
   * Typically: `() => IRModule.isAvailable()` from \`@remote/native-modules\`.
   * Injected here so `@remote/core` stays free of native dependencies.
   */
  isBlasterAvailable?: () => Promise<boolean>;

  /**
   * Transmit an IR payload via the built-in IR blaster.
   * Typically: `(payload) => IRModule.transmit('', payload)` from \`@remote/native-modules\`.
   *
   * @param payload     Pronto Hex string or raw JSON {frequency, pattern}
   */
  blasterTransmit?: (payload: string) => Promise<void>;

  /**
   * Returns true if a WiFi IR hub (Broadlink, TP-Link, Harmony, etc.)
   * is currently reachable. Called only when the built-in IR blaster
   * is unavailable.
   */
  isHubAvailable?: () => Promise<boolean>;

  /**
   * Sends an IR payload through the WiFi hub.
   * Only called when `isHubAvailable` returns true.
   *
   * @param payload     Pronto Hex string or raw JSON {frequency, pattern}
   * @param frequencyHz Carrier frequency in Hz (e.g. 38000)
   */
  hubRelay?: (payload: string, frequencyHz: number) => Promise<void>;
}

// ─── Resolution result types ───────────────────────────────────────────────

/** Payload was found; device has a built-in IR blaster. Transmit directly. */
export interface IRResolutionDirectBlaster {
  strategy: 'direct_blaster';
  payload: string;
  frequencyHz: number;
  /** Whether the payload came from the structured catalog or the IR library */
  source: 'catalog' | 'library';
  codesetId?: string;
}

/** Payload was found; no built-in IR — relay via WiFi hub. */
export interface IRResolutionHubRelay {
  strategy: 'hub_relay';
  payload: string;
  frequencyHz: number;
  source: 'catalog' | 'library';
  codesetId?: string;
}

/**
 * Model not found in any database.
 * Caller should iterate candidates in order, transmitting the probe payload
 * for each, and asking the user "Did the device respond?".
 * On confirmation, call `confirmBruteForceMatch()` to save the association.
 */
export interface IRResolutionBruteForce {
  strategy: 'brute_force';
  /** Ordered list of probe candidates — send payload[0] first */
  candidates: BruteForceProbe[];
  totalCount: number;
  /** Whether brute-force will use the built-in blaster (true) or hub (false) */
  transmitterType: 'direct_blaster' | 'hub_relay';
}

/** No IR database entry AND no transmitter (no blaster + no hub). */
export interface IRResolutionLearnMode {
  strategy: 'learn_mode';
  /** Human-readable explanation for the UI */
  reason: string;
}

/** Completely unresolvable — no transmitter available at all. */
export interface IRResolutionUnavailable {
  strategy: 'unavailable';
  reason: string;
}

export type IRResolution =
  | IRResolutionDirectBlaster
  | IRResolutionHubRelay
  | IRResolutionBruteForce
  | IRResolutionLearnMode
  | IRResolutionUnavailable;

// ─── Transmit result ───────────────────────────────────────────────────────

export interface IRTransmitResult {
  success: boolean;
  strategy: 'direct_blaster' | 'hub_relay';
  payload: string;
  frequencyHz: number;
  durationMs: number;
}

// ─── Params ────────────────────────────────────────────────────────────────

export interface IRResolveParams {
  /** Normalised command name passed to the catalog and library, e.g. 'POWER', 'VOL_UP' */
  commandName: string;
  /** catalog Brand.id, e.g. 'samsung' */
  catalogBrandId: string;
  /** Device category, e.g. 'tv', 'ac' */
  category: string;
  /** Device model number string, e.g. 'QN85B', 'UN55TU7000' */
  modelNumber: string;
  /** Optional: catalog DeviceModel.id for the structured catalog lookup */
  modelId?: string;
}

// ─── IRCommandResolver ─────────────────────────────────────────────────────

export class IRCommandResolver {
  private readonly library: IRLibraryRepository;
  private readonly catalogCommands?: CatalogCommandLookup;
  private readonly isBlasterAvailable?: () => Promise<boolean>;
  private readonly blasterTransmit?: (payload: string) => Promise<void>;
  private readonly isHubAvailable?: () => Promise<boolean>;
  private readonly hubRelay?: (payload: string, frequencyHz: number) => Promise<void>;

  constructor(options: IRCommandResolverOptions) {
    this.library             = options.library;
    this.catalogCommands     = options.catalogCommands;
    this.isBlasterAvailable  = options.isBlasterAvailable;
    this.blasterTransmit     = options.blasterTransmit;
    this.isHubAvailable      = options.isHubAvailable;
    this.hubRelay            = options.hubRelay;
  }

  // ── Case detection helpers ────────────────────────────────────────────────

  private async checkBlaster(): Promise<boolean> {
    if (!this.isBlasterAvailable || !this.blasterTransmit) return false;
    try {
      return await this.isBlasterAvailable();
    } catch {
      return false;
    }
  }

  private async checkHub(): Promise<boolean> {
    if (!this.isHubAvailable || !this.hubRelay) return false;
    try {
      return await this.isHubAvailable();
    } catch {
      return false;
    }
  }

  // ── Payload resolution ────────────────────────────────────────────────────

  private async findPayload(params: IRResolveParams): Promise<{
    payload: string;
    frequencyHz: number;
    source: 'catalog' | 'library';
    codesetId?: string;
  } | null> {
    // ── Step 1: Structured catalog (command_definitions table) ──────────────
    if (this.catalogCommands) {
      const prontoHex = await this.catalogCommands.resolveIRPayload(
        params.commandName,
        params.modelId,
        params.catalogBrandId,
      );
      if (prontoHex) {
        return { payload: prontoHex, frequencyHz: 38_000, source: 'catalog' };
      }
    }

    // ── Step 2: IR Library (ir_codes table with glob model matching) ─────────
    const resolved = await this.library.resolveCode({
      catalogBrandId: params.catalogBrandId,
      category:       params.category,
      modelNumber:    params.modelNumber,
      functionName:   params.commandName,
    });

    if (resolved) {
      return {
        payload:     resolved.payload,
        frequencyHz: resolved.frequencyHz,
        source:      'library',
        codesetId:   resolved.codeset.id,
      };
    }

    return null;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Resolve the best strategy for sending a command to an IR device.
   *
   * Decision tree:
   *
   *   Payload found?
   *   ├── YES → Has IR blaster?
   *   │         ├── YES → { strategy: 'direct_blaster' }
   *   │         └── NO  → Has WiFi hub?
   *   │                   ├── YES → { strategy: 'hub_relay' }
   *   │                   └── NO  → { strategy: 'unavailable' }
   *   └── NO  → Has any transmitter?
   *             ├── YES → Brute-force candidates available?
   *             │         ├── YES → { strategy: 'brute_force' }
   *             │         └── NO  → { strategy: 'learn_mode' }
   *             └── NO  → { strategy: 'unavailable' }
   */
  async resolve(params: IRResolveParams): Promise<IRResolution> {
    // ── Find payload ──────────────────────────────────────────────────────────
    const payloadResult = await this.findPayload(params);

    if (payloadResult) {
      // ── CASE 1 — Direct IR blaster ──────────────────────────────────────────
      const hasBlaster = await this.checkBlaster();
      if (hasBlaster) {
        return {
          strategy:    'direct_blaster',
          payload:     payloadResult.payload,
          frequencyHz: payloadResult.frequencyHz,
          source:      payloadResult.source,
          codesetId:   payloadResult.codesetId,
        };
      }

      // ── CASE 2 — Hub relay ──────────────────────────────────────────────────
      const hasHub = await this.checkHub();
      if (hasHub) {
        return {
          strategy:    'hub_relay',
          payload:     payloadResult.payload,
          frequencyHz: payloadResult.frequencyHz,
          source:      payloadResult.source,
          codesetId:   payloadResult.codesetId,
        };
      }

      return {
        strategy: 'unavailable',
        reason: 'IR payload found but no transmitter available. ' +
                'This device has no built-in IR blaster and no WiFi IR hub is connected.',
      };
    }

    // ── CASE 3 — Model not in database ────────────────────────────────────────
    const hasBlaster = await this.checkBlaster();
    const hasHub     = !hasBlaster && await this.checkHub();
    const hasAnyTransmitter = hasBlaster || hasHub;

    if (!hasAnyTransmitter) {
      return {
        strategy: 'unavailable',
        reason: 'No IR code found for this device and no IR transmitter is available. ' +
                'Connect a WiFi IR hub (e.g. Broadlink RM4) to enable control.',
      };
    }

    // Try brute-force probes from the IR library
    const candidates = await this.library.getBruteForceProbes(
      params.catalogBrandId,
      params.category,
    );

    if (candidates.length > 0) {
      return {
        strategy:        'brute_force',
        candidates,
        totalCount:      candidates.length,
        transmitterType: hasBlaster ? 'direct_blaster' : 'hub_relay',
      };
    }

    // No codes in library for this brand at all → recommend learn mode
    return {
      strategy: 'learn_mode',
      reason: `No IR codes found for ${params.catalogBrandId} ${params.category} ` +
              `in the library. Use Learn Mode to record codes from your physical remote.`,
    };
  }

  /**
   * Transmit an already-resolved direct/hub payload.
   * Only valid for `direct_blaster` or `hub_relay` strategies.
   * For `brute_force`, use `transmitBruteForceProbe()` instead.
   */
  async transmit(
    resolution: IRResolutionDirectBlaster | IRResolutionHubRelay,
  ): Promise<IRTransmitResult> {
    const start = Date.now();

    if (resolution.strategy === 'direct_blaster') {
      if (!this.blasterTransmit) {
        throw new Error('[IRCommandResolver] blasterTransmit callback is not configured.');
      }
      await this.blasterTransmit(resolution.payload);
      return {
        success:     true,
        strategy:    'direct_blaster',
        payload:     resolution.payload,
        frequencyHz: resolution.frequencyHz,
        durationMs:  Date.now() - start,
      };
    }

    // hub_relay
    if (!this.hubRelay) {
      throw new Error('[IRCommandResolver] hubRelay callback is not configured.');
    }
    await this.hubRelay(resolution.payload, resolution.frequencyHz);
    return {
      success:     true,
      strategy:    'hub_relay',
      payload:     resolution.payload,
      frequencyHz: resolution.frequencyHz,
      durationMs:  Date.now() - start,
    };
  }

  /**
   * Transmit a single brute-force probe.
   *
   * Used during the interactive "Find my remote code" setup flow:
   *   1. UI calls `resolve()` → gets `brute_force` resolution
   *   2. UI iterates `resolution.candidates` showing "Try code N of M"
   *   3. For each, calls `transmitBruteForceProbe(probe, transmitterType)`
   *   4. User confirms "Yes, device responded" → call `confirmBruteForceMatch()`
   *
   * @param probe           A single candidate from `IRResolutionBruteForce.candidates`
   * @param transmitterType From the brute-force resolution
   */
  async transmitBruteForceProbe(
    probe: BruteForceProbe,
    transmitterType: 'direct_blaster' | 'hub_relay',
  ): Promise<IRTransmitResult> {
    const start = Date.now();

    if (transmitterType === 'direct_blaster') {
      if (!this.blasterTransmit) {
        throw new Error('[IRCommandResolver] blasterTransmit callback is not configured.');
      }
      await this.blasterTransmit(probe.payload);
    } else {
      if (!this.hubRelay) {
        throw new Error('[IRCommandResolver] hubRelay callback is not configured.');
      }
      await this.hubRelay(probe.payload, probe.frequencyHz);
    }

    return {
      success:     true,
      strategy:    transmitterType,
      payload:     probe.payload,
      frequencyHz: probe.frequencyHz,
      durationMs:  Date.now() - start,
    };
  }

  /**
   * Confirm that a brute-force probe worked for a given model.
   * Links the ir_codeset to the catalog model so future lookups are instant.
   *
   * @param codesetId      The `probe.codesetId` that worked
   * @param catalogModelId The `DeviceModel.id` from the catalog
   */
  async confirmBruteForceMatch(codesetId: string, catalogModelId: string): Promise<void> {
    await this.library.codesets.linkToCatalogModel(codesetId, catalogModelId, 0.95);
  }
}
