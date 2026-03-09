/**
 * JavaScript interface for Matter (Project CHIP) protocol.
 */
export const MatterModule = {
  async isAvailable(): Promise<boolean> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
      const NativeMatter = require('react-native').NativeModules.Matter;
      return NativeMatter != null;
    } catch {
      return false;
    }
  },

  async discoverDevices(): Promise<string[]> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
    const NativeMatter = require('react-native').NativeModules.Matter;
    if (!NativeMatter) return [];
    return NativeMatter.discoverDevices() as Promise<string[]>;
  },

  async commission(deviceId: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
    const NativeMatter = require('react-native').NativeModules.Matter;
    if (!NativeMatter) throw new Error('[MatterModule] Not available');
    await NativeMatter.commission(deviceId);
  },

  async invoke(deviceId: string, payload: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
    const NativeMatter = require('react-native').NativeModules.Matter;
    if (!NativeMatter) throw new Error('[MatterModule] Not available');
    await NativeMatter.invoke(deviceId, payload);
  },

  async decommission(deviceId: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
    const NativeMatter = require('react-native').NativeModules.Matter;
    if (!NativeMatter) throw new Error('[MatterModule] Not available');
    await NativeMatter.decommission(deviceId);
  },
};
