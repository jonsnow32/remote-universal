// ── Shared grid placement ─────────────────────────────────────────────────────

/** Position and span of a widget within the section grid. */
export interface GridPlacement {
  row: number;
  col: number;
  rowSpan?: number;   // defaults to 1
  colSpan?: number;   // defaults to 1
}

// ── Widget definitions ────────────────────────────────────────────────────────

/** Standard tap button. */
export interface ButtonWidget extends GridPlacement {
  type: 'button';
  id: string;
  label: string;
  icon?: string;          // Ionicons icon name
  action: string;
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Circular D-Pad — 5 interaction zones.
 *  • Swipe in any direction → directional action.
 *  • Tap center zone (inner 32% radius) → center action.
 *  • Tap outer zone → nearest directional quadrant action.
 */
export interface DPadWidget extends GridPlacement {
  type: 'dpad';
  id: string;
  actions: {
    up: string;
    down: string;
    left: string;
    right: string;
    center: string;
  };
}

/**
 * Vertical rocker — for paired up/down controls (Vol+/Vol−, Ch+/Ch−).
 *  • Tap top → upAction.  • Tap bottom → downAction.
 *  • Optional mid zone → midAction (e.g. Mute).
 *  • Swipe up/down anywhere on the rocker → up/down action.
 */
export interface RockerWidget extends GridPlacement {
  type: 'rocker';
  id: string;
  upAction: string;
  downAction: string;
  upIcon?: string;
  downIcon?: string;
  upLabel?: string;
  downLabel?: string;
  midAction?: string;
  midIcon?: string;
  midLabel?: string;
}

/**
 * Large swipe-surface touchpad (Apple TV / Android TV trackpad style).
 *  • Swipe in any direction → directional action.
 *  • Single tap → tap action.
 */
export interface TouchpadWidget extends GridPlacement {
  type: 'touchpad';
  id: string;
  actions: {
    up: string;
    down: string;
    left: string;
    right: string;
    tap: string;
  };
  hint?: string;  // center hint text, e.g. 'Swipe to navigate'
}

/**
 * Text-input widget.
 * Tap opens an on-screen keyboard; submitting fires `${action}:${text}`.
 */
export interface TextInputWidget extends GridPlacement {
  type: 'text-input';
  id: string;
  placeholder?: string;   // default 'Search…'
  icon?: string;
  action: string;
}

/** Union of all widget types. */
export type RemoteWidget =
  | ButtonWidget
  | DPadWidget
  | RockerWidget
  | TouchpadWidget
  | TextInputWidget;

// ── Section & Layout ──────────────────────────────────────────────────────────

export interface LayoutSection {
  id: string;
  title?: string;
  /** Number of equal-width grid columns in this section. */
  columns: number;
  /** Height of each grid row in logical pixels. Default: 72. */
  rowHeight?: number;
  /** Gap between grid cells in logical pixels. Default: 8. */
  gap?: number;
  widgets: RemoteWidget[];
}

export interface RemoteLayoutDefinition {
  id: string;
  name: string;
  sections: LayoutSection[];
}

// ── Backward-compat alias ─────────────────────────────────────────────────────

/** @deprecated Use `ButtonWidget` instead. */
export type LayoutButton = ButtonWidget;
