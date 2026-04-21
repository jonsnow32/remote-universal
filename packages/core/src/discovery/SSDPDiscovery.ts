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
 * Google Cast device info returned by http://<ip>:8008/setup/eureka_info
 * Supported by: Chromecast, NVIDIA Shield TV, Mi Box, Android TV, Google TV.
 */
interface CastDeviceInfo {
  name?: string;
  model_name?: string;
  manufacturer?: string;
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
    // Probe each IP for both Samsung TV (port 8001) and Cast devices (port 8008) simultaneously.
    const probes = candidates.flatMap(ip => [
      this.probeSamsungTV(ip),
      this.probeCastDevice(ip),
    ]);
    const settled = await Promise.allSettled(probes);

    const results = settled
      .filter(
        (r): r is PromiseFulfilledResult<DiscoveredDevice | null> =>
          r.status === 'fulfilled' && r.value !== null
      )
      .map(r => r.value as DiscoveredDevice);

    // Deduplicate by address (a device might respond on both Samsung and Cast ports).
    const seen = new Set<string>();
    return results.filter(d => {
      if (seen.has(d.address)) return false;
      seen.add(d.address);
      return true;
    });
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
        type: 'tv' as const,
      };
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  }

  /**
   * Probes a Google Cast device at http://<ip>:8008/setup/eureka_info.
   * Responds on: NVIDIA Shield TV, Chromecast, Mi Box, Android TV, Google TV.
   */
  private async probeCastDevice(ip: string): Promise<DiscoveredDevice | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      SSDPDiscovery.PROBE_TIMEOUT_MS
    );

    try {
      const response = await fetch(`http://${ip}:8008/setup/eureka_info`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) return null;

      const data = (await response.json()) as CastDeviceInfo;
      const name = data.name ?? data.model_name ?? 'Cast Device';
      // Infer device type: STB for Android TV / Shield, TV for plain Chromecast.
      const modelLower = (data.model_name ?? '').toLowerCase();
      const isChromecastDongle =
        modelLower.includes('chromecast') && !modelLower.includes('google tv');
      return {
        id: `ssdp-cast-${ip}`,
        address: ip,
        name,
        source: 'ssdp',
        type: isChromecastDongle ? 'tv' : 'stb',
      };
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  }
}
