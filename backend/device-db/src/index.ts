export const DeviceDB = {
  async getDevice(id: string): Promise<{ id: string } | null> {
    // Fetch from Supabase or other DB
    return { id };
  },

  async listDevices(): Promise<{ id: string }[]> {
    return [];
  },
};
