/**
 * DaikinIREncoder
 *
 * TypeScript implementation of the standard Daikin 3-frame IR protocol,
 * compatible with ARC43 / ARC480A remote controls (most Daikin split-unit ACs).
 *
 * Protocol reference: irremoteesp8266 IRDaikinESP implementation.
 * Carrier: 38 kHz
 *
 * Signal structure:
 *   Frame1 (fixed, 8 bytes) → 29 ms gap →
 *   Frame2 (fixed, 8 bytes) → 29 ms gap →
 *   Frame3 (19 bytes, encodes full AC state)
 *
 * Important: Daikin encodes the ENTIRE AC state in EVERY Frame3 packet.
 * You cannot send single-purpose "temp-up" or "mode-cool" commands — each
 * transmission must include all parameters (power, mode, temp, fan, swing).
 * Use `DaikinACStateTracker` to maintain state between button presses.
 *
 * Note: Some Daikin models (e.g. Stylish FTXA, Sky Air, VRV) use slightly
 * different protocols. If your AC does not respond, capture your physical
 * remote's IR codes with an IR receiver and use those instead.
 */

// ─── Carrier & timing constants ──────────────────────────────────────────────

const CARRIER_HZ = 38_000;

/** Convert microseconds to Pronto ticks at 38 kHz. */
function ticks(us: number): number {
  return Math.round((us * CARRIER_HZ) / 1_000_000);
}

const T_LEADER_MARK  = ticks(3500);   // 133
const T_LEADER_SPACE = ticks(1750);   // 66
const T_BIT_MARK     = ticks(420);    // 16
const T_ZERO_SPACE   = ticks(420);    // 16
const T_ONE_SPACE    = ticks(1300);   // 49
const T_FRAME_GAP    = ticks(29_000); // 1102 — gap between frames (~29 ms)
const T_TRAIL        = ticks(50_000); // 1900 — tail after final frame

// ─── Protocol constants ───────────────────────────────────────────────────────

export const DaikinMode = {
  AUTO: 0,
  DRY:  2,
  COOL: 3,
  HEAT: 4,
  FAN:  6,
} as const;
export type DaikinModeValue = (typeof DaikinMode)[keyof typeof DaikinMode];

export const DaikinFan = {
  AUTO:  0xA,
  QUIET: 3,
  LOW:   3,
  MED:   5,
  HIGH:  7,
} as const;
export type DaikinFanValue = (typeof DaikinFan)[keyof typeof DaikinFan];

export const DaikinSwing = {
  OFF:  0x0,
  AUTO: 0xF,
} as const;
export type DaikinSwingValue = (typeof DaikinSwing)[keyof typeof DaikinSwing];

// ─── State ────────────────────────────────────────────────────────────────────

export interface DaikinACState {
  power:       boolean;
  mode:        DaikinModeValue;
  /** Temperature in °C (valid range: 16–30). */
  temperature: number;
  fan:         DaikinFanValue;
  swing:       DaikinSwingValue;
}

export const DEFAULT_DAIKIN_STATE: DaikinACState = {
  power:       false,
  mode:        DaikinMode.COOL,
  temperature: 25,
  fan:         DaikinFan.AUTO,
  swing:       DaikinSwing.AUTO,
};

// ─── Fixed header frames (always identical) ───────────────────────────────────

const FRAME1 = Uint8Array.from([0x11, 0xDA, 0x27, 0x00, 0xC5, 0x00, 0x00, 0xD7]);
const FRAME2 = Uint8Array.from([0x11, 0xDA, 0x27, 0x00, 0x42, 0x00, 0x00, 0x54]);

// ─── Frame 3 builder ──────────────────────────────────────────────────────────

function buildFrame3(state: DaikinACState): Uint8Array {
  const temp = Math.max(16, Math.min(30, Math.round(state.temperature)));

  const f = new Uint8Array(19);
  f[0]  = 0x11;
  f[1]  = 0xDA;
  f[2]  = 0x27;
  f[3]  = 0x00;
  f[4]  = 0x00;

  // Byte 5: mode (bits 7:4) + power flag (bit 0) + constant 0x08 (bit 3)
  //   power ON  → lower nibble = 0x9 (0b1001)
  //   power OFF → lower nibble = 0x8 (0b1000)
  f[5]  = (state.mode << 4) | (state.power ? 0x09 : 0x08);

  // Byte 6: temperature × 2 (so 25°C → 0x32 = 50)
  f[6]  = temp * 2;

  f[7]  = 0x00;

  // Byte 8: fan speed (bits 7:4) | swing vertical (bits 3:0)
  f[8]  = ((state.fan & 0xF) << 4) | (state.swing & 0xF);

  // Bytes 9–17: reserved / not used
  f[9]  = 0x00;
  f[10] = 0x00;
  f[11] = 0x00;
  f[12] = 0x00;
  f[13] = 0x00;
  f[14] = 0x00;
  f[15] = 0x00;
  f[16] = 0x00;
  f[17] = 0x00;

  // Byte 18: checksum = sum of bytes [4..17] mod 256
  let sum = 0;
  for (let i = 4; i <= 17; i++) sum += f[i];
  f[18] = sum & 0xFF;

  return f;
}

