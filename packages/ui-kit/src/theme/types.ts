/**
 * Brand theme interface — override per white-label app.
 */
export interface BrandTheme {
  colors: {
    primary: string;
    primaryDark: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    success: string;
    warning: string;
  };
  typography: {
    fontFamily: string;
    fontFamilyBold: string;
    fontSize: {
      xs: number;
      sm: number;
      md: number;
      lg: number;
      xl: number;
    };
  };
  shape: {
    borderRadius: {
      sm: number;
      md: number;
      lg: number;
      full: number;
    };
    spacing: {
      xs: number;
      sm: number;
      md: number;
      lg: number;
      xl: number;
    };
  };
  /** URI or require() of the brand logo */
  logo: number | string;
  /** Display name of the app */
  appName: string;
}
