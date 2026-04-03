import { NativeModules } from 'react-native';

interface AndroidTVNative {
  isPaired(ip: string): Promise<boolean>;
  startPairing(ip: string): Promise<void>;
  confirmPairing(ip: string, pin: string): Promise<void>;
  connectRemote(ip: string): Promise<void>;
  disconnectRemote(ip: string): Promise<void>;
  sendKey(ip: string, keyCode: number): Promise<void>;
  sendText(ip: string, text: string): Promise<void>;
  submitText(ip: string, text: string): Promise<void>;
  unpair(ip: string): Promise<void>;
}

function getNative(): AndroidTVNative | null {
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
 * Open a persistent remote-control session to the TV (port 6466).
 * Call after pairing to pre-establish the connection so key sends are instant.
 */
export function androidTvConnectRemote(ip: string): Promise<void> {
  return getNative()?.connectRemote(ip) ?? stub();
}

/**
 * Close the persistent remote-control session.
 */
export function androidTvDisconnectRemote(ip: string): Promise<void> {
  return getNative()?.disconnectRemote(ip) ?? stub();
}

/**
 * Inject a single keypress to a paired Android TV.
 * Uses the persistent session if available, otherwise opens one on first call.
 *
 * If the TV has been factory-reset the Promise rejects with code `"NOT_PAIRED"`.
 */
export function androidTvSendKey(ip: string, keyCode: number): Promise<void> {
  return getNative()?.sendKey(ip, keyCode) ?? stub();
}

/**
 * Stream the current text value to the focused IME field on the TV.
 * The native layer debounces calls by 300 ms so rapid keystrokes collapse
 * into a single ATVRS RemoteImeKeyInject message.
 * Resolves immediately (the debounce fires in the background).
 */
export function androidTvSendText(ip: string, text: string): Promise<void> {
  return getNative()?.sendText(ip, text) ?? stub();
}

/**
 * Immediately inject text into the focused IME field and press ENTER.
 * Cancels any pending debounced sendText call first.
 * Use this for the final search / submit action.
 */
export function androidTvSubmitText(ip: string, text: string): Promise<void> {
  return getNative()?.submitText(ip, text) ?? stub();
}

/**
 * Remove the local pairing record for a TV.
 * Does not communicate with the TV — the TV also needs to be un-trusted
 * through its own settings if you want to fully remove the pairing.
 */
export function androidTvUnpair(ip: string): Promise<void> {
  return getNative()?.unpair(ip) ?? stub();
}
