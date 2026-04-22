import React, { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@remote/ui-kit';
import { setDynamicLoadingEnabled } from '@react-native-vector-icons/common';
import { lightTheme, darkTheme } from './theme';
import { IRDatabaseProvider } from './lib/irDatabase';
import { CatalogDatabaseProvider } from './lib/catalogDatabase';
import { ThemeModeContext, ThemeMode, THEME_STORAGE_KEY } from './lib/themeMode';

// Disable dynamic (expo-font JS) loading — use native assets/fonts/ instead
setDynamicLoadingEnabled(false);

// Screens — 3 core screens (Discovery-first, no login wall)
import { DiscoveryScreen } from './screens/DiscoveryScreen';
import { RemoteScreen } from './screens/RemoteScreen';
import { SettingsScreen } from './screens/SettingsScreen';

// Navigation types
import type { RootStackParamList } from './types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

const queryClient = new QueryClient();

export default function App(): React.ReactElement {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    void AsyncStorage.getItem(THEME_STORAGE_KEY).then(saved => {
      if (saved === 'dark' || saved === 'light') {
        setThemeModeState(saved);
      }
    });
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
  }, []);

  const activeTheme = themeMode === 'dark' ? darkTheme : lightTheme;

  const navTheme = useMemo(() => ({
    ...NavigationDefaultTheme,
    colors: {
      ...NavigationDefaultTheme.colors,
      primary: activeTheme.colors.primary,
      background: activeTheme.colors.background,
      card: activeTheme.colors.surface,
      text: activeTheme.colors.text,
      border: activeTheme.colors.border,
      notification: activeTheme.colors.secondary,
    },
  }), [activeTheme]);

  const themeModeValue = useMemo(
    () => ({ themeMode, setThemeMode }),
    [themeMode, setThemeMode],
  );

  return (
    <ThemeModeContext.Provider value={themeModeValue}>
      <ThemeProvider theme={activeTheme}>
        <SafeAreaProvider>
          <CatalogDatabaseProvider>
            <IRDatabaseProvider>
              <QueryClientProvider client={queryClient}>
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
              </QueryClientProvider>
            </IRDatabaseProvider>
          </CatalogDatabaseProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}
