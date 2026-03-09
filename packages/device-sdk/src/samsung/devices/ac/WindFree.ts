import { DeviceDefinition } from '@remote/core';

/**
 * Samsung WindFree air conditioner device definition.
 */
export const SamsungWindFree: DeviceDefinition = {
  id: 'samsung-ac-windfree',
  brand: 'samsung',
  model: 'WindFree',
  category: 'ac',
  protocols: ['wifi', 'ir'],
  capabilities: ['power', 'temperature', 'fan_speed', 'swing', 'mode'],
  layout: { name: 'samsung-ac', source: '@remote/device-sdk/samsung/layouts/ac-layout' },
  commands: {
    POWER_ON: {
      ir: 'samsung-ac-power-on-ir-code',
      wifi: JSON.stringify({ cmd: 'power', value: 'on' }),
    },
    POWER_OFF: {
      ir: 'samsung-ac-power-off-ir-code',
      wifi: JSON.stringify({ cmd: 'power', value: 'off' }),
    },
    TEMP_UP: {
      wifi: JSON.stringify({ cmd: 'temperature', value: 'up' }),
    },
    TEMP_DOWN: {
      wifi: JSON.stringify({ cmd: 'temperature', value: 'down' }),
    },
    MODE_COOL: {
      wifi: JSON.stringify({ cmd: 'mode', value: 'cool' }),
    },
    MODE_HEAT: {
      wifi: JSON.stringify({ cmd: 'mode', value: 'heat' }),
    },
    MODE_FAN: {
      wifi: JSON.stringify({ cmd: 'mode', value: 'fan' }),
    },
    FAN_AUTO: {
      wifi: JSON.stringify({ cmd: 'fan', value: 'auto' }),
    },
    FAN_LOW: {
      wifi: JSON.stringify({ cmd: 'fan', value: 'low' }),
    },
    FAN_MED: {
      wifi: JSON.stringify({ cmd: 'fan', value: 'medium' }),
    },
    FAN_HIGH: {
      wifi: JSON.stringify({ cmd: 'fan', value: 'high' }),
    },
  },
};
