export const CloudSync = {
    async getRegisteredDevices() {
        try {
            const response = await fetch('/api/devices', {
                headers: { 'Content-Type': 'application/json' },
            });
            if (!response.ok)
                return [];
            return response.json();
        }
        catch {
            return [];
        }
    },
    async syncDeviceState(deviceId, state) {
        await fetch(`/api/devices/${deviceId}/state`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state),
        });
    },
};
//# sourceMappingURL=sync.js.map