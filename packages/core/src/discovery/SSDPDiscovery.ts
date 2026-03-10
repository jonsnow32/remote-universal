import { DiscoveredDevice } from './DeviceDiscovery';

/**
 * Probes a single Samsung TV at the known REST API endpoint.
 * Samsung Tizen TVs expose device info at http://<ip>:8001/api/v2/
 */
interface SamsungDeviceInfo {
  device?: {
    name?: string;
    id?: string;
    modelName?: string;
  };
}

/**
 * Discovers devices via SSDP (UPnP), e.g., Samsung SmartTV, DLNA.
 *
 * True SSDP requires sending an M-SEARCH UDP multicast to 239.255.255.255:1900,
 * which React Native cannot do without a native UDP module. As a practical
 * alternative this implementation probes Samsung Tizen TV REST endpoints
 * (port 8001) on a small range of common home-network addresses.
 *
 * To add full UPnP support, install a React Native UDP module and send:
 *   M-SEARCH * HTTP/1.1\r\n
 *   HOST: 239.255.255.255:1900\r\n
 *   MAN: "ssdp:discover"\r\n
 *   MX: 3\r\n
 *   ST: urn:samsung.com:device:RemoteControlReceiver:1\r\n\r\n
 */
export class SSDPDiscovery {
  /** Connect + read timeout per probe in milliseconds. */
  private static readonly PROBE_TIMEOUT_MS = 1_500;

  /** Subnets and host-range to check. Kept small to avoid flooding the network. */
  private static readonly SUBNETS = ['192.168.1', '192.168.0', '10.0.0', '10.0.1'];
  private static readonly HOST_RANGE: [number, number] = [1, 30];

  async discover(): Promise<DiscoveredDevice[]> {
    const candidates = this.buildCandidates();
    const probes = candidates.map(ip => this.probeSamsungTV(ip));
    const settled = await Promise.allSettled(probes);

    return settled
      .filter(
        (r): r is PromiseFulfilledResult<DiscoveredDevice | null> =>
          r.status === 'fulfilled' && r.value !== null
      )
      .map(r => r.value as DiscoveredDevice);
  }

  private buildCandidates(): string[] {
    const [start, end] = SSDPDiscovery.HOST_RANGE;
    const ips: string[] = [];
    for (const subnet of SSDPDiscovery.SUBNETS) {
      for (let host = start; host <= end; host++) {
        ips.push(`${subnet}.${host}`);
      }
    }
    return ips;
  }

  private async probeSamsungTV(ip: string): Promise<DiscoveredDevice | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      SSDPDiscovery.PROBE_TIMEOUT_MS
    );

    try {
      const response = await fetch(`http://${ip}:8001/api/v2/`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) return null;

      const data = (await response.json()) as SamsungDeviceInfo;
      const device = data.device;
      return {
        id: `ssdp-samsung-${device?.id ?? ip}`,
        address: ip,
        name: device?.name ?? device?.modelName ?? 'Samsung TV',
        source: 'ssdp',
      };
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  }
}
