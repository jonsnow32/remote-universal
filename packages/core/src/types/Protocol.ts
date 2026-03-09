import { SupportedProtocol } from './Device';

/**
 * Runtime protocol instance attached to a device connection.
 */
export interface ProtocolInstance {
  type: SupportedProtocol;
  isAvailable(): Promise<boolean>;
  connect(deviceId: string): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  send(deviceId: string, payload: string): Promise<void>;
}
