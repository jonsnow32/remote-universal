import type { RemoteLayoutDefinition } from '@remote/core';

export const samsungTVLayout: RemoteLayoutDefinition = {
  id: 'samsung-tv',
  name: 'Samsung TV',
  deviceType: 'tv',
  sections: [
    // ── Power ───────────────────────────────────────────────────────────────
    {
      id: 'power',
      columns: 3,
      rowHeight: 64,
      widgets: [
        { type: 'button', id: 'power', label: 'Power', icon: 'power', action: 'POWER_TOGGLE', row: 0, col: 1, variant: 'primary', size: 'lg' },
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

    // ── Controls ─────────────────────────────────────────────────────────────
    {
      id: 'controls',
      columns: 4,
      rowHeight: 62,
      widgets: [
        { type: 'button', id: 'back',   label: 'Back',     icon: 'arrow-back-outline',   action: 'BACK',   row: 0, col: 0 },
        { type: 'button', id: 'home',   label: 'Home',     icon: 'home-outline',          action: 'HOME',   row: 0, col: 1 },
        { type: 'button', id: 'menu',   label: 'Menu',     icon: 'menu-outline',          action: 'MENU',   row: 0, col: 2 },
        { type: 'button', id: 'source', label: 'Source',   icon: 'swap-horizontal-outline', action: 'SOURCE', row: 0, col: 3 },
      ],
    },

    // ── Streaming apps ───────────────────────────────────────────────────────
    {
      id: 'apps',
      title: 'Apps',
      columns: 3,
      rowHeight: 56,
      widgets: [
        { type: 'button', id: 'netflix',    label: 'Netflix',   icon: 'film-outline',     action: 'NETFLIX',    row: 0, col: 0 },
        { type: 'button', id: 'youtube',    label: 'YouTube',   icon: 'logo-youtube',     action: 'YOUTUBE',    row: 0, col: 1 },
        { type: 'button', id: 'smart-hub',  label: 'Smart Hub', icon: 'apps-outline',     action: 'SMART_HUB',  row: 0, col: 2 },
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
      ],
    },

    // ── Utility ──────────────────────────────────────────────────────────────
    {
      id: 'utility',
      title: 'Utility',
      columns: 3,
      rowHeight: 56,
      widgets: [
        { type: 'button', id: 'sleep',    label: 'Sleep',    icon: 'moon-outline',                   action: 'SLEEP_TIMER', row: 0, col: 0, variant: 'ghost' },
        { type: 'button', id: 'settings', label: 'Settings', icon: 'settings-outline',               action: 'SETTINGS',    row: 0, col: 1 },
        { type: 'button', id: 'info',     label: 'Info',     icon: 'information-circle-outline',     action: 'INFO',        row: 0, col: 2, variant: 'ghost' },
      ],
    },
  ],
};
