import { BaseProtocol } from './BaseProtocol';
import { SupportedProtocol } from '../types/Device';

/**
 * Matter (formerly Project CHIP) protocol implementation.
 */
export class MatterProtocol extends BaseProtocol {
  readonly type: SupportedProtocol = 'matter';

  async isAvailable(): Promise<boolean> {
    try {
      const { MatterModule } = await import('@remote/native-modules');
      return MatterModule.isAvailable();
    } catch {
      return false;
    }
  }

  async discover(): Promise<string[]> {
    try {
      const { MatterModule } = await import('@remote/native-modules');
      return MatterModule.discoverDevices();
    } catch {
      return [];
    }
  }

  async connect(deviceId: string): Promise<void> {
    const { MatterModule } = await import('@remote/native-modules');
    await MatterModule.commission(deviceId);
  }

  async send(deviceId: string, payload: string): Promise<void> {
    const { MatterModule } = await import('@remote/native-modules');
    await MatterModule.invoke(deviceId, payload);
  }

  async disconnect(deviceId: string): Promise<void> {
    const { MatterModule } = await import('@remote/native-modules');
    await MatterModule.decommission(deviceId);
  }
}
