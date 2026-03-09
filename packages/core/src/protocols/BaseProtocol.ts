import { DeviceCommand } from '../types/Command';
import { SupportedProtocol } from '../types/Device';

/**
 * Abstract base class for all communication protocols.
 * Provides retry logic with exponential backoff.
 */
export abstract class BaseProtocol {
  abstract readonly type: SupportedProtocol;

  /**
   * Checks whether this protocol is available on the current device/platform.
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Discovers devices using this protocol.
   * @returns Array of discovered device IDs or addresses
   */
  abstract discover(): Promise<string[]>;

  /**
   * Establishes a connection to the target device.
   * @param deviceId - The device to connect to
   */
  abstract connect(deviceId: string): Promise<void>;

  /**
   * Sends a raw payload to the device.
   * @param deviceId - The target device
   * @param payload - Protocol-specific payload string
   */
  abstract send(deviceId: string, payload: string): Promise<void>;

  /**
   * Disconnects from the target device.
   * @param deviceId - The device to disconnect from
   */
  abstract disconnect(deviceId: string): Promise<void>;

  /**
   * Sends a command with automatic retry and exponential backoff.
   * @param command - The command to send
   * @param payload - The protocol-specific payload
   * @param retries - Maximum number of attempts (default: 3)
   */
  async sendWithRetry(
    command: DeviceCommand,
    payload: string,
    retries = 3
  ): Promise<void> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await this.send(command.deviceId, payload);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < retries - 1) {
          const backoffMs = Math.pow(2, attempt) * 100; // 100ms, 200ms, 400ms …
          await delay(backoffMs);
        }
      }
    }

    throw new Error(
      `[${this.type}] Failed to send command "${command.action}" to device "${command.deviceId}" ` +
        `after ${retries} attempts. Last error: ${lastError?.message ?? 'unknown'}`
    );
  }
}

/** Promisified delay helper */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
