import { defaultTheme } from '@remote/ui-kit';
import type { BrandTheme } from '@remote/ui-kit';
import { Platform } from 'react-native';

/**
 * Warm, light theme inspired by friendly educational apps
 * - Beige/cream background
 * - Blue primary color
 * - Orange/gold and purple accents
 */
const sharedTypography: BrandTheme['typography'] = {
  ...defaultTheme.typography,
  fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif', default: 'System' }) ?? 'System',
  fontFamilyBold: Platform.select({ ios: 'Avenir Next Demi Bold', android: 'sans-serif-medium', default: 'System' }) ?? 'System',
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 22,
    xl: 32,
  },
};

export const lightTheme: BrandTheme = {
  ...defaultTheme,
  colors: {
    primary: '#2E86E7',
    primaryDark: '#1E6EC5',
    secondary: '#B7B3E8',
    background: '#F3DEAD',
    surface: '#ECEFF3',
    text: '#183B62',
    textSecondary: '#5E7692',
    border: '#E2D2B3',
    error: '#D84040',
    success: '#4CAF50',
    warning: '#F4B740',
  },
  typography: sharedTypography,
  appName: 'Universal Remote',
};

export const darkTheme: BrandTheme = {
  ...defaultTheme,
  colors: {
    primary: '#5EA2FF',
    primaryDark: '#3F86E5',
    secondary: '#9A97D8',
    background: '#0D1420',
    surface: '#1A2433',
    text: '#EAF2FF',
    textSecondary: '#9FB1C7',
    border: '#2D3A4D',
    error: '#FF6B6B',
    success: '#4FCB8B',
    warning: '#F6C35B',
  },
  typography: sharedTypography,
  appName: 'Universal Remote',
};

// Backward compatibility for existing imports.
export const theme: BrandTheme = lightTheme;
