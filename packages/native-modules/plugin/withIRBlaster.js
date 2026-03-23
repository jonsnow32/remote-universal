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

const MODULE_PACKAGE = 'com.streamless.nativemodules';
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
  if (contents.includes('add(IRBlasterPackage()')) return contents;

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

    const features = [
      // Built-in consumer IR emitter (e.g. Xiaomi with IR blaster)
      'android.hardware.consumerir',
      // USB Host mode — required for external USB Type-C IR blasters
      'android.hardware.usb.host',
    ];

    for (const featureName of features) {
      const alreadyPresent = manifest['uses-feature'].some(
        (f) => f.$?.['android:name'] === featureName
      );
      if (!alreadyPresent) {
        manifest['uses-feature'].push({
          $: {
            'android:name': featureName,
            // false = app still installs on devices without this hardware
            'android:required': 'false',
          },
        });
      }
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

      // Copy both IRBlaster*.kt and USBIRBlaster*.kt files
      const ktFiles = fs
        .readdirSync(KOTLIN_SRC_DIR)
        .filter((f) => (f.startsWith('IRBlaster') || f.startsWith('USBIRBlaster')) && f.endsWith('.kt'));

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
// USB device filter XML  (res/xml/usb_ir_device_filter.xml)
// ---------------------------------------------------------------------------
// VID/PID values must be DECIMAL in the XML (Android requirement).
// Matches the KNOWN_IR_DEVICES map in USBIRBlasterModule.kt.
const USB_DEVICE_FILTER_XML = `<?xml version="1.0" encoding="utf-8"?>
<!-- USB IR blaster device filter.
     Android shows "Open Universal Remote?" when one of these devices is plugged in.
     vendor-id / product-id must be DECIMAL (not hex). -->
<resources>
    <!-- USB-UIRT (0x1781 / 0x0938) -->
    <usb-device vendor-id="6017"  product-id="2360"  />
    <!-- USB IR Toy v2 — Dangerous Prototypes (0x04d8 / 0x003f) -->
    <usb-device vendor-id="1240"  product-id="63"    />
    <!-- USB IR Toy v1 (0x04d8 / 0xfd08) -->
    <usb-device vendor-id="1240"  product-id="64776" />
    <!-- FLIRC USB Gen 1 (0x20a0 / 0x0006) -->
    <usb-device vendor-id="8352"  product-id="6"     />
    <!-- FLIRC USB Gen 2 (0x20a0 / 0x4153) -->
    <usb-device vendor-id="8352"  product-id="16723" />
    <!-- IRTrans USB (0x0403 / 0xf850) -->
    <usb-device vendor-id="1027"  product-id="63568" />
    <!-- Irdroid USB (0x1e52 / 0x0002) -->
    <usb-device vendor-id="7762"  product-id="2"     />
    <!-- Silicon Labs CP210x — generic USB IR dongle (0x10c4 / 0xea60) -->
    <usb-device vendor-id="4292"  product-id="60000" />
    <!-- Prolific PL2303 — generic USB IR dongle (0x067b / 0x2303) -->
    <usb-device vendor-id="1659"  product-id="8963"  />
    <!-- STM32 Virtual COM — DIY IR sticks (0x0483 / 0x5740) -->
    <usb-device vendor-id="1155"  product-id="22336" />
    <!-- STM32 Virtual COM variant (0x0483 / 0x5750) -->
    <usb-device vendor-id="1155"  product-id="22352" />
    <!-- ELKSMART Smart IR Blaster (0x045C / 0x0195) -->
    <usb-device vendor-id="1116"  product-id="405"   />
</resources>`;

/**
 * Writes usb_ir_device_filter.xml into the generated app's res/xml/ directory.
 */
function withIRBlasterUSBDeviceFilter(config) {
  return withDangerousMod(config, [
    'android',
    (mod) => {
      const { projectRoot } = mod.modRequest;
      const resXmlDir = path.join(
        projectRoot, 'android', 'app', 'src', 'main', 'res', 'xml'
      );
      fs.mkdirSync(resXmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(resXmlDir, 'usb_ir_device_filter.xml'),
        USB_DEVICE_FILTER_XML,
        'utf8'
      );
      return mod;
    },
  ]);
}

/**
 * Adds to the main launcher Activity in AndroidManifest.xml:
 *   <intent-filter>
 *     <action android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED" />
 *   </intent-filter>
 *   <meta-data
 *     android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED"
 *     android:resource="@xml/usb_ir_device_filter" />
 *
 * This makes Android show "Open Universal Remote?" when a recognised IR blaster
 * is plugged in via USB OTG / Type-C.
 */
function withIRBlasterUSBIntent(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const app = manifest.application?.[0];
    if (!app) return mod;

    const activities = app.activity ?? [];
    // Find the main launcher activity
    const mainActivity = activities.find((a) =>
      (a['intent-filter'] ?? []).some((f) =>
        (f.action ?? []).some(
          (act) => act.$?.['android:name'] === 'android.intent.action.MAIN'
        )
      )
    );
    if (!mainActivity) return mod;

    // ── intent-filter ──────────────────────────────────────────────────────
    if (!mainActivity['intent-filter']) mainActivity['intent-filter'] = [];
    const hasUsbFilter = mainActivity['intent-filter'].some((f) =>
      (f.action ?? []).some(
        (act) => act.$?.['android:name'] === 'android.hardware.usb.action.USB_DEVICE_ATTACHED'
      )
    );
    if (!hasUsbFilter) {
      mainActivity['intent-filter'].push({
        action: [
          { $: { 'android:name': 'android.hardware.usb.action.USB_DEVICE_ATTACHED' } },
        ],
      });
    }

    // ── meta-data for the device filter XML ───────────────────────────────
    if (!mainActivity['meta-data']) mainActivity['meta-data'] = [];
    const hasMetaData = mainActivity['meta-data'].some(
      (m) => m.$?.['android:name'] === 'android.hardware.usb.action.USB_DEVICE_ATTACHED'
    );
    if (!hasMetaData) {
      mainActivity['meta-data'].push({
        $: {
          'android:name':     'android.hardware.usb.action.USB_DEVICE_ATTACHED',
          'android:resource': '@xml/usb_ir_device_filter',
        },
      });
    }

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
  config = withIRBlasterUSBDeviceFilter(config);
  config = withIRBlasterUSBIntent(config);
  return config;
}

module.exports = withIRBlaster;
