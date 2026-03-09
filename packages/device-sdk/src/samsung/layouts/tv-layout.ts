import { RemoteLayoutDefinition } from '@remote/core';

export const samsungTVLayout: RemoteLayoutDefinition = {
  id: 'samsung-tv',
  name: 'Samsung TV',
  columns: 3,
  sections: [
    {
      id: 'power',
      buttons: [
        { id: 'power', label: 'Power', action: 'POWER_TOGGLE', row: 0, col: 1, variant: 'primary', size: 'lg' },
      ],
    },
    {
      id: 'volume',
      title: 'Volume',
      buttons: [
        { id: 'vol-up', label: '▲', action: 'VOLUME_UP', row: 0, col: 1 },
        { id: 'mute', label: '🔇', action: 'MUTE', row: 1, col: 0 },
        { id: 'vol-down', label: '▼', action: 'VOLUME_DOWN', row: 2, col: 1 },
      ],
    },
    {
      id: 'navigation',
      title: 'Navigation',
      buttons: [
        { id: 'up', label: '▲', action: 'DPAD_UP', row: 0, col: 1 },
        { id: 'left', label: '◀', action: 'DPAD_LEFT', row: 1, col: 0 },
        { id: 'ok', label: 'OK', action: 'DPAD_OK', row: 1, col: 1, variant: 'primary' },
        { id: 'right', label: '▶', action: 'DPAD_RIGHT', row: 1, col: 2 },
        { id: 'down', label: '▼', action: 'DPAD_DOWN', row: 2, col: 1 },
      ],
    },
    {
      id: 'media',
      title: 'Media',
      buttons: [
        { id: 'netflix', label: 'Netflix', action: 'NETFLIX', row: 0, col: 0 },
        { id: 'youtube', label: 'YouTube', action: 'YOUTUBE', row: 0, col: 1 },
        { id: 'home', label: 'Home', action: 'HOME', row: 0, col: 2 },
        { id: 'back', label: 'Back', action: 'BACK', row: 1, col: 0 },
        { id: 'menu', label: 'Menu', action: 'MENU', row: 1, col: 1 },
        { id: 'source', label: 'Source', action: 'SOURCE', row: 1, col: 2 },
      ],
    },
  ],
};
