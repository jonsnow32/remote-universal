import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MacroStepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface MacroStepResult {
  stepIndex: number;
  status: MacroStepStatus;
  durationMs: number;
  error?: string;
}

export interface MacroRunResult {
  steps: MacroStepResult[];
  totalDurationMs: number;
  successCount: number;
  failCount: number;
  aborted: boolean;
}

/** A single step within a macro */
export interface StoredMacroStep {
  id: string;
  // Device reference
  deviceId: string;
  deviceNickname: string;   // cached — displayed even if device is removed
  deviceCategory: string;  // for icon colour
  deviceColor: string;
  // Command
  action: string;
  actionLabel: string;
  // Timing
  delayAfterMs: number;    // milliseconds to wait after this step (default 500)
}

export interface StoredMacro {
  id: string;
  name: string;
  iconName: string;  // Ionicons name
  color: string;
  steps: StoredMacroStep[];
  createdAt: number;
  updatedAt: number;
}

// ─── Known commands per device category ───────────────────────────────────────

export const CATEGORY_COMMANDS: Record<string, Array<{ action: string; label: string }>> = {
  tv: [
    { action: 'power_toggle', label: 'Power Toggle' },
    { action: 'power_on',     label: 'Power ON' },
    { action: 'power_off',    label: 'Power OFF' },
    { action: 'vol_up',       label: 'Volume Up' },
    { action: 'vol_down',     label: 'Volume Down' },
    { action: 'mute',         label: 'Mute' },
    { action: 'hdmi1',        label: 'HDMI 1' },
    { action: 'hdmi2',        label: 'HDMI 2' },
    { action: 'netflix',      label: 'Open Netflix' },
    { action: 'youtube',      label: 'Open YouTube' },
  ],
  ac: [
    { action: 'power_toggle', label: 'Power Toggle' },
    { action: 'power_on',     label: 'Power ON' },
    { action: 'power_off',    label: 'Power OFF' },
    { action: 'temp_up',      label: 'Temp +1°C' },
    { action: 'temp_down',    label: 'Temp -1°C' },
    { action: 'mode_cool',    label: 'Set Cool Mode' },
    { action: 'mode_heat',    label: 'Set Heat Mode' },
    { action: 'fan_auto',     label: 'Fan Auto' },
    { action: 'fan_high',     label: 'Fan High' },
    { action: 'fan_low',      label: 'Fan Low' },
    { action: 'swing_on',     label: 'Swing ON' },
    { action: 'swing_off',    label: 'Swing OFF' },
  ],
  speaker: [
    { action: 'power_toggle', label: 'Power Toggle' },
    { action: 'vol_up',       label: 'Volume Up' },
    { action: 'vol_down',     label: 'Volume Down' },
    { action: 'mute',         label: 'Mute' },
    { action: 'play',         label: 'Play' },
    { action: 'pause',        label: 'Pause' },
    { action: 'next',         label: 'Next Track' },
    { action: 'prev',         label: 'Previous Track' },
  ],
  soundbar: [
    { action: 'power_toggle', label: 'Power Toggle' },
    { action: 'vol_up',       label: 'Volume Up' },
    { action: 'vol_down',     label: 'Volume Down' },
    { action: 'mute',         label: 'Mute' },
    { action: 'sound_tv',     label: 'Mode: TV' },
    { action: 'sound_music',  label: 'Mode: Music' },
    { action: 'sound_movie',  label: 'Mode: Movie' },
  ],
  projector: [
    { action: 'power_toggle', label: 'Power Toggle' },
    { action: 'power_on',     label: 'Power ON' },
    { action: 'power_off',    label: 'Power OFF' },
    { action: 'source_hdmi',  label: 'Source: HDMI' },
    { action: 'vol_up',       label: 'Volume Up' },
    { action: 'vol_down',     label: 'Volume Down' },
  ],
  fan: [
    { action: 'power_toggle', label: 'Power Toggle' },
    { action: 'power_on',     label: 'Power ON' },
    { action: 'power_off',    label: 'Power OFF' },
    { action: 'speed_up',     label: 'Speed Up' },
    { action: 'speed_down',   label: 'Speed Down' },
    { action: 'oscillate',    label: 'Oscillate' },
  ],
  light: [
    { action: 'power_toggle', label: 'Power Toggle' },
    { action: 'power_on',     label: 'Turn ON' },
    { action: 'power_off',    label: 'Turn OFF' },
    { action: 'bright_up',    label: 'Brightness Up' },
    { action: 'bright_down',  label: 'Brightness Down' },
    { action: 'warm',         label: 'Warm White' },
    { action: 'cool',         label: 'Cool White' },
  ],
  other: [
    { action: 'power_toggle', label: 'Power Toggle' },
    { action: 'power_on',     label: 'Power ON' },
    { action: 'power_off',    label: 'Power OFF' },
  ],
};

