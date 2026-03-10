# Universal Remote — Control Platform
> Modular architecture powering multi-brand remote control apps for TV, AC, and smart home devices across iOS & Android

**Stack:** React Native · Wi-Fi · BLE · IR · White-Label Ready · iOS & Android

---

## 1. App Requirements

| Requirement | Description |
|---|---|
| **Multi-Device Control** | TVs, air conditioners, and other home devices — all from one app |
| **Multi-Protocol Support** | Wi-Fi, Smart TV protocols, BLE, and optional IR blaster hardware |
| **Modular Plugin System** | Protocol plugins allow any device brand to be added without core changes |
| **White-Label Generation** | Samsung, LG, Daikin brand apps generated from one shared core platform |
| **Easy Device Discovery** | Auto-discover devices on local network via mDNS, SSDP, and BLE scanning |
| **Customizable Layouts** | Per-device remote button layouts, user-customizable and brand-configurable |

---

## 2. High-Level Architecture

Three-layer platform: **Brand Apps → Core Engine → Hardware**

```
┌─────────────────────────────────────────────────────────────┐
│                  BRAND APPS  (White-Label Layer)            │
│                                                             │
│  Samsung TV Remote │ LG ThinQ Remote │ Daikin AC Control   │
│  Sony Remote       │ Universal Remote ★                     │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              @remote/core  (Core Platform)                  │
│                                                             │
│  Protocol Engine │ Device Registry │ Command Dispatcher     │
│  Discovery Engine │ UI Kit + Themer                         │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              NATIVE MODULES  (Hardware Layer)               │
│                                                             │
│  IR Blaster (Android) │ BLE Module (iOS+Android)           │
│  Wi-Fi/REST (Both)    │ HomeKit (iOS only) │ Matter (Both)  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Core Module Breakdown

Every module has a single responsibility and a defined public API.

### Protocol Engine
- `BaseProtocol` abstract class
- IR · BLE · Wi-Fi · Matter plugins
- Auto protocol selection (best available)
- Retry + error handling built-in

### Device Registry
- Per-brand device definitions
- IR code database (TV, AC, etc.)
- Command maps per device model
- Remote layout definitions

### Discovery Engine
- mDNS / Bonjour (LAN devices)
- SSDP (Smart TV, UPnP)
- BLE device scanning
- Hub detection (Broadlink, etc.)

### Command Dispatcher
- Routes commands to best protocol
- `CommandQueue` with sequencing
- `MacroEngine` for multi-step flows
- Platform-aware dispatch logic

### UI Kit + Themer
- `BrandTheme` injection system
- `RemoteButton`, D-Pad, NumPad components
- Layout renderer (declarative)
- Per-brand color + font overrides

### Cloud SDK
- Auth (Supabase / Firebase)
- Device state sync
- OTA config updates
- Tenant/license management

---

## 4. White-Label Brand App Model

Each brand app = **Device SDK slice + Theme config + App shell only**

```
@remote/core          device-sdk/           Brand Apps
──────────────        ──────────────        ──────────────────────
Protocol Engine  →    samsung/         →    Samsung TV Remote
Device Registry       lg/                   LG ThinQ Remote
Discovery Engine      daikin/               Daikin AC Control
Command Dispatcher    sony/                 Sony Remote
UI Kit + Themer       _template/            Universal Remote ★
Cloud SDK
```

> **~70%** shared code in core · **~25%** per brand in device-sdk · **~5%** brand config in app

---

## 5. Protocol Plugin System

All protocols implement `BaseProtocol` — new brands plug in without touching core.

### `«abstract» BaseProtocol`
```typescript
isAvailable(): Promise<boolean>
discover(): Promise<Device[]>
connect(deviceId): Promise<void>
send(command): Promise<void>
sendWithRetry(command, n): Promise<void>
```

### Protocol Implementations

| Protocol | Platform | Notes |
|---|---|---|
| `IRProtocol` | Android only | `ConsumerIrManager` |
| `BLEProtocol` | iOS + Android | `CoreBluetooth` / `BluetoothLE` |
| `WiFiProtocol` | Both | HTTP/REST + SSDP |
| `HomeKitProtocol` | iOS only | HomeKit framework |
| `MatterProtocol` | Both | Matter/Thread SDK |

> **`CommandDispatcher`** — selects best available protocol at runtime and routes commands

---

## 6. Device Discovery Flow

Multi-channel parallel discovery — user sees devices appear in real time.

```
mDNS/Bonjour    SSDP/UPnP      BLE Scan       IR Hub Scan    Brand Cloud API
     ↓               ↓              ↓               ↓               ↓
