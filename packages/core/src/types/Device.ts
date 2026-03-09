/**
 * Supported communication protocols for remote devices.
 */
export type SupportedProtocol = 'ir' | 'wifi' | 'ble' | 'homekit' | 'matter';

/**
 * Device capability identifiers.
 */
export type DeviceCapability =
  | 'power'
  | 'volume'
  | 'channel'
  | 'temperature'
  | 'fan_speed'
  | 'swing'
  | 'mode'
  | 'navigation'
  | 'media'
  | 'input_source';

/** A single command entry with optional per-protocol payloads. */
export interface CommandEntry {
  ir?: string;
  wifi?: string;
  ble?: string;
  matter?: string;
  homekit?: string;
}

/** Map of command name → CommandEntry */
export type CommandMap = Record<string, CommandEntry>;

/** Reference to a remote layout by name */
export interface LayoutRef {
  name: string;
  source: string;
}

/**
 * Complete definition of a controllable device.
 */
export interface DeviceDefinition {
  /** Unique identifier for this device model */
  id: string;
  /** Brand name (e.g., 'samsung', 'lg', 'daikin') */
  brand: string;
  /** Model name (e.g., 'QLED QN85B') */
  model: string;
  /** Device category */
  category: 'tv' | 'ac' | 'speaker' | 'light' | 'fan' | 'hub' | 'other';
  /** Ordered list of protocols to try (first = preferred) */
  protocols: SupportedProtocol[];
  /** What this device can do */
  capabilities: DeviceCapability[];
  /** Reference to the UI layout */
  layout: LayoutRef;
  /** Available commands with their protocol payloads */
  commands: CommandMap;
  /** Optional thumbnail image URI */
  thumbnail?: string;
}
