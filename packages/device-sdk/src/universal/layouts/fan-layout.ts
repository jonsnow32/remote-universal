import type { RemoteLayoutDefinition } from '@remote/core';

/**
 * Universal Electric Fan layout.
 * Covers tower fans, pedestal fans, desk fans, and ceiling fans
 * controllable via IR remote.
 */
export const universalFanLayout: RemoteLayoutDefinition = {
  id: 'universal-fan',
  name: 'Fan (Universal)',
  deviceType: 'fan',
  sections: [
    // ── Power ───────────────────────────────────────────────────────────────
    {
      id: 'power',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'power-toggle', label: 'Power', icon: 'power', action: 'POWER_TOGGLE', row: 0, col: 1, variant: 'primary', size: 'lg' },
      ],
    },

    // ── Speed ────────────────────────────────────────────────────────────────
    {
      id: 'speed',
      title: 'Speed',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'speed-up',   label: 'Speed +', icon: 'add-circle-outline',    action: 'SPEED_UP',   row: 0, col: 0, variant: 'primary' },
        { type: 'button', id: 'speed-down', label: 'Speed −', icon: 'remove-circle-outline', action: 'SPEED_DOWN', row: 0, col: 2 },
        { type: 'button', id: 'speed-1',    label: 'Low',                                     action: 'SPEED_1',    row: 1, col: 0 },
        { type: 'button', id: 'speed-2',    label: 'Med',                                     action: 'SPEED_2',    row: 1, col: 1 },
        { type: 'button', id: 'speed-3',    label: 'High',                                    action: 'SPEED_3',    row: 1, col: 2 },
        { type: 'button', id: 'speed-auto', label: 'Auto',    icon: 'sync-outline',          action: 'SPEED_AUTO', row: 2, col: 1, variant: 'ghost' },
      ],
    },

    // ── Mode ─────────────────────────────────────────────────────────────────
    {
      id: 'mode',
      title: 'Mode',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'mode-normal',  label: 'Normal', icon: 'ellipse-outline',   action: 'MODE_NORMAL',  row: 0, col: 0 },
        { type: 'button', id: 'mode-natural', label: 'Nature', icon: 'leaf-outline',      action: 'MODE_NATURAL', row: 0, col: 1 },
        { type: 'button', id: 'mode-sleep',   label: 'Sleep',  icon: 'moon-outline',      action: 'MODE_SLEEP',   row: 0, col: 2 },
        { type: 'button', id: 'mode-turbo',   label: 'Turbo',  icon: 'flash-outline',     action: 'MODE_TURBO',   row: 1, col: 0 },
        { type: 'button', id: 'mode-smart',   label: 'Smart',  icon: 'bulb-outline',      action: 'MODE_SMART',   row: 1, col: 1, variant: 'ghost' },
      ],
    },

    // ── Oscillation ──────────────────────────────────────────────────────────
    {
      id: 'oscillation',
      title: 'Oscillation',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'swing-on',  label: 'Swing On',  icon: 'swap-horizontal-outline', action: 'SWING_ON',  row: 0, col: 0, variant: 'primary' },
        { type: 'button', id: 'swing-off', label: 'Swing Off', icon: 'pause-outline',           action: 'SWING_OFF', row: 0, col: 2, variant: 'ghost' },
      ],
    },

    // ── Timer ────────────────────────────────────────────────────────────────
    {
      id: 'timer',
      title: 'Sleep Timer',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'timer-1h', label: '1 h',  icon: 'timer-outline', action: 'TIMER_1H', row: 0, col: 0 },
        { type: 'button', id: 'timer-2h', label: '2 h',  icon: 'timer-outline', action: 'TIMER_2H', row: 0, col: 1 },
        { type: 'button', id: 'timer-4h', label: '4 h',  icon: 'timer-outline', action: 'TIMER_4H', row: 0, col: 2 },
        { type: 'button', id: 'timer-8h', label: '8 h',  icon: 'timer-outline', action: 'TIMER_8H', row: 1, col: 0 },
        { type: 'button', id: 'timer-off', label: 'Off', icon: 'close-circle-outline', action: 'TIMER_OFF', row: 1, col: 2, variant: 'ghost' },
      ],
    },
  ],
};
