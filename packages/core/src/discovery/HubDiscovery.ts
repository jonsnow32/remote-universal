import { DiscoveredDevice } from './DeviceDiscovery';

/**
 * Discovers devices registered with a local or cloud hub (e.g., SmartThings, Google Home).
 */
export class HubDiscovery {
  async discover(): Promise<DiscoveredDevice[]> {
    // Hub discovery fetches device list from the cloud SDK
    try {
      const { CloudSync } = await import('@remote/cloud-sdk');
      const devices = await CloudSync.getRegisteredDevices();
      return devices.map((d: { id: string; address: string; name?: string; type?: string }) => ({
        id: d.id,
        address: d.address,
        name: d.name,
        source: 'hub' as const,
        type: (d.type as import('./DeviceDiscovery').DeviceType) ?? undefined,
      }));
    } catch {
      return [];
    }
  }
}
