import type { RemoteLayoutDefinition } from '@remote/core';

/**
 * Universal Projector layout.
 * Power on/off are kept separate (projector lamp needs cooldown before power-off).
 * Covers home-theater and office projectors with standard IR protocol.
 */
export const universalProjectorLayout: RemoteLayoutDefinition = {
  id: 'universal-projector',
  name: 'Projector (Universal)',
  deviceType: 'projector',
  sections: [
    // ── Power ───────────────────────────────────────────────────────────────
    // Separate on/off to avoid accidental lamp cut during cooldown cycle.
    {
      id: 'power',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'power-on',  label: 'On',  icon: 'power',         action: 'POWER_ON',  row: 0, col: 0, variant: 'primary', size: 'lg' },
        { type: 'button', id: 'power-off', label: 'Off', icon: 'power-outline', action: 'POWER_OFF', row: 0, col: 2, variant: 'danger',  size: 'lg' },
      ],
    },

    // ── Navigation (on-screen menu) ──────────────────────────────────────────
    {
      id: 'navigation',
      title: 'Navigation',
      columns: 3,
      rowHeight: 180,
      widgets: [
        {
          type: 'dpad', id: 'nav', row: 0, col: 0, colSpan: 3,
          actions: { up: 'DPAD_UP', down: 'DPAD_DOWN', left: 'DPAD_LEFT', right: 'DPAD_RIGHT', center: 'DPAD_OK' },
        },
      ],
    },

    // ── Navigation utility bar ───────────────────────────────────────────────
    {
      id: 'nav-bar',
      columns: 3,
      rowHeight: 56,
      widgets: [
        { type: 'button', id: 'menu', label: 'Menu', icon: 'menu-outline',      action: 'MENU', row: 0, col: 0 },
        { type: 'button', id: 'back', label: 'Back', icon: 'arrow-back-outline', action: 'BACK', row: 0, col: 2, variant: 'ghost' },
      ],
    },

    // ── Volume ──────────────────────────────────────────────────────────────
    {
      id: 'volume',
      title: 'Volume',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'vol-up',   label: 'Vol +', icon: 'volume-high-outline', action: 'VOLUME_UP',   row: 0, col: 0 },
        { type: 'button', id: 'mute',     label: 'Mute',  icon: 'volume-mute-outline', action: 'MUTE',        row: 0, col: 1, variant: 'ghost' },
        { type: 'button', id: 'vol-down', label: 'Vol −', icon: 'volume-low-outline',  action: 'VOLUME_DOWN', row: 0, col: 2 },
      ],
    },

    // ── Input Source ─────────────────────────────────────────────────────────
    {
      id: 'input',
      title: 'Input Source',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'hdmi-1', label: 'HDMI 1', action: 'HDMI_1', row: 0, col: 0 },
        { type: 'button', id: 'hdmi-2', label: 'HDMI 2', action: 'HDMI_2', row: 0, col: 1 },
        { type: 'button', id: 'vga',    label: 'VGA',    action: 'VGA',    row: 0, col: 2 },
        { type: 'button', id: 'usb',    label: 'USB',    icon: 'save-outline', action: 'USB', row: 1, col: 0 },
        { type: 'button', id: 'av',     label: 'AV',     action: 'AV',     row: 1, col: 1 },
        { type: 'button', id: 'source', label: 'Source', icon: 'swap-horizontal-outline', action: 'SOURCE', row: 1, col: 2, variant: 'ghost' },
      ],
    },

    // ── Image Adjustment ─────────────────────────────────────────────────────
    {
      id: 'image',
      title: 'Image',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'zoom-in',       label: 'Zoom +',   icon: 'add-circle-outline',    action: 'ZOOM_IN',       row: 0, col: 0 },
        { type: 'button', id: 'zoom-out',      label: 'Zoom −',   icon: 'remove-circle-outline', action: 'ZOOM_OUT',      row: 0, col: 1 },
        { type: 'button', id: 'aspect-ratio',  label: 'Aspect',   icon: 'scan-outline',          action: 'ASPECT_RATIO',  row: 0, col: 2 },
        { type: 'button', id: 'keystone-up',   label: 'KS ▲',                                    action: 'KEYSTONE_UP',   row: 1, col: 0 },
        { type: 'button', id: 'keystone-down', label: 'KS ▼',                                    action: 'KEYSTONE_DOWN', row: 1, col: 1 },
        { type: 'button', id: 'autofocus',     label: 'Focus',    icon: 'eye-outline',           action: 'AUTO_FOCUS',    row: 1, col: 2 },
      ],
    },

    // ── Utility ─────────────────────────────────────────────────────────────
    {
      id: 'utility',
      title: 'Utility',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'blank',   label: 'Blank',  icon: 'square-outline',           action: 'BLANK_SCREEN', row: 0, col: 0 },
        { type: 'button', id: 'freeze',  label: 'Freeze', icon: 'pause-circle-outline',     action: 'FREEZE',       row: 0, col: 1 },
        { type: 'button', id: 'picture', label: 'Mode',   icon: 'color-palette-outline',    action: 'PICTURE_MODE', row: 0, col: 2 },
        { type: 'button', id: 'info',    label: 'Info',   icon: 'information-circle-outline', action: 'INFO',       row: 1, col: 1, variant: 'ghost' },
      ],
    },
  ],
};
