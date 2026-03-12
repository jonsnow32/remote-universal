import { DiscoveredDevice, DeviceType } from './DeviceDiscovery';

interface ZCService {
  name: string;
  fullName: string;
  host: string;
  addresses: string[];
  port: number;
  txt: Record<string, string>;
}

interface ZCInstance {
  scan(type: string, protocol: string, domain: string): void;
  stop(): void;
  removeDeviceListeners(): void;
  on(event: string, cb: (...args: unknown[]) => void): void;
}

/**
 * Service types to scan for. Each type maps to a common smart-device category.
 * react-native-zeroconf scan() takes the simple name (no leading underscore, no ._tcp.local.).
 */
const SCAN_SERVICES: Array<{ type: string; protocol: string; deviceType: DeviceType }> = [
  { type: 'googlecast',        protocol: 'tcp', deviceType: 'tv' },  // Chromecast / Google TV
  { type: 'airplay',           protocol: 'tcp', deviceType: 'tv' },  // Apple TV / AirPlay
  { type: 'amzn-wplay',       protocol: 'tcp', deviceType: 'stb' }, // Amazon Fire TV
  { type: 'smarttv-rest',     protocol: 'tcp', deviceType: 'tv' },  // Tizen / Samsung smart TVs
  { type: 'androidtvremote2', protocol: 'tcp', deviceType: 'stb' }, // Android TV (NVIDIA Shield, etc.) v2
  { type: 'androidtvremote',  protocol: 'tcp', deviceType: 'stb' }, // Android TV (legacy)
];

/**
 * Discovers devices via mDNS/Bonjour (e.g., Chromecast, AirPlay, Roku).
 *
 * react-native-zeroconf uses an event-emitter API — scan() is synchronous
 * and results arrive via 'resolved' events. We wrap each scan in a Promise
 * with a timeout so callers get a plain async list of devices.
 */
export class MDNSDiscovery {
  async discover(timeoutMs = 5000): Promise<DiscoveredDevice[]> {
    const all: DiscoveredDevice[] = [];
    const seen = new Set<string>();

    // Run service type scans sequentially. Android's NsdManager has a limited
    // number of concurrent discovery listeners; running them all in parallel
    // causes silent failures. Each scan is given a short individual window so
    // the total stays within the caller's timeoutMs budget.
    const perTypeBudget = Math.floor(timeoutMs / SCAN_SERVICES.length);

    for (const { type, protocol, deviceType } of SCAN_SERVICES) {
      try {
        const devices = await this.scanServiceType(type, protocol, deviceType, perTypeBudget);
        for (const device of devices) {
          if (!seen.has(device.id)) {
            seen.add(device.id);
            all.push(device);
          }
        }
      } catch { /* per-type failures are non-fatal */ }
    }

    return all;
  }

  private scanServiceType(
    serviceType: string,
    protocol: string,
    deviceType: DeviceType,
    timeoutMs: number
  ): Promise<DiscoveredDevice[]> {
    return new Promise<DiscoveredDevice[]>((resolve) => {
      const results: DiscoveredDevice[] = [];
      const seen = new Set<string>();
      let zc: ZCInstance | undefined;

      function done() {
        clearTimeout(timer);
        try { zc?.stop(); } catch { /* ignore */ }
        try { zc?.removeDeviceListeners(); } catch { /* ignore */ }
        resolve(results);
      }

      let timer: ReturnType<typeof setTimeout>;

      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Zeroconf = (require('react-native-zeroconf') as { default: new () => ZCInstance }).default;
        zc = new Zeroconf();

        zc.on('resolved', (...args: unknown[]) => {
          const service = args[0] as ZCService;
          const address = service.addresses?.[0] ?? service.host ?? '';
          const id = `mdns-${serviceType}-${service.name}-${address}`;
          if (!seen.has(id)) {
            seen.add(id);
            results.push({
              id,
              address,
              name: service.txt?.fn ?? service.fullName ?? service.name,
              source: 'mdns',
              type: deviceType,
            });
          }
        });

        zc.on('error', (...args: unknown[]) => {
          const err = args[0];
          console.warn(
            `[MDNSDiscovery:${serviceType}]`,
            err instanceof Error ? err.message : String(err)
          );
        });

        timer = setTimeout(done, timeoutMs);
        zc.scan(serviceType, protocol, 'local');
      } catch {
        resolve(results);
      }
    });
  }
}
