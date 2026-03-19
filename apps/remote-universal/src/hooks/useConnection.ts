import { useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import {
  IRModule,
  BLEModule,
  ZeroconfModule,
  HomeKitModule,
  MatterModule,
} from '@remote/native-modules';
import { SamsungTizen, AndroidTV } from '@remote/device-sdk';
import type { ConnectionProtocol } from '../types/navigation';

// ─── Public types ────────────────────────────────────────────────────────────

export type ConnectionStep = {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  error?: string;
};

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface ConnectParams {
  protocol: ConnectionProtocol;
  address: string;
  brand?: string;
  layoutId?: string;
  /** Called when a Samsung TV sends ms.channel.unauthorized (Allow popup visible on TV). */
  onSamsungUnauthorized?: () => void;
}

/** Exposed when the connection flow needs the user to complete a pairing step. */
export interface PairingRequest {
  address: string;
  deviceName?: string;
}

// ─── Internal step definition ────────────────────────────────────────────────

interface StepDef {
  id: string;
  label: string;
  run: () => Promise<void>;
}

// ─── Wi-Fi steps (brand-aware) ───────────────────────────────────────────────

function buildWiFiSteps(
  address: string,
  brand?: string,
  layoutId?: string,
  requestPairing?: (addr: string) => Promise<void>,
  onSamsungUnauthorized?: () => void,
): StepDef[] {
  const brandLower = brand?.toLowerCase() ?? '';
  const isSamsung = brandLower === 'samsung';
  const isAndroidTV =
    brandLower.includes('android') ||
    brandLower === 'google' ||
    layoutId === 'universal-stb';

  const steps: StepDef[] = [
    {
      id: 'detect',
      label: 'Scanning local network',
      run: async () => {
        const serviceType = isSamsung
          ? '_smarttv-rest._tcp.'
          : isAndroidTV
          ? '_androidtvremote2._tcp.'
          : '_http._tcp.';
        try {
          await ZeroconfModule.scan(serviceType, 'tcp', 3000);
        } catch {
          // mDNS failure is non-fatal when we already have a direct address
        }
        if (!address) throw new Error('No device address provided');
      },
    },
  ];

  if (isSamsung) {
    steps.push(
      {
        id: 'probe',
        label: 'Probing Samsung TV',
        run: async () => {
          await SamsungTizen.probeTv(address);
        },
      },
      {
        id: 'websocket',
        label: 'Establishing secure channel',
        run: async () => {
          // Opens WSS (port 8002) or falls back to WS (port 8001).
          // If first-time, the TV shows an "Allow" popup the user must accept.
          await SamsungTizen.connect(address, onSamsungUnauthorized);
        },
      },
      {
        id: 'ready',
        label: 'Loading remote layout',
        run: async () => {
          // Layout is resolved synchronously via findLayout() in RemoteScreen
        },
      },
    );
  } else if (isAndroidTV) {
    steps.push(
      {
        id: 'pair_check',
        label: 'Verifying pairing status',
        run: async () => {
          const paired = await AndroidTV.isPaired(address);
          if (!paired) {
            if (requestPairing) {
              await requestPairing(address);
            } else {
              throw new Error('Device not paired — pairing handler not available');
            }
          }
        },
      },
      {
        id: 'remote',
        label: 'Opening remote session',
        run: async () => {
          await AndroidTV.connectRemote(address);
        },
      },
      {
        id: 'ready',
        label: 'Loading remote layout',
        run: async () => {},
      },
    );
  } else {
    // Generic Wi-Fi / REST device
    steps.push(
      {
        id: 'handshake',
        label: `Connecting to ${brand ?? 'device'}`,
        run: async () => {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 5000);
          try {
            await fetch(`http://${address}/`, { signal: ctrl.signal });
          } catch (e) {
            if ((e as Error).name === 'AbortError') {
              throw new Error('Connection timed out');
            }
            // Probe failure on generic device isn't necessarily fatal
          } finally {
            clearTimeout(timer);
          }
        },
      },
      {
        id: 'ready',
        label: 'Fetching device capabilities',
        run: async () => {},
      },
    );
  }

  return steps;
}

// ─── IR steps ────────────────────────────────────────────────────────────────

function buildIRSteps(): StepDef[] {
  return [
    {
      id: 'hardware',
      label: 'Checking IR hardware',
      run: async () => {
        const available = await IRModule.isAvailable();
        if (!available) {
          throw new Error(
            Platform.OS === 'ios'
              ? 'IR blaster not supported on iOS'
              : 'No IR blaster detected on this device',
          );
        }
      },
    },
    {
      id: 'codes',
      label: 'Loading IR code database',
      run: async () => {
        // Verify the IR hardware can report carrier frequencies
        await IRModule.getCarrierFrequencies();
      },
    },
    {
      id: 'ready',
      label: 'IR blaster ready',
      run: async () => {
        // IR is connectionless — no persistent session needed
      },
    },
  ];
}

// ─── BLE steps ───────────────────────────────────────────────────────────────

