import { DeviceDefinition } from '@remote/core';

export const LGDualCool: DeviceDefinition = {
  id: 'lg-ac-dualcool',
  brand: 'lg',
  model: 'DualCool',
  category: 'ac',
  protocols: ['wifi', 'ir'],
  capabilities: ['power', 'temperature', 'fan_speed', 'swing', 'mode'],
  layout: { name: 'lg-ac', source: '@remote/device-sdk/lg/layouts/ac-layout' },
  commands: {
    POWER_ON: { wifi: JSON.stringify({ command: 'Set', dataKey: 'airState.operation', dataValue: 1 }) },
    POWER_OFF: { wifi: JSON.stringify({ command: 'Set', dataKey: 'airState.operation', dataValue: 0 }) },
    TEMP_UP: { wifi: JSON.stringify({ command: 'Set', dataKey: 'airState.tempState.target', dataValue: '+1' }) },
    TEMP_DOWN: { wifi: JSON.stringify({ command: 'Set', dataKey: 'airState.tempState.target', dataValue: '-1' }) },
    MODE_COOL: { wifi: JSON.stringify({ command: 'Set', dataKey: 'airState.opMode', dataValue: 0 }) },
    MODE_HEAT: { wifi: JSON.stringify({ command: 'Set', dataKey: 'airState.opMode', dataValue: 4 }) },
    FAN_AUTO: { wifi: JSON.stringify({ command: 'Set', dataKey: 'airState.windStrength', dataValue: 0 }) },
    FAN_LOW: { wifi: JSON.stringify({ command: 'Set', dataKey: 'airState.windStrength', dataValue: 2 }) },
    FAN_MED: { wifi: JSON.stringify({ command: 'Set', dataKey: 'airState.windStrength', dataValue: 4 }) },
    FAN_HIGH: { wifi: JSON.stringify({ command: 'Set', dataKey: 'airState.windStrength', dataValue: 6 }) },
  },
};
