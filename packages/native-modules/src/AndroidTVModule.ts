import { NativeModules, Platform } from 'react-native';

interface AndroidTVNative {
  isPaired(ip: string): Promise<boolean>;
  startPairing(ip: string): Promise<void>;
  confirmPairing(ip: string, pin: string): Promise<void>;
  sendKey(ip: string, keyCode: number): Promise<void>;
  unpair(ip: string): Promise<void>;
}

function getNative(): AndroidTVNative | null {
  if (Platform.OS !== 'android') return null;
  return (NativeModules.AndroidTV as AndroidTVNative) ?? null;
}

const stub = (): Promise<never> =>
  Promise.reject(new Error('AndroidTV native module is not available on this platform'));

/**
 * Check if we have previously paired with a TV at the given IP.
 */
export function androidTvIsPaired(ip: string): Promise<boolean> {
  return getNative()?.isPaired(ip) ?? Promise.resolve(false);
}

/**
 * Connect to the TV's pairing service (port 6467).
 * Resolves once the TV is showing the 6-digit hex PIN.
 * Call {@link androidTvConfirmPairing} with the PIN immediately after.
 */
export function androidTvStartPairing(ip: string): Promise<void> {
  return getNative()?.startPairing(ip) ?? stub();
}

/**
 * Submit the PIN displayed on the TV screen.
 * Uses the socket opened by {@link androidTvStartPairing} — both calls
 * must use the same IP and follow each other without interruption.
 *
 * Rejects with code `"BAD_PIN"` if the PIN is wrong.
 */
export function androidTvConfirmPairing(ip: string, pin: string): Promise<void> {
  return getNative()?.confirmPairing(ip, pin) ?? stub();
}

/**
 * Inject a single keypress to a paired Android TV.
 * Opens a fresh TLS connection, exchanges the configure/ping handshake,
 * sends the key, then closes the connection.
 *
 * If the TV has been factory-reset the Promise rejects with code `"NOT_PAIRED"`.
 */
export function androidTvSendKey(ip: string, keyCode: number): Promise<void> {
  return getNative()?.sendKey(ip, keyCode) ?? stub();
}

/**
 * Remove the local pairing record for a TV.
 * Does not communicate with the TV — the TV also needs to be un-trusted
 * through its own settings if you want to fully remove the pairing.
 */
export function androidTvUnpair(ip: string): Promise<void> {
  return getNative()?.unpair(ip) ?? stub();
}
