import { BaseProtocol } from './BaseProtocol';
import { SupportedProtocol } from '../types/Device';

/** Default request timeout in milliseconds. */
const DEFAULT_TIMEOUT_MS = 5_000;

/**
 * Wi-Fi / LAN protocol implementation.
 * Uses HTTP/WebSocket to communicate with devices on the local network.
 */
export class WiFiProtocol extends BaseProtocol {
  readonly type: SupportedProtocol = 'wifi';

  async isAvailable(): Promise<boolean> {
    // Wi-Fi is assumed available if we can reach the network
    return true;
  }

  async discover(): Promise<string[]> {
    // Discovery is handled by MDNSDiscovery / SSDPDiscovery
    return [];
  }

  async connect(_deviceId: string): Promise<void> {
    // HTTP is stateless; connections are established per-request
  }

  async send(deviceId: string, payload: string): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(`http://${deviceId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `[WiFi] HTTP ${response.status} from device ${deviceId}: ${response.statusText}`
        );
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async disconnect(_deviceId: string): Promise<void> {
    // Nothing to disconnect for stateless HTTP
  }
}
