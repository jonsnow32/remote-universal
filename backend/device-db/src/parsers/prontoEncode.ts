/**
 * Minimal Pronto Hex encoder for common IR protocols.
 *
 * Converts decoded (protocol, address, command) from Flipper .ir "parsed" blocks
 * into a Pronto Hex string so they can be stored in ir_codes.pronto_hex and
 * transmitted by any IR blaster — including the ElkSmart USB dongle.
 *
 * Supported protocols:
 *   NEC / NEC42 / NEC48   — 38 kHz, 9ms/4.5ms leader, 32/42/48-bit frame
 *   SAMSUNG32              — 38 kHz, 4.5ms/4.5ms leader, 32-bit frame
 *   RC5 / RC5X             — 36 kHz, biphase Manchester, 14-bit frame
 *   SONY12 / SONY15 / SONY20 (SIRC) — 40 kHz, 2.4ms/0.6ms leader, 12/15/20-bit
 *
 * Pronto Hex format (mode 0x0000 = raw modulated):
 *   Word 0: 0x0000
 *   Word 1: carrier divisor (≈ 4_145_152 / freq_hz)
 *   Word 2: burst-pair count in once-sequence
 *   Word 3: 0x0000 (no repeat sequence)
 *   Words 4+: alternating mark/space counts in carrier ticks
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Map Flipper/IRDB protocol name → nominal carrier frequency (Hz). */
export const PROTOCOL_CARRIER_HZ: Record<string, number> = {
  NEC:         38_000,
  NEC42:       38_000,
  NEC48:       38_000,
  SAMSUNG32:   38_000,
  PANASONIC:   36_700,
  KASEIKYO:    36_700,
  RC5:         36_000,
  RC5X:        36_000,
  RC6:         36_000,
  RC6_6_20:    36_000,
  RC6_6_24:    36_000,
  SIRC:        40_000,
  SONY12:      40_000,
  SONY15:      40_000,
  SONY20:      40_000,
  MITSUBISHI:  38_000,
  JVC:         38_000,
  DENON:       38_000,
  SHARP:       38_000,
  LG:          38_000,
  DAIKIN:      38_000,
  MARANTZ:     38_000,
  PIONEER:     40_000,
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function prontoWord(n: number): string {
  return (n & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

/** µs → carrier ticks at given frequency. Minimum 1. */
function us(microseconds: number, freqHz: number): number {
  return Math.max(1, Math.round(microseconds / (1_000_000 / freqHz)));
}

/** Encode a flat list of [mark_ticks, space_ticks, ...] as a Pronto Hex string. */
function encode(freqHz: number, tickPairs: number[]): string {
  const divisor = Math.round(4_145_152 / freqHz);
  const pairCount = tickPairs.length / 2;
  const header = ['0000', prontoWord(divisor), prontoWord(pairCount), '0000'];
  return [...header, ...tickPairs.map(prontoWord)].join(' ');
}

/** Expand an integer to 8 bits, LSB first. */
function bits8Lsb(byte: number): number[] {
  return Array.from({ length: 8 }, (_, i) => (byte >> i) & 1);
}

// ─── NEC / NEC42 / NEC48 ─────────────────────────────────────────────────────

/**
 * Encode NEC 32-bit frame (standard NEC, usually called "NEC" in Flipper).
 * Frame order (LSB first): address[7:0], ~address[7:0], command[7:0], ~command[7:0]
 *
 * Flipper address field "AA BB CC DD" → take byte[0] (AA) as the 8-bit address.
 * Flipper command field "CC 00 00 00" → take byte[0] (CC) as the 8-bit command.
 */
export function encodeNEC(address: number, command: number, freqHz = 38_000): string {
  const addr = address & 0xFF;
  const cmd  = command & 0xFF;
  const dataBits = [
    ...bits8Lsb(addr),
    ...bits8Lsb(~addr & 0xFF),
    ...bits8Lsb(cmd),
    ...bits8Lsb(~cmd & 0xFF),
  ];

  const tickMark  = us(562, freqHz);
  const tickZero  = us(562, freqHz);     // space for bit 0
  const tickOne   = us(1688, freqHz);    // space for bit 1
  const tickStop  = us(40_000, freqHz);  // ~40ms trailing gap to end frame

  const pairs: number[] = [
    us(9000, freqHz), us(4500, freqHz),   // leader
    ...dataBits.flatMap(b => [tickMark, b ? tickOne : tickZero]),
    tickMark, tickStop,                   // stop + trailing gap
  ];
  return encode(freqHz, pairs);
}

/**
 * Encode NEC 42-bit frame (Extended NEC — address is 16-bit, no ~address sent).
 * Frame order (LSB first): address_lo[7:0], address_hi[7:0], command[7:0], ~command[7:0]
 * Then 10 additional address bits → total 42 bits.
 *
 * For simplicity and compatibility, we encode the lower 32 bits (standard NEC frame)
 * using address & 0xFF and command & 0xFF.  Most receivers only check 32 bits.
 */
export function encodeNEC42(address: number, command: number, freqHz = 38_000): string {
  // NEC42 in Flipper uses a 6-byte address. Bytes 0+1 = base address.
  const addrLo = address & 0xFF;
  const addrHi = (address >> 8) & 0xFF;
  const cmd    = command & 0xFF;
  const dataBits = [
    ...bits8Lsb(addrLo),
    ...bits8Lsb(addrHi),
    ...bits8Lsb(cmd),
    ...bits8Lsb(~cmd & 0xFF),
    // The remaining 10 bits of NEC42 are device-specific; omit as they vary
  ];

  const tickMark = us(562, freqHz);
  const tickZero = us(562, freqHz);
  const tickOne  = us(1688, freqHz);
  const tickStop = us(40_000, freqHz);

  const pairs: number[] = [
    us(9000, freqHz), us(4500, freqHz),
    ...dataBits.flatMap(b => [tickMark, b ? tickOne : tickZero]),
    tickMark, tickStop,
  ];
  return encode(freqHz, pairs);
}

// ─── Samsung32 ────────────────────────────────────────────────────────────────

/**
 * Encode Samsung32 frame.
 * Identical timing to NEC except leader is 4500µs/4500µs (not 9000/4500).
 * Frame (LSB first): address_lo[7:0], address_hi[7:0], command[7:0], ~command[7:0]
 *
 * Flipper address "AA BB 00 00" → address = 0xBBAA (16-bit LE).
 * Flipper command "CC 00 00 00" → command = 0xCC.
 */
export function encodeSamsung32(address: number, command: number, freqHz = 38_000): string {
  const addrLo = address & 0xFF;
  const addrHi = (address >> 8) & 0xFF;
  const cmd    = command & 0xFF;
  const dataBits = [
    ...bits8Lsb(addrLo),
    ...bits8Lsb(addrHi),
    ...bits8Lsb(cmd),
    ...bits8Lsb(~cmd & 0xFF),
  ];

  const tickMark = us(562, freqHz);
  const tickZero = us(562, freqHz);
  const tickOne  = us(1688, freqHz);
  const tickStop = us(40_000, freqHz);

  const pairs: number[] = [
    us(4500, freqHz), us(4500, freqHz),   // Samsung leader (differs from NEC)
    ...dataBits.flatMap(b => [tickMark, b ? tickOne : tickZero]),
    tickMark, tickStop,
  ];
  return encode(freqHz, pairs);
}

// ─── RC5 (Philips, 36 kHz) ───────────────────────────────────────────────────

/**
 * Encode RC5 / RC5X 14-bit frame (biphase Manchester, 36 kHz).
 *
 * Frame MSB first:
 *   S1=1, S2=1, Toggle=0, A4..A0 (5-bit address), C5..C0 (6-bit command)
 *
 * Biphase rule: each bit period = 889µs.
 *   Bit 0 → first half mark,  second half space  (low-to-high transition)
 *   Bit 1 → first half space, second half mark   (high-to-low transition)
 *
 * Pronto Hex represents marks/spaces as a flat alternating stream starting with
 * a mark. RC5 starts with bit S1=1 → first half is a space (off), but since
 * Pronto must start with a mark we compensate by adjusting the first pair.
 */
export function encodeRC5(address: number, command: number, freqHz = 36_000): string {
  const addr = address & 0x1F;   // 5-bit address
  const cmd  = command & 0x3F;   // 6-bit command  (RC5: C5..C0)

  // 14-bit frame MSB first: S1 S2 T A4 A3 A2 A1 A0 C5 C4 C3 C2 C1 C0
  const frameBits = [
    1, 1, 0,                                                // S1, S2, Toggle=0
    ...Array.from({ length: 5 }, (_, i) => (addr >> (4 - i)) & 1),
    ...Array.from({ length: 6 }, (_, i) => (cmd  >> (5 - i)) & 1),
  ];

  // Convert biphase bits to half-period marks/spaces.
  // half_tick = 444µs at 36kHz
  const ht = us(444, freqHz);

  // Build level stream (true = mark/on, false = space/off)
  // Bit 1 → [space, mark], Bit 0 → [mark, space]
  const levels: boolean[] = [];
  for (const b of frameBits) {
    if (b) { levels.push(false, true); }
    else   { levels.push(true, false); }
  }

  // Pronto stream starts with a mark. RC5 frame starts with S1=1 → first level is space.
  // Prepend a zero-length leading mark (1 tick) to align, or merge consecutive same-levels.
  // Practical approach: RLE-compress consecutive same levels into mark/space durations.
  const pairs: number[] = [];
  let i = 0;
  // If levels[0] is space (false), prefix with a 1-tick mark to satisfy Pronto convention
  // (some decoders ignore a sub-tick leading mark).
  if (!levels[0]) {
    pairs.push(1); // 1-tick phantom leader mark
    // Now expect alternating space/mark/space/...
  }
  // RLE-compress runs of same polarity
  while (i < levels.length) {
    const current = levels[i];
    let run = 0;
    while (i < levels.length && levels[i] === current) { run++; i++; }
    pairs.push(ht * run);
  }
  // Ensure even count (mark/space pairs)
  if (pairs.length % 2 !== 0) pairs.push(us(889, freqHz)); // trailing space

  return encode(freqHz, pairs);
}

// ─── Sony SIRC ───────────────────────────────────────────────────────────────

/**
 * Encode Sony SIRC 12-bit frame (most common Sony protocol, 40 kHz).
 *
 * Frame (LSB first): command[6:0] (7 bits), address[4:0] (5 bits) = 12 bits total.
 *   Leader: 2400µs mark, 600µs space
 *   Bit 0: 600µs mark, 600µs space
 *   Bit 1: 1200µs mark, 600µs space
 *   Trailing space: 600µs
 */
export function encodeSony12(address: number, command: number, freqHz = 40_000): string {
  const cmd  = command & 0x7F;  // 7-bit command
  const addr = address & 0x1F;  // 5-bit address

  const dataBits = [
    ...Array.from({ length: 7 }, (_, i) => (cmd  >> i) & 1),  // LSB first
    ...Array.from({ length: 5 }, (_, i) => (addr >> i) & 1),
  ];

  const tickSpace = us(600, freqHz);

  const pairs: number[] = [
    us(2400, freqHz), tickSpace,   // leader
    ...dataBits.flatMap(b => [b ? us(1200, freqHz) : us(600, freqHz), tickSpace]),
  ];
  return encode(freqHz, pairs);
}

// ─── Public dispatch ──────────────────────────────────────────────────────────

/**
 * Convert Flipper .ir "parsed" protocol block to a Pronto Hex string.
 *
 * @param protocol  e.g. "NEC", "Samsung32", "RC5"
 * @param addressBytesHex  e.g. "07 00 00 00" (Flipper little-endian bytes)
 * @param commandBytesHex  e.g. "02 00 00 00"
 * @returns Pronto Hex string, or null if protocol is not supported.
 */
export function protocolToPronto(
  protocol: string,
  addressBytesHex: string,
  commandBytesHex: string,
): string | null {
  const parseLE = (hex: string): number => {
    const bytes = hex.trim().split(/\s+/)
      .map(h => parseInt(h, 16))
      .filter(n => !isNaN(n));
    // Assemble little-endian: bytes[0] is least-significant
    return bytes.reduce((acc, b, i) => acc | (b << (i * 8)), 0);
  };

  const address = parseLE(addressBytesHex);
  const command = parseLE(commandBytesHex);
  const freqHz  = PROTOCOL_CARRIER_HZ[protocol.toUpperCase()] ?? 38_000;

  switch (protocol.toUpperCase()) {
    case 'NEC':
    case 'NEC48':   // Treat as standard NEC for now
      return encodeNEC(address, command, freqHz);
    case 'NEC42':
      return encodeNEC42(address, command, freqHz);
    case 'SAMSUNG32':
      return encodeSamsung32(address, command, freqHz);
    case 'RC5':
    case 'RC5X':
      return encodeRC5(address, command, freqHz);
    case 'SIRC':
    case 'SONY12':
      return encodeSony12(address, command, freqHz);
    case 'SONY15': {
      // 15-bit = 7-bit cmd + 8-bit extended address — encode as Sony12 variant
      const cmd15  = command & 0x7F;
      const addr15 = address & 0xFF;  // 8 bits for SONY15
      const bits15 = [
        ...Array.from({ length: 7 }, (_, i) => (cmd15  >> i) & 1),
        ...Array.from({ length: 8 }, (_, i) => (addr15 >> i) & 1),
      ];
      const sp = us(600, freqHz);
      const pairs15: number[] = [
        us(2400, freqHz), sp,
        ...bits15.flatMap(b => [b ? us(1200, freqHz) : us(600, freqHz), sp]),
      ];
      return encode(freqHz, pairs15);
    }
    case 'SONY20': {
      // 20-bit = 7-bit cmd + 5-bit addr + 8-bit extended
      const cmd20  = command & 0x7F;
      const addr20 = address & 0x1F;
      const ext20  = (address >> 8) & 0xFF;
      const bits20 = [
        ...Array.from({ length: 7  }, (_, i) => (cmd20  >> i) & 1),
        ...Array.from({ length: 5  }, (_, i) => (addr20 >> i) & 1),
        ...Array.from({ length: 8  }, (_, i) => (ext20  >> i) & 1),
      ];
      const sp = us(600, freqHz);
      const pairs20: number[] = [
        us(2400, freqHz), sp,
        ...bits20.flatMap(b => [b ? us(1200, freqHz) : us(600, freqHz), sp]),
      ];
      return encode(freqHz, pairs20);
    }
    default:
      return null; // unsupported protocol
  }
}