Smart TVs        Samsung TV    BT Speakers    Broadlink RM    SmartThings
Chromecasts      LG TV         BLE AC units   SwitchBot Hub   LG ThinQ
Apple TV         Roku          BT devices     Sensibo         Daikin Cloud
                               ↓
        ┌──────────────────────────────────────────────────┐
        │  Discovery Engine — deduplicates + normalizes    │
        └──────────────────────────┬───────────────────────┘
                                   ↓
        ┌──────────────────────────────────────────────────┐
        │  Device Registry — matches to brand + model      │
        └──────────────────────────┬───────────────────────┘
                                   ↓
        ┌──────────────────────────────────────────────────┐
        │  UI — device appears with correct remote layout  │
        └──────────────────────────────────────────────────┘
```

---

## 7. Monorepo Structure

Turborepo + pnpm workspaces — one repo, all apps and packages.

```
/universal-remote-platform
├── packages/
│   ├── core/
│   │   └── protocols/  commands/  discovery/
│   ├── ui-kit/
│   │   └── ThemeProvider  RemoteButton  Layouts
│   ├── device-sdk/
│   │   └── samsung/  lg/  daikin/  sony/  _template/
│   ├── native-modules/
│   │   └── android/  ios/  (IR, BLE, HomeKit, Matter)
│   └── cloud-sdk/
│       └── auth  sync  tenant-api  OTA
│
├── apps/
│   ├── remote-universal/
│   ├── remote-samsung/
│   ├── remote-lg/
│   ├── remote-daikin/
│   ├── remote-sony/
│   └── whitelabel-template/
│
└── backend/
    ├── api/              (REST — device commands, sync)
    ├── tenant-service/   (brand licensing)
    ├── device-db/        (master IR code database)
    └── ota-service/      (remote config push)
