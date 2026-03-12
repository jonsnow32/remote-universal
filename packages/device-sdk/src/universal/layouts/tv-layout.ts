import { RemoteLayoutDefinition } from '@remote/core';

/**
 * Universal TV layout — brand-agnostic.
 * Works with any TV controllable via IR, Wi-Fi, or BLE.
 * Brands can extend or override individual sections.
 */
export const universalTVLayout: RemoteLayoutDefinition = {
  id: 'universal-tv',
  name: 'TV (Universal)',
  columns: 4,
  sections: [
    // ── Power ───────────────────────────────────────────────────────────────
    {
      id: 'power',
      buttons: [
        {
          id: 'power-toggle',
          label: 'Power',
          icon: 'power',
          action: 'POWER_TOGGLE',
          row: 0, col: 1, colSpan: 2,
          variant: 'primary',
          size: 'lg',
        },
      ],
    },

    // ── Volume + Channel (side-by-side columns) ──────────────────────────────
    {
      id: 'vol-ch',
      title: 'Volume / Channel',
      buttons: [
        { id: 'vol-up',   label: 'Vol +', icon: 'volume-high-outline',   action: 'VOLUME_UP',   row: 0, col: 0 },
        { id: 'ch-up',    label: 'Ch +',  icon: 'chevron-up',            action: 'CHANNEL_UP',  row: 0, col: 3 },
        { id: 'mute',     label: 'Mute',  icon: 'volume-mute-outline',   action: 'MUTE',        row: 1, col: 0, variant: 'ghost' },
        { id: 'ch-prev',  label: 'Prev',  icon: 'return-down-back-outline', action: 'CHANNEL_PREV', row: 1, col: 3, variant: 'ghost' },
        { id: 'vol-down', label: 'Vol −', icon: 'volume-low-outline',    action: 'VOLUME_DOWN', row: 2, col: 0 },
        { id: 'ch-down',  label: 'Ch −',  icon: 'chevron-down',          action: 'CHANNEL_DOWN', row: 2, col: 3 },
      ],
    },

    // ── D-pad navigation ────────────────────────────────────────────────────
    {
      id: 'navigation',
      title: 'Navigation',
      buttons: [
        { id: 'nav-up',    label: '▲',   icon: 'chevron-up',      action: 'DPAD_UP',    row: 0, col: 1 },
        { id: 'nav-left',  label: '◀',   icon: 'chevron-back',    action: 'DPAD_LEFT',  row: 1, col: 0 },
        { id: 'nav-ok',    label: 'OK',                            action: 'DPAD_OK',    row: 1, col: 1, colSpan: 2, variant: 'primary' },
        { id: 'nav-right', label: '▶',   icon: 'chevron-forward', action: 'DPAD_RIGHT', row: 1, col: 3 },
        { id: 'nav-down',  label: '▼',   icon: 'chevron-down',    action: 'DPAD_DOWN',  row: 2, col: 1 },
      ],
    },

    // ── Utility ─────────────────────────────────────────────────────────────
    {
      id: 'utility',
      title: 'Controls',
      buttons: [
        { id: 'back',   label: 'Back',   icon: 'arrow-back-outline',         action: 'BACK',     row: 0, col: 0 },
        { id: 'home',   label: 'Home',   icon: 'home-outline',               action: 'HOME',     row: 0, col: 1 },
        { id: 'menu',   label: 'Menu',   icon: 'menu-outline',               action: 'MENU',     row: 0, col: 2 },
        { id: 'info',   label: 'Info',   icon: 'information-circle-outline', action: 'INFO',     row: 0, col: 3 },
        { id: 'guide',  label: 'Guide',  icon: 'grid-outline',               action: 'GUIDE',    row: 1, col: 0 },
        { id: 'subtitles', label: 'Sub', icon: 'text-outline',               action: 'SUBTITLES', row: 1, col: 1 },
        { id: 'settings', label: 'Settings', icon: 'settings-outline',       action: 'SETTINGS', row: 1, col: 2 },
        { id: 'sleep',  label: 'Sleep',  icon: 'moon-outline',               action: 'SLEEP_TIMER', row: 1, col: 3, variant: 'ghost' },
      ],
    },

    // ── Playback ────────────────────────────────────────────────────────────
    {
      id: 'playback',
      title: 'Playback',
      buttons: [
        { id: 'play-prev',  label: '|◀◀', icon: 'play-skip-back-outline',    action: 'PREV',        row: 0, col: 0 },
        { id: 'rewind',     label: '◀◀',  icon: 'play-back-outline',         action: 'REWIND',       row: 0, col: 1 },
        { id: 'play-pause', label: '▶‖',  icon: 'play-outline',              action: 'PLAY_PAUSE',   row: 0, col: 2, variant: 'primary' },
        { id: 'fast-fwd',   label: '▶▶',  icon: 'play-forward-outline',      action: 'FAST_FORWARD', row: 0, col: 3 },
        { id: 'play-next',  label: '▶▶|', icon: 'play-skip-forward-outline', action: 'NEXT',         row: 1, col: 3 },
        { id: 'stop',       label: 'Stop',icon: 'stop-circle-outline',        action: 'STOP',         row: 1, col: 0, variant: 'ghost' },
        { id: 'record',     label: 'Rec', icon: 'radio-button-on-outline',   action: 'RECORD',       row: 1, col: 1, variant: 'danger' },
      ],
    },

    // ── HDMI / Source ────────────────────────────────────────────────────────
    {
      id: 'input',
      title: 'Input Source',
      buttons: [
        { id: 'source',  label: 'Source',  icon: 'swap-horizontal-outline', action: 'SOURCE',   row: 0, col: 0, variant: 'ghost' },
        { id: 'hdmi-1',  label: 'HDMI 1',                                   action: 'HDMI_1',   row: 0, col: 1 },
        { id: 'hdmi-2',  label: 'HDMI 2',                                   action: 'HDMI_2',   row: 0, col: 2 },
        { id: 'hdmi-3',  label: 'HDMI 3',                                   action: 'HDMI_3',   row: 0, col: 3 },
        { id: 'usb',     label: 'USB',     icon: 'usb-outline',             action: 'USB',      row: 1, col: 1 },
        { id: 'av',      label: 'AV',                                        action: 'AV',       row: 1, col: 2 },
        { id: 'antenna', label: 'TV',      icon: 'tv-outline',              action: 'ANTENNA',  row: 1, col: 3 },
      ],
    },

    // ── Streaming apps ──────────────────────────────────────────────────────
    {
      id: 'apps',
      title: 'Apps',
      buttons: [
        { id: 'netflix',  label: 'Netflix',   icon: 'film-outline',          action: 'NETFLIX',    row: 0, col: 0 },
        { id: 'youtube',  label: 'YouTube',   icon: 'logo-youtube',          action: 'YOUTUBE',    row: 0, col: 1 },
        { id: 'disney',   label: 'Disney+',   icon: 'star-outline',          action: 'DISNEY_PLUS', row: 0, col: 2 },
        { id: 'prime',    label: 'Prime',     icon: 'cart-outline',          action: 'PRIME_VIDEO', row: 0, col: 3 },
      ],
    },

    // ── Picture / Sound presets ──────────────────────────────────────────────
    {
      id: 'picture-sound',
      title: 'Picture & Sound',
      buttons: [
        { id: 'pic-mode', label: 'Picture',  icon: 'color-palette-outline', action: 'PICTURE_MODE',  row: 0, col: 0 },
        { id: 'sound-mode', label: 'Sound',  icon: 'musical-note-outline',  action: 'SOUND_MODE',    row: 0, col: 1 },
        { id: 'cc',       label: 'CC',       icon: 'closed-captioning-outline', action: 'CLOSED_CAPTION', row: 0, col: 2 },
        { id: '3d',       label: '3D',                                       action: 'THREE_D',        row: 0, col: 3, variant: 'ghost' },
      ],
    },
  ],
};
