import { IRProtocol } from '@remote/core';

/** LG-specific IR protocol — uses NEC encoding */
export class LGIRCodes extends IRProtocol {
  readonly encoding = 'NEC';
  readonly carrierFrequencyKHz = 38;
}
