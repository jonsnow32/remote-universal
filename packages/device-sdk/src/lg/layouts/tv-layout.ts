import { RemoteLayoutDefinition } from '@remote/core';

export const lgTVLayout: RemoteLayoutDefinition = {
  id: 'lg-tv',
  name: 'LG TV',
  columns: 3,
  sections: [
    {
      id: 'power',
      buttons: [
        { id: 'power', label: 'Power', action: 'POWER_TOGGLE', row: 0, col: 1, variant: 'primary', size: 'lg' },
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
  ],
};
