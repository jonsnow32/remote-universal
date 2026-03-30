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

// ─── Canonical package roots ──────────────────────────────────────────────────
// The monorepo root node_modules/ contains STALE real directories (not pnpm
// symlinks) for many packages. Metro may resolve files from both the stale root
// copy AND the pnpm-managed app-level copy, giving them different module IDs.
// This causes singleton state (expo-font cache, react context, etc.) to split.
//
// Strategy: intercept any resolved path that starts with a stale root-hoisted
// directory and redirect it to the pnpm-managed canonical copy (resolved via
// the app's own node_modules symlinks → .pnpm store).

// Packages that are known-stale real directories at the monorepo root.
// These must be served from a single canonical location.
const staledRootPackages = [
  'react',
  'react-native',
  'expo-font',
  'expo-asset',
  'expo-modules-core',
  'expo-constants',
  'expo-haptics',
  'expo-file-system',
  'expo-keep-awake',
];

// Build redirect map: staleRootPath → canonicalAppPath
// canonicalAppPath is resolved via the app's node_modules (pnpm symlinks → store)
const redirectMap = [];
for (const pkg of staledRootPackages) {
  const stale = path.resolve(monorepoRoot, 'node_modules', pkg);
  // Try to find the canonical path via the app's node_modules first,
  // then fall back to the monorepo root's pnpm symlink.
  let canonical;
  const appLocal = path.resolve(projectRoot, 'node_modules', pkg);
  if (fs.existsSync(appLocal)) {
    canonical = fs.realpathSync(appLocal);
  } else {
    const rootLocal = path.resolve(monorepoRoot, 'node_modules', pkg);
    // Only treat as canonical when it's a symlink (pnpm-managed)
    const lstat = fs.lstatSync(rootLocal, { throwIfNoEntry: false });
    if (lstat && lstat.isSymbolicLink()) {
      canonical = fs.realpathSync(rootLocal);
    }
  }
  if (canonical && fs.existsSync(stale)) {
    const staleReal = fs.realpathSync(stale);
    if (staleReal !== canonical) {
      redirectMap.push({ stale: staleReal, canonical });
    }
  }
}

// Also pin bare imports directly to the canonical copy
const canonicalRN = fs.realpathSync(
  path.resolve(projectRoot, 'node_modules/react-native')
);
const canonicalReact = fs.realpathSync(
  path.resolve(projectRoot, 'node_modules/react')
);

config.resolver.extraNodeModules = {
  'react-native': canonicalRN,
  react: canonicalReact,
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Pin bare react / react-native / @expo/vector-icons imports to the canonical copy.
  if (
    moduleName === 'react' ||
    moduleName.startsWith('react/') ||
    moduleName === 'react-native' ||
    moduleName === '@expo/vector-icons' ||
    moduleName.startsWith('@expo/vector-icons/')
  ) {
    try {
      const filePath = require.resolve(moduleName, { paths: [projectRoot] });
      return { filePath: fs.realpathSync(filePath), type: 'sourceFile' };
    } catch {
      // fall through
    }
  }

  const result = context.resolveRequest(context, moduleName, platform);

  // Redirect stale root-hoisted paths to canonical pnpm-managed copies.
  if (result?.filePath) {
    for (const { stale, canonical } of redirectMap) {
      if (result.filePath.startsWith(stale + '/') || result.filePath === stale) {
        const relative = result.filePath.slice(stale.length);
        const redirected = canonical + relative;
        if (fs.existsSync(redirected)) {
          return { filePath: redirected, type: result.type };
        }
      }
    }
  }

  return result;
};

// Bundle SQLite database files so expo-sqlite can copy them from assets
config.resolver.assetExts = [...(config.resolver.assetExts ?? []), 'db'];

module.exports = config;
