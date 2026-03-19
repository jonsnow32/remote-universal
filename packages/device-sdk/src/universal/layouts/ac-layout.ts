import type { RemoteLayoutDefinition } from '@remote/core';

/**
 * Universal AC/Heat-pump layout — brand-agnostic.
 * Covers split AC, portable AC, and heat-pump units.
 * Brands extend this by overriding specific sections or adding brand-
 * specific actions (e.g. Daikin "Econo Cool", Mitsubishi i-Save, etc.).
 */
export const universalACLayout: RemoteLayoutDefinition = {
  id: 'universal-ac',
  name: 'Air Conditioner (Universal)',
  sections: [
    // ── Power ───────────────────────────────────────────────────────────────
    {
      id: 'power',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'power-on',  label: 'On',  icon: 'power',         action: 'POWER_ON',  row: 0, col: 0, variant: 'primary', size: 'lg' },
        { type: 'button', id: 'power-off', label: 'Off', icon: 'power-outline', action: 'POWER_OFF', row: 0, col: 2, variant: 'ghost',   size: 'lg' },
      ],
    },

    // ── Temperature ─────────────────────────────────────────────────────────
    {
      id: 'temperature',
      title: 'Temperature',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'temp-up',   label: 'Temp +', icon: 'add-circle-outline',    action: 'TEMP_UP',   row: 0, col: 0, variant: 'primary', size: 'lg' },
        { type: 'button', id: 'temp-down', label: 'Temp −', icon: 'remove-circle-outline', action: 'TEMP_DOWN', row: 0, col: 2, size: 'lg' },
      ],
    },

    // ── Mode ────────────────────────────────────────────────────────────────
    {
      id: 'mode',
      title: 'Mode',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'mode-cool', label: 'Cool', icon: 'snow-outline',        action: 'MODE_COOL', row: 0, col: 0 },
        { type: 'button', id: 'mode-heat', label: 'Heat', icon: 'flame-outline',       action: 'MODE_HEAT', row: 0, col: 1 },
        { type: 'button', id: 'mode-fan',  label: 'Fan',  icon: 'aperture-outline',    action: 'MODE_FAN',  row: 0, col: 2 },
        { type: 'button', id: 'mode-dry',  label: 'Dry',  icon: 'water-outline',       action: 'MODE_DRY',  row: 1, col: 0 },
        { type: 'button', id: 'mode-auto', label: 'Auto', icon: 'refresh-circle-outline', action: 'MODE_AUTO', row: 1, col: 1 },
      ],
    },

    // ── Fan Speed ────────────────────────────────────────────────────────────
    {
      id: 'fan-speed',
      title: 'Fan Speed',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'fan-auto',  label: 'Auto',  icon: 'sync-outline',       action: 'FAN_AUTO',  row: 0, col: 0 },
        { type: 'button', id: 'fan-low',   label: 'Low',                                action: 'FAN_LOW',   row: 0, col: 1 },
        { type: 'button', id: 'fan-med',   label: 'Med',                                action: 'FAN_MED',   row: 0, col: 2 },
        { type: 'button', id: 'fan-high',  label: 'High',                               action: 'FAN_HIGH',  row: 1, col: 0 },
        { type: 'button', id: 'fan-turbo', label: 'Turbo', icon: 'flash-outline',      action: 'FAN_TURBO', row: 1, col: 1 },
        { type: 'button', id: 'fan-quiet', label: 'Quiet', icon: 'mic-off-outline',    action: 'FAN_QUIET', row: 1, col: 2 },
      ],
    },

    // ── Swing ────────────────────────────────────────────────────────────────
    {
      id: 'swing',
      title: 'Air Swing',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'swing-h',    label: 'H-Swing',  icon: 'swap-horizontal-outline', action: 'SWING_HORIZONTAL', row: 0, col: 0 },
        { type: 'button', id: 'swing-v',    label: 'V-Swing',  icon: 'swap-vertical-outline',   action: 'SWING_VERTICAL',   row: 0, col: 1 },
        { type: 'button', id: 'swing-both', label: 'Both',     icon: 'move-outline',             action: 'SWING_BOTH',       row: 0, col: 2 },
        { type: 'button', id: 'swing-off',  label: 'Fixed',    icon: 'pause-outline',            action: 'SWING_OFF',        row: 1, col: 1, variant: 'ghost' },
      ],
    },

    // ── Comfort features ─────────────────────────────────────────────────────
    {
      id: 'comfort',
      title: 'Comfort',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'eco',        label: 'Eco',   icon: 'leaf-outline',   action: 'ECO_MODE',    row: 0, col: 0 },
        { type: 'button', id: 'sleep',      label: 'Sleep', icon: 'moon-outline',   action: 'SLEEP_MODE',  row: 0, col: 1 },
        { type: 'button', id: 'timer',      label: 'Timer', icon: 'timer-outline',  action: 'TIMER',       row: 0, col: 2 },
        { type: 'button', id: 'self-clean', label: 'Clean', icon: 'sparkles-outline', action: 'SELF_CLEAN', row: 1, col: 1, variant: 'ghost' },
      ],
    },
  ],
};
