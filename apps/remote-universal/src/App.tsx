import React from 'react';
import { Text, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@remote/ui-kit';
import { theme } from './theme';

// Onboarding
import { SplashScreen } from './screens/onboarding/SplashScreen';
import { PermissionsScreen } from './screens/onboarding/PermissionsScreen';
import { SetupCompleteScreen } from './screens/onboarding/SetupCompleteScreen';

// Main screens
import { HomeScreen } from './screens/HomeScreen';
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

const TAB_ICONS: Record<string, string> = {
  Home: '🏠',
  Devices: '📡',
  Macros: '⚡',
  Guide: '📺',
  Settings: '⚙️',
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
        tabBarIcon: ({ color }) => (
          <Text style={{ fontSize: 21 }}>{TAB_ICONS[route.name] ?? '●'}</Text>
        ),
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
  return (
    <View style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <NavigationContainer theme={navTheme}>
            <RootStack.Navigator
              initialRouteName="Splash"
              screenOptions={{ headerShown: false, animation: 'fade' }}
            >
              <RootStack.Screen name="Splash" component={SplashScreen} />
              <RootStack.Screen name="Permissions" component={PermissionsScreen} />
              <RootStack.Screen name="SetupComplete" component={SetupCompleteScreen} />
              <RootStack.Screen name="MainTabs" component={MainTabsNavigator} />
            </RootStack.Navigator>
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>
    </View>
  );
}
