'use strict';

/**
 * Expo config plugin — withMicStream
 *
 * Wires the MicStream native module (real-time PCM microphone streaming)
 * into the app during `expo prebuild`.
 *
 *   Android:
 *     1. Copies MicStreamModule.kt + MicStreamPackage.kt into the generated project.
 *     2. Registers MicStreamPackage in MainApplication.
 *     3. Adds RECORD_AUDIO permission to AndroidManifest.xml.
 *
 *   iOS:
 *     Adds NSMicrophoneUsageDescription to Info.plist.
 *     (Swift/ObjC files are picked up automatically by CocoaPods from the
 *      ios/ folder since they reside inside the @remote/native-modules pod.)
 *
 * Usage in app.json:
 *   "plugins": ["@remote/native-modules/plugin/withMicStream"]
 */

const {
  withMainApplication,
  withAndroidManifest,
  withInfoPlist,
  withDangerousMod,
} = require('@expo/config-plugins');
const path = require('path');
const fs   = require('fs');

const MODULE_PACKAGE = 'com.remoteplatform.nativemodules';
const IMPORT_LINE    = `import ${MODULE_PACKAGE}.MicStreamPackage`;
const KOTLIN_SRC_DIR = path.resolve(__dirname, '..', 'android');
const MIC_FILES      = ['MicStreamModule.kt', 'MicStreamPackage.kt'];

// ── helpers ─────────────────────────────────────────────────────────────────

function addImport(contents, importLine) {
  if (contents.includes(importLine)) return contents;
  const lastImport = contents.lastIndexOf('\nimport ');
  if (lastImport === -1) return `${importLine}\n${contents}`;
  const end = contents.indexOf('\n', lastImport + 1) + 1;
  return contents.slice(0, end) + importLine + '\n' + contents.slice(end);
}

function addPackageRegistration(contents) {
  if (contents.includes('add(MicStreamPackage()')) return contents;

  if (contents.includes('.packages.apply')) {
    return contents.replace(
      /\.packages\.apply\s*\{([\s\S]*?)\}/,
      (_, body) =>
        `.packages.apply {${body}        add(MicStreamPackage())\n        }`,
    );
  }

  if (contents.includes('PackageList(this).packages')) {
    return contents.replace(
      'PackageList(this).packages',
      'PackageList(this).packages.apply {\n            add(MicStreamPackage())\n        }',
    );
  }

  return contents;
}

// ── Android: copy Kotlin sources ────────────────────────────────────────────

function withMicKotlinSources(config) {
  return withDangerousMod(config, [
    'android',
    (mod) => {
      const { projectRoot } = mod.modRequest;
      const destDir = path.join(
        projectRoot,
        'android', 'app', 'src', 'main', 'java',
        ...MODULE_PACKAGE.split('.'),
      );
      fs.mkdirSync(destDir, { recursive: true });
      for (const file of MIC_FILES) {
        const src = path.join(KOTLIN_SRC_DIR, file);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(destDir, file));
      }
      return mod;
    },
  ]);
}

// ── Android: register package in MainApplication ─────────────────────────────

function withMicMainApplication(config) {
  return withMainApplication(config, (mod) => {
    let { contents } = mod.modResults;
    contents = addImport(contents, IMPORT_LINE);
    contents = addPackageRegistration(contents);
    mod.modResults.contents = contents;
    return mod;
  });
}

// ── Android: RECORD_AUDIO permission ────────────────────────────────────────

function withMicPermissionAndroid(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const usesPermissions = manifest['uses-permission'] ?? [];
    const RECORD = 'android.permission.RECORD_AUDIO';
    if (!usesPermissions.some((p) => p.$?.['android:name'] === RECORD)) {
      usesPermissions.push({ $: { 'android:name': RECORD } });
      manifest['uses-permission'] = usesPermissions;
    }
    return mod;
  });
}

// ── iOS: NSMicrophoneUsageDescription in Info.plist ─────────────────────────

function withMicInfoPlist(config) {
  return withInfoPlist(config, (mod) => {
    if (!mod.modResults.NSMicrophoneUsageDescription) {
      mod.modResults.NSMicrophoneUsageDescription =
        'The remote app needs your microphone to stream voice commands to the TV, just like a physical remote.';
    }
    return mod;
  });
}

// ── Composed plugin ─────────────────────────────────────────────────────────

function withMicStream(config) {
  config = withMicKotlinSources(config);
  config = withMicMainApplication(config);
  config = withMicPermissionAndroid(config);
  config = withMicInfoPlist(config);
  return config;
}

module.exports = withMicStream;
