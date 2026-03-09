export interface AppConfig {
  brandId: string;
  appName: string;
  bundleId: string;
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
  bundleId: 'com.remoteplatform.universal',
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
