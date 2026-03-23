/**
 * useUSBIRDetector
 *
 * Detects an external USB Type-C / OTG IR blaster being plugged into or removed
 * from the phone. Works independently of the built-in ConsumerIrManager emitter.
 *
 * Usage:
 * ```tsx
 * const usb = useUSBIRDetector();
 *
 * // usb.isConnected  — true when a USB IR blaster is plugged in + has permission
 * // usb.deviceName   — e.g. "USB IR Toy v2" or null
 * // usb.needsPermission — true when device is detected but permission not yet granted
 * // usb.requestPermission() — triggers the system USB permission dialog
 * ```
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { IRModule } from '@remote/native-modules';

export interface USBIRState {
  /** True when a USB IR device is connected AND the app has USB permission. */
  isConnected: boolean;
  /** Friendly product name of the plugged-in device, or null. */
  deviceName: string | null;
  /**
   * True when a USB device has been detected but the system permission dialog
   * has not been answered yet (or was denied).
   */
  needsPermission: boolean;
  /** Trigger the Android USB permission dialog for the connected device. */
  requestPermission: () => Promise<void>;
}

export function useUSBIRDetector(): USBIRState {
  const [isConnected, setIsConnected]       = useState(false);
  const [deviceName, setDeviceName]         = useState<string | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);

  // Track whether a device is physically plugged in (ignoring permission state)
  const devicePresentRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    // ── Initial check ──────────────────────────────────────────────────────
    // Query current state in case the device was already connected before the
    // component mounted (e.g. app relaunched with USB plugged in).
    async function checkInitial() {
      const [connected, name] = await Promise.all([
        IRModule.usb.isConnected().catch(() => false),
        IRModule.usb.getDeviceName().catch(() => null),
      ]);
      if (cancelled) return;
      if (connected) {
        devicePresentRef.current = true;
        setIsConnected(true);
        setDeviceName(name);
        setNeedsPermission(false);
      }
    }
    void checkInitial();

    // ── Event subscriptions ────────────────────────────────────────────────
    const unsubConnected = IRModule.usb.onConnected((info) => {
      devicePresentRef.current = true;
      setDeviceName(info.name);
      // Permission might already be granted (silent connect). Check immediately
      // rather than assuming it's pending — the native side emits PERM_GRANTED
      // when already granted, but we also verify here as a safety net.
      IRModule.usb.isConnected().then((already) => {
        if (cancelled) return;
        if (already) {
          setIsConnected(true);
          setNeedsPermission(false);
        } else {
          // Wait for USER_IR_PERMISSION_GRANTED/DENIED events
          setNeedsPermission(true);
          setIsConnected(false);
        }
      }).catch(() => {
        setNeedsPermission(true);
        setIsConnected(false);
      });
    });

    const unsubDisconnected = IRModule.usb.onDisconnected(() => {
      devicePresentRef.current = false;
      setIsConnected(false);
      setDeviceName(null);
      setNeedsPermission(false);
    });

    const unsubGranted = IRModule.usb.onPermissionGranted(() => {
      setNeedsPermission(false);
      setIsConnected(true);
      // Refresh device name in case it wasn't set yet
      IRModule.usb.getDeviceName().then((n) => {
        if (!cancelled && n) setDeviceName(n);
      }).catch(() => {});
    });

    const unsubDenied = IRModule.usb.onPermissionDenied(() => {
      setNeedsPermission(false);
      setIsConnected(false);
    });

    return () => {
      cancelled = true;
      unsubConnected();
      unsubDisconnected();
      unsubGranted();
      unsubDenied();
    };
  }, []);

  const requestPermission = useCallback(async () => {
    await IRModule.usb.requestPermission();
  }, []);

  return { isConnected, deviceName, needsPermission, requestPermission };
}
