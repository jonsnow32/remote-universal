import { RemoteLayoutDefinition } from '@remote/core';

/**
 * Universal Projector layout.
 * Power on/off are kept separate (projector lamp needs cooldown before power-off).
 * Covers home-theater and office projectors with standard IR protocol.
 */
export const universalProjectorLayout: RemoteLayoutDefinition = {
  id: 'universal-projector',
  name: 'Projector (Universal)',
  columns: 3,
  sections: [
    // ── Power ───────────────────────────────────────────────────────────────
    // Separate on/off to avoid accidental lamp cut during cooldown cycle.
    {
      id: 'power',
      buttons: [
        { id: 'power-on',  label: 'On',  icon: 'power',         action: 'POWER_ON',  row: 0, col: 0, variant: 'primary', size: 'lg' },
        { id: 'power-off', label: 'Off', icon: 'power-outline', action: 'POWER_OFF', row: 0, col: 2, variant: 'danger',  size: 'lg' },
      ],
    },

    // ── Navigation (on-screen menu) ──────────────────────────────────────────
    {
      id: 'navigation',
      title: 'Navigation',
      buttons: [
        { id: 'nav-up',    label: '▲',  icon: 'chevron-up',      action: 'DPAD_UP',    row: 0, col: 1 },
        { id: 'nav-left',  label: '◀',  icon: 'chevron-back',    action: 'DPAD_LEFT',  row: 1, col: 0 },
        { id: 'nav-ok',    label: 'OK',                           action: 'DPAD_OK',    row: 1, col: 1, variant: 'primary' },
        { id: 'nav-right', label: '▶',  icon: 'chevron-forward', action: 'DPAD_RIGHT', row: 1, col: 2 },
        { id: 'nav-down',  label: '▼',  icon: 'chevron-down',    action: 'DPAD_DOWN',  row: 2, col: 1 },
        { id: 'menu',      label: 'Menu', icon: 'menu-outline',  action: 'MENU',       row: 2, col: 0 },
        { id: 'back',      label: 'Back', icon: 'arrow-back-outline', action: 'BACK', row: 2, col: 2, variant: 'ghost' },
      ],
    },

    // ── Volume ──────────────────────────────────────────────────────────────
    {
      id: 'volume',
      title: 'Volume',
      buttons: [
        { id: 'vol-up',   label: 'Vol +', icon: 'volume-high-outline', action: 'VOLUME_UP',   row: 0, col: 0 },
        { id: 'mute',     label: 'Mute',  icon: 'volume-mute-outline', action: 'MUTE',        row: 0, col: 1, variant: 'ghost' },
        { id: 'vol-down', label: 'Vol −', icon: 'volume-low-outline',  action: 'VOLUME_DOWN', row: 0, col: 2 },
      ],
    },

    // ── Input Source ─────────────────────────────────────────────────────────
    {
      id: 'input',
      title: 'Input Source',
      buttons: [
        { id: 'hdmi-1', label: 'HDMI 1', action: 'HDMI_1', row: 0, col: 0 },
        { id: 'hdmi-2', label: 'HDMI 2', action: 'HDMI_2', row: 0, col: 1 },
        { id: 'vga',    label: 'VGA',    action: 'VGA',    row: 0, col: 2 },
        { id: 'usb',    label: 'USB',    icon: 'usb-outline', action: 'USB', row: 1, col: 0 },
        { id: 'av',     label: 'AV',     action: 'AV',     row: 1, col: 1 },
        { id: 'source', label: 'Source', icon: 'swap-horizontal-outline', action: 'SOURCE', row: 1, col: 2, variant: 'ghost' },
      ],
    },

    // ── Image Adjustment ─────────────────────────────────────────────────────
    {
      id: 'image',
      title: 'Image',
      buttons: [
        { id: 'zoom-in',       label: 'Zoom +',   icon: 'add-circle-outline',    action: 'ZOOM_IN',       row: 0, col: 0 },
        { id: 'zoom-out',      label: 'Zoom −',   icon: 'remove-circle-outline', action: 'ZOOM_OUT',      row: 0, col: 1 },
        { id: 'aspect-ratio',  label: 'Aspect',   icon: 'scan-outline',          action: 'ASPECT_RATIO',  row: 0, col: 2 },
        { id: 'keystone-up',   label: 'KS ▲',                                    action: 'KEYSTONE_UP',   row: 1, col: 0 },
        { id: 'keystone-down', label: 'KS ▼',                                    action: 'KEYSTONE_DOWN', row: 1, col: 1 },
        { id: 'autofocus',     label: 'Focus',    icon: 'eye-outline',           action: 'AUTO_FOCUS',    row: 1, col: 2 },
      ],
    },

    // ── Utility ─────────────────────────────────────────────────────────────
    {
      id: 'utility',
      title: 'Utility',
      buttons: [
        { id: 'blank',   label: 'Blank',  icon: 'square-outline',           action: 'BLANK_SCREEN', row: 0, col: 0 },
        { id: 'freeze',  label: 'Freeze', icon: 'pause-circle-outline',     action: 'FREEZE',       row: 0, col: 1 },
        { id: 'picture', label: 'Mode',   icon: 'color-palette-outline',    action: 'PICTURE_MODE', row: 0, col: 2 },
        { id: 'info',    label: 'Info',   icon: 'information-circle-outline', action: 'INFO',       row: 1, col: 1, variant: 'ghost' },
      ],
    },
  ],
};
