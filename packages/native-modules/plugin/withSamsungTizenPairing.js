'use strict';

/**
 * Expo config plugin — withSamsungTizenPairing
 *
 * Wires the Samsung Tizen WSS pairing native module into the app during
 * `expo prebuild`. Three things happen:
 *   1. Kotlin source files — copies SamsungTizenPairingModule.kt,
 *      SamsungTizenPairingPackage.kt, and LanSslConfigurator.kt from the
 *      package's android/ folder into the generated Android project.
 *   2. MainApplication.kt — adds the import and registers
 *      SamsungTizenPairingPackage in getPackages().
 *
 * Usage in app.json:
 *   "plugins": ["@remote/native-modules/plugin/withSamsungTizenPairing"]
 */

const { withMainApplication, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const MODULE_PACKAGE = 'com.streamless.nativemodules';
const IMPORT_LINE = `import ${MODULE_PACKAGE}.SamsungTizenPairingPackage`;

const KOTLIN_SRC_DIR = path.resolve(__dirname, '..', 'android');

const SAMSUNG_FILES = [
  'SamsungTizenPairingModule.kt',
  'SamsungTizenPairingPackage.kt',
  'LanSslConfigurator.kt',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addImport(contents, importLine) {
  if (contents.includes(importLine)) return contents;

  const lastImport = contents.lastIndexOf('\nimport ');
  if (lastImport === -1) {
    return `${importLine}\n${contents}`;
  }
  const endOfLine = contents.indexOf('\n', lastImport + 1) + 1;
  return contents.slice(0, endOfLine) + importLine + '\n' + contents.slice(endOfLine);
}

function addPackageRegistration(contents) {
  if (contents.includes('add(SamsungTizenPairingPackage()')) return contents;

  if (contents.includes('.packages.apply')) {
    return contents.replace(
      /\.packages\.apply\s*\{([\s\S]*?)\}/,
      (_, body) =>
        `.packages.apply {${body}        add(SamsungTizenPairingPackage())\n        }`
    );
  }

  if (contents.includes('PackageList(this).packages')) {
    return contents.replace(
      'PackageList(this).packages',
      'PackageList(this).packages.apply {\n            add(SamsungTizenPairingPackage())\n        }'
    );
  }

  return contents;
}

// ---------------------------------------------------------------------------
// Plugin steps
// ---------------------------------------------------------------------------

function withSamsungKotlinSources(config) {
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

      for (const file of SAMSUNG_FILES) {
        const src = path.join(KOTLIN_SRC_DIR, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, path.join(destDir, file));
        }
      }

      return mod;
    },
  ]);
}

function withSamsungMainApplication(config) {
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

function withSamsungTizenPairing(config) {
  config = withSamsungKotlinSources(config);
  config = withSamsungMainApplication(config);
  return config;
}

module.exports = withSamsungTizenPairing;
