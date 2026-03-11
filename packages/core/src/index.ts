// Types — base
export * from './types/Device';
export * from './types/Protocol';
export * from './types/Command';
export * from './types/RemoteLayout';

// Types — database schema
export * from './types/Catalog';
export * from './types/UserData';
export * from './types/IRLibrary';

// Database — Layer 1 static catalog
export type { Database, DatabaseRow } from './db/Database';
export { initCatalogDatabase } from './db/catalogSchema';
export {
  CatalogRepository,
  BrandRepository,
  DeviceModelRepository,
  CommandDefinitionRepository,
  CatalogLayoutRepository,
} from './db/CatalogRepository';

// Database — Layer 3 IR code library
export { initIRLibraryDatabase } from './db/irLibrarySchema';
export {
  IRLibraryRepository,
  IRBrandRepository,
  IRCodesetRepository,
  IRCodeRepository,
  IRImportBatchRepository,
} from './db/IRLibraryRepository';
export type {
  ResolveCodeParams,
  ResolvedIRCode,
  BruteForceProbe,
} from './db/IRLibraryRepository';

// IR command resolution (3-case flow)
export { IRCommandResolver } from './ir/IRCommandResolver';
export type {
  IRResolution,
  IRResolutionDirectBlaster,
  IRResolutionHubRelay,
  IRResolutionBruteForce,
  IRResolutionLearnMode,
  IRResolutionUnavailable,
  IRTransmitResult,
  IRResolveParams,
  CatalogCommandLookup,
  IRCommandResolverOptions,
} from './ir/IRCommandResolver';

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
export type { Macro, MacroCommand } from './commands/MacroEngine';

// Registry
export { DeviceRegistry } from './registry/DeviceRegistry';
