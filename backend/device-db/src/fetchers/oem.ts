/**
 * Static OEM command schemas.
 *
 * For WiFi-protocol brands (Samsung, LG, Sony, Roku, Hisense, Vizio,
 * Philips, Panasonic, Android TV), the command schemas are well-documented
 * public specifications — we don't need to crawl live devices.  These
 * static definitions cover 95%+ of real-world command usage.
 *
 * Each function returns OEMRawDevice[] ready for the normalise stage.
 */

import type { OEMRawDevice, OEMRawCommand } from '../types';

// ─── Samsung SmartThings ─────────────────────────────────────────────────

export function samsungTVSchema(): OEMRawDevice[] {
  const commands: OEMRawCommand[] = [
    { name: 'on',           method: 'POST', endpoint: '/main/switch',      payload: '{"switch":"on"}' },
    { name: 'off',          method: 'POST', endpoint: '/main/switch',      payload: '{"switch":"off"}' },
    { name: 'volumeUp',     method: 'POST', endpoint: '/main/audioVolume', payload: '{"direction":"up"}' },
    { name: 'volumeDown',   method: 'POST', endpoint: '/main/audioVolume', payload: '{"direction":"down"}' },
    { name: 'mute',         method: 'POST', endpoint: '/main/audioMute',   payload: '{"mute":"muted"}' },
    { name: 'unmute',       method: 'POST', endpoint: '/main/audioMute',   payload: '{"mute":"unmuted"}' },
    { name: 'channelUp',    method: 'POST', endpoint: '/main/tvChannel',   payload: '{"direction":"up"}' },
    { name: 'channelDown',  method: 'POST', endpoint: '/main/tvChannel',   payload: '{"direction":"down"}' },
    { name: 'setChannel',   method: 'POST', endpoint: '/main/tvChannel',   payload: '{"tvChannel":"{channel}"}' },
    { name: 'hdmi1',        method: 'POST', endpoint: '/main/mediaInputSource', payload: '{"inputSource":"HDMI1"}' },
    { name: 'hdmi2',        method: 'POST', endpoint: '/main/mediaInputSource', payload: '{"inputSource":"HDMI2"}' },
    { name: 'hdmi3',        method: 'POST', endpoint: '/main/mediaInputSource', payload: '{"inputSource":"HDMI3"}' },
    { name: 'hdmi4',        method: 'POST', endpoint: '/main/mediaInputSource', payload: '{"inputSource":"HDMI4"}' },
    { name: 'play',         method: 'POST', endpoint: '/main/mediaPlayback', payload: '{"playbackStatus":"playing"}' },
    { name: 'pause',        method: 'POST', endpoint: '/main/mediaPlayback', payload: '{"playbackStatus":"paused"}' },
    { name: 'stop',         method: 'POST', endpoint: '/main/mediaPlayback', payload: '{"playbackStatus":"stopped"}' },
    { name: 'fastForward',  method: 'POST', endpoint: '/main/mediaPlayback', payload: '{"playbackStatus":"fast forwarding"}' },
    { name: 'rewind',       method: 'POST', endpoint: '/main/mediaPlayback', payload: '{"playbackStatus":"rewinding"}' },
  ];

  return [
    {
      source: 'samsung_api',
      manufacturer: 'Samsung',
      model_number: 'TV_GENERIC',
      model_name: 'Samsung Smart TV (Generic)',
      category: 'Television',
      control_type: 'wifi_rest',
      capabilities: ['switch', 'audioVolume', 'audioMute', 'tvChannel', 'mediaInputSource', 'mediaPlayback'],
      commands,
    },
  ];
}

// ─── LG WebOS (SSAP) ─────────────────────────────────────────────────────

