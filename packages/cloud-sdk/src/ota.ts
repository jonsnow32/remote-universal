export interface OTAUpdate {
  version: string;
  url: string;
  checksum: string;
  releaseNotes?: string;
}

export const OTAService = {
  async checkForUpdate(currentVersion: string, brandId: string): Promise<OTAUpdate | null> {
    try {
      const response = await fetch(`/api/ota/latest?brand=${brandId}&current=${currentVersion}`);
      if (!response.ok) return null;
      const data = (await response.json()) as OTAUpdate & { hasUpdate: boolean };
      return data.hasUpdate ? data : null;
    } catch {
      return null;
    }
  },

  async applyUpdate(update: OTAUpdate): Promise<void> {
    // In a real app, this would use expo-updates or CodePush
    console.warn(`[OTA] Applying update ${update.version} from ${update.url}`);
  },
};
