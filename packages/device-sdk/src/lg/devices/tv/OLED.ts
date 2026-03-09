import { DeviceDefinition } from '@remote/core';

export const LGOLED: DeviceDefinition = {
  id: 'lg-oled-c3',
  brand: 'lg',
  model: 'OLED C3',
  category: 'tv',
  protocols: ['wifi', 'ir'],
  capabilities: ['power', 'volume', 'channel', 'navigation', 'media', 'input_source'],
  layout: { name: 'lg-tv', source: '@remote/device-sdk/lg/layouts/tv-layout' },
  commands: {
    POWER_TOGGLE: {
      ir: 'lg-power-ir',
      wifi: JSON.stringify({ type: 'click', name: 'POWER' }),
    },
    VOLUME_UP: {
      ir: 'lg-volup-ir',
      wifi: JSON.stringify({ type: 'click', name: 'VOLUMEUP' }),
    },
    VOLUME_DOWN: {
      ir: 'lg-voldown-ir',
      wifi: JSON.stringify({ type: 'click', name: 'VOLUMEDOWN' }),
    },
    MUTE: {
      ir: 'lg-mute-ir',
      wifi: JSON.stringify({ type: 'click', name: 'MUTE' }),
    },
    DPAD_UP: {
      wifi: JSON.stringify({ type: 'click', name: 'UP' }),
    },
    DPAD_DOWN: {
      wifi: JSON.stringify({ type: 'click', name: 'DOWN' }),
    },
    DPAD_LEFT: {
      wifi: JSON.stringify({ type: 'click', name: 'LEFT' }),
    },
    DPAD_RIGHT: {
      wifi: JSON.stringify({ type: 'click', name: 'RIGHT' }),
    },
    DPAD_OK: {
      wifi: JSON.stringify({ type: 'click', name: 'ENTER' }),
    },
    HOME: {
      wifi: JSON.stringify({ type: 'click', name: 'HOME' }),
    },
    BACK: {
      wifi: JSON.stringify({ type: 'click', name: 'BACK' }),
    },
  },
};