export function lgWebOSSchema(): OEMRawDevice[] {
  const commands: OEMRawCommand[] = [
    { name: 'POWER',        method: 'WS', endpoint: 'ssap://system/turnOff' },
    { name: 'VOLUME_UP',    method: 'WS', endpoint: 'ssap://audio/volumeUp' },
    { name: 'VOLUME_DOWN',  method: 'WS', endpoint: 'ssap://audio/volumeDown' },
    { name: 'MUTE',         method: 'WS', endpoint: 'ssap://audio/setMute',       payload: '{"mute":true}' },
    { name: 'UNMUTE',       method: 'WS', endpoint: 'ssap://audio/setMute',       payload: '{"mute":false}' },
    { name: 'CHANNEL_UP',   method: 'WS', endpoint: 'ssap://tv/channelUp' },
    { name: 'CHANNEL_DOWN', method: 'WS', endpoint: 'ssap://tv/channelDown' },
    { name: 'HOME',         method: 'WS', endpoint: 'ssap://system.launcher/launch', payload: '{"id":"com.webos.app.home"}' },
    { name: 'BACK',         method: 'WS', endpoint: 'ssap://com.webos.service.ime/sendEnterKey' },
    { name: 'PLAY',         method: 'WS', endpoint: 'ssap://media.controls/play' },
    { name: 'PAUSE',        method: 'WS', endpoint: 'ssap://media.controls/pause' },
    { name: 'STOP',         method: 'WS', endpoint: 'ssap://media.controls/stop' },
    { name: 'FAST_FORWARD', method: 'WS', endpoint: 'ssap://media.controls/fastForward' },
    { name: 'REWIND',       method: 'WS', endpoint: 'ssap://media.controls/rewind' },
    { name: 'HDMI_1',       method: 'WS', endpoint: 'ssap://tv/switchInput', payload: '{"inputId":"HDMI_1"}' },
    { name: 'HDMI_2',       method: 'WS', endpoint: 'ssap://tv/switchInput', payload: '{"inputId":"HDMI_2"}' },
    { name: 'HDMI_3',       method: 'WS', endpoint: 'ssap://tv/switchInput', payload: '{"inputId":"HDMI_3"}' },
    { name: 'APPS',         method: 'WS', endpoint: 'ssap://system.launcher/open', payload: '{"target":"appSelector"}' },
    { name: 'NETFLIX',      method: 'WS', endpoint: 'ssap://system.launcher/launch', payload: '{"id":"netflix"}' },
    { name: 'YOUTUBE',      method: 'WS', endpoint: 'ssap://system.launcher/launch', payload: '{"id":"youtube.leanback.v4"}' },
  ];

  return [
    {
      source: 'lg_api',
      manufacturer: 'LG',
      model_number: 'TV_WEBOS_GENERIC',
      model_name: 'LG Smart TV (WebOS)',
      category: 'Television',
      control_type: 'wifi_ws',
      capabilities: ['power', 'audioVolume', 'audioMute', 'tvChannel', 'mediaPlayback', 'mediaInputSource', 'launcher'],
      commands,
    },
  ];
}

// ─── Sony BRAVIA (IRCC-IP SOAP) ───────────────────────────────────────────

