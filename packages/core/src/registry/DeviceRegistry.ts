import { DeviceDefinition, DeviceCapability, SupportedProtocol } from '../types/Device';

/**
 * Central registry for all known device definitions.
 * Acts as a runtime in-memory store; devices can be loaded from the device-sdk.
 */
export class DeviceRegistry {
  private readonly devices = new Map<string, DeviceDefinition>();

  /**
   * Registers a device definition.
   * @param device - Device definition to register
   */
  register(device: DeviceDefinition): void {
    this.devices.set(device.id, device);
  }

  /**
   * Registers multiple device definitions at once.
   * @param devices - Array of device definitions
   */
  registerAll(devices: DeviceDefinition[]): void {
    devices.forEach(d => this.register(d));
  }

  /**
   * Retrieves a device definition by ID.
   * @param id - Device ID
   * @returns The device definition, or undefined if not found
   */
  getDevice(id: string): DeviceDefinition | undefined {
    return this.devices.get(id);
  }

  /**
   * Returns all registered devices, optionally filtered.
   * @param filter - Optional filter predicate
   */
  listDevices(filter?: (d: DeviceDefinition) => boolean): DeviceDefinition[] {
    const all = Array.from(this.devices.values());
    return filter ? all.filter(filter) : all;
  }

  /**
   * Removes a device from the registry.
   * @param id - Device ID to remove
   */
  unregister(id: string): boolean {
    return this.devices.delete(id);
  }

  /** Total number of registered devices */
  get count(): number {
    return this.devices.size;
  }

  /** Returns all devices matching the given brand (case-insensitive). */
  findByBrand(brand: string): DeviceDefinition[] {
    const normalized = brand.toLowerCase();
    return this.listDevices(d => d.brand.toLowerCase() === normalized);
  }

  /** Returns all devices in the given category. */
  findByCategory(category: DeviceDefinition['category']): DeviceDefinition[] {
    return this.listDevices(d => d.category === category);
  }

  /** Returns all devices that support the given protocol. */
  findByProtocol(protocol: SupportedProtocol): DeviceDefinition[] {
    return this.listDevices(d => (d.protocols as string[]).includes(protocol));
  }

  /** Returns all devices that have the given capability. */
  findByCapability(capability: DeviceCapability): DeviceDefinition[] {
    return this.listDevices(d => (d.capabilities as string[]).includes(capability));
  }
}
