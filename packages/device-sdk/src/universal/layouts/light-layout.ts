import type { RemoteLayoutDefinition } from '@remote/core';

/**
 * Universal Smart Light layout.
 * Supports IR and Wi-Fi smart bulbs/strips with dimming, color
 * temperature, RGB color, and preset scene control.
 */
export const universalLightLayout: RemoteLayoutDefinition = {
  id: 'universal-light',
  name: 'Smart Light (Universal)',
  deviceType: 'light',
  sections: [
    // ── Power ───────────────────────────────────────────────────────────────
    {
      id: 'power',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'power-toggle', label: 'Power', icon: 'bulb', action: 'POWER_TOGGLE', row: 0, col: 1, variant: 'primary', size: 'lg' },
      ],
    },

    // ── Brightness ───────────────────────────────────────────────────────────
    {
      id: 'brightness',
      title: 'Brightness',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'bright-max',  label: '●●●', icon: 'sunny',         action: 'BRIGHTNESS_MAX',  row: 0, col: 0, variant: 'primary' },
        { type: 'button', id: 'bright-up',   label: 'Bright +', icon: 'add-circle-outline',    action: 'BRIGHTNESS_UP',   row: 0, col: 1 },
        { type: 'button', id: 'bright-down', label: 'Bright −', icon: 'remove-circle-outline', action: 'BRIGHTNESS_DOWN', row: 1, col: 1 },
        { type: 'button', id: 'bright-min',  label: '○',   icon: 'sunny-outline', action: 'BRIGHTNESS_MIN',  row: 1, col: 0, variant: 'ghost' },
      ],
    },

    // ── Color Temperature ────────────────────────────────────────────────────
    {
      id: 'color-temp',
      title: 'Color Temp',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'ct-warm',     label: 'Warm',      icon: 'bonfire-outline',    action: 'COLOR_TEMP_WARM',     row: 0, col: 0 },
        { type: 'button', id: 'ct-neutral',  label: 'Neutral',   icon: 'partly-sunny-outline', action: 'COLOR_TEMP_NEUTRAL', row: 0, col: 1 },
        { type: 'button', id: 'ct-cool',     label: 'Cool',      icon: 'snow-outline',       action: 'COLOR_TEMP_COOL',     row: 0, col: 2 },
        { type: 'button', id: 'ct-daylight', label: 'Daylight',  icon: 'sunny-outline',      action: 'COLOR_TEMP_DAYLIGHT', row: 1, col: 1 },
      ],
    },

    // ── RGB Color ────────────────────────────────────────────────────────────
    {
      id: 'color-rgb',
      title: 'Color',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'color-white',  label: 'White',  action: 'COLOR_WHITE',  row: 0, col: 0, variant: 'primary' },
        { type: 'button', id: 'color-red',    label: 'Red',    action: 'COLOR_RED',    row: 0, col: 1 },
        { type: 'button', id: 'color-orange', label: 'Orange', action: 'COLOR_ORANGE', row: 0, col: 2 },
        { type: 'button', id: 'color-yellow', label: 'Yellow', action: 'COLOR_YELLOW', row: 1, col: 0 },
        { type: 'button', id: 'color-green',  label: 'Green',  action: 'COLOR_GREEN',  row: 1, col: 1 },
        { type: 'button', id: 'color-cyan',   label: 'Cyan',   action: 'COLOR_CYAN',   row: 1, col: 2 },
        { type: 'button', id: 'color-blue',   label: 'Blue',   action: 'COLOR_BLUE',   row: 2, col: 0 },
        { type: 'button', id: 'color-purple', label: 'Purple', action: 'COLOR_PURPLE', row: 2, col: 1 },
        { type: 'button', id: 'color-pink',   label: 'Pink',   action: 'COLOR_PINK',   row: 2, col: 2 },
      ],
    },

    // ── Scenes ───────────────────────────────────────────────────────────────
    {
      id: 'scenes',
      title: 'Scenes',
      columns: 3,
      rowHeight: 68,
      widgets: [
        { type: 'button', id: 'scene-reading', label: 'Reading', icon: 'book-outline',       action: 'SCENE_READING', row: 0, col: 0 },
        { type: 'button', id: 'scene-relax',   label: 'Relax',   icon: 'cafe-outline',       action: 'SCENE_RELAX',   row: 0, col: 1 },
        { type: 'button', id: 'scene-sleep',   label: 'Sleep',   icon: 'moon-outline',       action: 'SCENE_SLEEP',   row: 0, col: 2 },
        { type: 'button', id: 'scene-party',   label: 'Party',   icon: 'color-wand-outline', action: 'SCENE_PARTY',   row: 1, col: 0 },
        { type: 'button', id: 'scene-movie',   label: 'Movie',   icon: 'film-outline',       action: 'SCENE_MOVIE',   row: 1, col: 1 },
        { type: 'button', id: 'scene-strobe',  label: 'Strobe',  icon: 'flash-outline',      action: 'SCENE_STROBE',  row: 1, col: 2, variant: 'ghost' },
      ],
    },
  ],
};
