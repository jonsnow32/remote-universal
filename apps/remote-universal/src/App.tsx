import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@remote/ui-kit';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { setDynamicLoadingEnabled } from '@react-native-vector-icons/common';
import { theme } from './theme';
import { _initIRLocalDb } from './lib/irLocalDb';

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

/**
 * Captures the SQLiteDatabase from its context and stores it in the irLocalDb
 * singleton so all irApi.ts calls can use the local DB without React context.
 * Must be rendered inside the <SQLiteProvider> tree.
 */
function IRDbBridge(): null {
  const db = useSQLiteContext();
  useEffect(() => { _initIRLocalDb(db); }, [db]);
  return null;
}

export default function App(): React.ReactElement {
  return (
    <SafeAreaProvider>
      <SQLiteProvider
        databaseName="ir.db"
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        assetSource={{ assetId: require('../assets/ir.db') }}
      >
        <IRDbBridge />
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
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
