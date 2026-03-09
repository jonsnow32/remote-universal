import { IRProtocol } from '@remote/core';

/** Daikin IR protocol — uses proprietary Daikin encoding */
export class DaikinIR extends IRProtocol {
  readonly encoding = 'DAIKIN';
  readonly carrierFrequencyKHz = 38;
}
