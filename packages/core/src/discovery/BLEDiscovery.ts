import { DiscoveredDevice } from './DeviceDiscovery';

/**
 * Discovers devices via Bluetooth Low Energy scanning.
 */
export class BLEDiscovery {
  async discover(): Promise<DiscoveredDevice[]> {
    try {
      const { BLEModule } = await import('@remote/native-modules');
      const deviceIds = await BLEModule.scanForDevices();
      return deviceIds.map(id => ({ id, address: id, source: 'ble' as const, type: undefined }));
    } catch {
      return [];
    }
  }
}
