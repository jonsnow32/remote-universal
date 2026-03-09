import { defaultTheme } from '@remote/ui-kit';
import type { BrandTheme } from '@remote/ui-kit';

/** Daikin brand theme — primary color: Daikin Blue */
export const theme: BrandTheme = {
  ...defaultTheme,
  colors: {
    ...defaultTheme.colors,
    primary: '#005BAC',
    primaryDark: '#004080',
  },
  appName: 'Daikin Remote',
};
