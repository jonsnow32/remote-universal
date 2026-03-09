import { DeviceDefinition } from '@remote/core';

/**
 * Daikin Emura FTXJ air conditioner device definition.
 */
export const DaikinEmura: DeviceDefinition = {
  id: 'daikin-emura-ftxj',
  brand: 'daikin',
  model: 'Emura FTXJ',
  category: 'ac',
  protocols: ['wifi', 'ir'],
  capabilities: ['power', 'temperature', 'fan_speed', 'swing', 'mode'],
  layout: { name: 'daikin-ac', source: '@remote/device-sdk/daikin/layouts/ac-layout' },
  thumbnail: 'https://www.daikin.eu/content/dam/document-library/images/products/ftxj-m.jpg',
  commands: {
    POWER_ON: {
      ir: 'daikin-power-on-ir',
      wifi: JSON.stringify({ path: '/aircon/set_control_info', params: { pow: '1' } }),
    },
    POWER_OFF: {
      ir: 'daikin-power-off-ir',
      wifi: JSON.stringify({ path: '/aircon/set_control_info', params: { pow: '0' } }),
    },
    TEMP_UP: {
      wifi: JSON.stringify({ path: '/aircon/set_control_info', params: { stemp: '+1' } }),
    },
    TEMP_DOWN: {
      wifi: JSON.stringify({ path: '/aircon/set_control_info', params: { stemp: '-1' } }),
    },
    FAN_AUTO: {
      ir: 'daikin-fan-auto-ir',
      wifi: JSON.stringify({ path: '/aircon/set_control_info', params: { f_rate: 'A' } }),
    },
    FAN_LOW: {
      ir: 'daikin-fan-low-ir',
      wifi: JSON.stringify({ path: '/aircon/set_control_info', params: { f_rate: '3' } }),
    },
    FAN_MED: {
      ir: 'daikin-fan-med-ir',
      wifi: JSON.stringify({ path: '/aircon/set_control_info', params: { f_rate: '5' } }),
    },
    FAN_HIGH: {
      ir: 'daikin-fan-high-ir',
      wifi: JSON.stringify({ path: '/aircon/set_control_info', params: { f_rate: '7' } }),
    },
    MODE_COOL: {
      ir: 'daikin-cool-ir',
      wifi: JSON.stringify({ path: '/aircon/set_control_info', params: { mode: '3' } }),
    },
    MODE_HEAT: {
      ir: 'daikin-heat-ir',
      wifi: JSON.stringify({ path: '/aircon/set_control_info', params: { mode: '4' } }),
    },
    MODE_FAN: {
      ir: 'daikin-fan-mode-ir',
      wifi: JSON.stringify({ path: '/aircon/set_control_info', params: { mode: '6' } }),
    },
    MODE_DRY: {
      ir: 'daikin-dry-ir',
      wifi: JSON.stringify({ path: '/aircon/set_control_info', params: { mode: '2' } }),
    },
    SWING_ON: {
      ir: 'daikin-swing-on-ir',
      wifi: JSON.stringify({ path: '/aircon/set_control_info', params: { f_dir: '0' } }),
    },
    SWING_OFF: {
      ir: 'daikin-swing-off-ir',
      wifi: JSON.stringify({ path: '/aircon/set_control_info', params: { f_dir: '3' } }),
    },
  },
};
