import { BaseProtocol } from './BaseProtocol';
import { SupportedProtocol } from '../types/Device';

/**
 * Infrared (IR) protocol implementation.
 * Delegates blasting to the native IR module.
 */
export class IRProtocol extends BaseProtocol {
  readonly type: SupportedProtocol = 'ir';

  async isAvailable(): Promise<boolean> {
    // Check via native module whether IR blaster is present
    try {
      // Lazy import to avoid bundling native code in non-native contexts
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { IRModule } = await import('@remote/native-modules');
      return IRModule.isAvailable();
    } catch {
      return false;
    }
  }

  async discover(): Promise<string[]> {
    // IR is stateless — devices are known by their IR codes, not discovered
    return [];
  }

  async connect(_deviceId: string): Promise<void> {
    // IR is connectionless
  }

  async send(deviceId: string, payload: string): Promise<void> {
    const { IRModule } = await import('@remote/native-modules');
    await IRModule.transmit(deviceId, payload);
  }

  async disconnect(_deviceId: string): Promise<void> {
    // IR is connectionless
  }
}