// ─── Burst-pair encoder ───────────────────────────────────────────────────────

/**
 * Encodes a byte array into Pronto-tick burst pairs.
 * Bits are sent LSB-first (as per Daikin protocol).
 * The final space is TICK_FRAME_GAP (inter-frame) or TICK_TRAIL (end of signal).
 */
function encodeFrame(bytes: Uint8Array, isLast: boolean): number[] {
  const out: number[] = [T_LEADER_MARK, T_LEADER_SPACE];

  for (const byte of bytes) {
    for (let b = 0; b < 8; b++) {
      out.push(T_BIT_MARK);
      out.push((byte >> b) & 1 ? T_ONE_SPACE : T_ZERO_SPACE);
    }
  }

  // Stop bit — mark + trailing gap/trail
  out.push(T_BIT_MARK);
  out.push(isLast ? T_TRAIL : T_FRAME_GAP);

  return out;
}

// ─── Pronto Hex builder ───────────────────────────────────────────────────────

function toProntoHex(burstPairs: number[]): string {
  const pairCount = burstPairs.length / 2;
  const words = [
    0x0000,     // Pronto mode: raw (unmodulated)
    0x006D,     // 38 kHz carrier (4_145_152 / 38_000 ≈ 109 = 0x6D)
    pairCount,  // burst-pair count in sequence 1
    0x0000,     // no repeat sequence
    ...burstPairs,
  ];
  return words.map(w => w.toString(16).padStart(4, '0').toUpperCase()).join(' ');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Encode a Daikin AC state into a Pronto Hex string ready for `IRModule.transmit`.
 *
 * ```ts
 * const hex = encodeDaikinIR({ power: true, mode: DaikinMode.COOL, temperature: 25,
 *                               fan: DaikinFan.AUTO, swing: DaikinSwing.AUTO });
 * await IRModule.transmit('', hex);
 * ```
 */
export function encodeDaikinIR(state: DaikinACState): string {
  const burstPairs = [
    ...encodeFrame(FRAME1, false),
    ...encodeFrame(FRAME2, false),
    ...encodeFrame(buildFrame3(state), true),
  ];
  return toProntoHex(burstPairs);
}

// ─── State tracker ────────────────────────────────────────────────────────────

/**
 * Maintains Daikin AC state between commands so that e.g. TEMP_UP correctly
 * increments the current temperature without losing mode/fan/swing settings.
 *
 * Exported as a class — callers should create one instance per remote session.
 */
export class DaikinACStateTracker {
  private state: DaikinACState;

  constructor(initial: Partial<DaikinACState> = {}) {
    this.state = { ...DEFAULT_DAIKIN_STATE, ...initial };
  }

  getState(): Readonly<DaikinACState> { return this.state; }

  /** Apply a semantic command and return the resulting Pronto Hex. */
  applyCommand(command: string): string | null {
    const cmd = command.toUpperCase();

    switch (cmd) {
      case 'POWER_ON':
        this.state = { ...this.state, power: true };
        break;
      case 'POWER_OFF':
        this.state = { ...this.state, power: false };
        break;
      case 'TEMP_UP':
        this.state = { ...this.state, power: true,
          temperature: Math.min(30, this.state.temperature + 1) };
        break;
      case 'TEMP_DOWN':
        this.state = { ...this.state, power: true,
          temperature: Math.max(16, this.state.temperature - 1) };
        break;
      case 'MODE_COOL':
        this.state = { ...this.state, power: true, mode: DaikinMode.COOL };
        break;
      case 'MODE_HEAT':
        this.state = { ...this.state, power: true, mode: DaikinMode.HEAT };
        break;
      case 'MODE_DRY':
        this.state = { ...this.state, power: true, mode: DaikinMode.DRY };
        break;
      case 'MODE_FAN':
        this.state = { ...this.state, power: true, mode: DaikinMode.FAN };
        break;
      case 'MODE_AUTO':
        this.state = { ...this.state, power: true, mode: DaikinMode.AUTO };
        break;
      case 'FAN_AUTO':
        this.state = { ...this.state, fan: DaikinFan.AUTO };
        break;
      case 'FAN_LOW':
        this.state = { ...this.state, fan: DaikinFan.LOW };
        break;
      case 'FAN_MED':
        this.state = { ...this.state, fan: DaikinFan.MED };
        break;
      case 'FAN_HIGH':
        this.state = { ...this.state, fan: DaikinFan.HIGH };
        break;
      case 'SWING_ON':
        this.state = { ...this.state, swing: DaikinSwing.AUTO };
        break;
      case 'SWING_OFF':
        this.state = { ...this.state, swing: DaikinSwing.OFF };
        break;
      default:
        return null;  // unknown command
    }

    return encodeDaikinIR(this.state);
  }
}
