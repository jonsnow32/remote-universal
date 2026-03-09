import { BaseProtocol } from './BaseProtocol';
import { SupportedProtocol } from '../types/Device';

/**
 * Apple HomeKit protocol implementation.
 */
export class HomeKitProtocol extends BaseProtocol {
  readonly type: SupportedProtocol = 'homekit';

  async isAvailable(): Promise<boolean> {
    try {
      const { HomeKitModule } = await import('@remote/native-modules');
      return HomeKitModule.isAvailable();
    } catch {
      return false;
    }
  }

  async discover(): Promise<string[]> {
    try {
      const { HomeKitModule } = await import('@remote/native-modules');
      return HomeKitModule.getAccessories();
    } catch {
      return [];
    }
  }

  async connect(_deviceId: string): Promise<void> {
    // HomeKit manages connections internally
  }

  async send(deviceId: string, payload: string): Promise<void> {
    const { HomeKitModule } = await import('@remote/native-modules');
    await HomeKitModule.sendCharacteristic(deviceId, payload);
  }

  async disconnect(_deviceId: string): Promise<void> {
    // Managed by HomeKit framework
  }
}