// ircc_code values: Base64-encoded Sony IRCC key codes (public Bravia API spec)
export function sonyBraviaSchema(): OEMRawDevice[] {
  const SOAP_ACTION = 'urn:schemas-sony-com:service:IRCC:1#X_SendIRCC';

  const keys: Array<[string, string]> = [
    ['Power',           'AAAAAQAAAAEAAAAVAw=='],
    ['PowerOff',        'AAAAAQAAAAEAAAAvAw=='],
    ['PowerOn',         'AAAAAQAAAAEAAAAuAw=='],
    ['VolumeUp',        'AAAAAQAAAAEAAAASAw=='],
    ['VolumeDown',      'AAAAAQAAAAEAAAATAw=='],
    ['Mute',            'AAAAAQAAAAEAAAAUAw=='],
    ['ChannelUp',       'AAAAAQAAAAEAAAAQAw=='],
    ['ChannelDown',     'AAAAAQAAAAEAAAARAw=='],
    ['Home',            'AAAAAQAAAAEAAABgAw=='],
    ['Back',            'AAAAAgAAAJcAAAAjAw=='],
    ['Up',              'AAAAAQAAAAEAAAB0Aw=='],
    ['Down',            'AAAAAQAAAAEAAAB1Aw=='],
    ['Left',            'AAAAAQAAAAEAAAB2Aw=='],
    ['Right',           'AAAAAQAAAAEAAAB3Aw=='],
    ['Confirm',         'AAAAAQAAAAEAAABlAw=='],
    ['Play',            'AAAAAgAAAJcAAAAaAw=='],
    ['Pause',           'AAAAAgAAAJcAAAAZAw=='],
    ['Stop',            'AAAAAgAAAJcAAAAYAw=='],
    ['FastForward',     'AAAAAgAAAJcAAAAcAw=='],
    ['Rewind',          'AAAAAgAAAJcAAAAbAw=='],
    ['Input',           'AAAAAQAAAAEAAAAlAw=='],
    ['HDMI1',           'AAAAAgAAABoAAABaAw=='],
    ['HDMI2',           'AAAAAgAAABoAAABbAw=='],
    ['HDMI3',           'AAAAAgAAABoAAABcAw=='],
    ['HDMI4',           'AAAAAgAAABoAAABdAw=='],
    ['Netflix',         'AAAAAgAAABoAAAB8Aw=='],
    ['YouTube',         'AAAAAgAAAMQAAABHAw=='],
    ['PictureOff',      'AAAAAQAAAAEAAAB+Aw=='],
    ['Subtitle',        'AAAAAgAAAJcAAAAoAw=='],
    ['Info',            'AAAAAgAAAMQAAABNAw=='],
    ['Guide',           'AAAAAgAAAMQAAAAuAw=='],
    ['Exit',            'AAAAAgAAAJcAAAAjAw=='],
    ['Return',          'AAAAAgAAAJcAAAAjAw=='],
    ['Num0',            'AAAAAQAAAAEAAAAJAw=='],
    ['Num1',            'AAAAAQAAAAEAAAAKAw=='],
    ['Num2',            'AAAAAQAAAAEAAAALAw=='],
    ['Num3',            'AAAAAQAAAAEAAAAMAw=='],
    ['Num4',            'AAAAAQAAAAEAAAANAw=='],
    ['Num5',            'AAAAAQAAAAEAAAAOAw=='],
    ['Num6',            'AAAAAQAAAAEAAAAPAw=='],
    ['Num7',            'AAAAAQAAAAEAAAAQAw=='],
    ['Num8',            'AAAAAQAAAAEAAAARAw=='],
    ['Num9',            'AAAAAQAAAAEAAAASAw=='],
  ];

  const commands: OEMRawCommand[] = keys.map(([name, code]) => ({
    name,
    soap_action: SOAP_ACTION,
    soap_body: `<X_KeyEvent>${code}</X_KeyEvent>`,
    ircc_code: code,
  }));

  return [
    {
      source: 'sony_api',
      manufacturer: 'Sony',
      model_number: 'TV_BRAVIA_GENERIC',
      model_name: 'Sony BRAVIA (Generic)',
      category: 'Television',
      control_type: 'soap',
      capabilities: ['power', 'volume', 'channel', 'navigation', 'media', 'input_source'],
      commands,
    },
  ];
}

// ─── Roku ECP ─────────────────────────────────────────────────────────────
// Same key list applies to: TCL, Hisense Roku, Philips Roku, Sharp Roku, ONN

