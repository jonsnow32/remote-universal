import type { RemoteLayoutDefinition } from '@remote/core';

export const shieldTVLayout: RemoteLayoutDefinition = {
  id: 'shield-tv',
  name: 'NVIDIA Shield TV',
  deviceType: 'stb',
  sections: [
    // ── Power · Menu ──────────────────────────────────────────────────────────
    {
      id: 'power',
      columns: 4,
      rowHeight: 48,
      widgets: [
        { type: 'button', id: 'power', label: 'Power', icon: 'power', action: 'POWER_TOGGLE', row: 0, col: 1, variant: 'danger', size: 'lg' },
        { type: 'button', id: 'menu',  label: 'Menu',  icon: 'menu',  action: 'MENU',         row: 0, col: 2 },
      ],
    },

    // ── D-Pad ─────────────────────────────────────────────────────────────────
    {
      id: 'nav',
      columns: 4,
      rowHeight: 150,
      widgets: [
        {
          type: 'dpad', id: 'dpad', row: 0, col: 1, colSpan: 2,
          actions: { up: 'DPAD_UP', down: 'DPAD_DOWN', left: 'DPAD_LEFT', right: 'DPAD_RIGHT', center: 'DPAD_OK' },
        },
      ],
    },

    // ── Back · Home ───────────────────────────────────────────────────────────
    {
      id: 'nav-controls',
      columns: 4,
      rowHeight: 48,
      widgets: [
        { type: 'button', id: 'back', label: 'Back', icon: 'arrow-back-outline', action: 'BACK', row: 0, col: 1 },
        { type: 'button', id: 'home', label: 'Home', icon: 'ellipse-outline',    action: 'HOME', row: 0, col: 2 },
      ],
    },

    // ── Skip Forward · Voice ──────────────────────────────────────────────────
    {
      id: 'media-top',
      columns: 4,
      rowHeight: 48,
      widgets: [
        { type: 'button', id: 'fast-forward', label: 'Fwd',   icon: 'play-forward-outline', action: 'FAST_FORWARD',  row: 0, col: 1 },
        { type: 'button', id: 'voice',        label: 'Voice', icon: 'mic-outline',           action: 'VOICE_COMMAND', row: 0, col: 2 },
      ],
    },

    // ── Play/Pause · Volume Up ────────────────────────────────────────────────
    {
      id: 'media-mid',
      columns: 4,
      rowHeight: 48,
      widgets: [
        { type: 'button', id: 'play-pause', label: '▶‖',  icon: 'play-outline',         action: 'PLAY_PAUSE', row: 0, col: 1 },
        { type: 'button', id: 'vol-up',     label: 'Vol+', icon: 'volume-high-outline',  action: 'VOLUME_UP',  row: 0, col: 2 },
      ]
    },

    // ── Rewind · Volume Down ──────────────────────────────────────────────────
    {
      id: 'media-bot',
      columns: 4,
      rowHeight: 48,
      widgets: [
        { type: 'button', id: 'rewind',  label: 'Rew',  icon: 'play-back-outline',  action: 'REWIND',      row: 0, col: 1 },
        { type: 'button', id: 'vol-down', label: 'Vol−', icon: 'volume-low-outline', action: 'VOLUME_DOWN', row: 0, col: 2 },
      ],
    },

    // ── Netflix ───────────────────────────────────────────────────────────────
    {
      id: 'apps',
      columns: 3,
      rowHeight: 56,
      widgets: [
        { type: 'button', id: 'netflix', label: 'NETFLIX', icon: 'film-outline', action: 'NETFLIX', row: 0, col: 1, variant: 'danger' },
      ],
    },
  ],
};
