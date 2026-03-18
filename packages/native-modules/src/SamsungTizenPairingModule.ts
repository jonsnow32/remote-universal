import { NativeModules } from 'react-native';

interface SamsungTizenPairingNative {
  pairWithTV(ip: string, deviceId: string): Promise<null>;
}

function getNative(): SamsungTizenPairingNative | null {
  return (NativeModules.SamsungTizenPairing as SamsungTizenPairingNative) ?? null;
}

/**
 * Side-effect module: on Android, loading this native module wires up
 * LAN SSL trust so that JS WebSocket connections to WSS port 8002
 * (Samsung TV pairing) succeed with self-signed certificates.
 *
 * pairWithTV() is a no-op on Android — the full pairing flow happens
 * in JavaScript via the device-sdk SamsungTizen class.
 */
export function samsungTizenPairWithTV(
  ip: string,
  deviceId: string,
): Promise<null> {
  return getNative()?.pairWithTV(ip, deviceId) ?? Promise.resolve(null);
}
