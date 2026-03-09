import { DeviceDefinition, SupportedProtocol } from '../types/Device';
import { DeviceCommand, CommandResult } from '../types/Command';
import { BaseProtocol } from '../protocols/BaseProtocol';
import { IRProtocol } from '../protocols/IRProtocol';
import { BLEProtocol } from '../protocols/BLEProtocol';
import { WiFiProtocol } from '../protocols/WiFiProtocol';
import { HomeKitProtocol } from '../protocols/HomeKitProtocol';
import { MatterProtocol } from '../protocols/MatterProtocol';
import { DeviceRegistry } from '../registry/DeviceRegistry';

/** Map of available protocol instances */
const PROTOCOL_MAP: Record<SupportedProtocol, BaseProtocol> = {
  ir: new IRProtocol(),
  ble: new BLEProtocol(),
  wifi: new WiFiProtocol(),
  homekit: new HomeKitProtocol(),
  matter: new MatterProtocol(),
};

/**
 * Dispatches commands to devices by resolving the best available protocol.
 */
export class CommandDispatcher {
  constructor(private readonly registry: DeviceRegistry) {}

  /**
   * Determines the best available protocol for a device.
   * Iterates protocols in the order defined by the device definition.
   * @param device - The device definition
   * @returns The first available protocol instance
   * @throws Error if no protocol is available
   */
  async getBestProtocol(device: DeviceDefinition): Promise<BaseProtocol> {
    for (const protocolType of device.protocols) {
      const protocol = PROTOCOL_MAP[protocolType];
      if (!protocol) continue;

      const available = await protocol.isAvailable();
      if (available) {
        return protocol;
      }
    }

    throw new Error(
      `[CommandDispatcher] No available protocol for device "${device.id}" (${device.brand} ${device.model}). ` +
        `Tried: ${device.protocols.join(', ')}`
    );
  }

  /**
   * Resolves a device, finds the best protocol, and sends the command.
   * @param deviceId - The target device ID
   * @param action - The action name matching a CommandMap key
   * @param value - Optional command value/parameter
   * @returns Command result with timing and protocol used
   * @throws Error if device not found, no protocol available, or send fails
   */
  async dispatch(
    deviceId: string,
    action: string,
    value?: string | number | boolean
  ): Promise<CommandResult> {
    const startTime = Date.now();

    const device = this.registry.getDevice(deviceId);
    if (!device) {
      throw new Error(
        `[CommandDispatcher] Device not found: "${deviceId}". ` +
          `Make sure the device is registered with DeviceRegistry.`
      );
    }

    const commandEntry = device.commands[action];
    if (!commandEntry) {
      throw new Error(
        `[CommandDispatcher] Unknown action "${action}" for device "${deviceId}". ` +
          `Available actions: ${Object.keys(device.commands).join(', ')}`
      );
    }

    const protocol = await this.getBestProtocol(device);
    const payload = commandEntry[protocol.type];

    if (!payload) {
      throw new Error(
        `[CommandDispatcher] No payload for action "${action}" via protocol "${protocol.type}" ` +
          `on device "${deviceId}".`
      );
    }

    const command: DeviceCommand = { deviceId, action, value };
    await protocol.sendWithRetry(command, payload);

    return {
      success: true,
      deviceId,
      action,
      protocol: protocol.type,
      durationMs: Date.now() - startTime,
    };
  }
}
