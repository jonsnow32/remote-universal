import type { RemoteLayoutDefinition } from '@remote/core';

/**
 * Universal Speaker layout — for Bluetooth/Wi-Fi/IR audio speakers.
 * Covers soundbars, bookshelf speakers, and wireless speakers.
 */
export const universalSpeakerLayout: RemoteLayoutDefinition = {
  id: 'universal-speaker',
  name: 'Speaker (Universal)',
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
        { type: 'button', id: 'vol-down', label: 'Vol −', icon: 'volume-medium-outline', action: 'VOLUME_DOWN', row: 0, col: 2 },
      ],
    },

    // ── Playback ─────────────────────────────────────────────────────────────
    {
      id: 'playback',
      title: 'Playback',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'prev',       label: '|◀◀', icon: 'play-skip-back-outline',    action: 'PREV',       row: 0, col: 0 },
        { type: 'button', id: 'play-pause', label: '▶‖',  icon: 'play-outline',              action: 'PLAY_PAUSE', row: 0, col: 1, variant: 'primary', size: 'lg' },
        { type: 'button', id: 'next',       label: '▶▶|', icon: 'play-skip-forward-outline', action: 'NEXT',       row: 0, col: 2 },
      ],
    },

    // ── Input Source ─────────────────────────────────────────────────────────
    {
      id: 'source',
      title: 'Input Source',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'bt',       label: 'BT',       icon: 'bluetooth-outline',    action: 'SOURCE_BT',       row: 0, col: 0 },
        { type: 'button', id: 'aux',      label: 'AUX',      icon: 'headset-outline',      action: 'SOURCE_AUX',      row: 0, col: 1 },
        { type: 'button', id: 'usb',      label: 'USB',      icon: 'save-outline',             action: 'SOURCE_USB',      row: 0, col: 2 },
        { type: 'button', id: 'optical',  label: 'Optical',  icon: 'radio-outline',        action: 'SOURCE_OPTICAL',  row: 1, col: 0 },
        { type: 'button', id: 'wifi',     label: 'Wi-Fi',    icon: 'wifi-outline',         action: 'SOURCE_WIFI',     row: 1, col: 1 },
        { type: 'button', id: 'line-in',  label: 'Line In',  icon: 'git-merge-outline',    action: 'SOURCE_LINE_IN',  row: 1, col: 2 },
      ],
    },

    // ── EQ / Sound ───────────────────────────────────────────────────────────
    {
      id: 'eq',
      title: 'EQ',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'bass-up',     label: 'Bass +',    icon: 'trending-up-outline',   action: 'BASS_UP',     row: 0, col: 0 },
        { type: 'button', id: 'bass-down',   label: 'Bass −',    icon: 'trending-down-outline', action: 'BASS_DOWN',   row: 0, col: 1 },
        { type: 'button', id: 'treble-up',   label: 'Treble +',                                  action: 'TREBLE_UP',   row: 1, col: 0 },
        { type: 'button', id: 'treble-down', label: 'Treble −',                                  action: 'TREBLE_DOWN', row: 1, col: 1 },
        { type: 'button', id: 'eq-preset',   label: 'EQ Preset', icon: 'options-outline',       action: 'EQ_PRESET',   row: 0, col: 2, variant: 'ghost' },
      ],
    },

    // ── Extra ─────────────────────────────────────────────────────────────────
    {
      id: 'extra',
      title: 'Extra',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'party-mode', label: 'Party',  icon: 'star-outline',   action: 'PARTY_MODE', row: 0, col: 0, variant: 'ghost' },
        { type: 'button', id: 'stereo',     label: 'Stereo', icon: 'pulse-outline',  action: 'STEREO',     row: 0, col: 1, variant: 'ghost' },
        { type: 'button', id: 'sleep',      label: 'Sleep',  icon: 'moon-outline',   action: 'SLEEP_TIMER', row: 0, col: 2, variant: 'ghost' },
      ],
    },
  ],
};
