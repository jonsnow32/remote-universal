import { NativeModules } from 'react-native';
function getNative() {
    return NativeModules.SamsungTizenPairing ?? null;
}
/**
 * Side-effect module: on Android, loading this native module wires up
 * LAN SSL trust so that JS WebSocket connections to WSS port 8002
 * (Samsung TV pairing) succeed with self-signed certificates.
 *
 * pairWithTV() is a no-op on Android — the full pairing flow happens
 * in JavaScript via the device-sdk SamsungTizen class.
 */
export function samsungTizenPairWithTV(ip, deviceId) {
    return getNative()?.pairWithTV(ip, deviceId) ?? Promise.resolve(null);
}
//# sourceMappingURL=SamsungTizenPairingModule.js.map