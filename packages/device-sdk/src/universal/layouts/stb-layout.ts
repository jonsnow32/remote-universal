import { RemoteLayoutDefinition } from '@remote/core';

/**
 * Universal Set-top Box / Cable Box layout.
 * Covers cable boxes, satellite receivers, OTT boxes (Apple TV, Android TV)
 * and IPTV receivers. Uses 4-column grid for denser navigation controls.
 */
export const universalSTBLayout: RemoteLayoutDefinition = {
  id: 'universal-stb',
  name: 'Set-top Box (Universal)',
  columns: 4,
  sections: [
    // ── Power ───────────────────────────────────────────────────────────────
    {
      id: 'power',
      buttons: [
        { id: 'power-toggle', label: 'Power', icon: 'power', action: 'POWER_TOGGLE', row: 0, col: 1, colSpan: 2, variant: 'primary', size: 'lg' },
      ],
    },

    // ── Volume + Channel ─────────────────────────────────────────────────────
    {
      id: 'vol-ch',
      title: 'Volume / Channel',
      buttons: [
        { id: 'vol-up',   label: 'Vol +', icon: 'volume-high-outline', action: 'VOLUME_UP',    row: 0, col: 0 },
        { id: 'ch-up',    label: 'Ch +',  icon: 'chevron-up',          action: 'CHANNEL_UP',   row: 0, col: 3 },
        { id: 'mute',     label: 'Mute',  icon: 'volume-mute-outline', action: 'MUTE',         row: 1, col: 0, variant: 'ghost' },
        { id: 'ch-prev',  label: 'Prev',  icon: 'return-down-back-outline', action: 'CHANNEL_PREV', row: 1, col: 3, variant: 'ghost' },
        { id: 'vol-down', label: 'Vol −', icon: 'volume-low-outline',  action: 'VOLUME_DOWN',  row: 2, col: 0 },
        { id: 'ch-down',  label: 'Ch −',  icon: 'chevron-down',        action: 'CHANNEL_DOWN', row: 2, col: 3 },
      ],
    },

    // ── Navigation ──────────────────────────────────────────────────────────
    {
      id: 'navigation',
      title: 'Navigation',
      buttons: [
        { id: 'nav-up',    label: '▲',  icon: 'chevron-up',      action: 'DPAD_UP',    row: 0, col: 1 },
        { id: 'nav-left',  label: '◀',  icon: 'chevron-back',    action: 'DPAD_LEFT',  row: 1, col: 0 },
        { id: 'nav-ok',    label: 'OK',                           action: 'DPAD_OK',    row: 1, col: 1, colSpan: 2, variant: 'primary' },
        { id: 'nav-right', label: '▶',  icon: 'chevron-forward', action: 'DPAD_RIGHT', row: 1, col: 3 },
        { id: 'nav-down',  label: '▼',  icon: 'chevron-down',    action: 'DPAD_DOWN',  row: 2, col: 1 },
      ],
    },

    // ── Shortcut bar ─────────────────────────────────────────────────────────
    {
      id: 'shortcut',
      title: 'Controls',
      buttons: [
        { id: 'home',   label: 'Home',   icon: 'home-outline',               action: 'HOME',    row: 0, col: 0 },
        { id: 'back',   label: 'Back',   icon: 'arrow-back-outline',         action: 'BACK',    row: 0, col: 1 },
        { id: 'menu',   label: 'Menu',   icon: 'menu-outline',               action: 'MENU',    row: 0, col: 2 },
        { id: 'guide',  label: 'Guide',  icon: 'grid-outline',               action: 'GUIDE',   row: 0, col: 3 },
        { id: 'info',   label: 'Info',   icon: 'information-circle-outline', action: 'INFO',    row: 1, col: 0, variant: 'ghost' },
        { id: 'search', label: 'Search', icon: 'search-outline',             action: 'SEARCH',  row: 1, col: 1, variant: 'ghost' },
        { id: 'cc',     label: 'CC',     icon: 'text-outline',               action: 'CLOSED_CAPTION', row: 1, col: 2, variant: 'ghost' },
        { id: 'settings', label: 'Settings', icon: 'settings-outline',      action: 'SETTINGS', row: 1, col: 3, variant: 'ghost' },
      ],
    },

    // ── Playback ─────────────────────────────────────────────────────────────
    {
      id: 'playback',
      title: 'Playback',
      buttons: [
        { id: 'record',     label: 'Rec',   icon: 'radio-button-on-outline',   action: 'RECORD',       row: 0, col: 0, variant: 'danger' },
        { id: 'rewind',     label: '◀◀',   icon: 'play-back-outline',         action: 'REWIND',       row: 0, col: 1 },
        { id: 'play-pause', label: '▶‖',   icon: 'play-outline',              action: 'PLAY_PAUSE',   row: 0, col: 2, variant: 'primary' },
        { id: 'fast-fwd',   label: '▶▶',   icon: 'play-forward-outline',      action: 'FAST_FORWARD', row: 0, col: 3 },
        { id: 'stop',       label: 'Stop',  icon: 'stop-circle-outline',       action: 'STOP',         row: 1, col: 0, variant: 'ghost' },
        { id: 'prev',       label: '|◀◀',  icon: 'play-skip-back-outline',    action: 'PREV',         row: 1, col: 1 },
        { id: 'next',       label: '▶▶|',  icon: 'play-skip-forward-outline', action: 'NEXT',         row: 1, col: 2 },
        { id: 'live',       label: 'Live',  icon: 'radio-outline',             action: 'LIVE_TV',      row: 1, col: 3 },
      ],
    },

    // ── Colour buttons (broadcast interactive services) ──────────────────────
    {
      id: 'colour-buttons',
      title: 'Interactive',
      buttons: [
        { id: 'red',    label: 'Red',    action: 'BUTTON_RED',    row: 0, col: 0 },
        { id: 'green',  label: 'Green',  action: 'BUTTON_GREEN',  row: 0, col: 1 },
        { id: 'yellow', label: 'Yellow', action: 'BUTTON_YELLOW', row: 0, col: 2 },
        { id: 'blue',   label: 'Blue',   action: 'BUTTON_BLUE',   row: 0, col: 3 },
      ],
    },
  ],
};
