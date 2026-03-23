import type { RemoteLayoutDefinition } from '@remote/core';

/**
 * Universal Soundbar layout — for home-theater soundbar systems.
 * Distinct from generic speakers: emphasizes surround/sound-mode
 * presets, HDMI ARC input, and subwoofer control.
 */
export const universalSoundbarLayout: RemoteLayoutDefinition = {
  id: 'universal-soundbar',
  name: 'Soundbar (Universal)',
  deviceType: 'soundbar',
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

    // ── Volume ──────────────────────────────────────────────────────────────
    {
      id: 'volume',
      title: 'Volume',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'vol-up',   label: 'Vol +', icon: 'volume-high-outline',  action: 'VOLUME_UP',   row: 0, col: 0, variant: 'primary' },
        { type: 'button', id: 'mute',     label: 'Mute',  icon: 'volume-mute-outline',  action: 'MUTE',        row: 0, col: 1, variant: 'ghost' },
        { type: 'button', id: 'vol-down', label: 'Vol −', icon: 'volume-low-outline',   action: 'VOLUME_DOWN', row: 0, col: 2 },
      ],
    },

    // ── Sound Mode ──────────────────────────────────────────────────────────
    {
      id: 'sound-mode',
      title: 'Sound Mode',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'mode-movie',  label: 'Movie',  icon: 'film-outline',          action: 'MODE_MOVIE',  row: 0, col: 0 },
        { type: 'button', id: 'mode-music',  label: 'Music',  icon: 'musical-notes-outline', action: 'MODE_MUSIC',  row: 0, col: 1 },
        { type: 'button', id: 'mode-tv',     label: 'TV',     icon: 'tv-outline',            action: 'MODE_TV',     row: 0, col: 2 },
        { type: 'button', id: 'mode-sports', label: 'Sports', icon: 'football-outline',      action: 'MODE_SPORTS', row: 1, col: 0 },
        { type: 'button', id: 'mode-night',  label: 'Night',  icon: 'moon-outline',          action: 'MODE_NIGHT',  row: 1, col: 1 },
        { type: 'button', id: 'mode-3d',     label: '3D',     icon: 'cube-outline',          action: 'MODE_3D',     row: 1, col: 2 },
      ],
    },

    // ── Input Source ─────────────────────────────────────────────────────────
    {
      id: 'input',
      title: 'Input',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'hdmi-arc',  label: 'HDMI ARC',  action: 'SOURCE_HDMI_ARC',  row: 0, col: 0 },
        { type: 'button', id: 'optical',   label: 'Optical',   icon: 'radio-outline',      action: 'SOURCE_OPTICAL',  row: 0, col: 1 },
        { type: 'button', id: 'bluetooth', label: 'BT',        icon: 'bluetooth-outline',  action: 'SOURCE_BT',       row: 0, col: 2 },
        { type: 'button', id: 'usb',       label: 'USB',       icon: 'save-outline',           action: 'SOURCE_USB',      row: 1, col: 0 },
        { type: 'button', id: 'aux',       label: 'AUX',       icon: 'headset-outline',    action: 'SOURCE_AUX',      row: 1, col: 1 },
        { type: 'button', id: 'wifi',      label: 'Wi-Fi',     icon: 'wifi-outline',       action: 'SOURCE_WIFI',     row: 1, col: 2 },
      ],
    },

    // ── Subwoofer / Rear ─────────────────────────────────────────────────────
    {
      id: 'subwoofer',
      title: 'Subwoofer & Surround',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'sub-up',   label: 'Sub +',  icon: 'trending-up-outline',   action: 'SUBWOOFER_UP',   row: 0, col: 0 },
        { type: 'button', id: 'sub-down', label: 'Sub −',  icon: 'trending-down-outline', action: 'SUBWOOFER_DOWN', row: 0, col: 1 },
        { type: 'button', id: 'surr-up',  label: 'Surr +',                                 action: 'SURROUND_UP',   row: 1, col: 0 },
        { type: 'button', id: 'surr-down', label: 'Surr −',                                action: 'SURROUND_DOWN', row: 1, col: 1 },
        { type: 'button', id: 'dialog',   label: 'Voice',  icon: 'mic-outline',           action: 'VOICE_ENHANCE', row: 0, col: 2, variant: 'ghost' },
      ],
    },
  ],
};
