import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Pronto Hex parser
// ---------------------------------------------------------------------------

/**
 * Parses a Pronto Hex string into a carrier frequency and a microsecond pulse pattern.
 *
 * Pronto Hex (Philips) format:
 *   Word 0  — mode (must be 0x0000 for raw/unmodulated)
 *   Word 1  — frequency divisor: carrier_Hz ≈ 4_145_152 / word1
 *   Word 2  — burst-pair count in sequence 1 (sent once)
 *   Word 3  — burst-pair count in sequence 2 (repeat sequence)
 *   Words 4+ — alternating mark/space counts in Pronto ticks
 *
 * Each Pronto tick equals one carrier cycle = 1_000_000 / carrier_Hz microseconds.
 *
 * Example for NEC 38 kHz:  "0000 006D 0022 0000 0156 00AB 0015 0015 ..."
 *   → carrier = 38 000 Hz, leader = 9000 µs on + 4500 µs off, ...
 */
export function parseProntoHex(hex: string): { frequencyHz: number; pattern: number[] } {
  const words = hex.trim().split(/\s+/).map((w) => parseInt(w, 16));

  if (words.length < 4 || isNaN(words[0])) {
    throw new Error('[IRModule] Invalid Pronto Hex — expected at least 4 space-separated hex words');
  }
  if (words[0] !== 0x0000) {
    throw new Error(
      `[IRModule] Unsupported Pronto mode 0x${words[0].toString(16).padStart(4, '0')} — only raw mode (0x0000) is supported`
    );
  }

  const freqDivisor = words[1];
  if (freqDivisor === 0) throw new Error('[IRModule] Pronto Hex frequency divisor is zero');

  // carrier_Hz = 1_000_000 / (divisor × 0.241246 µs) ≈ 4_145_152 / divisor
  const frequencyHz = Math.round(4_145_152 / freqDivisor);

  const seq1Pairs = words[2];
  const seq2Pairs = words[3];
  // Prefer once-sequence; fall back to repeat-sequence if seq1 is empty
  const pairsToSend = seq1Pairs > 0 ? seq1Pairs : seq2Pairs;

  if (pairsToSend === 0) throw new Error('[IRModule] Pronto Hex contains no burst pairs');

  const tickDurationUs = 1_000_000 / frequencyHz;
  const pattern: number[] = [];

  for (let i = 0; i < pairsToSend * 2; i++) {
    const tick = words[4 + i];
    if (tick === undefined) break;
    // Clamp to ≥1 µs to avoid zero-width pulses that confuse ConsumerIrManager
    pattern.push(Math.max(1, Math.round(tick * tickDurationUs)));
  }

  return { frequencyHz, pattern };
}

// ---------------------------------------------------------------------------
// Native module bridge
// ---------------------------------------------------------------------------

interface IRBlasterNative {
  hasIrEmitter(): Promise<boolean>;
  transmit(carrierFrequency: number, pattern: number[]): Promise<void>;
  getCarrierFrequencies(): Promise<Array<[number, number]>>;
}

