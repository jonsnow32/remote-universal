import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@remote/ui-kit';
import { theme } from './theme';
import { ProProvider } from './hooks/usePro';
import { initPurchases } from './lib/purchases';

// Onboarding
import { SplashScreen } from './screens/onboarding/SplashScreen';
import { PermissionsScreen } from './screens/onboarding/PermissionsScreen';
import { SetupCompleteScreen } from './screens/onboarding/SetupCompleteScreen';

// Main screens
import { HomeScreen } from './screens/HomeScreen';
import { PaywallScreen } from './screens/PaywallScreen';
import { DiscoveryScreen } from './screens/DiscoveryScreen';
import { TVRemoteScreen } from './screens/TVRemoteScreen';
import { ACControlScreen } from './screens/ACControlScreen';
import { MacroScreen } from './screens/MacroScreen';
import { MacroEditorScreen } from './screens/MacroEditorScreen';
import { TVGuideScreen } from './screens/TVGuideScreen';
import { SettingsScreen } from './screens/SettingsScreen';

// Navigation types
import type {
  RootStackParamList,
  MainTabParamList,
  HomeStackParamList,
  MacroStackParamList,
} from './types/navigation';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const MacroStack = createNativeStackNavigator<MacroStackParamList>();

function HomeNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen name="TVRemote" component={TVRemoteScreen} />
      <HomeStack.Screen name="ACControl" component={ACControlScreen} />
    </HomeStack.Navigator>
  );
}

function MacroNavigator() {
  return (
    <MacroStack.Navigator screenOptions={{ headerShown: false }}>
      <MacroStack.Screen name="MacroList" component={MacroScreen} />
      <MacroStack.Screen name="MacroEditor" component={MacroEditorScreen} />
    </MacroStack.Navigator>
  );
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { filled: IoniconName; outline: IoniconName }> = {
  Home:     { filled: 'home',               outline: 'home-outline' },
  Devices:  { filled: 'hardware-chip',      outline: 'hardware-chip-outline' },
  Macros:   { filled: 'flash',              outline: 'flash-outline' },
  Guide:    { filled: 'tv',                 outline: 'tv-outline' },
  Settings: { filled: 'settings-sharp',     outline: 'settings-outline' },
};

function MainTabsNavigator() {
  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#141928',
          borderTopColor: '#2A3147',
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 20,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#6C63FF',
        tabBarInactiveTintColor: '#8892A4',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, focused }) => {
          const icons = TAB_ICONS[route.name];
          const name: IoniconName = icons
            ? (focused ? icons.filled : icons.outline)
            : 'ellipse-outline';
          return <Ionicons name={name} size={22} color={color} />;
        },
      })}
    >
      <MainTab.Screen name="Home" component={HomeNavigator} />
      <MainTab.Screen name="Devices" component={DiscoveryScreen} />
      <MainTab.Screen name="Macros" component={MacroNavigator} />
      <MainTab.Screen name="Guide" component={TVGuideScreen} />
      <MainTab.Screen name="Settings" component={SettingsScreen} />
    </MainTab.Navigator>
  );
}

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#6C63FF',
    background: '#0A0E1A',
    card: '#141928',
    text: '#FFFFFF',
    border: '#2A3147',
  },
};

const queryClient = new QueryClient();

export default function App(): React.ReactElement {
  useEffect(() => {
    initPurchases();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <ProProvider>
            <NavigationContainer theme={navTheme}>
              <RootStack.Navigator
                initialRouteName="Splash"
                screenOptions={{ headerShown: false, animation: 'fade' }}
              >
                <RootStack.Screen name="Splash" component={SplashScreen} />
                <RootStack.Screen name="Permissions" component={PermissionsScreen} />
                <RootStack.Screen name="SetupComplete" component={SetupCompleteScreen} />
                <RootStack.Screen name="MainTabs" component={MainTabsNavigator} />
                <RootStack.Screen
                  name="Paywall"
                  options={{ presentation: 'modal', animation: 'slide_from_bottom', headerShown: false }}
                >
                  {({ navigation, route }) => (
                    <PaywallScreen
                      onClose={() => navigation.goBack()}
                      reason={
                        route.params?.trigger === 'device_limit'
                          ? "You've reached the 3-device free limit"
                          : route.params?.trigger === 'macro'
                          ? 'Macros & automation are a Pro feature'
                          : route.params?.trigger === 'backup'
                          ? 'Cloud backup is a Pro feature'
                          : undefined
                      }
                    />
                  )}
                </RootStack.Screen>
              </RootStack.Navigator>
            </NavigationContainer>
          </ProProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
