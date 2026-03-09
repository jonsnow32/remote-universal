import { WiFiProtocol } from '@remote/core';

/** LG ThinQ cloud API integration */
export class LGThinQ extends WiFiProtocol {
  constructor(private readonly accessToken: string) {
    super();
  }

  async send(deviceId: string, payload: string): Promise<void> {
    const response = await fetch(
      `https://kic.lgthinq.com:46030/api/devices/${deviceId}/control`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': 'lg.thinq.remote',
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: payload,
      }
    );

    if (!response.ok) {
      throw new Error(`[LGThinQ] HTTP ${response.status}: ${response.statusText}`);
    }
  }
}