interface USBIRBlasterNative {
  isConnected(): Promise<boolean>;
  getDeviceName(): Promise<string | null>;
  requestPermission(): Promise<boolean>;
  transmit(carrierFrequency: number, pattern: number[]): Promise<void>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

function getNative(): IRBlasterNative | null {
  return (NativeModules.IRBlaster as IRBlasterNative) ?? null;
}

function getUSBNative(): USBIRBlasterNative | null {
  return (NativeModules.USBIRBlaster as USBIRBlasterNative) ?? null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * JavaScript interface for the Android IR blaster (ConsumerIrManager).
 *
 * **Platform support:** Android only (devices with a built-in IR emitter,
 * e.g. many Xiaomi, some Samsung/LG models). Always returns false / throws
 * on iOS where ConsumerIrManager does not exist.
 *
 * **Payload formats accepted by `transmit()`:**
 *
 * 1. **Pronto Hex** (preferred) — industry-standard string used by IRDB, Global Caché, etc.
 *    ```
 *    "0000 006D 0022 0000 0156 00AB 0015 0015 ..."
 *    ```
 *    Detected automatically when the string matches the `XXXX XXXX ...` hex-word pattern.
 *
 * 2. **Raw JSON** — explicit frequency + microsecond timings:
 *    ```json
 *    { "frequency": 38000, "pattern": [9000, 4500, 560, 560, ...] }
 *    ```
 *
 * **To generate IR codes:** use the [IRDB](https://github.com/probonopd/irdb) database
 * (Pronto Hex) or record codes from an existing remote with a BlasterMate dongle.
 */
export const IRModule = {
  /**
   * Returns true when an IR transmitter is available — either the device's
   * built-in ConsumerIrManager emitter OR a USB IR blaster is connected
   * and the app has permission to use it.
   */
  async isAvailable(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
      // 1. Check built-in ConsumerIrManager first
      const native = getNative();
      if (native && (await native.hasIrEmitter())) return true;
      // 2. Fall back to USB IR blaster
      const usb = getUSBNative();
      if (usb && (await usb.isConnected())) return true;
      return false;
    } catch {
      return false;
    }
  },

  /**
   * Transmits an IR signal.
   *
   * @param _deviceId  Not used for IR (broadcast protocol). Kept for API consistency.
   * @param payload    Pronto Hex string OR JSON string `{ frequency, pattern }`.
   */
  async transmit(_deviceId: string, payload: string): Promise<void> {
    if (Platform.OS !== 'android') {
      throw new Error('[IRModule] IR blasting is only supported on Android devices.');
    }

    let frequencyHz: number;
    let pattern: number[];

    const trimmed = payload.trim();

    // Detect Pronto Hex: sequence of 4-digit hex words separated by spaces
    if (/^[0-9a-fA-F]{4}(\s+[0-9a-fA-F]{4})+$/.test(trimmed)) {
      ({ frequencyHz, pattern } = parseProntoHex(trimmed));
    } else {
      // Raw JSON format
      const raw = JSON.parse(trimmed) as { frequency: number; pattern: number[] };
      frequencyHz = raw.frequency;
      pattern = raw.pattern;
    }

    // 1. Try built-in ConsumerIrManager
    const native = getNative();
    if (native) {
      const hasEmitter = await native.hasIrEmitter().catch(() => false);
      if (hasEmitter) {
        await native.transmit(frequencyHz, pattern);
        return;
      }
    }

    // 2. Fall back to USB IR blaster
    const usb = getUSBNative();
    if (usb) {
      const usbConnected = await usb.isConnected().catch(() => false);
      if (usbConnected) {
        await usb.transmit(frequencyHz, pattern);
        return;
      }
    }

    throw new Error(
      '[IRModule] No IR transmitter available. ' +
        'This device has no built-in IR emitter and no USB IR blaster is connected.'
    );
  },

  /**
   * Returns the carrier frequency ranges (Hz) supported by this device's IR emitter
   * as `[minFreq, maxFreq]` pairs. Empty on non-Android or devices without IR.
   *
   * Use this to validate a code's carrier before transmitting — most devices support
   * 30–60 kHz, covering the standard 38 kHz used by the vast majority of remotes.
   */
  async getCarrierFrequencies(): Promise<Array<[number, number]>> {
    if (Platform.OS !== 'android') return [];
    try {
      const native = getNative();
      if (!native) return [];
      return native.getCarrierFrequencies();
    } catch {
      return [];
    }
  },

  /**
   * USB IR blaster helpers — event subscriptions and status queries
   * for external USB Type-C / OTG IR dongles.
   */
  usb: {
    /** Returns true if a USB IR blaster is connected and ready to transmit. */
    async isConnected(): Promise<boolean> {
      if (Platform.OS !== 'android') return false;
      try {
        return (await getUSBNative()?.isConnected()) ?? false;
      } catch {
        return false;
      }
    },

    /** Returns the friendly product name of the connected USB device, or null. */
    async getDeviceName(): Promise<string | null> {
      if (Platform.OS !== 'android') return null;
      try {
        return (await getUSBNative()?.getDeviceName()) ?? null;
      } catch {
        return null;
      }
    },

    /**
     * Requests USB permission for the currently connected device.
     * On Android this shows a system dialog. Result is also delivered via the
     * USB_IR_PERMISSION_GRANTED / USB_IR_PERMISSION_DENIED events.
     * Returns true if permission was already granted synchronously.
     */
    async requestPermission(): Promise<boolean> {
      if (Platform.OS !== 'android') return false;
      try {
        return (await getUSBNative()?.requestPermission()) ?? false;
      } catch {
        return false;
      }
    },

    /**
     * Subscribe to USB IR blaster connection events.
     * Returns an unsubscribe function.
     */
    onConnected(
      callback: (info: { name: string; vendorId: string; productId: string }) => void
    ): () => void {
      if (Platform.OS !== 'android') return () => {};
      const native = getUSBNative();
      if (!native) return () => {};
      const emitter = new NativeEventEmitter(native as never);
      const sub = emitter.addListener('USB_IR_BLASTER_CONNECTED', callback);
      return () => sub.remove();
    },

    /** Subscribe to USB IR blaster disconnection events. */
    onDisconnected(callback: () => void): () => void {
      if (Platform.OS !== 'android') return () => {};
      const native = getUSBNative();
      if (!native) return () => {};
      const emitter = new NativeEventEmitter(native as never);
      const sub = emitter.addListener('USB_IR_BLASTER_DISCONNECTED', callback);
      return () => sub.remove();
    },

    /** Subscribe to USB permission granted events. */
    onPermissionGranted(callback: () => void): () => void {
      if (Platform.OS !== 'android') return () => {};
      const native = getUSBNative();
      if (!native) return () => {};
      const emitter = new NativeEventEmitter(native as never);
      const sub = emitter.addListener('USB_IR_PERMISSION_GRANTED', callback);
      return () => sub.remove();
    },

    /** Subscribe to USB permission denied events. */
    onPermissionDenied(callback: () => void): () => void {
      if (Platform.OS !== 'android') return () => {};
      const native = getUSBNative();
      if (!native) return () => {};
      const emitter = new NativeEventEmitter(native as never);
      const sub = emitter.addListener('USB_IR_PERMISSION_DENIED', callback);
      return () => sub.remove();
    },
  },
};
