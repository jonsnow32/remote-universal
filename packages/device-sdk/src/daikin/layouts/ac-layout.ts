import { RemoteLayoutDefinition } from '@remote/core';

export const daikinACLayout: RemoteLayoutDefinition = {
  id: 'daikin-ac',
  name: 'Daikin AC',
  columns: 3,
  sections: [
    {
      id: 'power',
      buttons: [
        { id: 'power-on', label: 'On', action: 'POWER_ON', row: 0, col: 0, variant: 'primary' },
        { id: 'power-off', label: 'Off', action: 'POWER_OFF', row: 0, col: 2, variant: 'ghost' },
      ],
    },
    {
      id: 'temperature',
      title: 'Temperature',
      buttons: [
        { id: 'temp-up', label: '▲ Temp', action: 'TEMP_UP', row: 0, col: 1 },
        { id: 'temp-down', label: '▼ Temp', action: 'TEMP_DOWN', row: 1, col: 1 },
      ],
    },
    {
      id: 'mode',
      title: 'Mode',
      buttons: [
        { id: 'cool', label: '❄️ Cool', action: 'MODE_COOL', row: 0, col: 0 },
        { id: 'heat', label: '🔥 Heat', action: 'MODE_HEAT', row: 0, col: 1 },
        { id: 'fan', label: '💨 Fan', action: 'MODE_FAN', row: 0, col: 2 },
        { id: 'dry', label: '💧 Dry', action: 'MODE_DRY', row: 1, col: 0 },
      ],
    },
    {
      id: 'fan',
      title: 'Fan Speed',
      buttons: [
        { id: 'fan-auto', label: 'Auto', action: 'FAN_AUTO', row: 0, col: 0 },
        { id: 'fan-low', label: 'Low', action: 'FAN_LOW', row: 0, col: 1 },
        { id: 'fan-med', label: 'Med', action: 'FAN_MED', row: 0, col: 2 },
        { id: 'fan-high', label: 'High', action: 'FAN_HIGH', row: 1, col: 0 },
      ],
    },
    {
      id: 'swing',
      title: 'Swing',
      buttons: [
        { id: 'swing-on', label: 'Swing On', action: 'SWING_ON', row: 0, col: 0 },
        { id: 'swing-off', label: 'Swing Off', action: 'SWING_OFF', row: 0, col: 1 },
      ],
    },
  ],
};
