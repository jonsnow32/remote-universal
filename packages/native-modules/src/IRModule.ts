/**
 * JavaScript interface for the native IR blaster module.
 * On iOS/Android this delegates to react-native-ir-kit or similar.
 */
export const IRModule = {
  /**
   * Checks if an IR blaster is available on this device.
   */
  async isAvailable(): Promise<boolean> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
      const NativeIR = require('react-native').NativeModules.IRKit;
      return NativeIR?.isAvailable?.() ?? false;
    } catch {
      return false;
    }
  },

  /**
   * Transmits an IR signal to a device.
   * @param deviceId - Target device identifier
   * @param payload - IR pronto hex code or NEC code string
   */
  async transmit(deviceId: string, payload: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
    const NativeIR = require('react-native').NativeModules.IRKit;
    if (!NativeIR) {
      throw new Error('[IRModule] Native IR module not available on this device.');
    }
    await NativeIR.transmit(deviceId, payload);
  },
};