export function rokuECPSchema(): OEMRawDevice[] {
  const keys = [
    'PowerOff', 'PowerOn', 'Home', 'Rev', 'Fwd', 'Play', 'Select',
    'Left', 'Right', 'Down', 'Up', 'Back', 'InstantReplay', 'Info',
    'Backspace', 'Search', 'Enter', 'VolumeDown', 'VolumeUp', 'VolumeMute',
    'ChannelDown', 'ChannelUp', 'InputTuner', 'InputAV1', 'InputHDMI1',
    'InputHDMI2', 'InputHDMI3', 'InputHDMI4', 'FindRemote',
  ];

  const commands: OEMRawCommand[] = keys.map(k => ({
    name: k,
    method: 'POST',
    endpoint: `/keypress/${k}`,
    ecp_key: k,
  }));

  return [
    {
      source: 'roku_ecp',
      manufacturer: 'Roku',
      model_number: 'TV_ROKU_GENERIC',
      model_name: 'Roku TV / Roku OS (Generic)',
      category: 'Television',
      control_type: 'ecp',
      capabilities: ['power', 'volume', 'navigation', 'media', 'input_source'],
      commands,
    },
  ];
}

// ─── Hisense RemoteNow (VIDAA OS) ─────────────────────────────────────────

export function hisenseSchema(): OEMRawDevice[] {
  const keys = [
    'KEY_POWER', 'KEY_VOLUMEUP', 'KEY_VOLUMEDOWN', 'KEY_MUTE',
    'KEY_UP', 'KEY_DOWN', 'KEY_LEFT', 'KEY_RIGHT', 'KEY_OK',
    'KEY_BACK', 'KEY_HOME', 'KEY_MENU', 'KEY_EXIT',
    'KEY_CHANNELUP', 'KEY_CHANNELDOWN',
    'KEY_F1', 'KEY_F2', 'KEY_F3', 'KEY_F4',
    'KEY_0', 'KEY_1', 'KEY_2', 'KEY_3', 'KEY_4',
    'KEY_5', 'KEY_6', 'KEY_7', 'KEY_8', 'KEY_9',
  ];

  const commands: OEMRawCommand[] = keys.map(k => ({
    name: k,
    method: 'WS',
    payload: JSON.stringify({ action_type: 'key', action: k }),
  }));

  return [
    {
      source: 'hisense_api',
      manufacturer: 'Hisense',
      model_number: 'TV_VIDAA_GENERIC',
      model_name: 'Hisense Smart TV (VIDAA)',
      category: 'Television',
      control_type: 'wifi_ws',
      capabilities: ['power', 'volume', 'channel', 'navigation'],
      commands,
    },
  ];
}

// ─── Vizio SmartCast ──────────────────────────────────────────────────────
// Codesets from the pyvizio project (Apache-2.0)

