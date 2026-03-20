import type { DeviceCommand } from '../types/Command';

// ─── Intent token lists ───────────────────────────────────────────────────────

const POWER_ON_TOKENS  = ['bật', 'mở', 'on', 'turn on', 'power on', 'start'];
const POWER_OFF_TOKENS = ['tắt', 'off', 'turn off', 'power off', 'stop'];
const VOL_UP_TOKENS    = ['tăng âm', 'vol up', 'volume up', 'louder', 'to hơn', 'tăng volume'];
const VOL_DOWN_TOKENS  = ['giảm âm', 'vol down', 'volume down', 'quieter', 'nhỏ hơn', 'giảm volume'];
const MUTE_TOKENS      = ['mute', 'tắt tiếng', 'im lặng'];
const CH_UP_TOKENS     = ['kênh trên', 'channel up', 'next channel', 'ch up'];
const CH_DOWN_TOKENS   = ['kênh dưới', 'channel down', 'prev channel', 'ch down', 'previous channel'];
const BACK_TOKENS      = ['quay lại', 'back', 'go back'];
const HOME_TOKENS      = ['màn hình chính', 'home', 'go home'];
const PLAY_PAUSE_TOKENS = ['play', 'pause', 'phát', 'dừng', 'play pause'];
const NETFLIX_TOKENS   = ['netflix'];
const YOUTUBE_TOKENS   = ['youtube'];

// AC-specific
const TEMP_UP_TOKENS   = ['tăng nhiệt', 'warmer', 'hotter', 'temp up', 'tăng độ'];
const TEMP_DOWN_TOKENS = ['giảm nhiệt', 'cooler', 'temp down', 'giảm độ', 'lạnh hơn'];
const COOL_MODE_TOKENS = ['chế độ lạnh', 'cool mode', 'cooling', 'làm lạnh'];
const FAN_MODE_TOKENS  = ['chế độ quạt', 'fan mode', 'fan only', 'quạt'];
const AUTO_MODE_TOKENS = ['chế độ tự động', 'auto mode', 'auto'];
const FAN_UP_TOKENS    = ['tăng quạt', 'fan up', 'fan speed up'];
const FAN_DOWN_TOKENS  = ['giảm quạt', 'fan down', 'fan speed down'];

// ─── Intent → action mapping ──────────────────────────────────────────────────

interface IntentRule {
  tokens: string[];
  action: string;
}

const TV_RULES: IntentRule[] = [
  { tokens: POWER_ON_TOKENS,   action: 'POWER_ON' },
  { tokens: POWER_OFF_TOKENS,  action: 'POWER_OFF' },
  { tokens: VOL_UP_TOKENS,     action: 'VOLUME_UP' },
  { tokens: VOL_DOWN_TOKENS,   action: 'VOLUME_DOWN' },
  { tokens: MUTE_TOKENS,       action: 'MUTE' },
  { tokens: CH_UP_TOKENS,      action: 'CHANNEL_UP' },
  { tokens: CH_DOWN_TOKENS,    action: 'CHANNEL_DOWN' },
  { tokens: BACK_TOKENS,       action: 'BACK' },
  { tokens: HOME_TOKENS,       action: 'HOME' },
  { tokens: PLAY_PAUSE_TOKENS, action: 'PLAY_PAUSE' },
  { tokens: NETFLIX_TOKENS,    action: 'NETFLIX' },
  { tokens: YOUTUBE_TOKENS,    action: 'YOUTUBE' },
];

const AC_RULES: IntentRule[] = [
  { tokens: POWER_ON_TOKENS,   action: 'POWER_ON' },
  { tokens: POWER_OFF_TOKENS,  action: 'POWER_OFF' },
  { tokens: TEMP_UP_TOKENS,    action: 'TEMP_UP' },
  { tokens: TEMP_DOWN_TOKENS,  action: 'TEMP_DOWN' },
  { tokens: COOL_MODE_TOKENS,  action: 'MODE_COOL' },
  { tokens: FAN_MODE_TOKENS,   action: 'MODE_FAN' },
  { tokens: AUTO_MODE_TOKENS,  action: 'MODE_AUTO' },
  { tokens: FAN_UP_TOKENS,     action: 'FAN_SPEED_UP' },
  { tokens: FAN_DOWN_TOKENS,   action: 'FAN_SPEED_DOWN' },
  { tokens: MUTE_TOKENS,       action: 'MUTE' },
];

