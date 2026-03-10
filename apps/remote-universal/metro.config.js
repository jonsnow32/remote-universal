const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Force all packages to resolve react-native and react from the same location
// to prevent the dual-instance / PlatformConstants TurboModule crash.
config.resolver.extraNodeModules = {
  'react-native': path.resolve(monorepoRoot, 'node_modules/react-native'),
  'react': path.resolve(monorepoRoot, 'node_modules/react'),
};

module.exports = config;
