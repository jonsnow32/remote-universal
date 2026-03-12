/**
 * Runtime-mutable API base URL.
 *
 * Priority (highest → lowest):
 *   1. User-saved override (AsyncStorage) – set from Settings screen
 *   2. EXPO_PUBLIC_API_BASE_URL build-time env var
 *   3. Hardcoded fallback 'http://localhost:3000'
 *
 * All fetch calls should import `getApiBaseUrl()` instead of reading
 * `appConfig.apiBaseUrl` directly.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { appConfig } from '../config';

const STORAGE_KEY = '@remote/api_base_url';

let _resolved: string | null = null;

/** Returns the backend base URL (no trailing slash). */
export async function getApiBaseUrl(): Promise<string> {
  if (_resolved !== null) return _resolved;
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    _resolved = (saved ?? appConfig.apiBaseUrl).replace(/\/$/, '');
  } catch {
    _resolved = appConfig.apiBaseUrl;
  }
  return _resolved;
}

/**
 * Persist a new backend URL.
 * Pass `null` to reset to the build-time default.
 */
export async function setApiBaseUrl(url: string | null): Promise<void> {
  if (url === null) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    _resolved = appConfig.apiBaseUrl;
  } else {
    const cleaned = url.replace(/\/$/, '');
    await AsyncStorage.setItem(STORAGE_KEY, cleaned);
    _resolved = cleaned;
  }
}

/** Synchronous read – only available after the first `getApiBaseUrl()` call. */
export function getApiBaseUrlSync(): string {
  return _resolved ?? appConfig.apiBaseUrl;
}
