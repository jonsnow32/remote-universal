import { NativeModules } from 'react-native';
function getNative() {
    return NativeModules.AndroidTV ?? null;
}
const stub = () => Promise.reject(new Error('AndroidTV native module is not available on this platform'));
/**
 * Check if we have previously paired with a TV at the given IP.
 */
export function androidTvIsPaired(ip) {
    return getNative()?.isPaired(ip) ?? Promise.resolve(false);
}
/**
 * Connect to the TV's pairing service (port 6467).
 * Resolves once the TV is showing the 6-digit hex PIN.
 * Call {@link androidTvConfirmPairing} with the PIN immediately after.
 */
export function androidTvStartPairing(ip) {
    return getNative()?.startPairing(ip) ?? stub();
}
/**
 * Submit the PIN displayed on the TV screen.
 * Uses the socket opened by {@link androidTvStartPairing} — both calls
 * must use the same IP and follow each other without interruption.
 *
 * Rejects with code `"BAD_PIN"` if the PIN is wrong.
 */
export function androidTvConfirmPairing(ip, pin) {
    return getNative()?.confirmPairing(ip, pin) ?? stub();
}
/**
 * Open a persistent remote-control session to the TV (port 6466).
 * Call after pairing to pre-establish the connection so key sends are instant.
 */
export function androidTvConnectRemote(ip) {
    return getNative()?.connectRemote(ip) ?? stub();
}
/**
 * Close the persistent remote-control session.
 */
export function androidTvDisconnectRemote(ip) {
    return getNative()?.disconnectRemote(ip) ?? stub();
}
/**
 * Inject a single keypress to a paired Android TV.
 * Uses the persistent session if available, otherwise opens one on first call.
 *
 * If the TV has been factory-reset the Promise rejects with code `"NOT_PAIRED"`.
 */
export function androidTvSendKey(ip, keyCode) {
    return getNative()?.sendKey(ip, keyCode) ?? stub();
}
/**
 * Remove the local pairing record for a TV.
 * Does not communicate with the TV — the TV also needs to be un-trusted
 * through its own settings if you want to fully remove the pairing.
 */
export function androidTvUnpair(ip) {
    return getNative()?.unpair(ip) ?? stub();
}
//# sourceMappingURL=AndroidTVModule.js.map