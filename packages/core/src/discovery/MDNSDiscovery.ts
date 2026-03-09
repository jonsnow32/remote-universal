import { DiscoveredDevice } from './DeviceDiscovery';

/**
 * Discovers devices via mDNS/Bonjour (e.g., Chromecast, AirPlay, Roku).
 */
export class MDNSDiscovery {
  async discover(): Promise<DiscoveredDevice[]> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const zeroconf = await import('react-native-zeroconf');
      return zeroconf.default.scan('_googlecast._tcp', 'local.');
    } catch {
      return [];
    }
  }
}