export function vizioSchema(): OEMRawDevice[] {
  const commands: OEMRawCommand[] = [
    { name: 'POWER_OFF',     method: 'PUT', endpoint: '/key_command/', payload: '{"KEYLIST":[{"CODESET":11,"CODE":0,"ACTION":"KEYPRESS"}]}' },
    { name: 'POWER_ON',      method: 'PUT', endpoint: '/key_command/', payload: '{"KEYLIST":[{"CODESET":11,"CODE":1,"ACTION":"KEYPRESS"}]}' },
    { name: 'POWER_TOGGLE',  method: 'PUT', endpoint: '/key_command/', payload: '{"KEYLIST":[{"CODESET":11,"CODE":2,"ACTION":"KEYPRESS"}]}' },
    { name: 'VOLUME_UP',     method: 'PUT', endpoint: '/key_command/', payload: '{"KEYLIST":[{"CODESET":5,"CODE":1,"ACTION":"KEYPRESS"}]}' },
    { name: 'VOLUME_DOWN',   method: 'PUT', endpoint: '/key_command/', payload: '{"KEYLIST":[{"CODESET":5,"CODE":0,"ACTION":"KEYPRESS"}]}' },
    { name: 'MUTE_ON',       method: 'PUT', endpoint: '/key_command/', payload: '{"KEYLIST":[{"CODESET":5,"CODE":3,"ACTION":"KEYPRESS"}]}' },
    { name: 'MUTE_OFF',      method: 'PUT', endpoint: '/key_command/', payload: '{"KEYLIST":[{"CODESET":5,"CODE":4,"ACTION":"KEYPRESS"}]}' },
    { name: 'MUTE_TOGGLE',   method: 'PUT', endpoint: '/key_command/', payload: '{"KEYLIST":[{"CODESET":5,"CODE":2,"ACTION":"KEYPRESS"}]}' },
    { name: 'CHANNEL_UP',    method: 'PUT', endpoint: '/key_command/', payload: '{"KEYLIST":[{"CODESET":8,"CODE":1,"ACTION":"KEYPRESS"}]}' },
    { name: 'CHANNEL_DOWN',  method: 'PUT', endpoint: '/key_command/', payload: '{"KEYLIST":[{"CODESET":8,"CODE":0,"ACTION":"KEYPRESS"}]}' },
    { name: 'INPUT_HDMI_1',  method: 'PUT', endpoint: '/key_command/', payload: '{"KEYLIST":[{"CODESET":7,"CODE":4,"ACTION":"KEYPRESS"}]}' },
    { name: 'INPUT_HDMI_2',  method: 'PUT', endpoint: '/key_command/', payload: '{"KEYLIST":[{"CODESET":7,"CODE":5,"ACTION":"KEYPRESS"}]}' },
    { name: 'INPUT_HDMI_3',  method: 'PUT', endpoint: '/key_command/', payload: '{"KEYLIST":[{"CODESET":7,"CODE":6,"ACTION":"KEYPRESS"}]}' },
    { name: 'INPUT_HDMI_4',  method: 'PUT', endpoint: '/key_command/', payload: '{"KEYLIST":[{"CODESET":7,"CODE":7,"ACTION":"KEYPRESS"}]}' },
    { name: 'UP',            method: 'PUT', endpoint: '/key_command/', payload: '{"KEYLIST":[{"CODESET":3,"CODE":8,"ACTION":"KEYPRESS"}]}' },
    { name: 'DOWN',          method: 'PUT', endpoint: '/key_command/', payload: '{"KEYLIST":[{"CODESET":3,"CODE":0,"ACTION":"KEYPRESS"}]}' },
    { name: 'LEFT',          method: 'PUT', endpoint: '/key_command/', payload: '{"KEYLIST":[{"CODESET":3,"CODE":1,"ACTION":"KEYPRESS"}]}' },
    { name: 'RIGHT',         method: 'PUT', endpoint: '/key_command/', payload: '{"KEYLIST":[{"CODESET":3,"CODE":7,"ACTION":"KEYPRESS"}]}' },
    { name: 'OK',            method: 'PUT', endpoint: '/key_command/', payload: '{"KEYLIST":[{"CODESET":3,"CODE":2,"ACTION":"KEYPRESS"}]}' },
    { name: 'BACK',          method: 'PUT', endpoint: '/key_command/', payload: '{"KEYLIST":[{"CODESET":4,"CODE":0,"ACTION":"KEYPRESS"}]}' },
    { name: 'HOME',          method: 'PUT', endpoint: '/key_command/', payload: '{"KEYLIST":[{"CODESET":4,"CODE":3,"ACTION":"KEYPRESS"}]}' },
    { name: 'MENU',          method: 'PUT', endpoint: '/key_command/', payload: '{"KEYLIST":[{"CODESET":4,"CODE":8,"ACTION":"KEYPRESS"}]}' },
    { name: 'PLAY',          method: 'PUT', endpoint: '/key_command/', payload: '{"KEYLIST":[{"CODESET":2,"CODE":3,"ACTION":"KEYPRESS"}]}' },
    { name: 'PAUSE',         method: 'PUT', endpoint: '/key_command/', payload: '{"KEYLIST":[{"CODESET":2,"CODE":2,"ACTION":"KEYPRESS"}]}' },
    { name: 'FAST_FORWARD',  method: 'PUT', endpoint: '/key_command/', payload: '{"KEYLIST":[{"CODESET":2,"CODE":0,"ACTION":"KEYPRESS"}]}' },
    { name: 'REWIND',        method: 'PUT', endpoint: '/key_command/', payload: '{"KEYLIST":[{"CODESET":2,"CODE":1,"ACTION":"KEYPRESS"}]}' },
  ];

  return [
    {
      source: 'vizio_api',
      manufacturer: 'Vizio',
      model_number: 'TV_SMARTCAST_GENERIC',
      model_name: 'Vizio SmartCast TV (Generic)',
      category: 'Television',
      control_type: 'wifi_rest',
      capabilities: ['power', 'volume', 'channel', 'navigation', 'media', 'input_source'],
      commands,
    },
  ];
}

