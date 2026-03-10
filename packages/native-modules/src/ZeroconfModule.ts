/**
 * Promise-based wrapper around react-native-zeroconf.
 *
 * react-native-zeroconf uses an event-emitter API where scan() is synchronous
 * and results arrive via 'resolved' events. This module wraps that pattern
 * in a Promise + timeout so callers can simply await the results.
 */

export interface ZeroconfDevice {
  /** Human-readable name from mDNS TXT record or fullName */
  name: string;
  /** Primary IP address */
  address: string;
  /** Service port */
  port: number;
  /** Service type that was scanned (e.g. 'googlecast', 'airplay') */
  serviceType: string;
  /** Raw TXT record values */
  txt: Record<string, string>;
}

interface ZCServiceRaw {
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

export const ZeroconfModule = {
  /**
   * Scans for mDNS/Bonjour services and returns discovered devices.
   *
   * @param type - Service type without leading underscore, e.g. 'googlecast', 'airplay'
   * @param protocol - TCP or UDP (most services use 'tcp')
   * @param timeoutMs - How long to scan before resolving (default 5000 ms)
   */
  async scan(
    type: string,
    protocol: 'tcp' | 'udp' = 'tcp',
    timeoutMs = 5000
  ): Promise<ZeroconfDevice[]> {
    return new Promise<ZeroconfDevice[]>((resolve) => {
      const devices: ZeroconfDevice[] = [];
      const seen = new Set<string>();
      let zc: ZCInstance | undefined;

      function done() {
        clearTimeout(timer);
        try { zc?.stop(); } catch { /* ignore native teardown errors */ }
        try { zc?.removeDeviceListeners(); } catch { /* ignore */ }
        resolve(devices);
      }

      let timer: ReturnType<typeof setTimeout>;

      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Zeroconf = (require('react-native-zeroconf') as { default: new () => ZCInstance }).default;
        zc = new Zeroconf();

        zc.on('resolved', (...args: unknown[]) => {
          const service = args[0] as ZCServiceRaw;
          const address = service.addresses?.[0] ?? service.host ?? '';
          const key = `${service.name}-${address}`;
          if (!seen.has(key)) {
            seen.add(key);
            devices.push({
              name: service.txt?.fn ?? service.fullName ?? service.name,
              address,
              port: service.port ?? 0,
              serviceType: type,
              txt: service.txt ?? {},
            });
          }
        });

        zc.on('error', (...args: unknown[]) => {
          const err = args[0];
          console.warn('[ZeroconfModule] scan error:', err instanceof Error ? err.message : String(err));
        });

        timer = setTimeout(done, timeoutMs);
        zc.scan(type, protocol, 'local');
      } catch {
        resolve(devices);
      }
    });
  },
};
