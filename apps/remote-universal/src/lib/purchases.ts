import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// ─── RevenueCat API Keys ──────────────────────────────────────────────────────
// Replace these with your actual keys from app.revenuecat.com
export const RC_API_KEY_IOS = 'appl_REPLACE_WITH_YOUR_IOS_KEY';
export const RC_API_KEY_ANDROID = 'goog_REPLACE_WITH_YOUR_ANDROID_KEY';

/**
 * True when running inside Expo Go. RevenueCat requires a native build;
 * in this environment we skip initialization and return free-tier defaults.
 */
export const IS_EXPO_GO =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// ─── Entitlement & Product IDs ────────────────────────────────────────────────
export const ENTITLEMENT_PRO = 'pro';

export const PRODUCT_IDS = {
  monthly: 'remote_pro_monthly',   // $2.99/month
  annual:  'remote_pro_annual',    // $19.99/year
  lifetime: 'remote_pro_lifetime', // $39.99 one-time
} as const;

// ─── Free tier limits ─────────────────────────────────────────────────────────
export const FREE_DEVICE_LIMIT = 3;

// ─── Init ─────────────────────────────────────────────────────────────────────
export function initPurchases(): void {
  if (IS_EXPO_GO) {
    if (__DEV__) console.log('[Purchases] Skipping RevenueCat init in Expo Go — use a development build.');
    return;
  }
  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }
  const apiKey = Platform.OS === 'ios' ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
  Purchases.configure({ apiKey });
}