// ─── Palette for macro colours ────────────────────────────────────────────────

export const MACRO_COLORS = [
  '#6C63FF', '#F5A623', '#FF4F9A', '#00C9A7',
  '#4A6BCC', '#FF6B9D', '#FFB347', '#4FC3F7',
];

export const MACRO_ICONS: Array<{ name: string; label: string }> = [
  { name: 'film-outline',           label: 'Movie' },
  { name: 'sunny-outline',          label: 'Morning' },
  { name: 'moon-outline',           label: 'Sleep' },
  { name: 'musical-notes-outline',  label: 'Music' },
  { name: 'game-controller-outline', label: 'Gaming' },
  { name: 'restaurant-outline',     label: 'Dinner' },
  { name: 'bed-outline',            label: 'Bed' },
  { name: 'home-outline',           label: 'Home' },
  { name: 'car-outline',            label: 'Leave' },
  { name: 'flash-outline',          label: 'Quick' },
];

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = '@remote/macros';

export async function loadMacros(): Promise<StoredMacro[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredMacro[]) : [];
  } catch {
    return [];
  }
}

export async function saveMacros(macros: StoredMacro[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(macros));
}

export async function upsertMacro(macro: StoredMacro): Promise<StoredMacro[]> {
  const all = await loadMacros();
  const idx = all.findIndex(m => m.id === macro.id);
  if (idx >= 0) {
    all[idx] = macro;
  } else {
    all.push(macro);
  }
  await saveMacros(all);
  return all;
}

export async function deleteMacro(id: string): Promise<StoredMacro[]> {
  const all = (await loadMacros()).filter(m => m.id !== id);
  await saveMacros(all);
  return all;
}

// ─── Execution simulator ──────────────────────────────────────────────────────
// Until CommandDispatcher is wired to real devices, simulate execution.
// A step succeeds if the device is "online" (from AsyncStorage StoredDevice).

const DEVICE_STORAGE_KEY = '@remote/user_devices';

interface DeviceOnlineMap {
  [deviceId: string]: boolean;
}

async function getOnlineMap(): Promise<DeviceOnlineMap> {
  try {
    const raw = await AsyncStorage.getItem(DEVICE_STORAGE_KEY);
    if (!raw) return {};
    const devices = JSON.parse(raw) as Array<{ id: string; is_online: boolean }>;
    const map: DeviceOnlineMap = {};
    for (const d of devices) map[d.id] = d.is_online;
    return map;
  } catch {
    return {};
  }
}

export interface RunOptions {
  signal?: AbortSignal;
  onStepUpdate: (index: number, result: MacroStepResult) => void;
}

export async function runMacro(
  macro: StoredMacro,
  { signal, onStepUpdate }: RunOptions,
): Promise<MacroRunResult> {
  const onlineMap = await getOnlineMap();
  const wallStart = Date.now();
  const results: MacroStepResult[] = macro.steps.map((_, i) => ({
    stepIndex: i,
    status: 'pending',
    durationMs: 0,
  }));

  let aborted = false;

  for (let i = 0; i < macro.steps.length; i++) {
    if (signal?.aborted) {
      aborted = true;
      for (let j = i; j < macro.steps.length; j++) {
        results[j].status = 'skipped';
        onStepUpdate(j, results[j]);
      }
      break;
    }

    const step = macro.steps[i];
    results[i] = { stepIndex: i, status: 'running', durationMs: 0 };
    onStepUpdate(i, results[i]);

    const stepStart = Date.now();
    const isOnline = onlineMap[step.deviceId] ?? false;

    // Simulate network latency
    const latency = 120 + Math.random() * 180;
    await new Promise(resolve => setTimeout(resolve, latency));

    if (signal?.aborted) {
      aborted = true;
      results[i] = { stepIndex: i, status: 'skipped', durationMs: Date.now() - stepStart };
      onStepUpdate(i, results[i]);
      for (let j = i + 1; j < macro.steps.length; j++) {
        results[j].status = 'skipped';
        onStepUpdate(j, results[j]);
      }
      break;
    }

    const durationMs = Date.now() - stepStart;

    if (isOnline) {
      results[i] = { stepIndex: i, status: 'success', durationMs };
    } else {
      results[i] = {
        stepIndex: i,
        status: 'failed',
        durationMs,
        error: `Device "${step.deviceNickname}" is offline`,
      };
    }
    onStepUpdate(i, results[i]);

    // Delay between steps
    if (i < macro.steps.length - 1 && step.delayAfterMs > 0 && !signal?.aborted) {
      await new Promise(resolve => setTimeout(resolve, step.delayAfterMs));
    }
  }

  const successCount = results.filter(r => r.status === 'success').length;
  const failCount = results.filter(r => r.status === 'failed').length;

  return {
    steps: results,
    totalDurationMs: Date.now() - wallStart,
    successCount,
    failCount,
    aborted,
  };
}