type DeviceCategory = 'tv' | 'ac' | 'speaker' | 'soundbar' | 'projector' | 'fan' | 'light' | 'stb' | 'other';

const RULES_BY_CATEGORY: Record<DeviceCategory, IntentRule[]> = {
  tv:        TV_RULES,
  ac:        AC_RULES,
  speaker:   TV_RULES,   // vol/play subset
  soundbar:  TV_RULES,
  projector: TV_RULES,
  fan:       AC_RULES,
  light:     [
    { tokens: POWER_ON_TOKENS,  action: 'POWER_ON' },
    { tokens: POWER_OFF_TOKENS, action: 'POWER_OFF' },
  ],
  stb:  TV_RULES,
  other: [
    { tokens: POWER_ON_TOKENS,  action: 'POWER_ON' },
    { tokens: POWER_OFF_TOKENS, action: 'POWER_OFF' },
  ],
};

// ─── Channel-number extraction ─────────────────────────────────────────────────

const CHANNEL_PATTERN = /(?:kênh|channel|ch)\s*(\d+)/i;
const TEMP_PATTERN    = /(\d+)\s*(?:°|độ|degree)/i;

// ─── Public API ───────────────────────────────────────────────────────────────

export interface VoiceParseResult {
  /** Whether an action was successfully identified */
  matched: boolean;
  /** The resolved DeviceCommand, or null if not matched */
  command: DeviceCommand | null;
  /** Human-readable explanation of what was understood */
  description: string;
}

export interface VoiceParseOptions {
  /** The device this voice command targets */
  deviceId: string;
  /** Helps select the appropriate rule set */
  deviceCategory?: DeviceCategory;
}

/**
 * Light-weight, zero-dependency NLP intent parser.
 *
 * Maps a spoken transcript (Vi / En) to a `DeviceCommand`.
 * Does NOT do network calls — runs entirely on-device.
 *
 * Usage:
 * ```ts
 * const result = VoiceCommandEngine.parse('tắt TV', {
 *   deviceId: 'samsung-living-room',
 *   deviceCategory: 'tv',
 * });
 * if (result.matched) dispatcher.dispatch(result.command!);
 * ```
 */
export class VoiceCommandEngine {
  /**
   * Parse a transcript and resolve it to a DeviceCommand.
   */
  static parse(transcript: string, opts: VoiceParseOptions): VoiceParseResult {
    const text = transcript.toLowerCase().trim();
    const category: DeviceCategory = opts.deviceCategory ?? 'tv';
    const rules = RULES_BY_CATEGORY[category] ?? TV_RULES;

    // ── Channel number extraction (e.g. "kênh 7", "channel 5") ──────────────
    const channelMatch = CHANNEL_PATTERN.exec(text);
    if (channelMatch) {
      const ch = channelMatch[1];
      return {
        matched: true,
        command: { deviceId: opts.deviceId, action: 'CHANNEL', value: ch },
        description: `Switch to channel ${ch}`,
      };
    }

    // ── Temperature number extraction (e.g. "26 độ", "set to 22°") ──────────
    if (category === 'ac' || category === 'fan') {
      const tempMatch = TEMP_PATTERN.exec(text);
      if (tempMatch) {
        const temp = tempMatch[1];
        return {
          matched: true,
          command: { deviceId: opts.deviceId, action: 'SET_TEMPERATURE', value: temp },
          description: `Set temperature to ${temp}°`,
        };
      }
    }

    // ── Token matching ────────────────────────────────────────────────────────
    for (const rule of rules) {
      if (rule.tokens.some(token => text.includes(token))) {
        return {
          matched: true,
          command: { deviceId: opts.deviceId, action: rule.action },
          description: `Execute: ${rule.action.replace(/_/g, ' ').toLowerCase()}`,
        };
      }
    }

    return {
      matched: false,
      command: null,
      description: `Could not understand: "${transcript}"`,
    };
  }

  /**
   * Returns all supported voice phrases for a given device category.
   * Useful for displaying a hint to the user.
   */
  static getHints(category: DeviceCategory = 'tv'): string[] {
    const rules = RULES_BY_CATEGORY[category] ?? TV_RULES;
    return rules.map(r => r.tokens[0]);
  }
}
