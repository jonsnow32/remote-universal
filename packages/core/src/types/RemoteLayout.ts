/**
 * A single button in a remote layout grid.
 */
export interface LayoutButton {
  id: string;
  label: string;
  icon?: string;
  action: string;
  row: number;
  col: number;
  colSpan?: number;
  rowSpan?: number;
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * A named group/section of buttons in the layout.
 */
export interface LayoutSection {
  id: string;
  title?: string;
  buttons: LayoutButton[];
}

/**
 * Full remote control layout definition.
 */
export interface RemoteLayoutDefinition {
  id: string;
  name: string;
  columns: number;
  sections: LayoutSection[];
}
