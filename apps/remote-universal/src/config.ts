export interface AppConfig {
  brandId: string;
  appName: string;
  bundleId: string;
  /**
   * Backend API base URL. Change to your Mac's LAN IP when testing on a real device,
   * e.g. http://192.168.1.10:3000
   */
  apiBaseUrl: string;
  features: {
    irControl: boolean;
    smartThingsIntegration: boolean;
    lgThinQIntegration: boolean;
    daikinCloudIntegration: boolean;
    homeKit: boolean;
    matter: boolean;
    macros: boolean;
    universalSearch: boolean;
    cloudSync: boolean;
  };
}

export const appConfig: AppConfig = {
  brandId: 'universal',
  appName: 'Universal Remote',
  bundleId: 'com.streamless.remote',
  // Set EXPO_PUBLIC_API_BASE_URL in .env to your Mac's LAN IP when testing on a real device.
  // Example: EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:3000
  apiBaseUrl: (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  features: {
    irControl: true,
    smartThingsIntegration: true,
    lgThinQIntegration: true,
    daikinCloudIntegration: true,
    homeKit: true,
    matter: true,
    macros: true,
    universalSearch: true,
    cloudSync: true,
  },
};
