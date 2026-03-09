import { samsungTVLayout } from '@remote/device-sdk';

export interface AppConfig {
  brandId: string;
  appName: string;
  bundleId: string;
  deviceSDK: typeof samsungTVLayout;
  features: {
    irControl: boolean;
    smartThingsIntegration: boolean;
    bixbyVoice: boolean;
    homeKit: boolean;
    matter: boolean;
    macros: boolean;
    universalSearch: boolean;
    cloudSync: boolean;
  };
}

export const appConfig: AppConfig = {
  brandId: 'samsung',
  appName: 'Samsung Remote',
  bundleId: 'com.samsung.remote',
  deviceSDK: samsungTVLayout,
  features: {
    irControl: true,
    smartThingsIntegration: true,
    bixbyVoice: true,
    homeKit: false,
    matter: true,
    macros: true,
    universalSearch: false,
    cloudSync: true,
  },
};
