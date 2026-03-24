/**
 * JavaScript interface for Apple HomeKit integration.
 * Requires react-native-homekit or HAP-NodeJS.
 */
export const HomeKitModule = {
    async isAvailable() {
        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
            const NativeHK = require('react-native').NativeModules.HomeKit;
            return NativeHK != null;
        }
        catch {
            return false;
        }
    },
    async getAccessories() {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
        const NativeHK = require('react-native').NativeModules.HomeKit;
        if (!NativeHK)
            return [];
        return NativeHK.getAccessories();
    },
    async sendCharacteristic(deviceId, payload) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires
        const NativeHK = require('react-native').NativeModules.HomeKit;
        if (!NativeHK)
            throw new Error('[HomeKitModule] Not available');
        await NativeHK.sendCharacteristic(deviceId, payload);
    },
};
//# sourceMappingURL=HomeKitModule.js.map