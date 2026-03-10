import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@remote/ui-kit';
import { theme } from './theme';

const Tab = createBottomTabNavigator();
const queryClient = new QueryClient();

export default function App(): React.ReactElement {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <NavigationContainer>
            <Tab.Navigator
              screenOptions={{
                headerShown: false,
                tabBarStyle: { backgroundColor: theme.colors.surface },
                tabBarActiveTintColor: theme.colors.primary,
                tabBarInactiveTintColor: theme.colors.textSecondary,
              }}
            >
              {/* LG-specific screens would go here */}
            </Tab.Navigator>
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