// ─── Philips JointSpace v6 ────────────────────────────────────────────────

export function philipsJointSpaceSchema(): OEMRawDevice[] {
  const keys = [
    'Standby', 'VolumeUp', 'VolumeDown', 'Mute',
    'CursorUp', 'CursorDown', 'CursorLeft', 'CursorRight', 'Confirm',
    'Back', 'Home', 'Options', 'Info', 'Find',
    'ChannelStepUp', 'ChannelStepDown',
    'Play', 'Pause', 'Stop', 'FastForward', 'Rewind',
    'SmartTV', 'Netflix', 'Prime',
    'Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4',
    'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9',
  ];

  const commands: OEMRawCommand[] = keys.map(k => ({
    name: k,
    method: 'POST',
    endpoint: '/6/input/key',
    payload: JSON.stringify({ key: k }),
    headers: '{"Content-Type":"application/json"}',
  }));

  return [
    {
      source: 'philips_api',
      manufacturer: 'Philips',
      model_number: 'TV_JOINTSPACE_GENERIC',
      model_name: 'Philips Smart TV (JointSpace)',
      category: 'Television',
      control_type: 'wifi_rest',
      capabilities: ['power', 'volume', 'channel', 'navigation', 'media'],
      commands,
    },
  ];
}

// ─── Panasonic Viera (NCTRL SOAP) ─────────────────────────────────────────

export function panasonicVieraSchema(): OEMRawDevice[] {
  const SOAP_ACTION =
    'urn:panasonic-com:service:p00NetworkControl:1#X_SendKey';

  const keys = [
    'NRC_POWER-ONOFF',
    'NRC_VOLUP-ONOFF', 'NRC_VOLDOWN-ONOFF', 'NRC_MUTE-ONOFF',
    'NRC_CH_UP-ONOFF', 'NRC_CH_DOWN-ONOFF',
    'NRC_UP-ONOFF', 'NRC_DOWN-ONOFF', 'NRC_LEFT-ONOFF', 'NRC_RIGHT-ONOFF',
    'NRC_ENTER-ONOFF', 'NRC_RETURN-ONOFF',
    'NRC_MENU-ONOFF', 'NRC_HOME-ONOFF', 'NRC_GUIDE-ONOFF', 'NRC_INFO-ONOFF',
    'NRC_PLAY-ONOFF', 'NRC_PAUSE-ONOFF', 'NRC_STOP-ONOFF',
    'NRC_FF-ONOFF', 'NRC_REW-ONOFF',
    'NRC_D0-ONOFF', 'NRC_D1-ONOFF', 'NRC_D2-ONOFF', 'NRC_D3-ONOFF',
    'NRC_D4-ONOFF', 'NRC_D5-ONOFF', 'NRC_D6-ONOFF', 'NRC_D7-ONOFF',
    'NRC_D8-ONOFF', 'NRC_D9-ONOFF',
    'NRC_HDMI1-ONOFF', 'NRC_HDMI2-ONOFF', 'NRC_HDMI3-ONOFF', 'NRC_HDMI4-ONOFF',
    'NRC_NETFLIX-ONOFF', 'NRC_APPS-ONOFF',
  ];

  const commands: OEMRawCommand[] = keys.map(k => ({
    name: k,
    method: 'POST',
    endpoint: 'http://{ip}:55000/nrc/control_0',
    soap_action: SOAP_ACTION,
    soap_body: `<X_KeyEvent>${k}</X_KeyEvent>`,
  }));

  return [
    {
      source: 'panasonic_api',
      manufacturer: 'Panasonic',
      model_number: 'TV_VIERA_GENERIC',
      model_name: 'Panasonic Viera (NCTRL)',
      category: 'Television',
      control_type: 'soap',
      capabilities: ['power', 'volume', 'channel', 'navigation', 'media', 'input_source'],
      commands,
    },
  ];
}

