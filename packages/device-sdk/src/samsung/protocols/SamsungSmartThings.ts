import { WiFiProtocol } from '@remote/core';

/**
 * Samsung SmartThings cloud/LAN integration.
 * Extends WiFiProtocol to add SmartThings-specific headers and authentication.
 */
export class SamsungSmartThings extends WiFiProtocol {
  constructor(private readonly apiKey: string) {
    super();
  }

  async send(deviceId: string, payload: string): Promise<void> {
    const response = await fetch(
      `https://api.smartthings.com/v1/devices/${deviceId}/commands`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: payload,
      }
    );

    if (!response.ok) {
      throw new Error(
        `[SmartThings] HTTP ${response.status} for device ${deviceId}: ${response.statusText}`
      );
    }
  }
}
