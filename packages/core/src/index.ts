// Types — base
export * from './types/Device';
export * from './types/Protocol';
export * from './types/Command';
export * from './types/RemoteLayout';

// Types — database schema
export * from './types/Catalog';
export * from './types/UserData';
export * from './types/IRLibrary';

// Protocols
export { BaseProtocol } from './protocols/BaseProtocol';
export { IRProtocol } from './protocols/IRProtocol';
export { BLEProtocol } from './protocols/BLEProtocol';
export { WiFiProtocol } from './protocols/WiFiProtocol';
export { HomeKitProtocol } from './protocols/HomeKitProtocol';
export { MatterProtocol } from './protocols/MatterProtocol';

// Discovery
export { DeviceDiscovery } from './discovery/DeviceDiscovery';
export type { DiscoveredDevice } from './discovery/DeviceDiscovery';
export { MDNSDiscovery } from './discovery/MDNSDiscovery';
export { SSDPDiscovery } from './discovery/SSDPDiscovery';
export { BLEDiscovery } from './discovery/BLEDiscovery';
export { HubDiscovery } from './discovery/HubDiscovery';

// Commands
export { CommandQueue } from './commands/CommandQueue';
export { CommandDispatcher } from './commands/CommandDispatcher';
export { MacroEngine } from './commands/MacroEngine';
export type { Macro } from './commands/MacroEngine';

// Registry
export { DeviceRegistry } from './registry/DeviceRegistry';
