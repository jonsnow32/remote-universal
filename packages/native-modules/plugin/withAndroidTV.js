'use strict';

/**
 * Expo config plugin — withAndroidTV
 *
 * Wires the Android TV native module into the app during `expo prebuild`.
 * Two things happen:
 *   1. Kotlin source files  — copies AndroidTVModule.kt + AndroidTVPackage.kt into
 *                             the generated Android project source tree.
 *   2. MainApplication.kt  — adds the import and registers AndroidTVPackage in
 *                             getPackages().
 *
 * Usage in app.json:
 *   "plugins": ["@remote/native-modules/plugin/withAndroidTV"]
 */

const { withMainApplication, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const MODULE_PACKAGE = 'com.streamless.nativemodules';
const IMPORT_LINE = `import ${MODULE_PACKAGE}.AndroidTVPackage`;

const KOTLIN_SRC_DIR = path.resolve(__dirname, '..', 'android');

// ---------------------------------------------------------------------------
// Helpers (same pattern as withIRBlaster)
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
  if (contents.includes('add(AndroidTVPackage()')) return contents;

  if (contents.includes('.packages.apply')) {
    return contents.replace(
      /\.packages\.apply\s*\{([\s\S]*?)\}/,
      (_, body) => `.packages.apply {${body}        add(AndroidTVPackage())\n        }`
    );
  }

  if (contents.includes('PackageList(this).packages')) {
    return contents.replace(
      'PackageList(this).packages',
      'PackageList(this).packages.apply {\n            add(AndroidTVPackage())\n        }'
    );
  }

  return contents;
}

// ---------------------------------------------------------------------------
// Plugin steps
// ---------------------------------------------------------------------------

function withAndroidTVKotlinSources(config) {
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

      // Only copy the AndroidTV Kotlin files from this plugin.
      const ktFiles = fs
        .readdirSync(KOTLIN_SRC_DIR)
        .filter((f) => f.startsWith('AndroidTV') && f.endsWith('.kt'));

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

function withAndroidTVMainApplication(config) {
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

function withAndroidTV(config) {
  config = withAndroidTVKotlinSources(config);
  config = withAndroidTVMainApplication(config);
  return config;
}

module.exports = withAndroidTV;
