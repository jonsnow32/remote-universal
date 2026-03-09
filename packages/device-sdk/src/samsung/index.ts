export { SamsungQLED } from './devices/tv/QLED';
export { SamsungFrame } from './devices/tv/Frame';
export { SamsungWindFree } from './devices/ac/WindFree';
export { SamsungIR } from './protocols/SamsungIR';
export { SamsungSmartThings } from './protocols/SamsungSmartThings';
export { samsungTVLayout } from './layouts/tv-layout';

/** All Samsung device definitions */
export const samsungDevices = [
  /* lazy import to avoid circular — app registers these at startup */
];
