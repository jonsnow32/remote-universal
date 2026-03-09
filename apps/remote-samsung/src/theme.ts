import { defaultTheme } from '@remote/ui-kit';
import type { BrandTheme } from '@remote/ui-kit';

/** Samsung brand theme — primary color: Samsung Blue */
export const theme: BrandTheme = {
  ...defaultTheme,
  colors: {
    ...defaultTheme.colors,
    primary: '#1428A0',
    primaryDark: '#0D1C7A',
  },
  appName: 'Samsung Remote',
};
