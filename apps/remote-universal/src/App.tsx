import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@remote/ui-kit';
import { setDynamicLoadingEnabled } from '@react-native-vector-icons/common';
import { theme } from './theme';
import { IRDatabaseProvider } from './lib/irDatabase';

// Disable dynamic (expo-font JS) loading — use native assets/fonts/ instead
setDynamicLoadingEnabled(false);

// Screens — 3 core screens (Discovery-first, no login wall)
import { DiscoveryScreen } from './screens/DiscoveryScreen';
import { RemoteScreen } from './screens/RemoteScreen';
import { SettingsScreen } from './screens/SettingsScreen';

// Navigation types
import type { RootStackParamList } from './types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#4FC3F7',
    background: '#0A0E1A',
    card: '#141928',
    text: '#FFFFFF',
    border: '#1E2535',
  },
};

const queryClient = new QueryClient();

export default function App(): React.ReactElement {
  return (
    <SafeAreaProvider>
      <IRDatabaseProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={theme}>
            <NavigationContainer theme={navTheme}>
              <Stack.Navigator
                initialRouteName="Discovery"
                screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
              >
                <Stack.Screen name="Discovery" component={DiscoveryScreen} />
                <Stack.Screen name="Remote" component={RemoteScreen} />
                <Stack.Screen
                  name="Settings"
                  component={SettingsScreen}
                  options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
                />
              </Stack.Navigator>
            </NavigationContainer>
          </ThemeProvider>
        </QueryClientProvider>
      </IRDatabaseProvider>
    </SafeAreaProvider>
  );
}
