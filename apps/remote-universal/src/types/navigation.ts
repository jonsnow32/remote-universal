import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

export type RootStackParamList = {
  Splash: undefined;
  Permissions: undefined;
  SetupComplete: undefined;
  MainTabs: undefined;
  Paywall: { trigger?: 'device_limit' | 'macro' | 'backup' | 'settings' } | undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Devices: undefined;
  Macros: undefined;
  Guide: undefined;
  Settings: undefined;
};

export type HomeStackParamList = {
  HomeMain: undefined;
  TVRemote: { deviceId: string; deviceName: string; location: string };
  ACControl: { deviceId: string; deviceName: string; location: string };
};

export type MacroStackParamList = {
  MacroList: undefined;
  MacroEditor: { macroId?: string; macroName?: string };
};

// Root screen props
export type SplashScreenProps = NativeStackScreenProps<RootStackParamList, 'Splash'>;
export type PermissionsScreenProps = NativeStackScreenProps<RootStackParamList, 'Permissions'>;
export type SetupCompleteScreenProps = NativeStackScreenProps<RootStackParamList, 'SetupComplete'>;

// Tab screen props
export type HomeTabProps = BottomTabScreenProps<MainTabParamList, 'Home'>;
export type DevicesTabProps = BottomTabScreenProps<MainTabParamList, 'Devices'>;
export type MacrosTabProps = BottomTabScreenProps<MainTabParamList, 'Macros'>;
export type GuideTabProps = BottomTabScreenProps<MainTabParamList, 'Guide'>;
export type SettingsTabProps = BottomTabScreenProps<MainTabParamList, 'Settings'>;

// Home stack screen props
export type HomeMainProps = NativeStackScreenProps<HomeStackParamList, 'HomeMain'>;
export type TVRemoteScreenProps = NativeStackScreenProps<HomeStackParamList, 'TVRemote'>;
export type ACControlScreenProps = NativeStackScreenProps<HomeStackParamList, 'ACControl'>;

// Macro stack screen props
export type MacroListProps = NativeStackScreenProps<MacroStackParamList, 'MacroList'>;
export type MacroEditorProps = NativeStackScreenProps<MacroStackParamList, 'MacroEditor'>;
