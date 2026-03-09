/**
 * JavaScript interface for Apple HomeKit integration.
 * Requires react-native-homekit or HAP-NodeJS.
 */
export const HomeKitModule = {
  async isAvailable(): Promise<boolean> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
      const NativeHK = require('react-native').NativeModules.HomeKit;
      return NativeHK != null;
    } catch {
      return false;
    }
  },

  async getAccessories(): Promise<string[]> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
    const NativeHK = require('react-native').NativeModules.HomeKit;
    if (!NativeHK) return [];
    return NativeHK.getAccessories() as Promise<string[]>;
  },

  async sendCharacteristic(deviceId: string, payload: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
    const NativeHK = require('react-native').NativeModules.HomeKit;
    if (!NativeHK) throw new Error('[HomeKitModule] Not available');
    await NativeHK.sendCharacteristic(deviceId, payload);
  },
};
