/**
 * Encodes a UTF-8 string to base64 without relying on Node's Buffer class,
 * which is not available in React Native's JS runtime.
 */
function toBase64(value: string): string {
  return btoa(unescape(encodeURIComponent(value)));
}

interface BleDevice {
  id: string;
  name?: string | null;
}

interface BleManagerInstance {
  state(): Promise<string>;
  connectToDevice(id: string): Promise<unknown>;
  cancelDeviceConnection(id: string): Promise<unknown>;
  stopDeviceScan(): void;
  startDeviceScan(
    uuids: string[] | null,
    options: unknown,
    callback: (error: Error | null, device: BleDevice | null) => void
  ): void;
  writeCharacteristicWithResponseForDevice(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string,
    base64Value: string
  ): Promise<unknown>;
}

function getBleManager(): BleManagerInstance {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { BleManager } = require('react-native-ble-plx') as {
    BleManager: new () => BleManagerInstance;
  };
  return new BleManager();
}

/**
 * JavaScript interface for Bluetooth Low Energy operations.
 * Wraps react-native-ble-plx with a simplified API.
 */
export const BLEModule = {
  async isAvailable(): Promise<boolean> {
    try {
      const manager = getBleManager();
      const state = await manager.state();
      return state === 'PoweredOn';
    } catch {
      return false;
    }
  },

  /**
   * Scans for nearby BLE devices and returns their IDs.
   * Stops after `timeoutMs` milliseconds (default 5 s).
   */
  async scanForDevices(timeoutMs = 5000): Promise<string[]> {
    return new Promise<string[]>((resolve) => {
      const deviceIds: string[] = [];
      const seen = new Set<string>();
      let manager: BleManagerInstance | undefined;

      function done() {
        clearTimeout(timer);
        try { manager?.stopDeviceScan(); } catch { /* ignore */ }
        resolve(deviceIds);
      }

      let timer: ReturnType<typeof setTimeout>;

      try {
        manager = getBleManager();
        timer = setTimeout(done, timeoutMs);

        manager.startDeviceScan(null, null, (error, device) => {
          if (error) {
            done();
            return;
          }
          if (device?.id && !seen.has(device.id)) {
            seen.add(device.id);
            deviceIds.push(device.id);
          }
        });
      } catch {
        resolve(deviceIds);
      }
    });
  },

  async connect(deviceId: string): Promise<void> {
    const manager = getBleManager();
    await manager.connectToDevice(deviceId);
  },

  async write(deviceId: string, payload: string): Promise<void> {
    const manager = getBleManager();
    // Standard BLE HID-over-GATT service / characteristic UUIDs (common for remote controls)
    await manager.writeCharacteristicWithResponseForDevice(
      deviceId,
      '0000ffe0-0000-1000-8000-00805f9b34fb',
      '0000ffe1-0000-1000-8000-00805f9b34fb',
      toBase64(payload)
    );
  },

  async disconnect(deviceId: string): Promise<void> {
    const manager = getBleManager();
    await manager.cancelDeviceConnection(deviceId);
  },
};
