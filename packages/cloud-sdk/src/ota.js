export const OTAService = {
    async checkForUpdate(currentVersion, brandId) {
        try {
            const response = await fetch(`/api/ota/latest?brand=${brandId}&current=${currentVersion}`);
            if (!response.ok)
                return null;
            const data = (await response.json());
            return data.hasUpdate ? data : null;
        }
        catch {
            return null;
        }
    },
    async applyUpdate(update) {
        // In a real app, this would use expo-updates or CodePush
        console.warn(`[OTA] Applying update ${update.version} from ${update.url}`);
    },
};
//# sourceMappingURL=ota.js.map