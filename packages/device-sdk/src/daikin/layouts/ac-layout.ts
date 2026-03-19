import type { RemoteLayoutDefinition } from '@remote/core';

export const daikinACLayout: RemoteLayoutDefinition = {
  id: 'daikin-ac',
  name: 'Daikin AC',
  sections: [
    {
      id: 'power',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'power-on', label: 'On', action: 'POWER_ON', row: 0, col: 0, variant: 'primary' },
        { type: 'button', id: 'power-off', label: 'Off', action: 'POWER_OFF', row: 0, col: 2, variant: 'ghost' },
      ],
    },
    {
      id: 'temperature',
      title: 'Temperature',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'temp-up', label: '▲ Temp', action: 'TEMP_UP', row: 0, col: 1 },
        { type: 'button', id: 'temp-down', label: '▼ Temp', action: 'TEMP_DOWN', row: 1, col: 1 },
      ],
    },
    {
      id: 'mode',
      title: 'Mode',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'cool', label: '❄️ Cool', action: 'MODE_COOL', row: 0, col: 0 },
        { type: 'button', id: 'heat', label: '🔥 Heat', action: 'MODE_HEAT', row: 0, col: 1 },
        { type: 'button', id: 'fan', label: '💨 Fan', action: 'MODE_FAN', row: 0, col: 2 },
        { type: 'button', id: 'dry', label: '💧 Dry', action: 'MODE_DRY', row: 1, col: 0 },
      ],
    },
    {
      id: 'fan',
      title: 'Fan Speed',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'fan-auto', label: 'Auto', action: 'FAN_AUTO', row: 0, col: 0 },
        { type: 'button', id: 'fan-low', label: 'Low', action: 'FAN_LOW', row: 0, col: 1 },
        { type: 'button', id: 'fan-med', label: 'Med', action: 'FAN_MED', row: 0, col: 2 },
        { type: 'button', id: 'fan-high', label: 'High', action: 'FAN_HIGH', row: 1, col: 0 },
      ],
    },
    {
      id: 'swing',
      title: 'Swing',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'swing-on', label: 'Swing On', action: 'SWING_ON', row: 0, col: 0 },
        { type: 'button', id: 'swing-off', label: 'Swing Off', action: 'SWING_OFF', row: 0, col: 1 },
      ],
    },
  ],
};