// ─── Android TV / Fire TV (ADB keycodes) ──────────────────────────────────
// Standard android.view.KeyEvent constants

export function androidTVSchema(): OEMRawDevice[] {
  const keycodes: Array<[string, number]> = [
    ['KEYCODE_POWER',         26],
    ['KEYCODE_SLEEP',        223],
    ['KEYCODE_WAKEUP',       224],
    ['KEYCODE_VOLUME_UP',     24],
    ['KEYCODE_VOLUME_DOWN',   25],
    ['KEYCODE_VOLUME_MUTE',  164],
    ['KEYCODE_CHANNEL_UP',  166],
    ['KEYCODE_CHANNEL_DOWN',167],
    ['KEYCODE_DPAD_UP',       19],
    ['KEYCODE_DPAD_DOWN',     20],
    ['KEYCODE_DPAD_LEFT',     21],
    ['KEYCODE_DPAD_RIGHT',    22],
    ['KEYCODE_DPAD_CENTER',   23],
    ['KEYCODE_BACK',           4],
    ['KEYCODE_HOME',           3],
    ['KEYCODE_MENU',          82],
    ['KEYCODE_SETTINGS',     176],
    ['KEYCODE_SEARCH',        84],
    ['KEYCODE_MEDIA_PLAY',   126],
    ['KEYCODE_MEDIA_PAUSE',  127],
    ['KEYCODE_MEDIA_STOP',    86],
    ['KEYCODE_MEDIA_FAST_FORWARD', 90],
    ['KEYCODE_MEDIA_REWIND',  89],
    ['KEYCODE_MEDIA_NEXT',    87],
    ['KEYCODE_MEDIA_PREVIOUS',88],
    ['KEYCODE_0',             7],
    ['KEYCODE_1',             8],
    ['KEYCODE_2',             9],
    ['KEYCODE_3',            10],
    ['KEYCODE_4',            11],
    ['KEYCODE_5',            12],
    ['KEYCODE_6',            13],
    ['KEYCODE_7',            14],
    ['KEYCODE_8',            15],
    ['KEYCODE_9',            16],
    ['KEYCODE_CAPTIONS',    175],
    ['KEYCODE_TV_INPUT',    178],
    ['KEYCODE_DEL',          67],
    ['KEYCODE_ENTER',        66],
  ];

  const commands: OEMRawCommand[] = keycodes.map(([name, code]) => ({
    name,
    adb_keycode: code,
    method: 'ADB',
    payload: `input keyevent ${code}`,
  }));

  return [
    {
      source: 'android_tv',
      manufacturer: 'Android TV',
      model_number: 'TV_ANDROID_GENERIC',
      model_name: 'Android TV (Generic)',
      category: 'Television',
      control_type: 'adb',
      capabilities: ['power', 'volume', 'channel', 'navigation', 'media'],
      commands,
    },
    {
      source: 'fire_tv',
      manufacturer: 'Amazon',
      model_number: 'TV_FIRE_OS_GENERIC',
      model_name: 'Amazon Fire TV (Generic)',
      category: 'Television',
      control_type: 'adb',
      capabilities: ['power', 'volume', 'navigation', 'media'],
      commands,
    },
  ];
}

/** Collect all static OEM schemas into one flat array. */
export function allOEMSchemas(): OEMRawDevice[] {
  return [
    ...samsungTVSchema(),
    ...lgWebOSSchema(),
    ...sonyBraviaSchema(),
    ...rokuECPSchema(),
    ...hisenseSchema(),
    ...vizioSchema(),
    ...philipsJointSpaceSchema(),
    ...panasonicVieraSchema(),
    ...androidTVSchema(),
  ];
}
