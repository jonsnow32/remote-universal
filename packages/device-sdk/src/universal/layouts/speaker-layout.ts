import { RemoteLayoutDefinition } from '@remote/core';

/**
 * Universal Speaker layout — for Bluetooth/Wi-Fi/IR audio speakers.
 * Covers soundbars, bookshelf speakers, and wireless speakers.
 */
export const universalSpeakerLayout: RemoteLayoutDefinition = {
  id: 'universal-speaker',
  name: 'Speaker (Universal)',
  columns: 3,
  sections: [
    // ── Power ───────────────────────────────────────────────────────────────
    {
      id: 'power',
      buttons: [
        { id: 'power-toggle', label: 'Power', icon: 'power', action: 'POWER_TOGGLE', row: 0, col: 1, variant: 'primary', size: 'lg' },
      ],
    },

    // ── Volume ──────────────────────────────────────────────────────────────
    {
      id: 'volume',
      title: 'Volume',
      buttons: [
        { id: 'vol-up',   label: 'Vol +', icon: 'volume-high-outline',  action: 'VOLUME_UP',   row: 0, col: 0, variant: 'primary' },
        { id: 'mute',     label: 'Mute',  icon: 'volume-mute-outline',  action: 'MUTE',        row: 0, col: 1, variant: 'ghost' },
        { id: 'vol-down', label: 'Vol −', icon: 'volume-medium-outline', action: 'VOLUME_DOWN', row: 0, col: 2 },
      ],
    },

    // ── Playback ─────────────────────────────────────────────────────────────
    {
      id: 'playback',
      title: 'Playback',
      buttons: [
        { id: 'prev',       label: '|◀◀', icon: 'play-skip-back-outline',    action: 'PREV',       row: 0, col: 0 },
        { id: 'play-pause', label: '▶‖',  icon: 'play-outline',              action: 'PLAY_PAUSE', row: 0, col: 1, variant: 'primary', size: 'lg' },
        { id: 'next',       label: '▶▶|', icon: 'play-skip-forward-outline', action: 'NEXT',       row: 0, col: 2 },
      ],
    },

    // ── Input Source ─────────────────────────────────────────────────────────
    {
      id: 'source',
      title: 'Input Source',
      buttons: [
        { id: 'bt',       label: 'BT',       icon: 'bluetooth-outline',    action: 'SOURCE_BT',       row: 0, col: 0 },
        { id: 'aux',      label: 'AUX',      icon: 'headset-outline',      action: 'SOURCE_AUX',      row: 0, col: 1 },
        { id: 'usb',      label: 'USB',      icon: 'save-outline',             action: 'SOURCE_USB',      row: 0, col: 2 },
        { id: 'optical',  label: 'Optical',  icon: 'radio-outline',        action: 'SOURCE_OPTICAL',  row: 1, col: 0 },
        { id: 'wifi',     label: 'Wi-Fi',    icon: 'wifi-outline',         action: 'SOURCE_WIFI',     row: 1, col: 1 },
        { id: 'line-in',  label: 'Line In',  icon: 'git-merge-outline',    action: 'SOURCE_LINE_IN',  row: 1, col: 2 },
      ],
    },

    // ── EQ / Sound ───────────────────────────────────────────────────────────
    {
      id: 'eq',
      title: 'EQ',
      buttons: [
        { id: 'bass-up',     label: 'Bass +',    icon: 'trending-up-outline',   action: 'BASS_UP',     row: 0, col: 0 },
        { id: 'bass-down',   label: 'Bass −',    icon: 'trending-down-outline', action: 'BASS_DOWN',   row: 0, col: 1 },
        { id: 'treble-up',   label: 'Treble +',                                  action: 'TREBLE_UP',   row: 1, col: 0 },
        { id: 'treble-down', label: 'Treble −',                                  action: 'TREBLE_DOWN', row: 1, col: 1 },
        { id: 'eq-preset',   label: 'EQ Preset', icon: 'options-outline',       action: 'EQ_PRESET',   row: 0, col: 2, variant: 'ghost' },
      ],
    },

    // ── Extra ─────────────────────────────────────────────────────────────────
    {
      id: 'extra',
      title: 'Extra',
      buttons: [
        { id: 'party-mode', label: 'Party',  icon: 'star-outline',   action: 'PARTY_MODE', row: 0, col: 0, variant: 'ghost' },
        { id: 'stereo',     label: 'Stereo', icon: 'pulse-outline',  action: 'STEREO',     row: 0, col: 1, variant: 'ghost' },
        { id: 'sleep',      label: 'Sleep',  icon: 'moon-outline',   action: 'SLEEP_TIMER', row: 0, col: 2, variant: 'ghost' },
      ],
    },
  ],
};
