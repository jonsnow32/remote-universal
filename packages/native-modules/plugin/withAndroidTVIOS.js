'use strict';

/**
 * Expo config plugin — withAndroidTVIOS
 *
 * Wires the iOS AndroidTV native module (Swift + Obj-C bridge) into the app
 * during `expo prebuild`.
 *
 * What it does:
 *   1. Copies AndroidTVModule.swift + AndroidTVModule.m into the generated
 *      iOS project's app source directory using withDangerousMod.
 *   2. Adds both files to the Xcode project (correct group UUID lookup).
 *   3. Patches Info.plist with NSLocalNetworkUsageDescription (iOS 14+
 *      requirement when connecting to LAN devices).
 *
 * Usage in app.json:
 *   "plugins": ["@remote/native-modules/plugin/withAndroidTVIOS"]
 */

const { withXcodeProject, withInfoPlist, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs   = require('fs');

const IOS_SRC_DIR = path.resolve(__dirname, '..', 'ios');
const SOURCE_FILES = ['AndroidTVModule.swift', 'AndroidTVModule.m'];

// ---------------------------------------------------------------------------
// Step 1 — copy source files into ios/{AppName}/
// ---------------------------------------------------------------------------

function withAndroidTVIOSSources(config) {
  return withDangerousMod(config, [
    'ios',
    (mod) => {
      const { projectRoot, projectName } = mod.modRequest;
      const appName  = projectName ?? 'app';
      const destDir  = path.join(projectRoot, 'ios', appName);

      fs.mkdirSync(destDir, { recursive: true });

      for (const file of SOURCE_FILES) {
        const src  = path.join(IOS_SRC_DIR, file);
        const dest = path.join(destDir, file);
        if (fs.existsSync(src) && !fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
        }
      }

      return mod;
    },
  ]);
}

// ---------------------------------------------------------------------------
// Step 2 — add files to the Xcode project
// ---------------------------------------------------------------------------

function withAndroidTVIOSXcodeProject(config) {
  return withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const appName      = config.modRequest.projectName ?? 'app';
    const target       = xcodeProject.getFirstTarget()?.uuid;

    // Resolve the PBX group UUID for the app's source group.
    // Try by name first, then by relative path.
    const groupKey =
      xcodeProject.findPBXGroupKey({ name: appName }) ||
      xcodeProject.findPBXGroupKey({ path: appName });

    if (!groupKey) {
      console.warn(`[withAndroidTVIOS] Could not find PBX group "${appName}" — skipping Xcode project update.`);
      return config;
    }

    for (const file of SOURCE_FILES) {
      // hasFile checks by relative path; skip if already added.
      const relPath = `${appName}/${file}`;
      if (!xcodeProject.hasFile(relPath)) {
        xcodeProject.addSourceFile(file, { target }, groupKey);
      }
    }

    return config;
  });
}

// ---------------------------------------------------------------------------
// Step 3 — Info.plist: local network usage description (iOS 14+)
// ---------------------------------------------------------------------------

function withAndroidTVIOSInfoPlist(config) {
  return withInfoPlist(config, (config) => {
    if (!config.modResults['NSLocalNetworkUsageDescription']) {
      config.modResults['NSLocalNetworkUsageDescription'] =
        'Used to connect to Android TV devices on your local network for remote control.';
    }
    return config;
  });
}

// ---------------------------------------------------------------------------
// Composed plugin
// ---------------------------------------------------------------------------

module.exports = function withAndroidTVIOS(config) {
  config = withAndroidTVIOSSources(config);
  config = withAndroidTVIOSXcodeProject(config);
  config = withAndroidTVIOSInfoPlist(config);
  return config;
};
