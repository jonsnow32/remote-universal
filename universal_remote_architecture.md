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

| Phase | Focus | Timeline | Deliverables |
|---|---|---|---|
| **Phase 1** | Core Platform | Weeks 1–6 | BaseProtocol + Wi-Fi plugin, Device Registry schema, IR + BLE native modules, UI Kit + ThemeProvider, Basic device discovery |
| **Phase 2** | Brand SDKs | Weeks 7–12 | Samsung / LG / Daikin device-sdk, CommandDispatcher + MacroEngine, Discovery Engine (mDNS + SSDP) |
| **Phase 3** | Brand Apps | Weeks 13–16 | Samsung / LG / Daikin app builds, App Store submissions, OTA config service |
| **Phase 4** | Platform+ | Weeks 17–20 | HomeKit + Matter support, AI voice command layer, Universal flagship app, Tenant licensing portal, New brand onboarding < 1 week |
