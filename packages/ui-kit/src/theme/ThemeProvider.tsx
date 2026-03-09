import React, { createContext, useContext } from 'react';
import { BrandTheme } from './types';
import { defaultTheme } from './defaultTheme';

const ThemeContext = createContext<BrandTheme>(defaultTheme);

/**
 * Provides the brand theme to all descendant components.
 */
export function ThemeProvider({
  theme = defaultTheme,
  children,
}: {
  theme?: BrandTheme;
  children: React.ReactNode;
}): React.ReactElement {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/**
 * Hook to access the current brand theme.
 * Must be used inside a ThemeProvider.
 */
export function useTheme(): BrandTheme {
  return useContext(ThemeContext);
}
