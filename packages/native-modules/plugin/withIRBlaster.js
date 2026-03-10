'use strict';

/**
 * Expo config plugin — withIRBlaster
 *
 * Wires the Android IR blaster native module into the app during `expo prebuild`.
 * Three things happen:
 *   1. AndroidManifest.xml  — adds <uses-feature android:name="android.hardware.consumerir"
 *                             android:required="false"> so the app still installs on devices
 *                             without IR hardware.
 *   2. Kotlin source files  — copies IRBlasterModule.kt + IRBlasterPackage.kt from the
 *                             package's android/ folder into the generated Android project.
 *   3. MainApplication.kt  — adds the import and registers IRBlasterPackage in getPackages().
 *
 * Usage in app.json:
 *   "plugins": ["@remote/native-modules/plugin/withIRBlaster"]
 */

const { withAndroidManifest, withMainApplication, withDangerousMod } =
  require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const MODULE_PACKAGE = 'com.remoteplatform.nativemodules';
const IMPORT_LINE = `import ${MODULE_PACKAGE}.IRBlasterPackage`;

/** Source directory containing the two .kt files shipped with this package. */
const KOTLIN_SRC_DIR = path.resolve(__dirname, '..', 'android');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Inserts `importLine` after the last existing `import` statement in the file.
 */
function addImport(contents, importLine) {
  if (contents.includes(importLine)) return contents;

  const lastImport = contents.lastIndexOf('\nimport ');
  if (lastImport === -1) {
    // No existing imports — prepend at top
    return `${importLine}\n${contents}`;
  }
  const endOfLine = contents.indexOf('\n', lastImport + 1) + 1;
  return contents.slice(0, endOfLine) + importLine + '\n' + contents.slice(endOfLine);
}

/**
 * Adds `add(IRBlasterPackage())` inside the getPackages() block.
 * Handles two common Expo SDK 54 patterns:
 *   A) PackageList(this).packages.apply { ... }
 *   B) PackageList(this).packages  (no apply block yet)
 */
function addPackageRegistration(contents) {
  if (contents.includes('IRBlasterPackage')) return contents;

  // Pattern A — apply block already present
  if (contents.includes('.packages.apply')) {
    return contents.replace(
      /\.packages\.apply\s*\{([\s\S]*?)\}/,
      (_, body) => `.packages.apply {${body}        add(IRBlasterPackage())\n        }`
    );
  }

  // Pattern B — plain .packages, wrap it in an apply block
  if (contents.includes('PackageList(this).packages')) {
    return contents.replace(
      'PackageList(this).packages',
      'PackageList(this).packages.apply {\n            add(IRBlasterPackage())\n        }'
    );
  }

  return contents;
}

// ---------------------------------------------------------------------------
// Plugin steps
// ---------------------------------------------------------------------------

function withIRBlasterManifest(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;

    if (!manifest['uses-feature']) {
      manifest['uses-feature'] = [];
    }

    const alreadyPresent = manifest['uses-feature'].some(
      (f) => f.$?.['android:name'] === 'android.hardware.consumerir'
    );

    if (!alreadyPresent) {
      manifest['uses-feature'].push({
        $: {
          'android:name': 'android.hardware.consumerir',
          // false = app still installs on devices without IR hardware
          'android:required': 'false',
        },
      });
    }

    return mod;
  });
}

function withIRBlasterKotlinSources(config) {
  return withDangerousMod(config, [
    'android',
    (mod) => {
      const { projectRoot } = mod.modRequest;
      const destDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        ...MODULE_PACKAGE.split('.')
      );

      fs.mkdirSync(destDir, { recursive: true });

      const ktFiles = fs
        .readdirSync(KOTLIN_SRC_DIR)
        .filter((f) => f.endsWith('.kt'));

      for (const file of ktFiles) {
        fs.copyFileSync(
          path.join(KOTLIN_SRC_DIR, file),
          path.join(destDir, file)
        );
      }

      return mod;
    },
  ]);
}

function withIRBlasterMainApplication(config) {
  return withMainApplication(config, (mod) => {
    let { contents } = mod.modResults;
    contents = addImport(contents, IMPORT_LINE);
    contents = addPackageRegistration(contents);
    mod.modResults.contents = contents;
    return mod;
  });
}

// ---------------------------------------------------------------------------
// Composed plugin
// ---------------------------------------------------------------------------

function withIRBlaster(config) {
  config = withIRBlasterManifest(config);
  config = withIRBlasterKotlinSources(config);
  config = withIRBlasterMainApplication(config);
  return config;
}

module.exports = withIRBlaster;
