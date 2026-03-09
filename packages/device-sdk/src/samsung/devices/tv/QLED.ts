import { DeviceDefinition } from '@remote/core';

/**
 * Samsung QLED QN85B device definition.
 */
export const SamsungQLED: DeviceDefinition = {
  id: 'samsung-qled-qn85b',
  brand: 'samsung',
  model: 'QLED QN85B',
  category: 'tv',
  protocols: ['wifi', 'ir'],
  capabilities: ['power', 'volume', 'channel', 'navigation', 'media', 'input_source'],
  layout: { name: 'samsung-tv', source: '@remote/device-sdk/samsung/layouts/tv-layout' },
  thumbnail: 'https://images.samsung.com/is/image/samsung/p6pim/uk/qe85qn85b/gallery/uk-qled-qn85b.jpg',
  commands: {
    POWER_TOGGLE: {
      ir: '0000 006D 0000 0022 00AC 00AB ...',
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_POWER' } }),
    },
    VOLUME_UP: {
      ir: '0000 006D 0000 0022 00AC 00AB ... VOLUP',
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_VOLUP' } }),
    },
    VOLUME_DOWN: {
      ir: '0000 006D 0000 0022 00AC 00AB ... VOLDOWN',
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_VOLDOWN' } }),
    },
    MUTE: {
      ir: '0000 006D 0000 0022 00AC 00AB ... MUTE',
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_MUTE' } }),
    },
    CH_UP: {
      ir: '0000 006D 0000 0022 00AC 00AB ... CHUP',
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_CHUP' } }),
    },
    CH_DOWN: {
      ir: '0000 006D 0000 0022 00AC 00AB ... CHDOWN',
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_CHDOWN' } }),
    },
    DPAD_UP: {
      ir: '0000 006D 0000 0022 00AC 00AB ... UP',
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_UP' } }),
    },
    DPAD_DOWN: {
      ir: '0000 006D 0000 0022 00AC 00AB ... DOWN',
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_DOWN' } }),
    },
    DPAD_LEFT: {
      ir: '0000 006D 0000 0022 00AC 00AB ... LEFT',
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_LEFT' } }),
    },
    DPAD_RIGHT: {
      ir: '0000 006D 0000 0022 00AC 00AB ... RIGHT',
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_RIGHT' } }),
    },
    DPAD_OK: {
      ir: '0000 006D 0000 0022 00AC 00AB ... ENTER',
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_ENTER' } }),
    },
    BACK: {
      ir: '0000 006D 0000 0022 00AC 00AB ... RETURN',
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_RETURN' } }),
    },
    HOME: {
      ir: '0000 006D 0000 0022 00AC 00AB ... HOME',
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_HOME' } }),
    },
    MENU: {
      ir: '0000 006D 0000 0022 00AC 00AB ... MENU',
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_MENU' } }),
    },
    NETFLIX: {
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_NETFLIX' } }),
    },
    YOUTUBE: {
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_YOUTUBE' } }),
    },
    SOURCE: {
      ir: '0000 006D 0000 0022 00AC 00AB ... SOURCE',
      wifi: JSON.stringify({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: 'KEY_SOURCE' } }),
    },
  },
};
