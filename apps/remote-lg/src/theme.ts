import { defaultTheme } from '@remote/ui-kit';
import type { BrandTheme } from '@remote/ui-kit';

/** LG brand theme — primary color: LG Red */
export const theme: BrandTheme = {
  ...defaultTheme,
  colors: {
    ...defaultTheme.colors,
    primary: '#A50034',
    primaryDark: '#7A0026',
  },
  appName: 'LG Remote',
};
