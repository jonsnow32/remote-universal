/**
 * Encodes a UTF-8 string to base64 without relying on Node's Buffer class,
 * which is not available in React Native's JS runtime.
 */
function toBase64(value) {
    return btoa(unescape(encodeURIComponent(value)));
}
function getBleManager() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { BleManager } = require('react-native-ble-plx');
    return new BleManager();
}
/**
 * JavaScript interface for Bluetooth Low Energy operations.
 * Wraps react-native-ble-plx with a simplified API.
 */
export const BLEModule = {
    async isAvailable() {
        try {
            const manager = getBleManager();
            const state = await manager.state();
            return state === 'PoweredOn';
        }
        catch {
            return false;
        }
    },
    /**
     * Scans for nearby BLE devices and returns their IDs.
     * Stops after `timeoutMs` milliseconds (default 5 s).
     */
    async scanForDevices(timeoutMs = 5000) {
        const found = await BLEModule.scanForDevicesWithInfo(timeoutMs);
        return found.map(d => d.id);
    },
    /**
     * Scans for nearby BLE devices and streams results via `onDevice` callback.
     * Resolves with the full list when the timeout expires or an error occurs.
     */
    scanForDevicesWithInfo(timeoutMs = 7000, onDevice) {
        return new Promise((resolve) => {
            const found = [];
            const seen = new Set();
            let manager;
            function done() {
                clearTimeout(timer);
                try {
                    manager?.stopDeviceScan();
                }
                catch { /* ignore */ }
                resolve(found);
            }
            let timer;
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
                        const entry = { id: device.id, name: device.name ?? device.id };
                        found.push(entry);
                        onDevice?.(entry);
                    }
                });
            }
            catch {
                resolve(found);
            }
        });
    },
    async connect(deviceId) {
        const manager = getBleManager();
        await manager.connectToDevice(deviceId);
    },
    async write(deviceId, payload) {
        const manager = getBleManager();
        // Standard BLE HID-over-GATT service / characteristic UUIDs (common for remote controls)
        await manager.writeCharacteristicWithResponseForDevice(deviceId, '0000ffe0-0000-1000-8000-00805f9b34fb', '0000ffe1-0000-1000-8000-00805f9b34fb', toBase64(payload));
    },
    async disconnect(deviceId) {
        const manager = getBleManager();
        await manager.cancelDeviceConnection(deviceId);
    },
};
//# sourceMappingURL=BLEModule.js.map