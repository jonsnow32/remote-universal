/**
 * JavaScript interface for Matter (Project CHIP) protocol.
 */
export const MatterModule = {
    async isAvailable() {
        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
            const NativeMatter = require('react-native').NativeModules.Matter;
            return NativeMatter != null;
        }
        catch {
            return false;
        }
    },
    async discoverDevices() {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
        const NativeMatter = require('react-native').NativeModules.Matter;
        if (!NativeMatter)
            return [];
        return NativeMatter.discoverDevices();
    },
    async commission(deviceId) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
        const NativeMatter = require('react-native').NativeModules.Matter;
        if (!NativeMatter)
            throw new Error('[MatterModule] Not available');
        await NativeMatter.commission(deviceId);
    },
    async invoke(deviceId, payload) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
        const NativeMatter = require('react-native').NativeModules.Matter;
        if (!NativeMatter)
            throw new Error('[MatterModule] Not available');
        await NativeMatter.invoke(deviceId, payload);
    },
    async decommission(deviceId) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
        const NativeMatter = require('react-native').NativeModules.Matter;
        if (!NativeMatter)
            throw new Error('[MatterModule] Not available');
        await NativeMatter.decommission(deviceId);
    },
};
//# sourceMappingURL=MatterModule.js.map