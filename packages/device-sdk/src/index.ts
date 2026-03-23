// Samsung
export * from './samsung';

// LG
export * from './lg';

// Daikin
export * from './daikin';

// Android TV (NVIDIA Shield, Mi Box, Google TV, etc.)
export * from './android';

// Universal brand-agnostic layouts
export * from './universal';

// Combined layout registry (brand-first, universal as fallback)
export { allBrandLayouts, ALL_LAYOUTS, findLayout, getLayoutsForDeviceType } from './allLayouts';
