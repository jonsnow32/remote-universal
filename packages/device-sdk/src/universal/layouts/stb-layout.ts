import type { RemoteLayoutDefinition } from '@remote/core';

/**
 * Universal Set-top Box / Cable Box layout.
 * Covers cable boxes, satellite receivers, OTT boxes (Apple TV, Android TV)
 * and IPTV receivers.
 */
export const universalSTBLayout: RemoteLayoutDefinition = {
  id: 'universal-stb',
  name: 'Set-top Box (Universal)',
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

    // ── Search ───────────────────────────────────────────────────────────────
    {
      id: 'search',
      columns: 1,
      rowHeight: 52,
      widgets: [
        { type: 'text-input', id: 'search-input', row: 0, col: 0, icon: 'search-outline', placeholder: 'Search channels & content…', action: 'SEARCH' },
      ],
    },

    // ── Controls ─────────────────────────────────────────────────────────────
    {
      id: 'shortcut',
      title: 'Controls',
      columns: 4,
      rowHeight: 62,
      widgets: [
        { type: 'button', id: 'home',     label: 'Home',     icon: 'home-outline',               action: 'HOME',           row: 0, col: 0 },
        { type: 'button', id: 'back',     label: 'Back',     icon: 'arrow-back-outline',         action: 'BACK',           row: 0, col: 1 },
        { type: 'button', id: 'menu',     label: 'Menu',     icon: 'menu-outline',               action: 'MENU',           row: 0, col: 2 },
        { type: 'button', id: 'guide',    label: 'Guide',    icon: 'grid-outline',               action: 'GUIDE',          row: 0, col: 3 },
        { type: 'button', id: 'info',     label: 'Info',     icon: 'information-circle-outline', action: 'INFO',           row: 1, col: 0, variant: 'ghost' },
        { type: 'button', id: 'cc',       label: 'CC',       icon: 'text-outline',               action: 'CLOSED_CAPTION', row: 1, col: 1, variant: 'ghost' },
        { type: 'button', id: 'settings', label: 'Settings', icon: 'settings-outline',           action: 'SETTINGS',       row: 1, col: 3, variant: 'ghost' },
      ],
    },

    // ── Playback ─────────────────────────────────────────────────────────────
    {
      id: 'playback',
      title: 'Playback',
      columns: 4,
      rowHeight: 60,
      widgets: [
        { type: 'button', id: 'record',     label: 'Rec',   icon: 'radio-button-on-outline',    action: 'RECORD',       row: 0, col: 0, variant: 'danger' },
        { type: 'button', id: 'rewind',     label: '◀◀',   icon: 'play-back-outline',           action: 'REWIND',       row: 0, col: 1 },
        { type: 'button', id: 'play-pause', label: '▶‖',   icon: 'play-outline',                action: 'PLAY_PAUSE',   row: 0, col: 2, variant: 'primary' },
        { type: 'button', id: 'fast-fwd',   label: '▶▶',   icon: 'play-forward-outline',        action: 'FAST_FORWARD', row: 0, col: 3 },
        { type: 'button', id: 'stop',       label: 'Stop',  icon: 'stop-circle-outline',         action: 'STOP',         row: 1, col: 0, variant: 'ghost' },
        { type: 'button', id: 'prev',       label: '|◀◀',  icon: 'play-skip-back-outline',      action: 'PREV',         row: 1, col: 1 },
        { type: 'button', id: 'next',       label: '▶▶|',  icon: 'play-skip-forward-outline',   action: 'NEXT',         row: 1, col: 2 },
        { type: 'button', id: 'live',       label: 'Live',  icon: 'radio-outline',               action: 'LIVE_TV',      row: 1, col: 3 },
      ],
    },

    // ── Colour buttons (broadcast interactive services) ──────────────────────
    {
      id: 'colour-buttons',
      title: 'Interactive',
      columns: 4,
      rowHeight: 56,
      widgets: [
        { type: 'button', id: 'red',    label: 'Red',    action: 'BUTTON_RED',    row: 0, col: 0 },
        { type: 'button', id: 'green',  label: 'Green',  action: 'BUTTON_GREEN',  row: 0, col: 1 },
        { type: 'button', id: 'yellow', label: 'Yellow', action: 'BUTTON_YELLOW', row: 0, col: 2 },
        { type: 'button', id: 'blue',   label: 'Blue',   action: 'BUTTON_BLUE',   row: 0, col: 3 },
      ],
    },
  ],
};
