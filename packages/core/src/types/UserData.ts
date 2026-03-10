/**
 * User Data Types
 *
 * These types represent user-specific, mutable data: homes, rooms, paired
 * device instances, custom layouts, macro sequences, and command overrides.
 *
 * User data is stored locally in SQLite (via expo-sqlite) and optionally
 * synced to the cloud via `packages/cloud-sdk/src/sync.ts`.
 *
 * All records use UUID v4 as the primary key so they can be created offline
 * and merged without conflict during sync.
 */

import type { SupportedProtocol } from './Device';
import type { DeviceCategory } from './Catalog';

// ─── Home ──────────────────────────────────────────────────────────────────

/**
 * Top-level grouping for a physical dwelling.
 * Each home contains one or more rooms.
 */
export interface Home {
  /** UUID v4 */
  id: string;
  /** Display name, e.g. 'Nhà Hà Nội' */
  name: string;
  /** IANA timezone identifier, e.g. 'Asia/Ho_Chi_Minh' */
  timezone?: string;
  /** Icon name (SF Symbols / Material Icons), e.g. 'home' */
  icon?: string;
  /** Sort position within the home list */
  sort_order: number;
  /** Unix timestamp (seconds) when last synced to cloud */
  synced_at?: number;
  /** Unix timestamp (seconds) */
  created_at: number;
  /** Unix timestamp (seconds) */
  updated_at: number;
}

// ─── Room ──────────────────────────────────────────────────────────────────

/**
 * A room/area inside a home.
 * Devices are assigned to rooms.
 */
export interface Room {
  /** UUID v4 */
  id: string;
  /** FK → Home.id */
  home_id: string;
  /** Display name, e.g. 'Phòng khách' */
  name: string;
  /**
   * Icon name, e.g. 'sofa', 'bed', 'restaurant', 'tv', 'kitchen'.
   * Intended to be rendered as a Material Icons or SF Symbols glyph.
   */
  icon?: string;
  /** Sort position within the room list */
  sort_order: number;
  /** Unix timestamp (seconds) */
  created_at: number;
  /** Unix timestamp (seconds) */
  updated_at: number;
}

// ─── User Device ───────────────────────────────────────────────────────────

/**
 * A user-paired device instance.
 *
 * `model_id` links to the static DeviceModel catalog entry (which holds
 * the command definitions and default layout).  A device can also be
 * created without a catalog match (`model_id` null) if the user adds it
 * fully manually.
 *
 * Network & auth fields are stored here because they are per-instance:
 * two users with the same TV model will have different IP addresses.
 */
export interface UserDevice {
  /** UUID v4 */
  id: string;
  /** FK → Room.id */
  room_id: string;
  /**
   * FK → DeviceModel.id in the catalog.
   * Null if the device was added manually without a catalog match.
   */
  model_id: string | null;
  /**
   * User-assigned nickname, e.g. 'Samsung TV Phòng khách'.
   * Falls back to DeviceModel.model_name if not set.
   */
  nickname?: string;
  /**
   * Cached category from the catalog model, stored for fast queries
   * (avoids a JOIN to device_models on every list render).
   */
  category: DeviceCategory;

  // ── Network identity ─────────────────────────────────────────────────────
  /** IPv4 or IPv6 address, e.g. '192.168.1.42' */
  ip_address?: string;
  /** MAC address, e.g. 'A4:C3:F0:...' */
  mac_address?: string;
  /** BLE device address / UUID */
  ble_address?: string;
  /**
   * UDN or device UUID from SSDP/mDNS discovery.
   * Used to re-identify the device if the IP changes via DHCP.
   */
  discovery_id?: string;

  // ── Protocol ──────────────────────────────────────────────────────────────
  /**
   * Override the protocol preference from the catalog.
   * Null = use the first protocol in DeviceModel.protocols.
   */
  preferred_protocol?: SupportedProtocol;
  /** HTTP port for Wi-Fi control (default: 80 or model-specific) */
  wifi_port?: number;
  /**
   * Encrypted authentication token for Wi-Fi APIs.
   * e.g. Samsung SmartThings token, LG ThinQ Bearer token.
   * Must be encrypted at rest using device keychain.
   */
  wifi_auth_token?: string;
  /** Matter fabric ID string */
  matter_fabric_id?: string;

  // ── Physical / IR hub ────────────────────────────────────────────────────
  /**
   * UUID of the IR hub (UserDevice.id) that forwards IR commands
   * to this device.  Null = use phone's built-in IR blaster.
   */
  ir_hub_id?: string;

