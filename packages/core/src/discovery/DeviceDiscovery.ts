import { MDNSDiscovery } from './MDNSDiscovery';
import { SSDPDiscovery } from './SSDPDiscovery';
import { BLEDiscovery } from './BLEDiscovery';
import { HubDiscovery } from './HubDiscovery';

export type DeviceType = 'tv' | 'ac' | 'speaker' | 'soundbar' | 'projector' | 'fan' | 'light' | 'stb';

export interface DiscoveredDevice {
  id: string;
  address: string;
  name?: string;
  source: 'mdns' | 'ssdp' | 'ble' | 'hub';
  /** All discovery sources that found this device. */
  sources?: Array<'mdns' | 'ssdp' | 'ble' | 'hub'>;
  /** Device category inferred at discovery time from protocol metadata. */
  type?: DeviceType;
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
    const byAddress = new Map<string, DiscoveredDevice>();

    const emitIfNew = (device: DiscoveredDevice): void => {
      const existing = byAddress.get(device.address);
      if (!existing) {
        const merged = { ...device, sources: [device.source] };
        byAddress.set(device.address, merged);
        all.push(merged);
        onDeviceFound(merged);
      } else {
        // Merge info from additional channel into existing entry
        if (!existing.sources!.includes(device.source)) {
          existing.sources!.push(device.source);
        }
        if (device.name && (!existing.name || existing.name === existing.id)) {
          existing.name = device.name;
        }
        if (device.type && !existing.type) {
          existing.type = device.type;
        }
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

  /**
   * Merges devices by address so the same physical device discovered via
   * multiple channels (mDNS, SSDP, BLE, hub) appears only once.
   * Prefers the entry with a name over anonymous ones.
   */
  private deduplicate(devices: DiscoveredDevice[]): DiscoveredDevice[] {
    const byAddress = new Map<string, DiscoveredDevice>();
    for (const d of devices) {
      const key = d.address;
      const existing = byAddress.get(key);
      if (!existing) {
        byAddress.set(key, { ...d, sources: [d.source] });
      } else {
        // Accumulate sources
        if (!existing.sources!.includes(d.source)) {
          existing.sources!.push(d.source);
        }
        // Prefer a real name over a generic/missing one
        if (d.name && (!existing.name || existing.name === existing.id)) {
          existing.name = d.name;
        }
        // Prefer a more specific type (non-undefined)
        if (d.type && !existing.type) {
          existing.type = d.type;
        }
      }
    }
    return Array.from(byAddress.values());
  }
}
