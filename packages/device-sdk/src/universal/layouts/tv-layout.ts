import type { RemoteLayoutDefinition } from '@remote/core';

/**
 * Universal TV layout — brand-agnostic.
 * Works with any TV controllable via IR, Wi-Fi, or BLE.
 * Brands can extend or override individual sections.
 */
export const universalTVLayout: RemoteLayoutDefinition = {
  id: 'universal-tv',
  name: 'TV (Universal)',
  deviceType: 'tv',
  sections: [
    // ── Power ───────────────────────────────────────────────────────────────
    {
      id: 'power',
      columns: 3,
      rowHeight: 64,
      widgets: [
        { type: 'button', id: 'power-toggle', label: 'Power', icon: 'power', action: 'POWER_TOGGLE', row: 0, col: 1, variant: 'primary', size: 'lg' },
      ],
    },

    // ── Vol rocker · DPad · Channel rocker ──────────────────────────────────
    {
      id: 'main-controls',
      columns: 5,
      rowHeight: 240,
      widgets: [
        {
          type: 'rocker', id: 'volume', row: 0, col: 0,
          upAction: 'VOLUME_UP', downAction: 'VOLUME_DOWN', midAction: 'MUTE',
          upIcon: 'volume-high-outline', downIcon: 'volume-low-outline', midIcon: 'volume-mute-outline',
          upLabel: 'Vol+', downLabel: 'Vol−', midLabel: 'Mute',
        },
        {
          type: 'dpad', id: 'nav', row: 0, col: 1, colSpan: 3,
          actions: { up: 'DPAD_UP', down: 'DPAD_DOWN', left: 'DPAD_LEFT', right: 'DPAD_RIGHT', center: 'DPAD_OK' },
        },
        {
          type: 'rocker', id: 'channel', row: 0, col: 4,
          upAction: 'CHANNEL_UP', downAction: 'CHANNEL_DOWN',
          upIcon: 'chevron-up', downIcon: 'chevron-down',
          upLabel: 'Ch+', downLabel: 'Ch−',
        },
      ],
    },

    // ── Utility controls ─────────────────────────────────────────────────────
    {
      id: 'utility',
      title: 'Controls',
      columns: 4,
      rowHeight: 62,
      widgets: [
        { type: 'button', id: 'back',     label: 'Back',     icon: 'arrow-back-outline',         action: 'BACK',       row: 0, col: 0 },
        { type: 'button', id: 'home',     label: 'Home',     icon: 'home-outline',               action: 'HOME',       row: 0, col: 1 },
        { type: 'button', id: 'menu',     label: 'Menu',     icon: 'menu-outline',               action: 'MENU',       row: 0, col: 2 },
        { type: 'button', id: 'info',     label: 'Info',     icon: 'information-circle-outline', action: 'INFO',       row: 0, col: 3 },
        { type: 'button', id: 'guide',    label: 'Guide',    icon: 'grid-outline',               action: 'GUIDE',      row: 1, col: 0 },
        { type: 'button', id: 'subtitles', label: 'Sub',     icon: 'text-outline',              action: 'SUBTITLES',  row: 1, col: 1 },
        { type: 'button', id: 'settings', label: 'Settings', icon: 'settings-outline',           action: 'SETTINGS',   row: 1, col: 2 },
        { type: 'button', id: 'sleep',    label: 'Sleep',    icon: 'moon-outline',              action: 'SLEEP_TIMER', row: 1, col: 3, variant: 'ghost' },
      ],
    },

    // ── Playback ─────────────────────────────────────────────────────────────
    {
      id: 'playback',
      title: 'Playback',
      columns: 4,
      rowHeight: 60,
      widgets: [
        { type: 'button', id: 'play-prev',  label: '|◀◀', icon: 'play-skip-back-outline',    action: 'PREV',         row: 0, col: 0 },
        { type: 'button', id: 'rewind',     label: '◀◀',  icon: 'play-back-outline',          action: 'REWIND',       row: 0, col: 1 },
        { type: 'button', id: 'play-pause', label: '▶‖',  icon: 'play-outline',               action: 'PLAY_PAUSE',   row: 0, col: 2, variant: 'primary' },
        { type: 'button', id: 'fast-fwd',   label: '▶▶',  icon: 'play-forward-outline',       action: 'FAST_FORWARD', row: 0, col: 3 },
        { type: 'button', id: 'play-next',  label: '▶▶|', icon: 'play-skip-forward-outline',  action: 'NEXT',         row: 1, col: 3 },
        { type: 'button', id: 'stop',       label: 'Stop', icon: 'stop-circle-outline',        action: 'STOP',         row: 1, col: 0, variant: 'ghost' },
        { type: 'button', id: 'record',     label: 'Rec',  icon: 'radio-button-on-outline',    action: 'RECORD',       row: 1, col: 1, variant: 'danger' },
      ],
    },

    // ── HDMI / Source ────────────────────────────────────────────────────────
    {
      id: 'input',
      title: 'Input Source',
      columns: 4,
      rowHeight: 60,
      widgets: [
        { type: 'button', id: 'source',  label: 'Source',  icon: 'swap-horizontal-outline', action: 'SOURCE',   row: 0, col: 0, variant: 'ghost' },
        { type: 'button', id: 'hdmi-1',  label: 'HDMI 1',                                   action: 'HDMI_1',   row: 0, col: 1 },
        { type: 'button', id: 'hdmi-2',  label: 'HDMI 2',                                   action: 'HDMI_2',   row: 0, col: 2 },
        { type: 'button', id: 'hdmi-3',  label: 'HDMI 3',                                   action: 'HDMI_3',   row: 0, col: 3 },
        { type: 'button', id: 'usb',     label: 'USB',     icon: 'save-outline',            action: 'USB',      row: 1, col: 1 },
        { type: 'button', id: 'av',      label: 'AV',                                        action: 'AV',       row: 1, col: 2 },
        { type: 'button', id: 'antenna', label: 'TV',      icon: 'tv-outline',              action: 'ANTENNA',  row: 1, col: 3 },
      ],
    },

    // ── Streaming apps ───────────────────────────────────────────────────────
    {
      id: 'apps',
      title: 'Apps',
      columns: 4,
      rowHeight: 56,
      widgets: [
        { type: 'button', id: 'netflix', label: 'Netflix',  icon: 'film-outline',   action: 'NETFLIX',     row: 0, col: 0 },
        { type: 'button', id: 'youtube', label: 'YouTube',  icon: 'logo-youtube',   action: 'YOUTUBE',     row: 0, col: 1 },
        { type: 'button', id: 'disney',  label: 'Disney+',  icon: 'star-outline',   action: 'DISNEY_PLUS', row: 0, col: 2 },
        { type: 'button', id: 'prime',   label: 'Prime',    icon: 'cart-outline',   action: 'PRIME_VIDEO', row: 0, col: 3 },
      ],
    },

    // ── Picture / Sound presets ──────────────────────────────────────────────
    {
      id: 'picture-sound',
      title: 'Picture & Sound',
      columns: 4,
      rowHeight: 56,
      widgets: [
        { type: 'button', id: 'pic-mode',   label: 'Picture', icon: 'color-palette-outline',    action: 'PICTURE_MODE',   row: 0, col: 0 },
        { type: 'button', id: 'sound-mode', label: 'Sound',   icon: 'musical-note-outline',     action: 'SOUND_MODE',     row: 0, col: 1 },
        { type: 'button', id: 'cc',         label: 'CC',       icon: 'chatbox-ellipses-outline', action: 'CLOSED_CAPTION', row: 0, col: 2 },
        { type: 'button', id: '3d',         label: '3D',                                         action: 'THREE_D',        row: 0, col: 3, variant: 'ghost' },
      ],
    },

    // ── Voice command ────────────────────────────────────────────────────────
    {
      id: 'voice',
      title: 'Voice',
      columns: 3,
      rowHeight: 88,
      widgets: [
        { type: 'voice', id: 'voice-cmd', label: 'Voice', row: 0, col: 1 },
      ],
    },
  ],
};
