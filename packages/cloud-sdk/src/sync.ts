export interface RegisteredDevice {
  id: string;
  address: string;
  name?: string;
  brand: string;
  model: string;
}

export const CloudSync = {
  async getRegisteredDevices(): Promise<RegisteredDevice[]> {
    try {
      const response = await fetch('/api/devices', {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) return [];
      return response.json() as Promise<RegisteredDevice[]>;
    } catch {
      return [];
    }
  },

  async syncDeviceState(deviceId: string, state: Record<string, unknown>): Promise<void> {
    await fetch(`/api/devices/${deviceId}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
  },
};