  // ── State ─────────────────────────────────────────────────────────────────
  /** Whether the device was reachable at last check */
  is_online: boolean;
  /** Unix timestamp (seconds) of last successful command */
  last_seen_at?: number;
  /** Sort position within the room */
  sort_order: number;
  /** Unix timestamp (seconds) */
  created_at: number;
  /** Unix timestamp (seconds) */
  updated_at: number;
}

// ─── Custom Command Override ────────────────────────────────────────────────

/**
 * Overrides or extends a command from the catalog for a specific user device.
 *
 * Only the non-null fields override the matching `CommandDefinition`.
 * This allows users to re-capture their own IR code for a specific button
 * without changing the catalog entry for everyone.
 *
 * Setting `is_hidden = true` removes the button from the layout entirely.
 */
export interface CustomCommandOverride {
  /** UUID v4 */
  id: string;
  /** FK → UserDevice.id */
  user_device_id: string;
  /**
   * Matches `CommandDefinition.name`, e.g. 'power_on'.
   * The override is applied on top of the catalog entry with this name.
   */
  command_name: string;
  /** Replacement display label */
  custom_label?: string;
  /** Replacement IR Pronto Hex */
  ir_pronto?: string;
  /** Replacement raw IR pattern JSON */
  ir_raw?: string;
  /** Replacement Wi-Fi JSON payload */
  wifi_payload?: string;
  /** Replacement BLE base64 value */
  ble_value?: string;
  /** Replacement Matter JSON payload */
  matter_payload?: string;
  /** If true, hides this command button from all layouts for this device */
  is_hidden: boolean;
  /** Unix timestamp (seconds) */
  created_at: number;
  /** Unix timestamp (seconds) */
  updated_at: number;
}

// ─── User Macro ────────────────────────────────────────────────────────────

/**
 * A user-created macro — a named, ordered sequence of commands across
 * one or more devices.  Macros are stored as header + steps.
 *
 * Note: this is distinct from the runtime `Macro` in `CommandDispatcher`
 * which is a transient execution object.  `UserMacro` is the persisted
 * definition that gets serialised and synced to the cloud.
 */
export interface UserMacro {
  /** UUID v4 */
  id: string;
  /** Display name, e.g. 'Movie Night' */
  name: string;
  /** Icon name for the macro tile */
  icon?: string;
  /** Sort position in the macros list */
  sort_order: number;
  /** Unix timestamp (seconds) */
  created_at: number;
  /** Unix timestamp (seconds) */
  updated_at: number;
}

/**
 * A single step in a `UserMacro`.
 */
export interface UserMacroStep {
  /** UUID v4 */
  id: string;
  /** FK → UserMacro.id */
  macro_id: string;
  /** 0-based execution order */
  step_order: number;
  /** FK → UserDevice.id */
  user_device_id: string;
  /** Command name, e.g. 'power_on' */
  command_name: string;
  /**
   * Optional free-form value passed to the command dispatcher.
   * e.g. '25' for temperature, '50' for volume level.
   */
  command_value?: string;
  /** Milliseconds to wait after this step before executing next step */
  delay_after_ms: number;
  /** How many times to repeat this step (default: 1) */
  repeat_count: number;
}

// ─── Custom Layout ─────────────────────────────────────────────────────────

/**
 * A user-customised remote layout for a specific paired device.
 *
 * When `is_active` is true, this layout is shown instead of the
 * default catalog layout for the device.
 *
 * `sections_json` is a serialised `RemoteLayoutSection[]`.
 */
export interface CustomLayout {
  /** UUID v4 */
  id: string;
  /** FK → UserDevice.id */
  user_device_id: string;
  /** Display name, e.g. 'My Compact Layout' */
  name: string;
  /** Number of grid columns (typically 4–6) */
  columns: number;
  /** JSON-serialised RemoteLayoutSection[] */
  sections_json: string;
  /** True when this layout is currently active for the device */
  is_active: boolean;
  /** Unix timestamp (seconds) */
  created_at: number;
  /** Unix timestamp (seconds) */
  updated_at: number;
}

// ─── Aggregate helpers ─────────────────────────────────────────────────────

/**
 * Full device view used by the UI: user device + resolved catalog model.
 * Returned by the device repository layer; never stored directly.
 */
export interface ResolvedUserDevice {
  device: UserDevice;
  /**
   * Resolved display name:
   *   nickname → model_name → category fallback
   */
  displayName: string;
  /**
   * Resolved thumbnail URI:
   *   catalog thumbnail → generic category icon URI
   */
  thumbnailUri?: string;
  /** Active layout id (custom or catalog default) */
  activeLayoutId: string;
}
