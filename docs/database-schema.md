# Database Schema Reference

> All database schemas, data models, and API payload types used across the Remote Universal platform.

**Storage layers:**
- **SQLite (on-device)** — `expo-sqlite`, offline-first, synced to cloud
- **Supabase (cloud)** — Auth, real-time sync, tenant management
- **IR Library DB** — Separate bundled SQLite snapshot (read-only)

---

## Table of Contents

1. [Three-Layer Model](#1-three-layer-model)
2. [Layer 1 — Static Device Catalog (SQLite, read-only)](#2-layer-1--static-device-catalog)
   - [brands](#brands)
   - [device_models](#device_models)
   - [command_definitions](#command_definitions)
   - [catalog_layouts](#catalog_layouts)
3. [Layer 2 — User Data (SQLite, mutable)](#3-layer-2--user-data)
   - [homes](#homes)
   - [rooms](#rooms)
   - [user_devices](#user_devices)
   - [custom_command_overrides](#custom_command_overrides)
   - [user_macros](#user_macros)
   - [user_macro_steps](#user_macro_steps)
   - [custom_layouts](#custom_layouts)
4. [Layer 3 — IR Code Library (SQLite, read-only)](#4-layer-3--ir-code-library)
   - [ir_brands](#ir_brands)
   - [ir_codesets](#ir_codesets)
   - [ir_codes](#ir_codes)
   - [ir_import_batches](#ir_import_batches)
5. [Cloud / API Types](#5-cloud--api-types)
   - [RegisteredDevice](#registereddevice)
   - [TenantConfig](#tenantconfig)
   - [OTAUpdate](#otaupdate)
6. [TypeScript Interfaces Quick Reference](#6-typescript-interfaces-quick-reference)
7. [Indexes Summary](#7-indexes-summary)

---

## 1. Three-Layer Model

```
┌──────────────────────────────────────────────────────────────────┐
│  Layer 1 — Static Device Catalog                                 │
│  (Read-only · bundled JSON + device-db API · cached in SQLite)   │
│                                                                  │
│  brands → device_models → command_definitions                    │
│                         └─ catalog_layouts                       │
└──────────────────────────────────────────────────────────────────┘
              ↑ referenced by FK model_id
┌──────────────────────────────────────────────────────────────────┐
│  Layer 2 — User Data                                             │
│  (Mutable · local SQLite · cloud-synced via cloud-sdk/sync.ts)   │
│                                                                  │
│  homes → rooms → user_devices                                    │
│                    ├─ custom_command_overrides                   │
│                    └─ custom_layouts                             │
│  user_macros → user_macro_steps                                  │
└──────────────────────────────────────────────────────────────────┘
              ↑ resolved from codeset_id
┌──────────────────────────────────────────────────────────────────┐
│  Layer 3 — IR Code Library                                       │
│  (Read-only · separate bundled .db snapshot)                     │
│                                                                  │
│  ir_brands → ir_codesets → ir_codes                              │
│  ir_import_batches  (import metadata)                            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Layer 1 — Static Device Catalog

Bundled with the app and optionally updated via the `device-db` backend service. Cached in a local SQLite database. Never user-modified.

Source: `packages/core/src/db/catalogSchema.ts` · Types: `packages/core/src/types/Catalog.ts`

---

### `brands`

A device manufacturer / brand. Aliases point to a canonical record via `canonical_id`.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK | Stable slug, e.g. `'samsung'` |
| `name` | TEXT | NOT NULL | Display name, e.g. `'Samsung'` |
| `slug` | TEXT | NOT NULL UNIQUE | URL-safe slug, e.g. `'samsung'` |
| `logo_uri` | TEXT | | Local asset URI or HTTPS URL |
| `country` | TEXT | | ISO 3166-1 alpha-2, e.g. `'KR'` |
| `website` | TEXT | | Brand homepage URL |
| `canonical_id` | TEXT | FK → `brands.id` | Alias deduplication — all alias records point to the primary |
| `created_at` | INTEGER | NOT NULL | Unix timestamp (seconds) |
| `updated_at` | INTEGER | NOT NULL | Unix timestamp (seconds) |

> **Why `canonical_id`?** Open-source IR datasets spell brand names inconsistently ("SAMSUNG", "Samsung Electronics"). Aliases all point to one canonical record so the UI only shows the primary brand.

---

### `device_models`

A specific device model from a brand. One record covers a model line that spans multiple years when the command set is identical.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK | `'<brand>.<slug>[-year]'`, e.g. `'samsung.qled-qn85b-2022'` |
| `brand_id` | TEXT | FK → `brands.id` ON DELETE CASCADE | Parent brand |
| `model_number` | TEXT | NOT NULL | Official model number, e.g. `'QN85B'` |
| `model_name` | TEXT | NOT NULL | Human-readable name, e.g. `'QLED 85" QN85B'` |
| `category` | TEXT | NOT NULL | See [Device Categories](#device-categories) |
| `year_from` | INTEGER | | First model year (inclusive) |
| `year_to` | INTEGER | | Last model year. `NULL` = still current |
| `protocols` | TEXT | NOT NULL DEFAULT `'[]'` | JSON array of `SupportedProtocol[]`, ordered — first = preferred |
| `capabilities` | TEXT | NOT NULL DEFAULT `'[]'` | JSON array of `DeviceCapability[]` |
| `thumbnail_uri` | TEXT | | Product image URI |
| `source` | TEXT | NOT NULL DEFAULT `'community'` | `official \| irdb \| flipper \| community \| manual` |
| `catalog_version` | TEXT | | Opaque version tag for OTA catalog updates |
| `created_at` | INTEGER | NOT NULL | Unix timestamp (seconds) |
| `updated_at` | INTEGER | NOT NULL | Unix timestamp (seconds) |

**Indexes:**
- `idx_device_models_brand_category` on `(brand_id, category)` — fast brand + category filtering
- `idx_device_models_model_number` on `(model_number)`
- `device_models_fts` — FTS5 virtual table on `model_number`, `model_name` for full-text search

**Device Categories (`category` column):**

| Value | Description |
|---|---|
| `tv` | Television |
| `ac` | Air conditioner |
| `speaker` | Speaker / soundbar |
| `light` | Smart light |
| `fan` | Fan |
| `projector` | Projector |
| `set_top_box` | Set-top box / satellite receiver |
| `streaming_stick` | Streaming stick (Fire TV, Chromecast) |
| `soundbar` | Soundbar |
| `receiver` | AV receiver |
| `dvd_bluray` | DVD / Blu-ray player |
| `hub` | Smart home hub |
| `other` | Uncategorised |

---

### `command_definitions`

A single controllable command for a device model (or brand-level generic). Stores per-protocol payloads in the same row — the `CommandDispatcher` tries columns in order without needing a secondary join.

A command may belong to a **specific model** (`model_id` set) or be a **brand-level generic** (`model_id` null, `brand_id` set).

| Column | Type | Protocol | Description |
|---|---|---|---|
| `id` | TEXT PK | — | `'<model_id>.<cmd_name>'`, e.g. `'samsung.qled-qn85b-2022.power_on'` |
| `model_id` | TEXT FK? | — | → `device_models.id`. `NULL` = brand-level generic |
| `brand_id` | TEXT FK? | — | → `brands.id`. Required when `model_id` is `NULL` |
| `name` | TEXT NOT NULL | — | Machine key, e.g. `'power_on'`, `'vol_up'` |
| `label` | TEXT NOT NULL | — | Display text, e.g. `'Power On'` |
| `icon` | TEXT? | — | SF Symbol / Material icon name |
| `capability` | TEXT? | — | High-level grouping (see `DeviceCapability`) |
| `sort_order` | INTEGER DEFAULT 0 | — | Within capability group |
| `ir_pronto` | TEXT? | IR | Pronto Hex string |
| `ir_raw` | TEXT? | IR | JSON `{frequency, pattern[]}` |
| `ir_frequency` | INTEGER? | IR | Hz (default 38 000) |
| `ir_protocol` | TEXT? | IR | `'NEC' \| 'RC5' \| 'Samsung32' \| ...` |
| `wifi_method` | TEXT? | Wi-Fi | `'POST' \| 'GET' \| 'WS'` |
| `wifi_endpoint` | TEXT? | Wi-Fi | Path template, e.g. `'/api/v2/command'` |
| `wifi_payload` | TEXT? | Wi-Fi | JSON body template |
| `wifi_headers` | TEXT? | Wi-Fi | JSON extra headers object |
| `ble_service_uuid` | TEXT? | BLE | GATT service UUID |
| `ble_char_uuid` | TEXT? | BLE | GATT characteristic UUID |
| `ble_value` | TEXT? | BLE | Base64-encoded write value |
| `ble_write_type` | TEXT? | BLE | `'withResponse' \| 'withoutResponse'` |
| `matter_cluster` | INTEGER? | Matter | Cluster ID (decimal) |
| `matter_command` | INTEGER? | Matter | Command ID (decimal) |
| `matter_payload` | TEXT? | Matter | JSON command payload |
| `matter_endpoint` | INTEGER? DEFAULT 1 | Matter | Endpoint number |
| `homekit_service` | TEXT? | HomeKit | e.g. `'Thermostat'`, `'Lightbulb'` |
| `homekit_characteristic` | TEXT? | HomeKit | e.g. `'CurrentTemperature'`, `'On'` |
| `homekit_value` | TEXT? | HomeKit | JSON-serialised characteristic value |

**Constraint:** `CHECK (model_id IS NOT NULL OR brand_id IS NOT NULL)`

**Indexes:**
- `idx_command_definitions_model_name` on `(model_id, name)` — primary lookup for `CommandDispatcher`
- `idx_command_definitions_brand_name` on `(brand_id, name) WHERE model_id IS NULL` — brand-level generic lookup

---

### `catalog_layouts`

A remote control button grid layout stored in the catalog. Can be model-specific, brand+category, or universal.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK | e.g. `'samsung.tv.default'` |
| `model_id` | TEXT | FK → `device_models.id` ON DELETE CASCADE | Specific model. `NULL` = shared layout |
| `brand_id` | TEXT | FK → `brands.id` | Brand scope. `NULL` = universal |
| `category` | TEXT | | Device category when `model_id` is null |
| `name` | TEXT | NOT NULL | Descriptive name, e.g. `'Default TV Remote'` |
| `columns` | INTEGER | NOT NULL DEFAULT 4 | Grid column count (typically 4–6) |
| `sections_json` | TEXT | NOT NULL DEFAULT `'[]'` | JSON-serialised `RemoteLayoutSection[]` |
| `is_default` | INTEGER | NOT NULL DEFAULT 0 | Boolean — is this the default layout for its scope? |
| `created_at` | INTEGER | NOT NULL | Unix timestamp (seconds) |
| `updated_at` | INTEGER | NOT NULL | Unix timestamp (seconds) |

**Layout resolution priority** (first match wins):
1. Model-specific layout (`model_id` matches)
2. Brand + category layout (`brand_id` + `category` matches)
3. Universal category layout (`category` matches, `brand_id` null)

---

## 3. Layer 2 — User Data

Mutable, per-user data stored in local SQLite and cloud-synced via `packages/cloud-sdk/src/sync.ts`.

Source: `packages/core/src/db/userDataSchema.ts` · Types: `packages/core/src/types/UserData.ts`

---

### `homes`

Top-level grouping for a physical dwelling. Each user can have multiple homes.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK | UUID v4 |
| `name` | TEXT | NOT NULL | Display name, e.g. `'Nhà Hà Nội'` |
| `timezone` | TEXT | | IANA timezone, e.g. `'Asia/Ho_Chi_Minh'` |
| `icon` | TEXT | | Icon name (SF Symbols / Material Icons) |
| `sort_order` | INTEGER | DEFAULT 0 | Sort position in the home list |
| `synced_at` | INTEGER | | Unix timestamp (seconds) of last cloud sync |
| `created_at` | INTEGER | NOT NULL | Unix timestamp (seconds) |
| `updated_at` | INTEGER | NOT NULL | Unix timestamp (seconds) |

---

### `rooms`

An area inside a home. Devices are assigned to rooms.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK | UUID v4 |
| `home_id` | TEXT | NOT NULL FK → `homes.id` ON DELETE CASCADE | Parent home |
| `name` | TEXT | NOT NULL | Display name, e.g. `'Phòng khách'` |
| `icon` | TEXT | | Icon name, e.g. `'sofa'`, `'bed'`, `'tv'` |
| `sort_order` | INTEGER | DEFAULT 0 | Sort position within the home |
| `created_at` | INTEGER | NOT NULL | Unix timestamp (seconds) |
| `updated_at` | INTEGER | NOT NULL | Unix timestamp (seconds) |

---

### `user_devices`

A user-paired device instance. Links to the static catalog via `model_id`. Network and auth fields are stored here because they are per-instance (two users with the same TV model have different IP addresses).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK | UUID v4 |
| `room_id` | TEXT | NOT NULL FK → `rooms.id` ON DELETE CASCADE | Containing room |
| `model_id` | TEXT | | FK → `device_models.id` in catalog. `NULL` = manually added |
| `nickname` | TEXT | | User-assigned name. Falls back to `model_name` |
| `category` | TEXT | NOT NULL | Cached category for fast queries (avoids JOIN) |
| `ip_address` | TEXT | | IPv4 / IPv6, e.g. `'192.168.1.42'` |
| `mac_address` | TEXT | | MAC address, e.g. `'A4:C3:F0:...'` |
| `ble_address` | TEXT | | BLE device address / UUID |
| `discovery_id` | TEXT | | UDN / UUID from SSDP or mDNS — re-identifies device after IP change |
| `preferred_protocol` | TEXT | | Override protocol (`ir \| wifi \| ble \| homekit \| matter`). `NULL` = use catalog default |
| `wifi_port` | INTEGER | | HTTP port (default: 80 or model-specific) |
| `wifi_auth_token` | TEXT | | Encrypted auth token (SmartThings Bearer, LG ThinQ, etc.) |
| `matter_fabric_id` | TEXT | | Matter fabric ID string |
| `ir_hub_id` | TEXT | | FK → `user_devices.id` of an IR hub. `NULL` = use phone's IR blaster |
| `is_online` | INTEGER | DEFAULT 0 | Boolean — reachable at last check |
| `last_seen_at` | INTEGER | | Unix timestamp (seconds) of last successful command |
| `sort_order` | INTEGER | DEFAULT 0 | Sort position within the room |
| `created_at` | INTEGER | NOT NULL | Unix timestamp (seconds) |
| `updated_at` | INTEGER | NOT NULL | Unix timestamp (seconds) |

**Index:** `idx_user_devices_room` on `(room_id, category)`

> **Security note:** `wifi_auth_token` must be encrypted at rest using the device keychain (iOS Keychain / Android Keystore) before writing to SQLite.

---

### `custom_command_overrides`

Overrides or extends a catalog command for a specific user device. Only non-null fields replace the matching `CommandDefinition`. Allows users to re-capture their own IR code for a button without changing the shared catalog entry.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK | UUID v4 |
| `user_device_id` | TEXT | NOT NULL FK → `user_devices.id` ON DELETE CASCADE | Target device |
| `command_name` | TEXT | NOT NULL | Matches `command_definitions.name`, e.g. `'power_on'` |
| `custom_label` | TEXT | | Replacement display label |
| `ir_pronto` | TEXT | | Replacement Pronto Hex |
| `ir_raw` | TEXT | | Replacement raw IR pattern JSON |
| `wifi_payload` | TEXT | | Replacement Wi-Fi JSON payload |
| `ble_value` | TEXT | | Replacement BLE base64 value |
| `matter_payload` | TEXT | | Replacement Matter JSON payload |
| `is_hidden` | INTEGER | DEFAULT 0 | Boolean — if `1`, hides this button from all layouts |
| `created_at` | INTEGER | NOT NULL | Unix timestamp (seconds) |
| `updated_at` | INTEGER | NOT NULL | Unix timestamp (seconds) |

**Constraint:** `UNIQUE (user_device_id, command_name)` — one override per command per device

---

### `user_macros`

A user-created macro — a named, ordered sequence of commands across one or more devices.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK | UUID v4 |
| `name` | TEXT | NOT NULL | Display name, e.g. `'Movie Night'` |
| `icon` | TEXT | | Icon name for the macro tile |
| `sort_order` | INTEGER | DEFAULT 0 | Sort position in the macros list |
| `created_at` | INTEGER | NOT NULL | Unix timestamp (seconds) |
| `updated_at` | INTEGER | NOT NULL | Unix timestamp (seconds) |

---

### `user_macro_steps`

Individual steps within a `user_macros` entry. Steps execute sequentially with configurable delays.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK | UUID v4 |
| `macro_id` | TEXT | NOT NULL FK → `user_macros.id` ON DELETE CASCADE | Parent macro |
| `step_order` | INTEGER | NOT NULL | 0-based execution order |
| `user_device_id` | TEXT | NOT NULL FK → `user_devices.id` | Target device for this step |
| `command_name` | TEXT | NOT NULL | Command to execute, e.g. `'power_on'` |
| `command_value` | TEXT | | Optional free-form value, e.g. `'25'` for temperature |
| `delay_after_ms` | INTEGER | DEFAULT 300 | Milliseconds to wait after this step |
| `repeat_count` | INTEGER | DEFAULT 1 | How many times to repeat this step |

---

### `custom_layouts`

A user-customised remote button grid layout for a specific paired device. When `is_active` is `1`, this layout replaces the catalog default.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK | UUID v4 |
| `user_device_id` | TEXT | NOT NULL FK → `user_devices.id` ON DELETE CASCADE | Target device |
| `name` | TEXT | NOT NULL | Display name, e.g. `'My Compact Layout'` |
| `columns` | INTEGER | NOT NULL | Grid column count (typically 4–6) |
| `sections_json` | TEXT | NOT NULL | JSON-serialised `RemoteLayoutSection[]` |
| `is_active` | INTEGER | DEFAULT 0 | Boolean — `1` if this layout is currently active |
| `created_at` | INTEGER | NOT NULL | Unix timestamp (seconds) |
| `updated_at` | INTEGER | NOT NULL | Unix timestamp (seconds) |

---

## 4. Layer 3 — IR Code Library

Separate bundled SQLite snapshot (`ir_library.db`). Read-only at runtime. Updated via `ir_import_batches` during app updates or OTA pushes.

Source: `packages/core/src/db/irLibrarySchema.ts` · Types: `packages/core/src/types/IRLibrary.ts`

---

### `ir_brands`

A brand entry within the IR dataset. Separate from `brands` in Layer 1 — linked via `catalog_brand_id` once matched.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK | e.g. `'irdb:samsung'` |
| `name` | TEXT | NOT NULL | Brand name as it appears in the source dataset, e.g. `'SAMSUNG'` |
| `category` | TEXT | NOT NULL | Device category this entry covers |
| `catalog_brand_id` | TEXT | | FK → `brands.id` in catalog. `NULL` until matched |
| `source` | TEXT | NOT NULL | `'irdb' \| 'flipper' \| 'gc' \| 'pronto_db' \| 'manual'` |
| `priority` | INTEGER | NOT NULL DEFAULT 0 | Higher = preferable (more complete / reliable) |
| `code_count` | INTEGER | NOT NULL DEFAULT 0 | Cached count of `ir_codes` rows under this brand |
| `imported_at` | INTEGER | NOT NULL | Unix timestamp (seconds) of import |

**Indexes:**
- `idx_ir_brands_catalog_brand` on `(catalog_brand_id)`
- `idx_ir_brands_source_category` on `(source, category)`

---

### `ir_codesets`

A group of IR codes that applies to a range of models within a brand. `model_pattern` is a glob-style string for model number matching.

**Codeset resolution priority** (best match for a model):
1. Exact `model_pattern` match
2. Highest `match_confidence`
3. Highest `ir_brands.priority`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK | e.g. `'irdb:samsung:tv:00042'` |
| `brand_id` | TEXT | NOT NULL FK → `ir_brands.id` ON DELETE CASCADE | Parent IR brand |
| `model_pattern` | TEXT | | Glob: `NULL`/`'*'` = all models; `'QN*'` = prefix; `'QN85B'` = exact |
| `catalog_model_id` | TEXT | | FK → `device_models.id` once matched |
| `match_confidence` | REAL | NOT NULL DEFAULT 0.0 | 0.0–1.0 confidence score. 1.0 = OEM-confirmed |
| `protocol_name` | TEXT | | `'NEC' \| 'RC5' \| 'RC6' \| 'Samsung32' \| 'RAW'` |
| `carrier_frequency_hz` | INTEGER | NOT NULL DEFAULT 38000 | Carrier frequency in Hz |
| `source` | TEXT | NOT NULL | Source dataset identifier |
| `source_id` | TEXT | | Opaque ID from source for deduplication |
| `imported_at` | INTEGER | NOT NULL | Unix timestamp (seconds) of import |

**Indexes:**
- `idx_ir_codesets_brand` on `(brand_id)`
- `idx_ir_codesets_catalog_model` on `(catalog_model_id)`
- `idx_ir_codesets_confidence` on `(brand_id, match_confidence DESC)`

---

### `ir_codes`

Individual IR code entries within a codeset. At least one of `pronto_hex` or `raw_pattern` must be non-null. Pronto Hex is the preferred transmission format.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK | UUID v4 (generated on import) |
| `codeset_id` | TEXT | NOT NULL FK → `ir_codesets.id` ON DELETE CASCADE | Parent codeset |
| `function_name` | TEXT | NOT NULL | Normalised UPPER_SNAKE_CASE, e.g. `'POWER_ON'`, `'VOL_UP'` |
| `function_label` | TEXT | | Display name from source dataset |
| `function_category` | TEXT | | `'power' \| 'volume' \| 'navigation' \| ...` |
| `pronto_hex` | TEXT | | Pronto Hex encoded signal, e.g. `'0000 006D 0022 ...'` |
| `raw_pattern` | TEXT | | JSON `int[]` of microsecond on/off durations |
| `raw_frequency_hz` | INTEGER | | Carrier frequency override (falls back to codeset) |
| `address` | INTEGER | | Protocol-decoded address (NEC / RC5 / RC6 / Samsung32) |
| `ir_command` | INTEGER | | Protocol-decoded command byte |
| `bit_count` | INTEGER | | Protocol frame size in bits |

**Indexes:**
- `idx_ir_codes_codeset` on `(codeset_id)`
- `idx_ir_codes_function` on `(codeset_id, function_name)`

---

### `ir_import_batches`

Tracks each dataset import run for incremental updates and rollback.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK | UUID v4 |
| `source` | TEXT | NOT NULL | `'irdb' \| 'flipper' \| 'gc' \| 'pronto_db' \| 'manual'` |
| `version` | TEXT | NOT NULL | Opaque version tag (git SHA, release name, etc.) |
| `brands_count` | INTEGER | NOT NULL DEFAULT 0 | Number of `ir_brands` rows imported |
| `codesets_count` | INTEGER | NOT NULL DEFAULT 0 | Number of `ir_codesets` rows imported |
| `codes_count` | INTEGER | NOT NULL DEFAULT 0 | Number of `ir_codes` rows imported |
| `is_active` | INTEGER | NOT NULL DEFAULT 0 | Boolean — `1` = currently active snapshot |
| `imported_at` | INTEGER | NOT NULL | Unix timestamp (seconds) |

---

## 5. Cloud / API Types

Types used by `packages/cloud-sdk` and `backend/api`. These represent data transferred over the API and stored in Supabase.

---

### `RegisteredDevice`

Device registered to a user account in the cloud. Returned by `CloudSync.getRegisteredDevices()`.

```typescript
interface RegisteredDevice {
  id:       string;   // Stable device UUID
  address:  string;   // IP or BLE address
  name?:    string;   // Human-readable name
  brand:    string;   // Brand slug, e.g. 'samsung'
  model:    string;   // Model name, e.g. 'QLED QN85B'
}
```

Source: `packages/cloud-sdk/src/sync.ts`

---

### `TenantConfig`

White-label brand configuration returned by the tenant service.

```typescript
interface TenantConfig {
  id:       string;                       // Tenant UUID
  brandId:  string;                       // Brand slug, e.g. 'samsung'
  name:     string;                       // Display name, e.g. 'Samsung Remote'
  features: Record<string, boolean>;      // Feature flags, e.g. { 'ir': true }
  theme:    Record<string, unknown>;      // Brand theme overrides
}
```

Source: `packages/cloud-sdk/src/tenant.ts`

---

### `OTAUpdate`

Over-the-air update payload returned by `OTAService.checkForUpdate()`.

```typescript
interface OTAUpdate {
  version:       string;    // Semantic version, e.g. '2.1.0'
  url:           string;    // Download URL for the update bundle
  checksum:      string;    // Integrity hash of the update bundle
  releaseNotes?: string;    // Human-readable changelog
}
```

Source: `packages/cloud-sdk/src/ota.ts`

---

## 6. TypeScript Interfaces Quick Reference

| Interface | File | Layer | Description |
|---|---|---|---|
| `Brand` | `core/types/Catalog.ts` | 1 | Device manufacturer |
| `DeviceModel` | `core/types/Catalog.ts` | 1 | Specific device model |
| `CommandDefinition` | `core/types/Catalog.ts` | 1 | Single command with per-protocol payloads |
| `CatalogLayout` | `core/types/Catalog.ts` | 1 | Catalog remote button layout |
| `DeviceCategory` | `core/types/Catalog.ts` | 1 | Category enum type |
| `CatalogSource` | `core/types/Catalog.ts` | 1 | Data provenance enum |
| `Home` | `core/types/UserData.ts` | 2 | User's home/dwelling |
| `Room` | `core/types/UserData.ts` | 2 | Room within a home |
| `UserDevice` | `core/types/UserData.ts` | 2 | Paired device instance |
| `CustomCommandOverride` | `core/types/UserData.ts` | 2 | Per-device command override |
| `UserMacro` | `core/types/UserData.ts` | 2 | Named automation sequence |
| `UserMacroStep` | `core/types/UserData.ts` | 2 | Single step in a macro |
| `CustomLayout` | `core/types/UserData.ts` | 2 | User-customised button grid |
| `ResolvedUserDevice` | `core/types/UserData.ts` | 2 | Fully resolved device view (runtime, not stored) |
| `IRBrand` | `core/types/IRLibrary.ts` | 3 | Brand entry in IR dataset |
| `IRCodeset` | `core/types/IRLibrary.ts` | 3 | Group of IR codes for a model range |
| `IRCode` | `core/types/IRLibrary.ts` | 3 | Single IR code entry |
| `IRImportBatch` | `core/types/IRLibrary.ts` | 3 | Import run metadata |
| `DeviceDefinition` | `core/types/Device.ts` | SDK | Device definition in device-sdk |
| `SupportedProtocol` | `core/types/Device.ts` | — | `'ir' \| 'wifi' \| 'ble' \| 'homekit' \| 'matter'` |
| `DeviceCapability` | `core/types/Device.ts` | — | Capability enum type |
| `RegisteredDevice` | `cloud-sdk/sync.ts` | Cloud | Cloud-registered device |
| `TenantConfig` | `cloud-sdk/tenant.ts` | Cloud | White-label brand config |
| `OTAUpdate` | `cloud-sdk/ota.ts` | Cloud | OTA update payload |

---

## 7. Indexes Summary

| Table | Index Name | Columns | Purpose |
|---|---|---|---|
| `device_models` | `idx_device_models_brand_category` | `(brand_id, category)` | Fast brand + category filter |
| `device_models` | `idx_device_models_model_number` | `(model_number)` | Model number lookup |
| `device_models` | `device_models_fts` (FTS5) | `model_number, model_name` | Full-text search |
| `command_definitions` | `idx_command_definitions_model_name` | `(model_id, name)` | Primary dispatch lookup |
| `command_definitions` | `idx_command_definitions_brand_name` | `(brand_id, name) WHERE model_id IS NULL` | Brand-level generic lookup |
| `catalog_layouts` | `idx_catalog_layouts_model` | `(model_id)` | Layout resolution by model |
| `user_devices` | `idx_user_devices_room` | `(room_id, category)` | Device list by room |
| `ir_brands` | `idx_ir_brands_catalog_brand` | `(catalog_brand_id)` | Cross-DB brand linking |
| `ir_brands` | `idx_ir_brands_source_category` | `(source, category)` | Source + category filtering |
| `ir_codesets` | `idx_ir_codesets_brand` | `(brand_id)` | Codesets by brand |
| `ir_codesets` | `idx_ir_codesets_catalog_model` | `(catalog_model_id)` | Link to catalog model |
| `ir_codesets` | `idx_ir_codesets_confidence` | `(brand_id, match_confidence DESC)` | Best-match codeset selection |
| `ir_codes` | `idx_ir_codes_codeset` | `(codeset_id)` | Codes by codeset |
| `ir_codes` | `idx_ir_codes_function` | `(codeset_id, function_name)` | Function name lookup |
