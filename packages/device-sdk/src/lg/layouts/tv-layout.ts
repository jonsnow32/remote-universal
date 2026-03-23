import type { RemoteLayoutDefinition } from '@remote/core';

export const lgTVLayout: RemoteLayoutDefinition = {
  id: 'lg-tv',
  name: 'LG TV',
  deviceType: 'tv',
  sections: [
    {
      id: 'power',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'power', label: 'Power', action: 'POWER_TOGGLE', row: 0, col: 1, variant: 'primary', size: 'lg' },
      ],
    },
    // ── Main controls: Vol · DPad · Ch ───────────────────────────────────────
    {
      id: 'main-controls',
      columns: 5,
      rowHeight: 220,
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
    {
      id: 'controls',
      columns: 3,
      rowHeight: 60,
      widgets: [
        { type: 'button', id: 'back',   label: 'Back',   icon: 'arrow-back-outline', action: 'BACK',   row: 0, col: 0 },
        { type: 'button', id: 'home',   label: 'Home',   icon: 'home-outline',       action: 'HOME',   row: 0, col: 1 },
        { type: 'button', id: 'source', label: 'Source', icon: 'swap-horizontal-outline', action: 'SOURCE', row: 0, col: 2 },
      ],
    },
  ],
};
