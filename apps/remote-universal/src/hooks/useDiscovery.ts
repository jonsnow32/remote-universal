import { useState, useCallback, useRef, useEffect } from 'react';
import { DeviceDiscovery } from '@remote/core';
import type { DiscoveredDevice } from '@remote/core';
import type { ConnectionProtocol, SavedDevice } from '../types/navigation';

const discovery = new DeviceDiscovery();

export type DiscoveryStatus = 'idle' | 'scanning' | 'done';

/** Map discovery source → protocol */
function sourceToProtocol(source: string): ConnectionProtocol {
  switch (source) {
    case 'ble': return 'ble';
    case 'hub': return 'ir';
    default: return 'wifi';
  }
}

/** Infer brand from device id/name */
function inferBrand(device: DiscoveredDevice): string {
  const id = device.id.toLowerCase();
  const name = (device.name ?? '').toLowerCase();
  if (id.includes('samsung') || name.includes('samsung')) return 'Samsung';
  if (id.includes('lg') || name.includes('lg')) return 'LG';
  if (id.includes('daikin') || name.includes('daikin')) return 'Daikin';
  if (id.includes('sony') || name.includes('sony')) return 'Sony';
  if (id.includes('panasonic') || name.includes('panasonic')) return 'Panasonic';
  return 'Unknown';
}

/** Infer layout id from device info */
function inferLayoutId(device: DiscoveredDevice): string | undefined {
  const id = device.id.toLowerCase();
  const name = (device.name ?? '').toLowerCase();
  if (id.includes('samsung') || name.includes('samsung')) return 'samsung-tv';
  if (id.includes('lg') || name.includes('lg')) return 'lg-tv';
  if (id.includes('daikin') || name.includes('daikin')) return 'daikin-ac';
  if (id.includes('androidtvremote') || name.includes('shield') || name.includes('android tv')) return 'universal-stb';
  return undefined;
}

/** Infer location from device info */
function inferLocation(device: DiscoveredDevice): string {
  const name = (device.name ?? '').toLowerCase();
  if (name.includes('living') || name.includes('salon')) return 'Living Room';
  if (name.includes('bed') || name.includes('chambre')) return 'Bedroom';
  if (name.includes('study') || name.includes('office')) return 'Study';
  if (name.includes('kitchen')) return 'Kitchen';
  return 'My Room';
}

export interface DiscoveredDeviceInfo {
  raw: DiscoveredDevice;
  name: string;
  brand: string;
  location: string;
  protocol: ConnectionProtocol;
  deviceType: 'tv' | 'ac' | 'speaker' | 'soundbar' | 'projector' | 'fan' | 'light' | 'stb';
  layoutId?: string;
}

export function useDiscovery() {
  const [status, setStatus] = useState<DiscoveryStatus>('idle');
  const [devices, setDevices] = useState<DiscoveredDeviceInfo[]>([]);
  const scanRef = useRef(false);

  const startScan = useCallback(async () => {
    if (scanRef.current) return;
    scanRef.current = true;
    setStatus('scanning');
    setDevices([]);

    try {
      await discovery.discoverStream(
        (device) => {
          const info: DiscoveredDeviceInfo = {
            raw: device,
            name: device.name ?? device.id,
            brand: inferBrand(device),
            location: inferLocation(device),
            protocol: sourceToProtocol(device.source),
            deviceType: device.type ?? 'tv',
            layoutId: inferLayoutId(device),
          };
          setDevices(prev => {
            if (prev.some(d => d.raw.id === device.id)) return prev;
            return [...prev, info];
          });
        },
        8000,
      );
    } catch {
      // scan error — just stop
    } finally {
      scanRef.current = false;
      setStatus('done');
    }
  }, []);

  const stopScan = useCallback(() => {
    scanRef.current = false;
    setStatus('done');
  }, []);

  // Auto-scan on mount
  useEffect(() => {
    void startScan();
  }, [startScan]);

  return { status, devices, startScan, stopScan };
}
