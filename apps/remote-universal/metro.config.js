const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Canonical react-native / react: the app-level pnpm symlinks that point into
// the .pnpm store with a fully resolved dependency tree.  The monorepo root may
// contain a stale hoisted *real directory* whose internal node_modules is
// incomplete — we must never serve files from there.
const canonicalRN = path.resolve(projectRoot, 'node_modules/react-native');
const canonicalReact = path.resolve(projectRoot, 'node_modules/react');

config.resolver.extraNodeModules = {
  'react-native': canonicalRN,
  'react': canonicalReact,
};

// Detect the root-hoisted copies so we can redirect any stray resolutions.
const rootRN = path.resolve(monorepoRoot, 'node_modules/react-native');
const rootReact = path.resolve(monorepoRoot, 'node_modules/react');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Pin bare react / react-native imports to the app-local canonical copy.
  if (
    moduleName === 'react' ||
    moduleName.startsWith('react/') ||
    moduleName === 'react-native'
  ) {
    try {
      const filePath = require.resolve(moduleName, { paths: [projectRoot] });
      return { filePath, type: 'sourceFile' };
    } catch {
      // fall through to default resolver
    }
  }

  // Default resolution (handles platform extensions, relative paths, etc.)
  const result = context.resolveRequest(context, moduleName, platform);

  // Normalise any path that landed in the stale root-hoisted copy back into the
  // canonical (pnpm-managed) app-level copy so Metro sees a single instance and
  // the dependency tree is complete.
  if (result?.filePath) {
    const fp = result.filePath;
    if (fp.startsWith(rootRN + '/')) {
      const canonical = path.join(canonicalRN, fp.slice(rootRN.length));
      if (fs.existsSync(canonical)) {
        return { filePath: canonical, type: result.type };
      }
    }
    if (fp.startsWith(rootReact + '/')) {
      const canonical = path.join(canonicalReact, fp.slice(rootReact.length));
      if (fs.existsSync(canonical)) {
        return { filePath: canonical, type: result.type };
      }
    }
  }

  return result;
};

// Bundle SQLite database files so expo-sqlite can copy them from assets
config.resolver.assetExts = [...(config.resolver.assetExts ?? []), 'db'];

module.exports = config;
