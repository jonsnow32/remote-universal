import { DeviceDefinition } from '@remote/core';

/**
 * Samsung The Frame TV device definition.
 */
export const SamsungFrame: DeviceDefinition = {
  id: 'samsung-the-frame',
  brand: 'samsung',
  model: 'The Frame',
  category: 'tv',
  protocols: ['wifi', 'ir'],
  capabilities: ['power', 'volume', 'channel', 'navigation', 'media', 'input_source'],
  layout: { name: 'samsung-tv', source: '@remote/device-sdk/samsung/layouts/tv-layout' },
  commands: {
    POWER_TOGGLE: {
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_POWER' } }),
    },
    ART_MODE: {
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_ART_MODE' } }),
    },
    VOLUME_UP: {
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_VOLUP' } }),
    },
    VOLUME_DOWN: {
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_VOLDOWN' } }),
    },
    MUTE: {
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_MUTE' } }),
    },
    DPAD_UP: {
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_UP' } }),
    },
    DPAD_DOWN: {
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_DOWN' } }),
    },
    DPAD_LEFT: {
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_LEFT' } }),
    },
    DPAD_RIGHT: {
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_RIGHT' } }),
    },
    DPAD_OK: {
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_ENTER' } }),
    },
    HOME: {
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_HOME' } }),
    },
    BACK: {
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_RETURN' } }),
    },
  },
};
