/**
 * A command to be sent to a device.
 */
export interface DeviceCommand {
  /** Target device identifier */
  deviceId: string;
  /** Action name matching a key in CommandMap */
  action: string;
  /** Optional override value / parameter */
  value?: string | number | boolean;
}

/**
 * Result from a dispatched command.
 */
export interface CommandResult {
  success: boolean;
  deviceId: string;
  action: string;
  protocol: string;
  durationMs: number;
  error?: string;
}
