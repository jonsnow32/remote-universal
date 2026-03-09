import { WiFiProtocol } from '@remote/core';

/** Daikin Cloud / Onecta API integration */
export class DaikinCloud extends WiFiProtocol {
  constructor(private readonly accessToken: string) {
    super();
  }

  async send(deviceId: string, payload: string): Promise<void> {
    const parsed = JSON.parse(payload) as { path: string; params: Record<string, string> };
    const query = new URLSearchParams(parsed.params).toString();

    const response = await fetch(
      `http://${deviceId}${parsed.path}?${query}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`[DaikinCloud] HTTP ${response.status}: ${response.statusText}`);
    }
  }
}