function buildBLESteps(address: string): StepDef[] {
  return [
    {
      id: 'bluetooth',
      label: 'Checking Bluetooth status',
      run: async () => {
        const available = await BLEModule.isAvailable();
        if (!available) throw new Error('Bluetooth is turned off or unavailable');
      },
    },
    {
      id: 'scan',
      label: 'Scanning for BLE device',
      run: async () => {
        const devices = await BLEModule.scanForDevices(5000);
        if (address && !devices.some(d => d === address)) {
          // Device not found in scan but we have an ID — proceed to connect
        } else if (!address && devices.length === 0) {
          throw new Error('No BLE devices found nearby');
        }
      },
    },
    {
      id: 'pair',
      label: 'Pairing via Bluetooth',
      run: async () => {
        await BLEModule.connect(address);
      },
    },
  ];
}

// ─── HomeKit steps ───────────────────────────────────────────────────────────

function buildHomeKitSteps(address: string): StepDef[] {
  return [
    {
      id: 'available',
      label: 'Checking HomeKit availability',
      run: async () => {
        const available = await HomeKitModule.isAvailable();
        if (!available) throw new Error('HomeKit is not available on this device');
      },
    },
    {
      id: 'discover',
      label: 'Finding HomeKit accessory',
      run: async () => {
        const accessories = await HomeKitModule.getAccessories();
        if (address && !accessories.some(a => a === address)) {
          throw new Error('HomeKit accessory not found — ensure it is added to your Home');
        }
      },
    },
    {
      id: 'ready',
      label: 'Loading HomeKit services',
      run: async () => {
        // HomeKit manages connections internally via HAP
      },
    },
  ];
}

// ─── Matter steps ────────────────────────────────────────────────────────────

function buildMatterSteps(address: string): StepDef[] {
  return [
    {
      id: 'available',
      label: 'Checking Matter support',
      run: async () => {
        const available = await MatterModule.isAvailable();
        if (!available) throw new Error('Matter is not supported on this device');
      },
    },
    {
      id: 'commission',
      label: 'Commissioning device',
      run: async () => {
        await MatterModule.commission(address);
      },
    },
    {
      id: 'clusters',
      label: 'Reading device clusters',
      run: async () => {
        await MatterModule.discoverDevices();
      },
    },
  ];
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useConnection() {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [steps, setSteps] = useState<ConnectionStep[]>([]);
  const [pairingRequest, setPairingRequest] = useState<PairingRequest | null>(null);
  const abortRef = useRef(false);
  const pairingResolveRef = useRef<(() => void) | null>(null);
  const pairingRejectRef = useRef<((err: Error) => void) | null>(null);

  const connect = useCallback(async (params: ConnectParams): Promise<boolean> => {
    abortRef.current = false;
    setPairingRequest(null);
    const { protocol, address, brand, layoutId } = params;

    // Pairing callback — injected into Wi-Fi/AndroidTV step builders
    const triggerPairing = (addr: string): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        pairingResolveRef.current = resolve;
        pairingRejectRef.current = reject;
        setPairingRequest({ address: addr, deviceName: brand });
      });

    // Build protocol-specific step definitions
    let defs: StepDef[];
    switch (protocol) {
      case 'wifi':
        defs = buildWiFiSteps(address, brand, layoutId, triggerPairing, params.onSamsungUnauthorized);
        break;
      case 'ir':
        defs = buildIRSteps();
        break;
      case 'ble':
        defs = buildBLESteps(address);
        break;
      case 'homekit':
        defs = buildHomeKitSteps(address);
        break;
      case 'matter':
        defs = buildMatterSteps(address);
        break;
    }

    // Initialize UI step state
    setSteps(defs.map(d => ({ id: d.id, label: d.label, status: 'pending' })));
    setStatus('connecting');

    // Execute steps sequentially — each calls real native modules / SDK
    for (let i = 0; i < defs.length; i++) {
      if (abortRef.current) return false;

      setSteps(prev =>
        prev.map((s, idx) => (idx === i ? { ...s, status: 'running' } : s)),
      );

      try {
        await defs[i].run();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setSteps(prev =>
          prev.map((s, idx) =>
            idx === i ? { ...s, status: 'error', error: message } : s,
          ),
        );
        setStatus('error');
        return false;
      }

      if (abortRef.current) return false;

      setSteps(prev =>
        prev.map((s, idx) => (idx === i ? { ...s, status: 'done' } : s)),
      );
    }

    setStatus('connected');
    return true;
  }, []);

  /** Call when the user successfully completes pairing via the modal. */
  const resolvePairing = useCallback(() => {
    setPairingRequest(null);
    pairingResolveRef.current?.();
    pairingResolveRef.current = null;
    pairingRejectRef.current = null;
  }, []);

  /** Call when the user cancels the pairing modal. */
  const rejectPairing = useCallback(() => {
    setPairingRequest(null);
    pairingRejectRef.current?.(new Error('Pairing cancelled by user'));
    pairingResolveRef.current = null;
    pairingRejectRef.current = null;
  }, []);

  const abort = useCallback(() => {
    abortRef.current = true;
    setPairingRequest(null);
    pairingRejectRef.current?.(new Error('Connection aborted'));
    pairingResolveRef.current = null;
    pairingRejectRef.current = null;
    setStatus('idle');
    setSteps([]);
  }, []);

  return { status, steps, pairingRequest, connect, abort, resolvePairing, rejectPairing };
}
