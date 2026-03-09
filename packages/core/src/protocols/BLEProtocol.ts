import { BaseProtocol } from './BaseProtocol';
import { SupportedProtocol } from '../types/Device';

/**
 * Bluetooth Low Energy (BLE) protocol implementation.
 */
export class BLEProtocol extends BaseProtocol {
  readonly type: SupportedProtocol = 'ble';

  async isAvailable(): Promise<boolean> {
    try {
      const { BLEModule } = await import('@remote/native-modules');
      return BLEModule.isAvailable();
    } catch {
      return false;
    }
  }

  async discover(): Promise<string[]> {
    try {
      const { BLEModule } = await import('@remote/native-modules');
      return BLEModule.scanForDevices();
    } catch {
      return [];
    }
  }

  async connect(deviceId: string): Promise<void> {
    const { BLEModule } = await import('@remote/native-modules');
    await BLEModule.connect(deviceId);
  }

  async send(deviceId: string, payload: string): Promise<void> {
    const { BLEModule } = await import('@remote/native-modules');
    await BLEModule.write(deviceId, payload);
  }

  async disconnect(deviceId: string): Promise<void> {
    const { BLEModule } = await import('@remote/native-modules');
    await BLEModule.disconnect(deviceId);
  }
}
