import { IRProtocol } from '@remote/core';

/**
 * Samsung-specific IR protocol extension.
 * Samsung uses NEC-variant IR codes at 38kHz carrier.
 */
export class SamsungIR extends IRProtocol {
  readonly carrierFrequencyKHz = 38;
  readonly encoding = 'NEC';
}