```

---

## 8. Technology Stack

### Frontend
| Library | Purpose |
|---|---|
| React Native + Expo | Cross-platform iOS & Android |
| TypeScript | Type-safe across all packages |
| NativeWind + Reanimated 3 | Styling + gesture animations |
| React Navigation | Screen routing |

### State & Data
| Library | Purpose |
|---|---|
| Zustand | Device + UI state management |
| TanStack Query | API data fetching + caching |
| MMKV | Fast local device config storage |
| Zod | Runtime schema validation |

### Hardware Protocols
| Library | Purpose |
|---|---|
| ConsumerIrManager (Android) | IR blaster — Kotlin native module |
| react-native-ble-plx | BLE — iOS + Android |
| HomeKit framework (iOS) | Swift native module |
| Matter SDK | Both platforms via bridge |

### Backend & Infra
| Library | Purpose |
|---|---|
| Supabase | Auth + DB + Realtime |
| Node.js + Fastify | Tenant + OTA API service |
| MQTT (Mosquitto) | Real-time device state sync |
| Turborepo + pnpm | Monorepo build orchestration |

---

## 9. Implementation Roadmap

> **Status key:** ✅ Done · 🔄 In Progress · ⬜ Not Started
> **Current date:** March 10, 2026

---

### Phase 1 — Core Platform Foundation ✅
**Goal:** Monorepo scaffold, protocol engine, native modules, UI kit, basic discovery.

| # | Task | Status | Notes |
|---|---|---|---|
| 1.1 | Monorepo setup (Turborepo + pnpm workspaces) | ✅ | `apps/`, `packages/`, `backend/` structure in place |
| 1.2 | Expo SDK 54 upgrade across all 4 apps | ✅ | `remote-universal`, `remote-samsung`, `remote-lg`, `remote-daikin` |
| 1.3 | `BaseProtocol` abstract class with retry/backoff | ✅ | `packages/core/src/protocols/BaseProtocol.ts` |
| 1.4 | `WiFiProtocol` — HTTP POST + AbortController timeout | ✅ | 5 s timeout, subclassable for brand overrides |
| 1.5 | `IRProtocol` — delegates to native `IRModule` | ✅ | Lazy import, connectionless |
| 1.6 | `BLEProtocol` — delegates to native `BLEModule` | ✅ | Full connect/write/disconnect cycle |
| 1.7 | `IRBlasterModule.kt` — Android `ConsumerIrManager` | ✅ | `hasIrEmitter()`, `transmit()`, `getCarrierFrequencies()` |
| 1.8 | `IRBlasterPackage.kt` — ReactPackage registration | ✅ | Auto-registered via Expo config plugin |
| 1.9 | Expo config plugin `withIRBlaster.js` | ✅ | Patches `AndroidManifest.xml` + `MainApplication.kt` |
| 1.10 | `IRModule.ts` — Pronto Hex parser + auto-detect format | ✅ | Supports Pronto Hex and raw JSON `{frequency, pattern}` |
| 1.11 | `BLEModule.ts` — `BleManager.startDeviceScan()` + Base64 fix | ✅ | Replaced `Buffer.from()` with `btoa()`; real scan with timeout |
| 1.12 | `ZeroconfModule.ts` — Promise wrapper for `react-native-zeroconf` | ✅ | Event-listener pattern with configurable timeout |
| 1.13 | `DeviceRegistry` — register/query device definitions | ✅ | `findByBrand()`, `findByCategory()`, `findByProtocol()`, `findByCapability()` |
| 1.14 | `CommandDispatcher` — protocol auto-selection + routing | ✅ | `getBestProtocol()` → `dispatch()` with timing |
| 1.15 | `CommandQueue` — FIFO sequencing, prevents race conditions | ✅ | Processes one command at a time |
| 1.16 | `MacroEngine` — multi-step command sequences with delay | ✅ | Save/load/list named macros |
| 1.17 | `ThemeProvider` + `BrandTheme` type system | ✅ | Context + `useTheme()` hook |
| 1.18 | `RemoteButton`, `DPad`, `NumPad`, `RemoteLayout` components | ✅ | Declarative layout renderer |
| 1.19 | `DeviceCard` component | ✅ | Connected/disconnected indicator, brand display |
| 1.20 | 8-screen UI for `remote-universal` app | ✅ | Discovery, Home, Remote, Settings + tab nav |
| 1.21 | pnpm dual react-native instance fix | ✅ | `pnpm.overrides` + `metro.config.js` extraNodeModules |

---

### Phase 2 — Discovery Engine + Brand SDKs ✅
**Goal:** Full device discovery across all channels; Samsung, LG, Daikin device definitions.

| # | Task | Status | Notes |
|---|---|---|---|
| 2.1 | `MDNSDiscovery` — event-based zeroconf (Chromecast, AirPlay, Tizen, Fire TV) | ✅ | 4 service types scanned in parallel with timeout |
| 2.2 | `SSDPDiscovery` — HTTP probe of Samsung Tizen REST API (`port 8001`) | ✅ | Scans common subnets; full UDP M-SEARCH needs native UDP module |
| 2.3 | `BLEDiscovery` — wraps `BLEModule.scanForDevices()` | ✅ | Maps BLE device IDs to `DiscoveredDevice` |
| 2.4 | `HubDiscovery` — pulls registered devices from cloud SDK | ✅ | Calls `CloudSync.getRegisteredDevices()` |
| 2.5 | `DeviceDiscovery` orchestrator — parallel channels with timeout | ✅ | `discoverAll(timeoutMs)` + `discoverStream(onFound, timeoutMs)` |
| 2.6 | Samsung QLED device definition (IR + WiFi commands) | ✅ | POWER, VOL, CH, D-PAD, HOME, BACK, NETFLIX, YOUTUBE, SOURCE |
| 2.7 | `SamsungSmartThings` protocol (Bearer auth, SmartThings API) | ✅ | Extends `WiFiProtocol` |
| 2.8 | Samsung TV remote layout (4 sections) | ✅ | Power, volume, navigation, media |
| 2.9 | LG OLED C3 device definition (IR + WiFi) | ✅ | Full command map, LG WebOS REST |
| 2.10 | `LGThinQ` protocol (LG cloud API) | ✅ | `x-client-id` header + Bearer token |
| 2.11 | LG DualCool AC device definition | ✅ | Power, temp, fan, mode commands |
| 2.12 | LG TV remote layout | ✅ | |
| 2.13 | Daikin Emura FTXJ device definition (IR + WiFi) | ✅ | Temp, fan speed, mode, swing commands |
| 2.14 | `DaikinCloud` protocol | ⬜ | Daikin Cloud API integration |
| 2.15 | Daikin AC remote layout | ⬜ | Dedicated AC layout with temp slider |
| 2.16 | Sony Bravia device-sdk | ⬜ | IRCC-IP + REST API |

---

### Phase 3 — Brand Apps + Backend Services 🔄
**Goal:** Runnable brand apps, backend API, App Store submissions.

#### 3.1 Brand App Polish
| # | Task | Status | Notes |
|---|---|---|---|
| 3.1.1 | `remote-samsung` — Samsung theme + QLED remote screen | 🔄 | App scaffold exists; needs RemoteScreen wired to SmartThings |
| 3.1.2 | `remote-lg` — LG ThinQ theme + OLED + DualCool screens | 🔄 | App scaffold exists; needs device registration on launch |
| 3.1.3 | `remote-daikin` — Daikin theme + AC control screen | 🔄 | App scaffold exists; needs AC layout + Cloud protocol |
| 3.1.4 | `remote-universal` — all brands, full discovery flow | 🔄 | Screens done; wire `discoverStream` to `DiscoveryScreen` |
| 3.1.5 | SafeAreaView for all screens (iOS home bar / Android nav bar) | ⬜ | Apply `useSafeAreaInsets()` per screen |
| 3.1.6 | Gesture animations (Reanimated 3) on button press | ⬜ | Scale + haptic feedback |
| 3.1.7 | MMKV persistence — save paired devices across sessions | ⬜ | `DeviceRegistry` serialize/restore on app launch |

#### 3.2 Backend Services
| # | Task | Status | Notes |
|---|---|---|---|
| 3.2.1 | `backend/api` — REST endpoints (devices, commands, tenant) | 🔄 | Routes scaffolded; needs auth middleware |
| 3.2.2 | `backend/device-db` — master IR code database service | ⬜ | IRDB import + brand/model lookup API |
| 3.2.3 | `backend/ota-service` — push remote layout updates to apps | ⬜ | Signed JSON config, version check on app launch |
| 3.2.4 | `backend/tenant-service` — brand licensing + white-label config | ⬜ | Per-tenant theme + device list override |
| 3.2.5 | `cloud-sdk` — Supabase auth (login, refresh, logout) | ⬜ | Replace placeholder `fetch('/api/devices')` in `CloudSync` |
| 3.2.6 | `cloud-sdk` — MQTT real-time device state sync | ⬜ | Subscribe to device state topics |
| 3.2.7 | API auth middleware (JWT verify) | ⬜ | Protect all `/api/*` routes |

#### 3.3 App Store Submission
| # | Task | Status | Notes |
|---|---|---|---|
| 3.3.1 | App icons + splash screens for all 4 brand apps | ⬜ | 1024×1024 icon, branded splash |
| 3.3.2 | `expo prebuild` + Gradle/Xcode project generation | ⬜ | Required before native module activation |
| 3.3.3 | Android IR permission + manifest review | ⬜ | `CONSUMER_IR` feature declared; verify on physical device |
| 3.3.4 | BLE permissions (iOS `NSBluetoothAlwaysUsageDescription`, Android) | ⬜ | Add to `app.json` `infoPlist` + Expo plugin |
| 3.3.5 | EAS Build profiles (dev, preview, production) | ⬜ | `eas.json` for managed + bare workflow |
| 3.3.6 | TestFlight / Internal track submissions | ⬜ | One brand app as pilot |
| 3.3.7 | App Store + Google Play metadata | ⬜ | Screenshots, description, privacy policy URL |

---

### Phase 4 — Platform+ (Advanced Protocols + AI) ⬜
**Goal:** HomeKit, Matter, voice commands, tenant portal, sub-1-week brand onboarding.

#### 4.1 HomeKit (iOS)
| # | Task | Status | Notes |
|---|---|---|---|
| 4.1.1 | `HomeKitModule.swift` — HMAccessoryBrowser + HMCharacteristic write | ⬜ | Swift native module; wrap in `HomeKitModule.ts` |
| 4.1.2 | `HomeKitProtocol` — send via HMCharacteristic | ⬜ | Already stubbed in `packages/core/protocols/` |
| 4.1.3 | HomeKit entitlement + `app.json` plugin | ⬜ | `com.apple.developer.homekit` entitlement required |
| 4.1.4 | AC + TV device HomeKit service mappings | ⬜ | `HMServiceTypeThermostat`, `HMServiceTypeTelevision` |

#### 4.2 Matter / Thread
| # | Task | Status | Notes |
|---|---|---|---|
| 4.2.1 | Matter SDK native bridge (iOS + Android) | ⬜ | `MatterModule.ts` already stubbed |
| 4.2.2 | `MatterProtocol` — commissioning + cluster commands | ⬜ | OnOff, LevelControl, Thermostat clusters |
| 4.2.3 | Matter device discovery via mDNS (`_matter._tcp`) | ⬜ | Add to `MDNSDiscovery` SCAN_SERVICES |
| 4.2.4 | Thread network setup flow (iOS `NEHotspotConfigurationManager`) | ⬜ | |

#### 4.3 AI Voice Command Layer
| # | Task | Status | Notes |
|---|---|---|---|
| 4.3.1 | On-device speech recognition (Whisper.rn or `@react-native-voice/voice`) | ⬜ | Wake word + command transcription |
| 4.3.2 | NLP intent parser — map phrase → `DeviceCommand` | ⬜ | "Turn off Samsung TV" → `{ deviceId, action: 'POWER_OFF' }` |
| 4.3.3 | LLM fallback for ambiguous commands (OpenAI / local LLM) | ⬜ | Context-aware: knows paired devices + current state |
| 4.3.4 | Siri Shortcut + Google Assistant integration | ⬜ | `SiriKit` intents / App Actions |
| 4.3.5 | Voice command UI (floating mic button, waveform feedback) | ⬜ | |

#### 4.4 Tenant / White-Label Portal
| # | Task | Status | Notes |
|---|---|---|---|
| 4.4.1 | Web portal — brand config editor (theme, device list, OTA payload) | ⬜ | Vite + React dashboard |
| 4.4.2 | Brand onboarding CLI (`pnpm create @remote/brand <name>`) | ⬜ | Generates app scaffold from `_template/` |
| 4.4.3 | Per-tenant EAS build trigger via GitHub Actions | ⬜ | Push to `brand/<name>` → EAS Build → TestFlight / Play |
| 4.4.4 | License management — feature flags per tenant tier | ⬜ | Free (1 brand), Pro (5 brands), Enterprise (unlimited) |
| 4.4.5 | Analytics dashboard — command counts, error rates per brand | ⬜ | |

---

### Immediate Next Steps (Sprint — now)

| Priority | Task | Owner area |
|---|---|---|
| 🔴 High | Wire `discoverStream()` into `DiscoveryScreen.tsx` (progressive device list) | `apps/remote-universal` |
| 🔴 High | `expo prebuild` + IR blaster test on physical Android device | `apps/remote-universal` |
| 🔴 High | Daikin Cloud protocol (`DaikinCloud.ts`) + AC layout | `packages/device-sdk/daikin` |
| 🟡 Medium | MMKV device persistence — save/restore `DeviceRegistry` | `packages/core` |
| 🟡 Medium | BLE permissions config plugin (`withBLEPermissions.js`) | `packages/native-modules` |
| 🟡 Medium | Supabase auth in `cloud-sdk` | `packages/cloud-sdk` |
| 🟡 Medium | `remote-samsung` RemoteScreen wired to SmartThings | `apps/remote-samsung` |
| 🟢 Low | SafeAreaView via `useSafeAreaInsets()` on all screens | all apps |
| 🟢 Low | EAS Build config (`eas.json`) | all apps |

---

## 10. Database Schema

> **Design goal:** support 500+ brands, 10 000+ device models, and millions of IR codes — while remaining fast on a $150 Android phone with an offline-first architecture.

### 10.1 Three-Layer Model

```
┌──────────────────────────────────────────────────────────────────┐
│  Layer 1 — Static Device Catalog                                 │
│  (Read-only · bundled JSON + device-db API · cached in SQLite)   │
│                                                                  │
│  Brand → DeviceModel → CommandDefinition                         │
│                      └─ CatalogLayout                            │
└──────────────────────────────────────────────────────────────────┘
              ↑ referenced by FK model_id
┌──────────────────────────────────────────────────────────────────┐
│  Layer 2 — User Data                                             │
│  (Mutable · local SQLite · cloud-synced via cloud-sdk/sync.ts)   │
│                                                                  │
│  Home → Room → UserDevice                                        │
│                  ├─ CustomCommandOverride   (per-button tweak)   │
│                  └─ CustomLayout            (custom grid)        │
│  UserMacro → UserMacroStep[]                                     │
└──────────────────────────────────────────────────────────────────┘
              ↑ resolved from codeset_id
┌──────────────────────────────────────────────────────────────────┐
│  Layer 3 — IR Code Library                                       │
│  (Read-only · separate bundled .db snapshot)                     │
│                                                                  │
│  IRBrand → IRCodeset → IRCode[]                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

### 10.2 Layer 1 — Static Device Catalog

#### `brands`
| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | Stable slug, e.g. `'samsung'` |
| `name` | TEXT | Display name, e.g. `'Samsung'` |
| `slug` | TEXT UNIQUE | URL-safe, e.g. `'samsung'` |
| `logo_uri` | TEXT? | Local asset or HTTPS URL |
| `country` | TEXT? | ISO 3166-1 alpha-2, e.g. `'KR'` |
| `website` | TEXT? | Brand homepage |
| `canonical_id` | TEXT? | FK → `brands.id` — alias deduplication |
| `created_at` | INTEGER | Unix timestamp (s) |
| `updated_at` | INTEGER | Unix timestamp (s) |

> **Why `canonical_id`?**  Open-source datasets spell brand names inconsistently ("SAMSUNG", "Samsung Electronics", "Samsung TV"). All aliases point to one canonical record, so UI queries only show the canonical brand.

---

#### `device_models`
| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | `'<brand>.<slug>[-year]'`, e.g. `'samsung.qled-qn85b-2022'` |
| `brand_id` | TEXT FK | → `brands.id` |
| `model_number` | TEXT | Official model number, e.g. `'QN85B'` |
| `model_name` | TEXT | Human name, e.g. `'QLED 85" QN85B'` |
| `category` | TEXT | `tv \| ac \| speaker \| light \| fan \| projector \| soundbar \| set_top_box \| streaming_stick \| receiver \| dvd_bluray \| hub \| other` |
| `year_from` | INTEGER? | First model year (inclusive) |
| `year_to` | INTEGER? | Last model year. NULL = still current. |
| `protocols` | TEXT | JSON array (ordered; first = preferred) |
| `capabilities` | TEXT | JSON array of `DeviceCapability` |
| `thumbnail_uri` | TEXT? | |
| `source` | TEXT | `official \| irdb \| flipper \| community \| manual` |
| `catalog_version` | TEXT? | Opaque version tag for OTA updates |
| `created_at` | INTEGER | |
| `updated_at` | INTEGER | |

**Index:** `(brand_id, category)` — fast brand+category filtering in discovery

---

#### `command_definitions`
| Column | Type | Protocol | Description |
|---|---|---|---|
| `id` | TEXT PK | — | `'<model_id>.<cmd_name>'` |
| `model_id` | TEXT? FK | — | → `device_models.id`. NULL = brand-level generic |
| `brand_id` | TEXT? FK | — | → `brands.id`. Required when `model_id` is NULL |
| `name` | TEXT | — | Machine key, e.g. `'power_on'`, `'vol_up'` |
| `label` | TEXT | — | Display, e.g. `'Power On'` |
| `icon` | TEXT? | — | SF Symbol / Material icon name |
| `capability` | TEXT? | — | High-level grouping |
| `sort_order` | INTEGER? | — | Within capability group |
| `ir_pronto` | TEXT? | IR | Pronto Hex string |
| `ir_raw` | TEXT? | IR | JSON `{frequency, pattern[]}` |
| `ir_frequency` | INTEGER? | IR | Hz (default 38 000) |
| `ir_protocol` | TEXT? | IR | `'NEC' \| 'RC5' \| 'Samsung32' \| ...` |
| `wifi_method` | TEXT? | Wi-Fi | `'POST' \| 'GET' \| 'WS'` |
| `wifi_endpoint` | TEXT? | Wi-Fi | Path template, e.g. `'/api/v2/command'` |
| `wifi_payload` | TEXT? | Wi-Fi | JSON body template |
| `wifi_headers` | TEXT? | Wi-Fi | JSON extra headers |
| `ble_service_uuid` | TEXT? | BLE | |
| `ble_char_uuid` | TEXT? | BLE | GATT characteristic UUID |
| `ble_value` | TEXT? | BLE | Base64-encoded write value |
| `ble_write_type` | TEXT? | BLE | `'withResponse' \| 'withoutResponse'` |
| `matter_cluster` | INTEGER? | Matter | Cluster ID |
| `matter_command` | INTEGER? | Matter | Command ID |
| `matter_payload` | TEXT? | Matter | JSON payload |
| `matter_endpoint` | INTEGER? | Matter | Default 1 |
| `homekit_service` | TEXT? | HomeKit | e.g. `'Thermostat'` |
| `homekit_characteristic` | TEXT? | HomeKit | e.g. `'CurrentTemperature'` |
| `homekit_value` | TEXT? | HomeKit | JSON-serialised value |

**Index:** `(model_id, name)` — primary lookup path for `CommandDispatcher`

> **Per-command multi-protocol storage** means the dispatcher tries columns in order — never needs a secondary join.

---

#### `catalog_layouts`
| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | e.g. `'samsung.tv.default'` |
| `model_id` | TEXT? FK | → `device_models.id`. NULL = shared/generic |
| `category` | TEXT? | Category fallback when `model_id` is NULL |
| `brand_id` | TEXT? FK | → `brands.id`. NULL = universal |
| `name` | TEXT | Display name |
| `columns` | INTEGER | Grid columns (typically 4–6) |
| `sections_json` | TEXT | JSON `RemoteLayoutSection[]` |
| `is_default` | INTEGER | `1` = default layout for this model/category |
| `created_at` | INTEGER | |
| `updated_at` | INTEGER | |

**Resolution order:** model-specific `is_default` → brand+category → universal category

---

### 10.3 Layer 2 — User Data

#### `homes`
| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | UUID v4 (client-generated) |
| `name` | TEXT | e.g. `'Nhà Hà Nội'` |
| `timezone` | TEXT? | IANA, e.g. `'Asia/Ho_Chi_Minh'` |
| `icon` | TEXT? | Icon name |
| `sort_order` | INTEGER | |
| `synced_at` | INTEGER? | Last cloud sync timestamp |
| `created_at` | INTEGER | |
| `updated_at` | INTEGER | |

---

#### `rooms`
| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | UUID v4 |
| `home_id` | TEXT FK | → `homes.id` |
| `name` | TEXT | e.g. `'Phòng khách'` |
| `icon` | TEXT? | e.g. `'sofa'`, `'bed'`, `'restaurant'` |
| `sort_order` | INTEGER | |
| `created_at` | INTEGER | |
| `updated_at` | INTEGER | |

---

#### `user_devices`
| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | UUID v4 |
| `room_id` | TEXT FK | → `rooms.id` |
| `model_id` | TEXT? FK | → `device_models.id`. NULL = fully manual |
| `nickname` | TEXT? | User-assigned, e.g. `'Samsung TV Phòng khách'` |
| `category` | TEXT | Cached from catalog for fast queries |
| `ip_address` | TEXT? | |
| `mac_address` | TEXT? | e.g. `'A4:C3:F0:...'` |
| `ble_address` | TEXT? | |
| `discovery_id` | TEXT? | UDN/UUID for re-identification after IP change |
| `preferred_protocol` | TEXT? | Overrides `DeviceModel.protocols[0]` |
| `wifi_port` | INTEGER? | |
| `wifi_auth_token` | TEXT? | Encrypted via device keychain |
| `matter_fabric_id` | TEXT? | |
| `ir_hub_id` | TEXT? FK | → `user_devices.id` of IR hub; NULL = phone IR |
| `is_online` | INTEGER | `0 \| 1` |
| `last_seen_at` | INTEGER? | |
| `sort_order` | INTEGER | |
| `created_at` | INTEGER | |
| `updated_at` | INTEGER | |

**Index:** `(room_id, category)` — home screen device list by room

---

#### `custom_command_overrides`
| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | UUID v4 |
| `user_device_id` | TEXT FK | → `user_devices.id` |
| `command_name` | TEXT | Matches `command_definitions.name` |
| `custom_label` | TEXT? | Replacement display label |
| `ir_pronto` | TEXT? | User-captured Pronto Hex |
| `ir_raw` | TEXT? | User-captured raw pattern JSON |
| `wifi_payload` | TEXT? | |
| `ble_value` | TEXT? | |
| `matter_payload` | TEXT? | |
| `is_hidden` | INTEGER | `1` = hide from all layouts |
| `created_at` | INTEGER | |
| `updated_at` | INTEGER | |

**Read merge logic** (in `CommandDispatcher.resolveCommand`):
```
override.ir_pronto ?? catalog.ir_pronto
override.wifi_payload ?? catalog.wifi_payload
...
```

---

#### `user_macros`
| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | UUID v4 |
| `name` | TEXT | e.g. `'Movie Night'` |
| `icon` | TEXT? | |
| `sort_order` | INTEGER | |
| `created_at` | INTEGER | |
| `updated_at` | INTEGER | |

#### `user_macro_steps`
| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | UUID v4 |
| `macro_id` | TEXT FK | → `user_macros.id` |
| `step_order` | INTEGER | 0-based execution index |
| `user_device_id` | TEXT FK | → `user_devices.id` |
| `command_name` | TEXT | e.g. `'power_on'` |
| `command_value` | TEXT? | Optional dynamic value |
| `delay_after_ms` | INTEGER | Wait before next step (default 300) |
| `repeat_count` | INTEGER | Default 1 |

---

#### `custom_layouts`
| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | UUID v4 |
| `user_device_id` | TEXT FK | → `user_devices.id` |
| `name` | TEXT | e.g. `'Compact Layout'` |
| `columns` | INTEGER | |
| `sections_json` | TEXT | JSON `RemoteLayoutSection[]` |
| `is_active` | INTEGER | `1` = current layout for this device |
| `created_at` | INTEGER | |
| `updated_at` | INTEGER | |

---

### 10.4 Layer 3 — IR Code Library

#### `ir_brands`
| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | e.g. `'irdb:samsung'` |
| `name` | TEXT | Name as it appears in source, e.g. `'SAMSUNG'` |
| `category` | TEXT | Device category |
| `catalog_brand_id` | TEXT? FK | → `brands.id` once matched |
| `source` | TEXT | `irdb \| flipper \| gc \| pronto_db \| manual` |
| `priority` | INTEGER | Higher = preferred source |
| `code_count` | INTEGER | Cached total codes |
| `imported_at` | INTEGER | |

#### `ir_codesets`
| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | e.g. `'irdb:samsung:tv:00042'` |
| `brand_id` | TEXT FK | → `ir_brands.id` |
| `model_pattern` | TEXT? | Glob matching model numbers; NULL = all models |
| `catalog_model_id` | TEXT? FK | → `device_models.id` once matched |
| `match_confidence` | REAL | 0.0–1.0 |
| `protocol_name` | TEXT? | `'NEC' \| 'RC5' \| 'Samsung32' \| 'RAW' \| ...` |
| `carrier_frequency_hz` | INTEGER | Default 38 000 |
| `source` | TEXT | |
| `source_id` | TEXT? | Deduplication key from source dataset |
| `imported_at` | INTEGER | |

#### `ir_codes`
| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | UUID v4 |
| `codeset_id` | TEXT FK | → `ir_codesets.id` |
| `function_name` | TEXT | Normalised `UPPER_SNAKE_CASE`, e.g. `'POWER_ON'` |
| `function_label` | TEXT? | Raw label from dataset |
| `function_category` | TEXT? | e.g. `'power'`, `'volume'` |
| `pronto_hex` | TEXT? | Pronto Hex (preferred) |
| `raw_pattern` | TEXT? | JSON int[] microsecond on/off pairs |
| `raw_frequency_hz` | INTEGER? | Overrides codeset frequency |
| `address` | INTEGER? | Protocol-decoded address |
| `command` | INTEGER? | Protocol-decoded command |
| `bit_count` | INTEGER? | |

**Import scale:** IRDB contains ~570 000 IR codes across ~1 300 brands.
Stored in a bundled read-only `irdb.db` SQLite file (~12 MB compressed), loaded lazily when the user selects a brand that isn't in the main catalog.

---

### 10.5 Entity Relationship Diagram (ERD)

```
brands ──────────< device_models >──────────< command_definitions
   │                    │                            │
   │                    └───────< catalog_layouts    │
   │                                                 │
ir_brands ──< ir_codesets >──< ir_codes              │
                 │                                   │
                 └── match_confidence ───────── device_models

homes >──────< rooms >──────< user_devices >─────────────────────
                                    │                            │
                                    │◄── model_id (FK) ──────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
        custom_command_overrides  custom_layouts  (ir_hub_id → self)

user_macros >──────< user_macro_steps >──────── user_devices
```

---

### 10.6 Storage Technology

| Layer | Technology | Rationale |
|---|---|---|
| **User Data (Layer 2)** | `expo-sqlite` (built-in SDK 50+) | No ejection, WAL mode, prepared statements |
| **Static Catalog (Layer 1)** | JSON bundles per brand (lazy) + SQLite cache | Brand JSON ~50 KB; load on first touch |
| **IR Library (Layer 3)** | Bundled read-only `irdb.db` (~12 MB) | One-time `expo-asset` copy on first launch |
| **Cloud Sync** | `cloud-sdk/sync.ts` → Supabase | Layer 2 homes/rooms/devices/macros synced |
| **State (runtime)** | Zustand store | Loaded from SQLite on mount; mutations write-through |

#### SQLite initialisation (Layer 2)
```typescript
// packages/core/src/db/schema.ts
import * as SQLite from 'expo-sqlite';

export async function initUserDatabase(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS homes (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      timezone TEXT, icon TEXT,
      sort_order INTEGER DEFAULT 0,
      synced_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY, home_id TEXT NOT NULL,
      name TEXT NOT NULL, icon TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_devices (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL, model_id TEXT,
      nickname TEXT, category TEXT NOT NULL,
      ip_address TEXT, mac_address TEXT, ble_address TEXT,
      discovery_id TEXT, preferred_protocol TEXT,
      wifi_port INTEGER, wifi_auth_token TEXT,
      matter_fabric_id TEXT, ir_hub_id TEXT,
      is_online INTEGER DEFAULT 0,
      last_seen_at INTEGER, sort_order INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_user_devices_room
      ON user_devices(room_id, category);

    CREATE TABLE IF NOT EXISTS custom_command_overrides (
      id TEXT PRIMARY KEY,
      user_device_id TEXT NOT NULL, command_name TEXT NOT NULL,
      custom_label TEXT, ir_pronto TEXT, ir_raw TEXT,
      wifi_payload TEXT, ble_value TEXT, matter_payload TEXT,
      is_hidden INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_device_id) REFERENCES user_devices(id) ON DELETE CASCADE,
      UNIQUE (user_device_id, command_name)
    );

    CREATE TABLE IF NOT EXISTS user_macros (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL, icon TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_macro_steps (
      id TEXT PRIMARY KEY,
      macro_id TEXT NOT NULL, step_order INTEGER NOT NULL,
      user_device_id TEXT NOT NULL, command_name TEXT NOT NULL,
      command_value TEXT, delay_after_ms INTEGER DEFAULT 300,
      repeat_count INTEGER DEFAULT 1,
      FOREIGN KEY (macro_id) REFERENCES user_macros(id) ON DELETE CASCADE,
      FOREIGN KEY (user_device_id) REFERENCES user_devices(id)
    );

    CREATE TABLE IF NOT EXISTS custom_layouts (
      id TEXT PRIMARY KEY,
      user_device_id TEXT NOT NULL, name TEXT NOT NULL,
      columns INTEGER NOT NULL, sections_json TEXT NOT NULL,
      is_active INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_device_id) REFERENCES user_devices(id) ON DELETE CASCADE
    );
  `);
}
```

---

### 10.7 Catalog Loading Strategy

```
App launch
    │
    ├─ Load bundled seed catalog (top 20 brands, JSON in assets/)
    │    → insert into SQLite `device_models` + `command_definitions`
    │
    ├─ Background fetch: device-db API /brands/{slug}
    │    → upsert rows, update catalog_version
    │
    └─ On demand (user searches brand X not cached):
         → GET /api/device-db/brand/X
         → cache in SQLite
         → display results
```

#### Brand bundle structure (`device-sdk/samsung/index.ts` pattern)
```
assets/catalog/
  samsung.json       (~80 KB: 5 models × 40 commands × all protocols)
  lg.json
  daikin.json
  sony.json
  ...
  _manifest.json     (brand list + version checksums for incremental update)
```

---

### 10.8 Scaling to 500+ Brands

| Challenge | Solution |
|---|---|
| **Brand name deduplication** | `brands.canonical_id` collapses aliases |
| **Partial year matches** | `year_from`/`year_to` range on `device_models` |
| **Generic IR fallback** | `command_definitions.model_id = NULL` with `brand_id` for shared codes |
| **Model-search UX** | FTS5 virtual table on `(model_number, model_name)` |
| **Cold start speed** | Seed only top-20 brands; lazy-load others on demand |
| **IR library size** | Separate `irdb.db`; never loaded unless user picks "IR blaster" mode |
| **Community contributions** | `source = 'community'`; version-controlled JSON in `device-sdk/` |
| **OTA catalog updates** | `catalog_version` check on launch; backend `device-db` serves diffs |
