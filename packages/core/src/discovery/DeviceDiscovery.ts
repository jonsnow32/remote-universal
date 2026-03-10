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

/** Default scan window in milliseconds. */
const DEFAULT_TIMEOUT_MS = 8_000;

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
   * @param timeoutMs - Maximum time to wait for any single channel (default 8 s)
   */
  async discoverAll(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<DiscoveredDevice[]> {
    const raceWithTimeout = <T>(p: Promise<T[]>): Promise<T[]> =>
      Promise.race([
        p,
        new Promise<T[]>(resolve => setTimeout(() => resolve([]), timeoutMs)),
      ]);

    const [mdnsDevices, ssdpDevices, bleDevices, hubDevices] = await Promise.allSettled([
      raceWithTimeout(this.mdns.discover(timeoutMs)),
      raceWithTimeout(this.ssdp.discover()),
      raceWithTimeout(this.ble.discover()),
      raceWithTimeout(this.hub.discover()),
    ]);

    const results: DiscoveredDevice[] = [];

    if (mdnsDevices.status === 'fulfilled') results.push(...mdnsDevices.value);
    if (ssdpDevices.status === 'fulfilled') results.push(...ssdpDevices.value);
    if (bleDevices.status === 'fulfilled') results.push(...bleDevices.value);
    if (hubDevices.status === 'fulfilled') results.push(...hubDevices.value);

    return this.deduplicate(results);
  }

  /**
   * Streams discovered devices to `onDeviceFound` as each channel reports them,
   * rather than waiting for all channels to finish. Useful for progressive UI updates.
   *
   * @param onDeviceFound - Called for each newly discovered device (may be called concurrently)
   * @param timeoutMs - Maximum total scan time (default 8 s)
   * @returns All discovered devices after timeout
   */
  async discoverStream(
    onDeviceFound: (device: DiscoveredDevice) => void,
    timeoutMs = DEFAULT_TIMEOUT_MS
  ): Promise<DiscoveredDevice[]> {
    const all: DiscoveredDevice[] = [];
    const seen = new Set<string>();

    const emitIfNew = (device: DiscoveredDevice): void => {
      if (!seen.has(device.id)) {
        seen.add(device.id);
        all.push(device);
        onDeviceFound(device);
      }
    };

    const withEmit = async (
      channelPromise: Promise<DiscoveredDevice[]>
    ): Promise<void> => {
      try {
        const devices = await channelPromise;
        devices.forEach(emitIfNew);
      } catch { /* individual channel failures are non-fatal */ }
    };

    await Promise.race([
      Promise.all([
        withEmit(this.mdns.discover(timeoutMs)),
        withEmit(this.ssdp.discover()),
        withEmit(this.ble.discover()),
        withEmit(this.hub.discover()),
      ]),
      new Promise<void>(resolve => setTimeout(resolve, timeoutMs)),
    ]);

    return all;
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
