import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DeviceType } from '@remote/core';

// ─── Protocol types ──────────────────────────────────────────────────────────

export type ConnectionProtocol = 'wifi' | 'ble' | 'ir' | 'homekit' | 'matter';

// ─── Discovered / saved device ───────────────────────────────────────────────

export type DeviceCategory = 'tv' | 'ac' | 'speaker' | 'light';

export interface SavedDevice {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: DeviceCategory;
  location: string;
  protocol: ConnectionProtocol;
  address: string;
  deviceType: DeviceType;
  layoutId?: string;
}

// ─── Layout options ──────────────────────────────────────────────────────────

/** A layout ID string referencing an entry in the device-sdk layout registry. */
export type LayoutVariant = string;

// ─── Navigation param lists ──────────────────────────────────────────────────

export type RootStackParamList = {
  /** Main discovery screen — first screen user sees */
  Discovery: undefined;
  /** Connection process → layout selection → remote control */
  Remote: {
    deviceId: string;
    deviceName: string;
    address: string;
    deviceType: DeviceType;
    protocol: ConnectionProtocol;
    brand?: string;
    /** Device model number (e.g. 'QN85B'). Used for IR code lookup. */
    model?: string;
    /** Pre-selected IR codeset ID from the setup flow. */
    codesetId?: string;
    layoutId?: string;
  };
  /** Settings accessible from gear icon */
  Settings: undefined;
};

// ─── Screen prop helpers ─────────────────────────────────────────────────────

export type DiscoveryScreenProps = NativeStackScreenProps<RootStackParamList, 'Discovery'>;
export type RemoteScreenProps = NativeStackScreenProps<RootStackParamList, 'Remote'>;
export type SettingsScreenProps = NativeStackScreenProps<RootStackParamList, 'Settings'>;
