import { MDNSDiscovery } from './MDNSDiscovery';
import { SSDPDiscovery } from './SSDPDiscovery';
import { BLEDiscovery } from './BLEDiscovery';
import { HubDiscovery } from './HubDiscovery';

export interface DiscoveredDevice {
  id: string;
  address: string;
  name?: string;
  source: 'mdns' | 'ssdp' | 'ble' | 'hub';
}

/**
 * Orchestrates all discovery channels and merges results.
 */
export class DeviceDiscovery {
  private readonly mdns = new MDNSDiscovery();
  private readonly ssdp = new SSDPDiscovery();
  private readonly ble = new BLEDiscovery();
  private readonly hub = new HubDiscovery();

  /**
   * Runs all discovery channels concurrently and returns merged, deduplicated results.
   */
  async discoverAll(): Promise<DiscoveredDevice[]> {
    const [mdnsDevices, ssdpDevices, bleDevices, hubDevices] = await Promise.allSettled([
      this.mdns.discover(),
      this.ssdp.discover(),
      this.ble.discover(),
      this.hub.discover(),
    ]);

    const results: DiscoveredDevice[] = [];

    if (mdnsDevices.status === 'fulfilled') results.push(...mdnsDevices.value);
    if (ssdpDevices.status === 'fulfilled') results.push(...ssdpDevices.value);
    if (bleDevices.status === 'fulfilled') results.push(...bleDevices.value);
    if (hubDevices.status === 'fulfilled') results.push(...hubDevices.value);

    return this.deduplicate(results);
  }

  private deduplicate(devices: DiscoveredDevice[]): DiscoveredDevice[] {
    const seen = new Set<string>();
    return devices.filter(d => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });
  }
}
