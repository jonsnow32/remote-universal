import { BrandTheme } from './types';

/**
 * Default theme used by the universal remote app.
 */
export const defaultTheme: BrandTheme = {
  colors: {
    primary: '#2563EB',
    primaryDark: '#1D4ED8',
    secondary: '#7C3AED',
    background: '#0F172A',
    surface: '#1E293B',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    border: '#334155',
    error: '#EF4444',
    success: '#22C55E',
    warning: '#F59E0B',
  },
  typography: {
    fontFamily: 'System',
    fontFamilyBold: 'System',
    fontSize: {
      xs: 10,
      sm: 12,
      md: 14,
      lg: 18,
      xl: 24,
    },
  },
  shape: {
    borderRadius: {
      sm: 4,
      md: 8,
      lg: 16,
      full: 9999,
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
    },
  },
  logo: 0,
  appName: 'Universal Remote',
};
