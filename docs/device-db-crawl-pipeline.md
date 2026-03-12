# Device DB — Crawl & Import Pipeline

> How the backend discovers, fetches, parses, normalises, and persists IR codes and device catalog data from online sources into the internal databases.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Online Source Registry](#2-online-source-registry)
3. [Pipeline Architecture](#3-pipeline-architecture)
4. [Stage 1 — Fetch](#4-stage-1--fetch)
5. [Stage 2 — Parse](#5-stage-2--parse)
6. [Stage 3 — Normalise](#6-stage-3--normalise)
7. [Stage 4 — Deduplicate](#7-stage-4--deduplicate)
8. [Stage 5 — Brand & Model Matching](#8-stage-5--brand--model-matching)
9. [Stage 6 — Write (Upsert)](#9-stage-6--write-upsert)
10. [Stage 7 — Snapshot & OTA Publish](#10-stage-7--snapshot--ota-publish)
11. [Incremental Update Strategy](#11-incremental-update-strategy)
12. [Scheduled Jobs](#12-scheduled-jobs)
13. [Error Handling & Rollback](#13-error-handling--rollback)
14. [Data Flow: IR Code Library (Layer 3)](#14-data-flow-ir-code-library-layer-3)
15. [Data Flow: Device Catalog (Layer 1)](#15-data-flow-device-catalog-layer-1)

---

## 1. Overview

The `backend/device-db` service is responsible for keeping the platform's two read-only databases fresh:

| Database | Content | Destination |
|---|---|---|
| **IR Code Library** (Layer 3) | 600k+ IR codes, codesets, brands | Supabase PostgreSQL → bundled SQLite snapshot |
| **Device Catalog** (Layer 1) | Brand metadata, device models, command definitions, layouts | Supabase PostgreSQL → bundled SQLite snapshot |

Apps download these snapshots once at install and update them via the `ota-service`. The pipeline runs scheduled jobs on the backend and never requires any device to be online.

---

## 2. Online Source Registry

### IR Code Sources

| Source ID | Type | URL / Repo | Format | Estimated Size |
|---|---|---|---|---|
| `irdb` | GitHub repo | `github.com/probonopd/irdb` | CSV per brand/category | 570k+ codes |
| `flipper` | GitHub repo | `github.com/flipperdevices/flipperzero-firmware` /assets/infrared | `.ir` key-value files | 50k+ codes |
| `gc` (Global Caché) | HTTP REST API | `irdb.globalcache.com/api/v1` | JSON with Pronto Hex | 200k+ codes |
| `pronto_db` | GitHub archive | `github.com/bengtmartensson/ProntoNG` /config | Pronto Hex text files | 100k+ codes |
| `manual` | On-device capture | Submitted by app users via REST API | Raw `{frequency, pattern[]}` | User-generated |

### Device Catalog Sources

#### Smart TV Cloud APIs (Wi-Fi / proprietary protocols)

| Source ID | Brand | Type | Endpoint / Repo | Protocol | Notes |
|---|---|---|---|---|---|
| `samsung_api` | Samsung | REST API | `api.smartthings.com/v1/devices/presentations` | SmartThings REST | Requires SmartThings API key |
| `lg_api` | LG | REST API | `aic-service.lgthinq.com/v1/service/application/device-type-list` | LG ThinQ (WebOS) | Public endpoint; Bearer token for per-device control |
| `sony_api` | Sony | REST API | `sony BRAVIA developer portal` IRCC-IP + REST | IRCC-IP + DIAL | RequiresBRAVIA IP Control enabled on TV |
| `philips_api` | Philips (TP Vision) | REST API | `jointspace.sourceforge.net` JointSpace API v6 | HTTP/REST | Port 1925; no auth on older models |
| `panasonic_api` | Panasonic | REST API | `github.com/florianl/go-nctrl` NCTRL protocol | HTTP NCTRL | Viera 2012+ models; port 55000 |
| `hisense_api` | Hisense | REST API | `github.com/newAM/hisense-tv` RemoteNow API | HTTP + WebSocket | Port 36669; TLS on newer models |
| `tcl_api` | TCL | REST API | `github.com/nicedoc/tcl-remote` | HTTP REST | Port 4998; Roku OS models use Roku ECP instead |
| `vizio_api` | Vizio | REST API | `github.com/exiva/Vizio_SmartCast_API` SmartCast | HTTPS REST | Port 9000; pairing PIN flow |
| `roku_ecp` | Roku / TCL Roku | REST API | `developer.roku.com/docs/developer-program/debugging/external-control-api.md` ECP | HTTP ECP | Port 8060; no auth; covers all Roku OS TVs |
| `fire_tv` | Amazon Fire TV | ADB / REST | `developer.amazon.com/docs/fire-tv/remote-debugger.html` ADB | ADB TCP | Port 5555; also DIAL for basic control |
| `android_tv` | Any Android TV | ADB + REST | Android Debug Bridge TCP + TV Remote Service API | ADB TCP port 5555 | Covers Nvidia Shield, Sony Bravia Android, Chromecast with Google TV |
| `webos_direct` | LG WebOS (direct) | WebSocket | `github.com/nicedoc/homebridge-lgwebos` | WebSocket port 3000 | Supplements `lg_api` for older non-ThinQ models |
| `tizen_direct` | Samsung Tizen (direct) | REST | `<ip>:8001/api/v2/` Samsung REST API | HTTP REST | Supplements `samsung_api`; covers non-SmartThings models |
| `daikin_api` | Daikin | REST API | Daikin Developer Portal | HTTP REST | AC units only |
| `community` | All | GitHub PR | `github.com/remote-universal/device-sdk` | TypeScript | Community-contributed `DeviceDefinition` files |
| `openhardware` | All | GitHub | `github.com/home-assistant/core` /homeassistant/components | Python config | Home Assistant device integrations (broadest brand coverage) |

#### IR-Only / Legacy TV Brands

These brands do not have cloud APIs; coverage comes exclusively from IR source databases (IRDB, Flipper, Global Caché).

| Brand | IR DB Coverage | Dominant IR Protocol | Notes |
|---|---|---|---|
| Toshiba | IRDB, Flipper, GC | NEC / Toshiba variant | Toshiba variant = NEC with 13-bit address |
| Sharp | IRDB, Flipper, GC | Sharp protocol (38 kHz) | 15-bit address + 15-bit command |
| Haier | IRDB, GC | NEC | Wide model variance; large codeset needed |
| Skyworth | IRDB | NEC / RC6 | Primarily APAC market |
| Xiaomi (Mi TV) | IRDB, Flipper | NEC / RC5 | Also supports Android TV ADB control |
| Changhong | IRDB | NEC | Primarily CN market |
| Grundig | IRDB, GC | RC5 / RC6 | European brand (TP Vision group) |
| Hitachi | IRDB, GC | NEC / Hitachi-32 | Hitachi-32 is a NEC superset |
| JVC | IRDB, GC | JVC protocol (38 kHz) | 8-bit address + 8-bit command |
| Funai / Walmart ONN | IRDB | NEC | Funai OEM covers many budget TV brands |
| Insignia (Best Buy) | IRDB, Flipper | NEC | Manufactured by Funai / Hisense |
| Element | IRDB | NEC | Budget US brand |

---

## 3. Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       ONLINE SOURCES                                    │
│                                                                         │
│  IRDB (GitHub)  Flipper (GitHub)  GlobalCaché API  OEM APIs  Users      │
└──────────┬────────────┬─────────────────┬──────────────┬────────────────┘
           │            │                 │              │
           ▼            ▼                 ▼              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Stage 1: FETCH                                                         │
│  GitHub Releases API · HTTP polling · git clone (sparse) · REST calls  │
│  → Raw files stored in /tmp/crawl/<source>/<batch-id>/                  │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Stage 2: PARSE                                                         │
│  IRDBParser · FlipperParser · GCParser · OEMParser                      │
│  → Typed RawEntry[] (source-schema objects, no normalisation yet)       │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Stage 3: NORMALISE                                                     │
│  → Unified NormalisedIREntry / NormalisedModelEntry                     │
│  Name cleanup · UPPER_SNAKE_CASE functions · Pronto Hex conversion      │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Stage 4: DEDUPLICATE                                                   │
│  Check ir_import_batches.source_id + ir_codesets.source_id             │
│  → Skip already-imported entries, flag changed entries for update       │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Stage 5: BRAND & MODEL MATCHING                                        │
│  Fuzzy match ir_brands.name → brands.id (catalog)                      │
│  Fuzzy match model_pattern  → device_models.id (catalog)               │
│  → Writes catalog_brand_id, catalog_model_id, match_confidence         │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Stage 6: WRITE (UPSERT)                                                │
│  Bulk INSERT OR REPLACE into Supabase PostgreSQL                        │
│  Wrap in transaction · update ir_import_batches counters                │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Stage 7: SNAPSHOT & OTA PUBLISH                                        │
│  pg_dump → SQLite export via db-to-sqlite                               │
│  Sign with HMAC-SHA256 · Upload to CDN · Update ota-service version tag │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Stage 1 — Fetch

### Responsibilities
- Download raw source data without parsing or transforming it.
- Cache downloads in temp storage to allow re-runs without re-fetching.
- Record fetch metadata (time, version/SHA, byte count) for audit and deduplication.

### Per-Source Fetch Strategy

#### IRDB (GitHub)
```
GET https://api.github.com/repos/probonopd/irdb/git/trees/master?recursive=1
  → enumerate all CSV file paths under /codes/<Category>/<Brand>/

For each file:
  GET https://raw.githubusercontent.com/probonopd/irdb/master/codes/<Category>/<Brand>/<file>.csv
  Cache at: /tmp/crawl/irdb/<tree-sha>/<Category>/<Brand>/<file>.csv

Version key: git tree SHA (from GitHub Trees API response)
Skip fetch if: ir_import_batches WHERE source='irdb' AND version=<tree-sha> AND is_active=1
```

#### Flipper Zero IR
```
GET https://api.github.com/repos/flipperdevices/flipperzero-firmware/git/trees/dev?recursive=1
  → filter paths matching assets/infrared/**/*.ir

For each .ir file:
  GET https://raw.githubusercontent.com/.../assets/infrared/<device>/<file>.ir
  Cache at: /tmp/crawl/flipper/<commit-sha>/<device>/<file>.ir

Version key: latest commit SHA on `dev` branch
```

#### Global Caché API
```
GET https://irdb.globalcache.com/api/v1/manufacturers
  → list of {id, name, category}

For each manufacturer:
  GET https://irdb.globalcache.com/api/v1/manufacturers/<id>/codeset
    → list of codesets with Pronto Hex

Rate limit: 2 req/s — use p-limit(2) + 500ms delay
Version key: ISO date of last crawl (API has no versioning)
```

#### OEM / Smart TV APIs

```
# ── Samsung ──────────────────────────────────────────────────────────────
# SmartThings cloud API (modern Tizen TVs)
GET https://api.smartthings.com/v1/devices/presentations?manufacturerName=Samsung
Headers: Authorization: Bearer <SMARTTHINGS_TOKEN>
# Tizen direct REST (fallback, no cloud account needed)
GET http://<ip>:8001/api/v2/

# ── LG ───────────────────────────────────────────────────────────────────
# ThinQ cloud (device list + capabilities)
GET https://aic-service.lgthinq.com/v1/service/application/device-type-list
# WebOS direct WebSocket (older / non-ThinQ models)
WS  ws://<ip>:3000  (LG WebOS SSAP handshake)

# ── Sony ─────────────────────────────────────────────────────────────────
# BRAVIA IRCC-IP (older models, port 80)
POST http://<ip>/sony/IRCC
SOAP body: <u:X_SendIRCC xmlns:u="urn:schemas-sony-com:service:IRCC:1">
# BRAVIA REST API (2016+)
POST http://<ip>/sony/system  { method: 'getRemoteControllerInfo' }
Headers: X-Auth-PSK: <user_pin>

# ── Philips (TP Vision) ───────────────────────────────────────────────────
# JointSpace API v6 (2016+ models, HTTPS)
GET https://<ip>:1925/6/applications
GET https://<ip>:1925/6/input/key  (POST to send key)
Digest auth: <serialnumber>:<pin>

# ── Panasonic ─────────────────────────────────────────────────────────────
# NCTRL (Viera 2012+, port 55000)
GET http://<ip>:55000/nrc/control_0
SOAP action: urn:panasonic-com:service:p00NetworkControl:1#X_SendKey
# Newer models (2019+) — Viera via Android TV ADB

# ── Hisense ───────────────────────────────────────────────────────────────
# RemoteNow (VIDAA OS, WebSocket port 36669)
WS  wss://<ip>:36669  (challenge-response auth)
# Hisense Android TV models → use Android TV ADB path

# ── TCL ───────────────────────────────────────────────────────────────────
# Roku OS models → use Roku ECP (see below)
# Android TV models → use Android TV ADB
# Legacy TCL models → IR only

# ── Vizio ─────────────────────────────────────────────────────────────────
# SmartCast API (port 9000, HTTPS)
GET https://<ip>:9000/state/device/deviceinfo
PUT https://<ip>:9000/key_command/  { KEYLIST: [{CODESET:11,CODE:2,ACTION:KEYPRESS}] }
Headers: AUTH: <pairing_token>  (after PIN pairing flow)

# ── Roku & Roku-OS TVs (TCL, Philips, Sharp, Hisense Roku models) ─────────
# External Control Protocol — no auth, HTTP only
GET  http://<ip>:8060/query/device-info
     http://<ip>:8060/query/apps
POST http://<ip>:8060/keypress/<key>   e.g. PowerOff, VolumeUp, Home

# ── Amazon Fire TV ────────────────────────────────────────────────────────
# ADB over TCP (developer mode required)
adb connect <ip>:5555
adb shell input keyevent <keycode>
# Key codes per android.view.KeyEvent (KEYCODE_POWER=26, KEYCODE_VOLUME_UP=24, ...)

# ── Android TV / Google TV (Nvidia Shield, Sony XR, Xiaomi, etc.) ─────────
# Android TV Remote Service (port 6466) — certificate pairing first
# ADB TCP as fallback (developer mode)
adb connect <ip>:5555

# ── Daikin AC ─────────────────────────────────────────────────────────────
GET https://developer.cloud.daikineurope.com/v1/product/list
Headers: Authorization: Bearer <DAIKIN_DEVELOPER_TOKEN>
```

### Fetch Output Schema

```typescript
type SourceId =
  // IR code database sources
  | 'irdb' | 'flipper' | 'gc' | 'pronto_db' | 'manual'
  // Smart TV cloud / local API sources
  | 'samsung_api' | 'tizen_direct'
  | 'lg_api'      | 'webos_direct'
  | 'sony_api'
  | 'philips_api'
  | 'panasonic_api'
  | 'hisense_api'
  | 'tcl_api'
  | 'vizio_api'
  | 'roku_ecp'
  | 'fire_tv'
  | 'android_tv'
  // AC sources
  | 'daikin_api'
  // Community / open-source
  | 'community' | 'openhardware';

interface FetchResult {
  source:      SourceId;
  version:     string;          // git SHA / API date / release tag
  fetchedAt:   number;          // Unix timestamp (seconds)
  fileCount:   number;
  totalBytes:  number;
  localDir:    string;          // /tmp/crawl/<source>/<version>/
}
```

---

## 5. Stage 2 — Parse

Each source has a dedicated parser that reads raw files and emits typed source-native objects. No normalisation happens here — field names and values remain as they appear in the source.

### IRDB CSV Parser

IRDB CSVs have the header: `functionname,protocol,device,subdevice,function`

```
Input:  /tmp/crawl/irdb/<sha>/TV/Samsung/Samsung_AA59-00784A.csv
Output: IRDBRawEntry[]

interface IRDBRawEntry {
  source_file:  string;    // 'TV/Samsung/Samsung_AA59-00784A.csv'
  functionname: string;    // 'Power'
  protocol:     string;    // 'NEC1'
  device:       number;    // 7
  subdevice:    number;    // -1
  function:     number;    // 2
}
```

Derive from the file path:
- `category` ← first path segment (`TV`)
- `brand_name` ← second path segment (`Samsung`)
- `model_pattern` ← filename without extension (`Samsung_AA59-00784A`)

### Flipper .ir Parser

Flipper `.ir` files are key-value text files with multiple `#` comment blocks:

```
# Samsung TV
name: Power
type: parsed
protocol: Samsung32
address: 07 00 00 00
command: 02 00 00 00
```

```typescript
interface FlipperRawEntry {
  source_file:  string;
  device_name:  string;    // from file header comment
  name:         string;    // 'Power'
  type:         'parsed' | 'raw';
  protocol?:    string;    // 'Samsung32'
  address?:     string;    // hex string
  command?:     string;    // hex string
  frequency?:   number;    // for type=raw
  duty_cycle?:  number;
  data?:        string;    // space-separated microsecond durations
}
```

### Global Caché JSON Parser

```typescript
interface GCRawCodeset {
  manufacturer: string;
  devicetype:   string;
  model:        string;
  irfunctions:  Array<{
    functionname: string;
    code:         string;   // Pronto Hex
  }>;
}
```

### OEM / Smart TV API Parsers

Each brand has a dedicated parser adapter. All adapters emit the same `OEMRawDevice` intermediate type.

#### Per-Brand Parser Notes

| Brand | Parser | Source Format | Key Quirks |
|---|---|---|---|
| **Samsung** | `SamsungSmartThingsParser` | SmartThings JSON `presentation` | Capability names use camelCase SmartThings schema; map to internal snake_case |
| **Samsung (Tizen direct)** | `TizenDirectParser` | Tizen REST JSON | Overlaps SmartThings; dedup by model serial |
| **LG** | `LGThinQParser` | ThinQ JSON device-type-list | Command codes in LG-specific hex; map to REST payload |
| **LG (WebOS direct)** | `WebOSDirectParser` | SSAP JSON response | Button names from `getRemoteControllerInfo`; merge with ThinQ data |
| **Sony** | `SonyBraviaParser` | IRCC-IP SOAP + REST JSON | Two response schemas pre/post-2016; detect by `getRemoteControllerInfo` presence |
| **Philips** | `PhilipsJointSpaceParser` | JointSpace JSON v6 | Key codes are string names e.g. `'VolumeUp'`; map to internal `VOL_UP` |
| **Panasonic** | `PanasonicNCTRLParser` | SOAP XML | Extract key list from `X_GetCommandList` SOAP response |
| **Hisense** | `HisenseRemoteNowParser` | WebSocket JSON challenge/response | Key names match Hisense internal enum; normalise per lookup table |
| **TCL / Hisense Roku** | `RokuECPParser` | Roku ECP XML | `GET /query/device-info` for model; `keypress` paths are canonical Roku keys |
| **Vizio** | `VizioSmartCastParser` | SmartCast JSON codeset | Codeset 11 (TV power/input), 7 (volume); numeric codes mapped to names |
| **Amazon Fire TV** | `FireTVADBParser` | ADB keyevent integers | `android.view.KeyEvent` constants; same as Android TV |
| **Android TV** | `AndroidTVParser` | ADB keyevent + TV Remote API | Covers Sony Android, Nvidia Shield, Xiaomi Mi TV, Chromecast Google TV |
| **Roku (standalone)** | `RokuECPParser` | Same as TCL Roku | Shared parser; `source` field set to `roku_ecp` |
| **Daikin** | `DaikinCloudParser` | Daikin Developer Portal JSON | AC-specific capabilities: temperature, fan speed, swing, mode |
| **Home Assistant** | `HAComponentParser` | Python `.py` component config | Parses `SUPPORT_*` flags + service call schemas; broadest brand coverage |

#### Shared Output Type

```typescript
interface OEMRawDevice {
  source:          SourceId;
  manufacturer:    string;
  model_number:    string;
  model_name:      string;
  category:        string;      // raw from source, e.g. 'Television', 'TV', 'tv'
  capabilities:    string[];    // raw capability strings from source
  control_type:    'wifi_rest' | 'wifi_ws' | 'adb' | 'ecp' | 'soap' | 'ir_only';
  commands: Array<{
    name:          string;      // raw from source
    endpoint?:     string;
    method?:       string;      // 'GET' | 'POST' | 'PUT' | 'WS' | 'ADB' | 'SOAP'
    payload?:      string;
    headers?:      Record<string, string>;
    keycode?:      string | number;  // for ADB/ECP key-based sources
  }>;
}
```

---

## 6. Stage 3 — Normalise

Converts all source-native types into a single unified schema used for all downstream stages.

### IR Entry Normalisation

```typescript
interface NormalisedIREntry {
  // Lineage
  source:        'irdb' | 'flipper' | 'gc' | 'pronto_db' | 'manual';
  source_id:     string;                // deterministic hash of source_file + function

  // Brand / category
  brand_name:    string;                // title-cased, e.g. 'Samsung'
  category:      string;                // lower-snake, e.g. 'tv'

  // Codeset grouping
  model_pattern: string | null;         // e.g. 'AA59-00784A' or null

  // Protocol
  protocol_name: string | null;        // normalised: 'NEC' | 'RC5' | 'Samsung32' | ...
  carrier_hz:    number;               // default 38000

  // Function
  function_name: string;               // normalised UPPER_SNAKE_CASE, e.g. 'POWER_ON'
  function_label: string;              // original display name

  // Payloads (at least one must be set)
  pronto_hex:    string | null;
  raw_pattern:   number[] | null;
  address:       number | null;        // protocol-decoded
  ir_command:    number | null;
  bit_count:     number | null;
}
```

### Normalisation Rules

**Brand name cleanup:**
```
# Whitespace / casing
'SAMSUNG'              → 'Samsung'
'  Sony  '             → 'Sony'

# Legal suffix stripping
'LG Electronics'       → 'LG'
'DAIKIN IND.'          → 'Daikin'
'Panasonic Corp.'      → 'Panasonic'
'Sharp Corp'           → 'Sharp'
'Toshiba Corporation'  → 'Toshiba'
'Haier Group'          → 'Haier'

# Well-known aliases (lookup table, not regex)
'LOEWE'                → 'Loewe'
'FUNAI'                → 'Funai'
'PHILIPS'              → 'Philips'
'TCL COMMUNICATION'    → 'TCL'
'HISENSE ELECTRIC'     → 'Hisense'
'SKYWORTH RGB'         → 'Skyworth'
'XIAOMI MI'            → 'Xiaomi'
'VIZIO INC'            → 'Vizio'
'ROKU INC'             → 'Roku'
'JVC KENWOOD'          → 'JVC'
'HITACHI LTD'          → 'Hitachi'
'GRUNDIG AG'           → 'Grundig'
'CHANGHONG ELECTRIC'   → 'Changhong'
```
Apply: trim → title-case → strip legal suffixes (`Inc`, `Corp`, `Ltd`, `Co.`, `Electronics`, `Industries`, `Group`, `Electric`, `Communication`) → alias lookup table

**Function name normalisation (UPPER_SNAKE_CASE):**
```
'Power'            → 'POWER_TOGGLE'
'Power On'         → 'POWER_ON'
'Vol+'             → 'VOL_UP'
'Volume Down'      → 'VOL_DOWN'
'CH+'              → 'CH_UP'
'0'                → 'NUM_0'
'AV Mode'          → 'AV_MODE'
```
Lookup table first, regex fallback: `s/\s+/_/g → uppercase → strip non-word chars`

**Function category assignment:**
```
POWER_ON / POWER_OFF / POWER_TOGGLE   → 'power'
VOL_UP / VOL_DOWN / MUTE              → 'volume'
CH_UP / CH_DOWN / NUM_*               → 'channel'
UP / DOWN / LEFT / RIGHT / OK / BACK  → 'navigation'
PLAY / PAUSE / STOP / FF / REW        → 'media'
TEMP_* / FAN_* / MODE_*               → 'hvac'
INPUT_* / SOURCE_*                    → 'input_source'
```

**Protocol normalisation:**
```
# NEC family (used by: Samsung older models, LG older, Toshiba, Haier, Hisense, Changhong)
'NEC'        → 'NEC'
'NEC1'       → 'NEC'
'NEC2'       → 'NEC'
'NECx1'      → 'NEC'
'NECx2'      → 'NEC'

# Samsung proprietary (used by: Samsung TVs 2009+)
'Samsung32'  → 'Samsung32'
'SAMSUNG'    → 'Samsung32'

# RC family (used by: Philips, Grundig, Loewe, some Panasonic)
'RC-5'       → 'RC5'
'RC5'        → 'RC5'
'RC-6'       → 'RC6'
'RC6'        → 'RC6'
'RC6M0'      → 'RC6'

# Sony SIRC (used by: Sony Bravia, older Sony TVs)
'SONY12'     → 'SIRC'
'SONY15'     → 'SIRC'
'SONY20'     → 'SIRC'
'SIRC'       → 'SIRC'

# Sharp (used by: Sharp TVs)
'Sharp'      → 'Sharp'
'SHARP'      → 'Sharp'

# JVC (used by: JVC TVs, some Funai-manufactured brands)
'JVC'        → 'JVC'

# Panasonic (used by: Panasonic TVs, some Technics)
'Panasonic'  → 'Panasonic'
'KASEIKYO'   → 'Panasonic'

# Mitsubishi / Fujitsu (used by: AC units primarily)
'Mitsubishi' → 'Mitsubishi'
'Fujitsu'    → 'Fujitsu'

# Hitachi (NEC superset)
'Hitachi32'  → 'Hitachi32'

# Denon / Marantz
'Denon'      → 'Denon'

# Toshiba (NEC variant)
'Toshiba'    → 'Toshiba'

# Raw / unrecognised
'RAW'        → 'RAW'
'UNKNOWN'    → 'RAW'
```

**Pronto Hex conversion from Flipper decoded fields:**
When only `address` + `command` + `protocol` is available (Flipper `type: parsed`):
```
Samsung32 → encode as Pronto Hex using Samsung frame format:
  0000 <freq_divider_hex> <pair_count_hex> 0000 <leader_pair> <address_bits> <command_bits> <stop_bit>
```
Use `@tinyir/encode` library for protocol-to-Pronto conversion.

### Device Catalog Normalisation

The `control_type` field from `OEMRawDevice` maps to `SupportedProtocol[]` as follows:

| `control_type` | `protocols[]` | Notes |
|---|---|---|
| `wifi_rest` | `['wifi', 'ir']` | HTTP REST API; IR as fallback |
| `wifi_ws` | `['wifi', 'ir']` | WebSocket-based (WebOS, Hisense, Vizio) |
| `adb` | `['wifi']` | Android TV / Fire TV via ADB TCP |
| `ecp` | `['wifi', 'ir']` | Roku ECP; IR remote also works |
| `soap` | `['wifi', 'ir']` | Sony IRCC-IP, Panasonic NCTRL |
| `ir_only` | `['ir']` | Legacy / IR-only brands |

```typescript
interface NormalisedModelEntry {
  source:       SourceId;
  brand_slug:   string;          // 'samsung', 'sony', 'tcl', ...
  model_number: string;          // 'QN85B', 'KD-65A80L', 'S546', ...
  model_name:   string;          // human-readable, e.g. 'QLED 85" QN85B'
  category:     DeviceCategory;
  protocols:    SupportedProtocol[];
  capabilities: DeviceCapability[];
  commands: Array<{
    name:              string;   // normalised, e.g. 'power_on'
    label:             string;
    // Wi-Fi REST / WebSocket
    wifi_method?:      string;
    wifi_endpoint?:    string;
    wifi_payload?:     string;
    wifi_headers?:     string;
    // Roku ECP
    ecp_key?:          string;   // e.g. 'PowerOff', 'VolumeUp'
    // ADB (Android TV / Fire TV)
    adb_keycode?:      number;   // android.view.KeyEvent constant
    // SOAP (Sony IRCC, Panasonic NCTRL)
    soap_action?:      string;
    soap_body?:        string;
    // IR Pronto Hex (populated after IR matching stage)
    ir_pronto?:        string;
    ir_raw?:           string;
  }>;
}
```

#### Category normalisation from OEM strings

```
# TV categories
'Television'         → 'tv'
'TV'                 → 'tv'
'SmartTV'            → 'tv'
'RemoteController'   → 'tv'   (Panasonic/Sony naming)
'OLED'               → 'tv'
'QLED'               → 'tv'

# Audio categories
'Soundbar'           → 'soundbar'
'SoundBar'           → 'soundbar'
'Speaker'            → 'speaker'
'Receiver'           → 'receiver'
'AVReceiver'         → 'receiver'

# AC/HVAC categories
'AirConditioner'     → 'ac'
'AC'                 → 'ac'
'Thermostat'         → 'ac'

# Other
'SetTopBox'          → 'set_top_box'
'StreamingStick'     → 'streaming_stick'
'Projector'          → 'projector'
```

---

## 7. Stage 4 — Deduplicate

Prevents re-importing unchanged data. Two levels of deduplication:

### Batch-Level (skip entire source run)

```sql
SELECT id FROM ir_import_batches
WHERE source = :source
  AND version = :version
  AND is_active = 1
LIMIT 1;
```
If a row exists → skip the source entirely for this run.

### Entry-Level (skip individual codes already imported)

```sql
SELECT id FROM ir_codesets
WHERE source = :source
  AND source_id = :source_id
LIMIT 1;
```
`source_id` is a deterministic hash:
```
source_id = SHA256( source + ':' + brand_name + ':' + model_pattern + ':' + function_name ).slice(0, 16)
```

For changed entries (same `source_id`, different payload):
- Compare `pronto_hex` and `raw_pattern`.
- If changed → mark for **UPDATE** rather than skip.
- Increment `ir_import_batches.updated_count` (separate from `codes_count`).

---

## 8. Stage 5 — Brand & Model Matching

Links Layer 3 (IR Library) records to Layer 1 (Catalog) records.

### Brand Matching

**Goal:** set `ir_brands.catalog_brand_id` → `brands.id`

**Algorithm (run in order, first hit wins):**

```
1. Exact slug match
   normalise(ir_brands.name) == brands.slug
   e.g. 'samsung' == 'samsung'  → confidence 1.0

2. Lowercase name match
   lower(ir_brands.name) == lower(brands.name)
   e.g. 'samsung' == 'Samsung'  → confidence 0.95

3. Token overlap (Jaccard similarity)
   tokenise(ir_brands.name) ∩ tokenise(brands.name) / union
   threshold ≥ 0.6             → confidence = jaccard_score

4. No match                    → catalog_brand_id stays NULL, logged for review
```

All brand matches with confidence < 1.0 are written to a `brand_match_candidates` review table for manual confirmation before being promoted.

### Model Matching

**Goal:** set `ir_codesets.catalog_model_id` → `device_models.id`

```
Input: ir_brands.catalog_brand_id + ir_codesets.model_pattern

1. Exact model_number match (within the matched brand)
   device_models WHERE brand_id = :brand_id
                   AND UPPER(model_number) = UPPER(model_pattern)
   → confidence 1.0

2. Prefix / suffix glob match
   model_pattern = 'QN*'  → matches QN85B, QN90B, QN65B...
   → confidence 0.8 (codeset applies to many models; stored once, linked to all matches)

3. FTS5 search on device_models_fts
   MATCH :model_pattern
   → confidence = rank-based score, capped at 0.7

4. No match → catalog_model_id stays NULL
   (codeset still usable if catalog_brand_id is set — brand-level fallback)
```

### Match Output Written to DB

```sql
UPDATE ir_brands
SET catalog_brand_id = :matched_brand_id
WHERE id = :ir_brand_id;

UPDATE ir_codesets
SET catalog_model_id  = :matched_model_id,
    match_confidence  = :confidence
WHERE id = :codeset_id;
```

---

## 9. Stage 6 — Write (Upsert)

All writes happen inside a single Supabase PostgreSQL transaction per source batch.

### Write Order (respects FK constraints)

```
1. brands              (catalog)         INSERT OR IGNORE
2. device_models       (catalog)         INSERT OR IGNORE
3. command_definitions (catalog)         UPSERT on (model_id, name)
4. ir_brands           (IR library)      UPSERT on (source, name, category)
5. ir_codesets         (IR library)      UPSERT on (source, source_id)
6. ir_codes            (IR library)      UPSERT on (codeset_id, function_name)
7. ir_import_batches   (IR library)      INSERT with is_active = 0 initially
```

### Batch Completion

After all rows are written successfully:
```sql
-- Mark new batch as active
UPDATE ir_import_batches SET is_active = 1
WHERE id = :new_batch_id;

-- Deactivate previous batch for this source
UPDATE ir_import_batches SET is_active = 0
WHERE source = :source
  AND id != :new_batch_id;
```

### Upsert Strategy (conflict resolution)

```sql
-- ir_codes example
INSERT INTO ir_codes (id, codeset_id, function_name, pronto_hex, ...)
VALUES (:id, :codeset_id, :function_name, :pronto_hex, ...)
ON CONFLICT (codeset_id, function_name) DO UPDATE SET
  pronto_hex       = EXCLUDED.pronto_hex,
  raw_pattern      = EXCLUDED.raw_pattern,
  raw_frequency_hz = EXCLUDED.raw_frequency_hz,
  address          = EXCLUDED.address,
  ir_command       = EXCLUDED.ir_command,
  bit_count        = EXCLUDED.bit_count;
```

---

## 10. Stage 7 — Snapshot & OTA Publish

Apps do not query Supabase directly at runtime — they use a bundled SQLite file that is updated via the OTA service.

### Export Flow

```
Supabase PostgreSQL
        │
        │  SELECT all rows from ir_brands, ir_codesets, ir_codes,
        │  ir_import_batches WHERE is_active = 1
        ▼
  node-sqlite3 / better-sqlite3
        │  INSERT rows into in-memory SQLite
        │  PRAGMA optimize; VACUUM;
        ▼
  ir_library_<version>.db   (binary SQLite file)
        │
        │  HMAC-SHA256(file, SNAPSHOT_SIGNING_KEY)
        ▼
  ir_library_<version>.db.sig  (signature file)
        │
        ▼
  Upload to CDN:
    https://cdn.remote-universal.app/snapshots/ir_library_<version>.db
    https://cdn.remote-universal.app/snapshots/ir_library_<version>.db.sig
        │
        ▼
  ota-service version manifest updated:
    POST /internal/snapshots
    { source: 'ir_library', version, url, checksum, size }
```

### App Download & Verify Flow

```
App startup
    │
    GET /api/ota/latest?brand=universal&current=<local_version>
    ├── hasUpdate: false → use existing bundled .db
    └── hasUpdate: true
            │
            GET <cdn_url>/ir_library_<new_version>.db
            GET <cdn_url>/ir_library_<new_version>.db.sig
            │
            Verify HMAC-SHA256(downloaded_file, PUBLIC_SNAPSHOT_KEY)
            ├── mismatch → discard, keep old .db, report error
            └── match
                    │
                    Move to app Documents dir
                    Re-open SQLite connection
                    Update local version tag in MMKV
```

---

## 11. Incremental Update Strategy

Full re-crawls of all sources are expensive (IRDB has 570k+ codes). The pipeline uses incremental strategies per source:

| Source | Incremental Mechanism |
|---|---|
| `irdb` | Compare GitHub tree SHA. Only fetch files changed since last imported SHA using `/compare/<old>..<new>` diff API |
| `flipper` | Compare commit SHA on `dev` branch. Sparse checkout only changed `.ir` files |
| `gc` | No versioning — full crawl on schedule, rely on `source_id` dedup to skip unchanged entries |
| `pronto_db` | Compare GitHub release tag |
| `samsung_api` | Page through `updatedAfter=<last_run_iso_date>` query param |
| `tizen_direct` | No versioning — dedup by model serial from `/api/v2/` response |
| `lg_api` | Fetch all (small dataset, ~200 device types) |
| `webos_direct` | Dedup by model number from `getSystemInfo` response |
| `sony_api` | Fetch all; dedup by model number from `X_GetProductInformation` |
| `philips_api` | No public version endpoint — dedup by model from JointSpace `/6/system/menuitems/settings/current` |
| `panasonic_api` | Fetch all (`~150 Viera models`); dedup by model |
| `hisense_api` | Fetch all; dedup by model from `getDeviceInfo` WebSocket response |
| `tcl_api` | Fetch all legacy TCL; Roku OS models redirect to `roku_ecp` path |
| `vizio_api` | Fetch all; dedup by model from `/state/device/deviceinfo` |
| `roku_ecp` | Roku publishes a public device registry — fetch once, dedup by model SK (`device-info` `model-number`) |
| `fire_tv` | Amazon Fire TV device registry (Fire OS version + model list from Amazon developer portal) |
| `android_tv` | Home Assistant `androidtv` component component list; updated on HA release |
| `daikin_api` | Fetch all (small dataset) |
| `community` | Compare GitHub PR merge SHA |
| `openhardware` | Compare HA core release tag (bi-weekly releases) |

### State Tracking

```sql
-- Track last successful crawl per source
CREATE TABLE crawl_state (
  source        TEXT PRIMARY KEY,
  last_version  TEXT NOT NULL,    -- git SHA / ISO date / release tag
  last_run_at   INTEGER NOT NULL, -- Unix timestamp
  status        TEXT NOT NULL,    -- 'success' | 'partial' | 'failed'
  error_message TEXT
);
```

---

## 12. Scheduled Jobs

Managed by a cron runner in `backend/device-db` (node-cron or a GitHub Actions scheduled workflow).

| Job | Schedule | Sources | Notes |
|---|---|---|---|
| `crawl:irdb` | Weekly, Mon 02:00 UTC | IRDB GitHub | Incremental by tree SHA; largest source (~570k codes) |
| `crawl:flipper` | Weekly, Mon 02:30 UTC | Flipper GitHub | Incremental by commit SHA |
| `crawl:gc` | Monthly, 1st 03:00 UTC | Global Caché API | Full crawl, dedup handles idempotence |
| `crawl:pronto_db` | Monthly, 1st 03:30 UTC | ProntoNG GitHub | Incremental by release tag |
| `crawl:oem:tier1` | Daily, 04:00 UTC | Samsung, LG, Sony, Philips | Small datasets; frequent model releases |
| `crawl:oem:tier2` | Daily, 04:30 UTC | Panasonic, Hisense, TCL, Vizio | Medium datasets |
| `crawl:oem:tier3` | Daily, 05:00 UTC | Roku ECP, Fire TV, Android TV, Daikin | Roku/Android model lists change slowly |
| `crawl:community` | On PR merge (webhook) | community GitHub | Triggered by `device-sdk` PR merge webhook |
| `crawl:openhardware` | Weekly, Tue 03:00 UTC | Home Assistant core | Bi-weekly HA releases |
| `match:brands` | After any crawl completes | — | Re-run brand + model matching for unmatched rows |
| `snapshot:publish` | After any crawl + match completes | — | Export + upload SQLite snapshot to CDN |

### Job Runner Pseudocode

```typescript
async function runCrawlPipeline(source: SourceId): Promise<void> {
  const fetchResult  = await fetch(source);        // Stage 1
  const rawEntries   = await parse(fetchResult);   // Stage 2
  const normalised   = await normalise(rawEntries); // Stage 3
  const newEntries   = await deduplicate(normalised, source); // Stage 4
  const matched      = await matchBrandsAndModels(newEntries); // Stage 5
  const batchId      = await writeToDatabase(matched, source, fetchResult.version); // Stage 6
  await publishSnapshot(batchId);                  // Stage 7

  await updateCrawlState(source, fetchResult.version, 'success');
}
```

---

## 13. Error Handling & Rollback

### Transaction Rollback

If Stage 6 (Write) fails mid-batch:
```sql
ROLLBACK;
-- ir_import_batches row is never committed — no partial state
-- crawl_state.status = 'failed', error_message = <exception>
```
The previous `is_active = 1` batch remains untouched.

### Per-Entry Fault Tolerance

Stages 2–5 run in a streaming pipeline. A failure on one entry is logged and skipped — it does not abort the batch:

```typescript
for (const entry of normalisedEntries) {
  try {
    await processEntry(entry);
  } catch (err) {
    logger.warn({ entry, err }, 'Skipping malformed entry');
    metrics.increment('crawl.entry.skipped');
  }
}
```

### Snapshot Integrity

If the HMAC signature verification fails on the app side, the app keeps the existing local snapshot and reports the failure to the OTA service via `POST /api/ota/report-error`.

### Alerts

The following conditions trigger a Slack/PagerDuty alert:
- Any crawl job fails completely (Stage 1 or Stage 6 throws)
- `newEntries.length === 0` after deduplication (unexpected — suggests fetcher broke)
- Snapshot signing fails
- CDN upload fails after 3 retries

---

## 14. Data Flow: IR Code Library (Layer 3)

End-to-end trace for a single IRDB entry:

```
Source file:
  IRDB/codes/TV/Samsung/Samsung_AA59-00784A.csv
  row: "Power,NEC1,7,-1,2"

Stage 1 (Fetch):
  Cached at /tmp/crawl/irdb/<sha>/TV/Samsung/Samsung_AA59-00784A.csv

Stage 2 (Parse → IRDBRawEntry):
  { source_file: 'TV/Samsung/Samsung_AA59-00784A.csv',
    functionname: 'Power', protocol: 'NEC1',
    device: 7, subdevice: -1, function: 2 }

Stage 3 (Normalise → NormalisedIREntry):
  { source: 'irdb',
    source_id: 'a3f1b2c4d5e6f7a8',
    brand_name: 'Samsung', category: 'tv',
    model_pattern: 'AA59-00784A',
    protocol_name: 'NEC', carrier_hz: 38000,
    function_name: 'POWER_TOGGLE', function_label: 'Power',
    pronto_hex: '0000 006C 0022 0002 015B 00AD ...',
    address: 7, ir_command: 2, bit_count: 32 }

Stage 4 (Deduplicate):
  SELECT from ir_codesets WHERE source='irdb' AND source_id='a3f1b2c4d5e6f7a8'
  → Not found → proceed

Stage 5 (Match):
  ir_brands.name = 'Samsung' → brands.id = 'samsung' (exact slug match, conf=1.0)
  model_pattern = 'AA59-00784A' → device_models FTS search → 'samsung.qled-qn85b-2022' (conf=0.7)

Stage 6 (Write):
  INSERT ir_brands:   { id: 'irdb:samsung:tv', name: 'Samsung', category: 'tv',
                        catalog_brand_id: 'samsung', source: 'irdb', priority: 1 }
  INSERT ir_codesets: { id: 'irdb:samsung:tv:aa59', brand_id: 'irdb:samsung:tv',
                        model_pattern: 'AA59-00784A', catalog_model_id: 'samsung.qled-qn85b-2022',
                        match_confidence: 0.7, protocol_name: 'NEC', carrier_frequency_hz: 38000,
                        source: 'irdb', source_id: 'a3f1b2c4d5e6f7a8' }
  INSERT ir_codes:    { id: 'uuid-v4', codeset_id: 'irdb:samsung:tv:aa59',
                        function_name: 'POWER_TOGGLE', function_label: 'Power',
                        function_category: 'power',
                        pronto_hex: '0000 006C 0022 0002 015B 00AD ...',
                        address: 7, ir_command: 2, bit_count: 32 }

Stage 7 (Snapshot):
  Exported to ir_library_20260312.db → signed → uploaded to CDN
```

---

## 15. Data Flow: Device Catalog (Layer 1)

End-to-end traces for representative TV brands across different control protocols.

### Samsung (SmartThings REST)

```
Source: Samsung SmartThings API
  GET /v1/devices/presentations?manufacturerName=Samsung

Stage 1 (Fetch):
  Response cached to /tmp/crawl/samsung_api/20260312/presentations.json

Stage 2 (Parse → OEMRawDevice):
  { source: 'samsung_api',
    manufacturer: 'Samsung', model_number: 'QN85B',
    model_name: 'QLED 85" QN85B', category: 'Television',
    control_type: 'wifi_rest',
    capabilities: ['switch', 'audioVolume', 'tvChannel'],
    commands: [
      { name: 'on',        endpoint: '/main/switch',      method: 'POST', payload: '{"switch":"on"}' },
      { name: 'volumeUp',  endpoint: '/main/audioVolume', method: 'POST', payload: '{"direction":"up"}' },
    ] }

Stage 3 (Normalise):
  { brand_slug: 'samsung', model_number: 'QN85B', category: 'tv',
    protocols: ['wifi', 'ir'],
    commands: [
      { name: 'power_on', label: 'Power On',
        wifi_method: 'POST', wifi_endpoint: '/main/switch', wifi_payload: '{"switch":"on"}' },
      { name: 'vol_up', label: 'Vol +',
        wifi_method: 'POST', wifi_endpoint: '/main/audioVolume', wifi_payload: '{"direction":"up"}' },
    ] }

Stage 6 (Write):
  UPSERT brands:              { id: 'samsung', name: 'Samsung', slug: 'samsung', country: 'KR' }
  UPSERT device_models:       { id: 'samsung.qled-qn85b-2022', brand_id: 'samsung',
                                category: 'tv', protocols: '["wifi","ir"]', source: 'samsung_api' }
  UPSERT command_definitions: { id: 'samsung.qled-qn85b-2022.power_on', name: 'power_on',
                                wifi_method: 'POST', wifi_endpoint: '/main/switch',
                                wifi_payload: '{"switch":"on"}' }
```

### LG (ThinQ Cloud + WebOS Direct WebSocket)

```
Source A: LG ThinQ API  — device-type-list
Source B: LG WebOS Direct  — ws://<ip>:3000 (SSAP)

Stage 2 (Parse → OEMRawDevice):
  { source: 'lg_api', manufacturer: 'LG', model_number: 'OLED65C3',
    model_name: 'LG OLED evo C3 65"', category: 'Television',
    control_type: 'wifi_rest',
    commands: [
      { name: 'turnOn',     endpoint: '/device/thinq/v2/deviceStatus', method: 'POST',
        payload: '{"dataKey":"airState.operation","dataValue":"1"}' },
      { name: 'volumeUp',   endpoint: '/device/thinq/v2/deviceStatus', method: 'POST',
        payload: '{"dataKey":"airState.volume.current","dataValue":"up"}' },
    ] }

  { source: 'webos_direct', manufacturer: 'LG', model_number: 'OLED65C3',
    control_type: 'wifi_ws',
    commands: [
      { name: 'POWER',      method: 'WS', payload: '{"type":"request","uri":"ssap://system/turnOff"}' },
      { name: 'VOLUME_UP',  method: 'WS', payload: '{"type":"request","uri":"ssap://audio/volumeUp"}' },
    ] }

Stage 3 (Normalise — merge ThinQ + WebOS into one model entry):
  { brand_slug: 'lg', model_number: 'OLED65C3', category: 'tv',
    protocols: ['wifi', 'ir'],
    commands: [
      { name: 'power_off', label: 'Power Off',
        wifi_method: 'WS', wifi_endpoint: 'ws://{ip}:3000',
        wifi_payload: '{"type":"request","uri":"ssap://system/turnOff"}' },
      { name: 'vol_up', label: 'Vol +',
        wifi_method: 'WS', wifi_endpoint: 'ws://{ip}:3000',
        wifi_payload: '{"type":"request","uri":"ssap://audio/volumeUp"}' },
    ] }
```

### Sony (BRAVIA REST + IRCC-IP SOAP)

```
Source: Sony BRAVIA REST API
  POST http://<ip>/sony/system  { method: 'getRemoteControllerInfo' }
  Headers: X-Auth-PSK: <user_pin>

Stage 2 (Parse → OEMRawDevice):
  { source: 'sony_api', manufacturer: 'Sony', model_number: 'KD-65A80L',
    model_name: 'BRAVIA XR A80L 65"', category: 'Television',
    control_type: 'soap',
    commands: [
      { name: 'PowerOff',   keycode: 'AAAAAQAAAAEAAAAvAw==' },
      { name: 'VolumeUp',   keycode: 'AAAAAQAAAAEAAAASAw==' },
      { name: 'Home',       keycode: 'AAAAAQAAAAEAAABgAw==' },
      { name: 'Netflix',    keycode: 'AAAAAgAAABoAAAB8Aw==' },
    ] }

Stage 3 (Normalise):
  { brand_slug: 'sony', model_number: 'KD-65A80L', category: 'tv',
    protocols: ['wifi', 'ir'],
    commands: [
      { name: 'power_off', label: 'Power Off',
        soap_action: 'urn:schemas-sony-com:service:IRCC:1#X_SendIRCC',
        soap_body: '<IRCCCode>AAAAAQAAAAEAAAAvAw==</IRCCCode>' },
      { name: 'vol_up', label: 'Vol +',
        soap_action: 'urn:schemas-sony-com:service:IRCC:1#X_SendIRCC',
        soap_body: '<IRCCCode>AAAAAQAAAAEAAAASAw==</IRCCCode>' },
    ] }
```

### Panasonic (Viera NCTRL SOAP)

```
Source: Panasonic NCTRL SOAP  port 55000
  GET http://<ip>:55000/nrc/control_0
  → X_GetCommandList SOAP response enumerates all key names

Stage 2 (Parse → OEMRawDevice):
  { source: 'panasonic_api', manufacturer: 'Panasonic', model_number: 'TX-65LZ2000',
    model_name: 'Viera LZ2000 OLED 65"', category: 'Television',
    control_type: 'soap',
    commands: [
      { name: 'NRC_POWER-ONOFF', method: 'SOAP',
        soap_action: 'urn:panasonic-com:service:p00NetworkControl:1#X_SendKey' },
      { name: 'NRC_VOLUP-ONOFF', method: 'SOAP',
        soap_action: 'urn:panasonic-com:service:p00NetworkControl:1#X_SendKey' },
    ] }

Stage 3 (Normalise):
  { brand_slug: 'panasonic', model_number: 'TX-65LZ2000', category: 'tv',
    protocols: ['wifi', 'ir'],
    commands: [
      { name: 'power_toggle', label: 'Power',
        wifi_method: 'POST', wifi_endpoint: 'http://{ip}:55000/nrc/control_0',
        soap_body: '<X_KeyEvent>NRC_POWER-ONOFF</X_KeyEvent>' },
      { name: 'vol_up', label: 'Vol +',
        wifi_method: 'POST', wifi_endpoint: 'http://{ip}:55000/nrc/control_0',
        soap_body: '<X_KeyEvent>NRC_VOLUP-ONOFF</X_KeyEvent>' },
    ] }
```

### Philips (JointSpace REST)

```
Source: Philips JointSpace API v6
  GET https://<ip>:1925/6/input/key  (POST for send)

Stage 2 (Parse → OEMRawDevice):
  { source: 'philips_api', manufacturer: 'Philips', model_number: '65OLED907',
    model_name: 'Philips OLED+ 65OLED907', category: 'Television',
    control_type: 'wifi_rest',
    commands: [
      { name: 'Standby',   method: 'POST', endpoint: '/6/input/key',
        payload: '{"key":"Standby"}' },
      { name: 'VolumeUp',  method: 'POST', endpoint: '/6/input/key',
        payload: '{"key":"VolumeUp"}' },
      { name: 'CursorUp',  method: 'POST', endpoint: '/6/input/key',
        payload: '{"key":"CursorUp"}' },
    ] }

Stage 3 (Normalise):
  { brand_slug: 'philips', model_number: '65OLED907', category: 'tv',
    protocols: ['wifi', 'ir'],
    commands: [
      { name: 'power_off', label: 'Power Off',
        wifi_method: 'POST', wifi_endpoint: 'https://{ip}:1925/6/input/key',
        wifi_payload: '{"key":"Standby"}' },
    ] }
```

### Hisense (RemoteNow WebSocket — VIDAA OS)

```
Source: Hisense RemoteNow API
  WS wss://<ip>:36669  →  { action_type: 'get', action: 'remote_control_list' }

Stage 2 (Parse → OEMRawDevice):
  { source: 'hisense_api', manufacturer: 'Hisense', model_number: 'U8H',
    model_name: 'Hisense U8H ULED 65"', category: 'TV',
    control_type: 'wifi_ws',
    commands: [
      { name: 'KEY_POWER',     method: 'WS', payload: '{"action_type":"key","action":"KEY_POWER"}' },
      { name: 'KEY_VOLUMEUP',  method: 'WS', payload: '{"action_type":"key","action":"KEY_VOLUMEUP"}' },
    ] }

Stage 3 (Normalise):
  { brand_slug: 'hisense', model_number: 'U8H', category: 'tv',
    protocols: ['wifi', 'ir'],
    commands: [
      { name: 'power_toggle', label: 'Power',
        wifi_method: 'WS', wifi_payload: '{"action_type":"key","action":"KEY_POWER"}' },
      { name: 'vol_up', label: 'Vol +',
        wifi_method: 'WS', wifi_payload: '{"action_type":"key","action":"KEY_VOLUMEUP"}' },
    ] }
```

### Roku / TCL Roku OS (External Control Protocol)

Roku ECP is canonical across **all Roku OS TVs** — TCL, Hisense Roku, Philips Roku, Sharp Roku.
Same parser, same endpoints; only `brand_slug` + model fields differ.

```
Source: Roku ECP  +  Roku public device registry
  GET http://<ip>:8060/query/device-info
  → model-name: 'TCL 4-Series', model-number: '43S455'

Stage 2 (Parse → OEMRawDevice):
  { source: 'roku_ecp', manufacturer: 'TCL', model_number: '43S455',
    model_name: 'TCL 4-Series 43"', category: 'TV',
    control_type: 'ecp',
    commands: [
      { name: 'PowerOff',   method: 'POST', endpoint: '/keypress/PowerOff' },
      { name: 'VolumeUp',   method: 'POST', endpoint: '/keypress/VolumeUp' },
      { name: 'Home',       method: 'POST', endpoint: '/keypress/Home' },
      { name: 'Back',       method: 'POST', endpoint: '/keypress/Back' },
      { name: 'Select',     method: 'POST', endpoint: '/keypress/Select' },
      { name: 'Up',         method: 'POST', endpoint: '/keypress/Up' },
      { name: 'Netflix',    method: 'POST', endpoint: '/keypress/NetflixKey' },
    ] }

Stage 3 (Normalise):
  { brand_slug: 'tcl', model_number: '43S455', category: 'tv',
    protocols: ['wifi', 'ir'],
    commands: [
      { name: 'power_off', label: 'Power Off', ecp_key: 'PowerOff',
        wifi_method: 'POST', wifi_endpoint: 'http://{ip}:8060/keypress/PowerOff' },
      { name: 'vol_up',    label: 'Vol +',     ecp_key: 'VolumeUp',
        wifi_method: 'POST', wifi_endpoint: 'http://{ip}:8060/keypress/VolumeUp' },
      { name: 'home',      label: 'Home',      ecp_key: 'Home',
        wifi_method: 'POST', wifi_endpoint: 'http://{ip}:8060/keypress/Home' },
    ] }

Note: Same Roku ECP commands work across:
  TCL Roku TVs · Hisense Roku TVs · Philips Roku TVs · Sharp Roku TVs · ONN Roku TVs
  → one set of command_definitions per category='tv', brand_id='roku_ecp_common'
     resolved at runtime by DeviceRegistry based on discovered OS type
```

### Vizio (SmartCast REST)

```
Source: Vizio SmartCast API
  GET https://<ip>:9000/state/device/deviceinfo
  → model: 'P75Q9-J01', name: 'Vizio P-Series Quantum'

Stage 2 (Parse → OEMRawDevice):
  { source: 'vizio_api', manufacturer: 'Vizio', model_number: 'P75Q9-J01',
    model_name: 'P-Series Quantum 75"', category: 'TV',
    control_type: 'wifi_rest',
    commands: [
      { name: 'POWER_OFF', method: 'PUT', endpoint: '/key_command/',
        payload: '{"KEYLIST":[{"CODESET":11,"CODE":0,"ACTION":"KEYPRESS"}]}' },
      { name: 'VOLUME_UP', method: 'PUT', endpoint: '/key_command/',
        payload: '{"KEYLIST":[{"CODESET":5,"CODE":1,"ACTION":"KEYPRESS"}]}' },
      { name: 'INPUT_HDMI1', method: 'PUT', endpoint: '/key_command/',
        payload: '{"KEYLIST":[{"CODESET":7,"CODE":4,"ACTION":"KEYPRESS"}]}' },
    ] }

Stage 3 (Normalise):
  { brand_slug: 'vizio', model_number: 'P75Q9-J01', category: 'tv',
    protocols: ['wifi', 'ir'],
    commands: [
      { name: 'power_off', label: 'Power Off',
        wifi_method: 'PUT', wifi_endpoint: 'https://{ip}:9000/key_command/',
        wifi_headers: '{"AUTH":"{pairing_token}","Content-Type":"application/json"}',
        wifi_payload: '{"KEYLIST":[{"CODESET":11,"CODE":0,"ACTION":"KEYPRESS"}]}' },
    ] }
```

### Android TV / Fire TV (ADB keyevent)

Covers: Sony Bravia Android, Nvidia Shield, Xiaomi Mi TV, Amazon Fire TV, Chromecast with Google TV.

```
Source: Android TV ADB + Home Assistant androidtv component

Stage 2 (Parse → OEMRawDevice):
  { source: 'android_tv', manufacturer: 'Xiaomi', model_number: 'L65M8-A2',
    model_name: 'Xiaomi TV A2 65"', category: 'TV',
    control_type: 'adb',
    commands: [
      { name: 'KEYCODE_POWER',      adb_keycode: 26 },
      { name: 'KEYCODE_VOLUME_UP',  adb_keycode: 24 },
      { name: 'KEYCODE_VOLUME_DOWN',adb_keycode: 25 },
      { name: 'KEYCODE_HOME',       adb_keycode: 3 },
      { name: 'KEYCODE_BACK',       adb_keycode: 4 },
      { name: 'KEYCODE_DPAD_UP',    adb_keycode: 19 },
      { name: 'KEYCODE_DPAD_CENTER',adb_keycode: 23 },
    ] }

Stage 3 (Normalise):
  { brand_slug: 'xiaomi', model_number: 'L65M8-A2', category: 'tv',
    protocols: ['wifi'],
    commands: [
      { name: 'power_toggle', label: 'Power',    adb_keycode: 26,
        wifi_method: 'ADB', wifi_payload: 'input keyevent 26' },
      { name: 'vol_up',       label: 'Vol +',    adb_keycode: 24,
        wifi_method: 'ADB', wifi_payload: 'input keyevent 24' },
      { name: 'home',         label: 'Home',     adb_keycode: 3,
        wifi_method: 'ADB', wifi_payload: 'input keyevent 3' },
    ] }

Note: android.view.KeyEvent constants are the same for ALL Android TV brands.
  → shared 'android_tv_common' command_definitions row; brand/model row references it.
```

### IR-Only Brands (via IRDB / Flipper)

Brands with no cloud API (Toshiba, Sharp, JVC, Haier, Changhong, Skyworth, etc.) get catalog entries
created automatically during the Brand Matching stage (Stage 5) when an IR codeset is matched:

```
IRDB source file: /TV/Sharp/Sharp_GA005WJSA.csv
  → Stage 5 brand match: 'SHARP' → brands.id = 'sharp' (slug match, conf=1.0)
  → Stage 5 model match: 'GA005WJSA' → no catalog_model_id (no prior catalog entry)

  Auto-create device_models row:
    { id: 'sharp.ga005wjsa', brand_id: 'sharp',
      model_number: 'GA005WJSA', model_name: 'Sharp GA005WJSA',
      category: 'tv', protocols: '["ir"]',
      source: 'irdb', catalog_version: <batch_id> }

  ir_codesets row updated:
    catalog_model_id = 'sharp.ga005wjsa', match_confidence = 1.0

  command_definitions populated in Stage 6 after IR Match stage
  (ir_pronto populated once ir_code is linked to the command_definition)
```

### Stage 7 (Snapshot) — applies to all brands above

```
All brands' brands + device_models + command_definitions written to Supabase PostgreSQL
  → Exported to catalog_<version>.db → HMAC-SHA256 signed → uploaded to CDN
  → Apps receive OTA update notification on next launch
```
