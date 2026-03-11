# B2B White-Label Platform — User Flow & UI Flow

> Mô tả chi tiết luồng người dùng và giao diện cho mô hình kinh doanh White-Label B2B

---

## 1. Tổng quan các Actor

```
┌─────────────────────────────────────────────────────────────────┐
│                        ECOSYSTEM                                │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   Platform   │    │    Brand     │    │    End User      │  │
│  │   Owner      │    │   (Tenant)   │    │  (App User)      │  │
│  │  (You/Us)    │    │  Samsung, LG │    │  Người dùng cuối │  │
│  └──────┬───────┘    └──────┬───────┘    └────────┬─────────┘  │
│         │                  │                      │            │
│   Runs portal,        Pays license,         Downloads          │
│   manages infra       customizes app        branded app        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Flow Tổng quan (End-to-End)

```
Platform Owner                Brand (Tenant)              End User
─────────────────             ──────────────              ──────────────
  │                              │                            │
  ├─ Build platform core         │                            │
  ├─ Deploy Tenant Portal ──────►│                            │
  │                              ├─ Register account          │
  │                              ├─ Configure brand app       │
  │                              ├─ Upload assets             │
  │                              ├─ Select device catalog     │
  │                              ├─ Pay subscription          │
  │◄────────── Webhook ──────────┤                            │
  ├─ Trigger EAS Build           │                            │
  ├─ Generate branded .ipa/.apk  │                            │
  ├─ Submit to stores ──────────────────────────────────────► │
  │                              │                            ├─ Download app
  │                              │                            ├─ Onboard
  │                              ├─ Push OTA update ─────────►├─ Auto-update UI
  │                              ├─ View analytics ◄──────────┤
  │                              │                            │
```

---

## 3. Tenant Portal — Brand Flow

### 3.1 Onboarding Tenant mới

```
[Landing Page]
      │
      ▼
[Register Brand Account]
  • Company name
  • Email / domain
  • App name (e.g. "Samsung SmartRemote")
  • Bundle ID (e.g. com.samsung.smartremote)
  • Select tier: Starter / Pro / Enterprise
      │
      ▼
[Verify Email + Payment]
  • Stripe checkout
  • Nhận API key + tenant_id
      │
      ▼
[Tenant Dashboard] ◄──── Điểm bắt đầu cho mọi lần quay lại
```

---

### 3.2 Tenant Dashboard — Sitemap

```
Tenant Dashboard
├── 🏠 Overview
│     • App stats (DAU, sessions, devices added)
│     • Build status (last build, store status)
│     • Quick actions
│
├── 🎨 Brand Config
│     ├── Theme Editor
│     │     • Primary / accent colors
│     │     • Font family
│     │     • Dark / light mode default
│     │     • Border radius presets
│     ├── Assets
│     │     • App icon (1024×1024)
│     │     • Splash screen
│     │     • Logo (SVG/PNG)
│     │     • Store screenshots
│     └── App Info
│           • App name, subtitle
│           • Store description (vi/en)
│           • Support URL, Privacy Policy URL
│
├── 📱 Device Catalog
│     ├── Enabled Categories (toggle)
│     │     TV · AC · Speaker · Projector · ...
│     ├── Featured Brands (reorder)
│     │     Pinned brands shown first in Add Device wizard
│     ├── Device Models
│     │     • Browse / search from master catalog
│     │     • Enable/disable per model
│     │     • Override command (custom IR code upload)
│     └── Custom Devices (add manual entry)
│
├── 🔧 Remote Layouts
│     ├── Default layouts per category
│     ├── Layout editor (drag-and-drop button grid)
│     └── OTA push layout to live users
│
├── 🚀 Builds
│     ├── Build History
│     ├── Trigger New Build
│     │     • Select platforms (iOS / Android / Both)
│     │     • Environment (dev / staging / production)
│     └── Download .ipa / .apk (for internal testing)
│
├── 📊 Analytics
│     • Commands sent / hour (heatmap)
│     • Most-used devices
│     • IR vs WiFi vs BLE ratio
│     • Feature flag usage
│
├── 🔑 API & Webhooks
│     • API key management
│     • Webhook endpoints (build complete, OTA deployed)
│     └── SDK integration guide
│
└── ⚙️ Settings
      • Team members + roles
      • Subscription & billing
      • Delete tenant
```

---

### 3.3 Theme Editor — UI Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Theme Editor                                        [Preview ▶] │
├──────────────────────┬──────────────────────────────────────────┤
│                      │                                          │
│  Colors              │         Live Preview (Phone Frame)       │
│  ─────────────────── │   ┌─────────────────────────────────┐    │
│  Primary    [■ #1428A0] │   │  ████ Samsung SmartRemote ████ │    │
│  Accent     [■ #00B5E2] │   │  ──────────────────────────── │    │
│  Background [■ #0A0E1A] │   │  Good morning 👋               │    │
│  Surface    [■ #141928] │   │  2 of 3 devices online        │    │
│  Text       [■ #FFFFFF] │   │                               │    │
│                      │   │  ┌──────────┐  ┌──────────┐    │    │
│  Typography          │   │  │📺 Samsung│  │❄️ Daikin │    │    │
│  ─────────────────── │   │  │   TV     │  │   AC     │    │    │
│  Font family         │   │  │ Online ● │  │Offline ○ │    │    │
│  [SF Pro      ▾]     │   │  └──────────┘  └──────────┘    │    │
│                      │   └─────────────────────────────────┘    │
│  Border Radius       │                                          │
│  Cards  [●──────] 16 │   Mode: [● Dark  ○ Light]               │
│  Buttons[──●────] 12 │                                          │
│                      │   [Reset to defaults]  [Save & Deploy ▶] │
└──────────────────────┴──────────────────────────────────────────┘
```

---

### 3.4 OTA Layout Update Flow

```
Brand đăng nhập Portal
        │
        ▼
[Layout Editor] — Kéo thả button vào grid
        │
        ▼
[Preview] — Xem trước trên phone frame ảo
        │
        ▼
[Push OTA Update]
  • Target: All users / iOS only / Android only / % rollout
  • Schedule: Now / Scheduled time
        │
        ▼
[OTA Service backend]
  • Ký JSON config với private key tenant
  • Upload lên CDN
  • Gửi push notification đến app
        │
        ▼
[App User — nhận OTA]
  • App check version khi launch
  • Download config mới (~5 KB JSON)
  • UI update ngay — không cần App Store review
```

---

## 4. End User Flow — Branded App

### 4.1 First Launch / Onboarding

```
[Splash Screen]  (Branded logo + color)
      │
      ▼
[Welcome Screen]
  ┌─────────────────────────────────┐
  │   [Brand Logo]                  │
  │                                 │
  │   Control all your              │
  │   [Brand Name] devices          │
  │   from one place                │
  │                                 │
  │   [Get Started]                 │
  │   [I have an account — Log in]  │
  └─────────────────────────────────┘
      │
      ▼
[Permission Requests]  (1 per screen — không dump tất cả cùng lúc)
  Screen 1: Local Network access
    "To find your [Brand] devices automatically"
    [Allow]  [Skip]
  Screen 2: Bluetooth
    "To connect to [Brand] BLE devices"
    [Allow]  [Skip]
      │
      ▼
[Home Screen]  →  (Empty State — Add First Device)
```

---

### 4.2 Màn hình chính — Home Screen

```
┌─────────────────────────────────┐
│  Good morning 👋         [🔔]   │
│  1 of 3 devices online          │
│─────────────────────────────────│
│                                 │
│  ┌─────────────────────────┐    │
│  │ ▌ 📺  Samsung QLED       │    │
│  │    Living Room · Samsung │    │
│  │                  ● Online│    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │ ▌ ❄️  Daikin Emura       │    │
│  │    Bedroom · Daikin      │    │
│  │                 ○ Offline│    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │ ▌ 🔊  Sonos Arc          │    │
│  │    Living Room · Sonos   │    │
│  │                  ● Online│    │
│  └─────────────────────────┘    │
│                                 │
│                        [+] FAB  │
└─────────────────────────────────┘
```

---

### 4.3 Add Device Wizard — 3 bước

```
Step 1/3 — Chọn loại thiết bị
┌─────────────────────────────────┐
│  ════════════════  Add Device   │
│  ●●○  [✕]                       │
│─────────────────────────────────│
│  What type of device?           │
│                                 │
│  ┌──────┐ ┌──────┐ ┌──────┐    │
│  │  📺  │ │  ❄️  │ │  🔊  │    │
│  │  TV  │ │  AC  │ │Speak.│    │
│  └──────┘ └──────┘ └──────┘    │
│  ┌──────┐ ┌──────┐ ┌──────┐    │
│  │  💡  │ │  💨  │ │  📽️  │    │
│  │Light │ │ Fan  │ │Proj. │    │
│  └──────┘ └──────┘ └──────┘    │
│                                 │
│               [Next →]          │
└─────────────────────────────────┘

Step 2/3 — Chọn brand
┌─────────────────────────────────┐
│  ════════════════  Add Device   │
│  ●●○  [✕]                       │
│─────────────────────────────────│
│  Select brand                   │
│                                 │
│  ┌─────────────────────────┐    │
│  │ Samsung               ✓ │    │  ← Selected
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │ LG                       │    │
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │ Sony                     │    │
│  └─────────────────────────┘    │
│                                 │
│  [← Back]          [Next →]     │
└─────────────────────────────────┘

Step 3/3 — Chi tiết thiết bị
┌─────────────────────────────────┐
│  ════════════════  Add Device   │
│  ●●●  [✕]                       │
│─────────────────────────────────│
│  Device details                 │
│                                 │
│  MODEL / NAME *                 │
│  ┌─────────────────────────┐    │
│  │ QLED QN85B              │    │
│  └─────────────────────────┘    │
│                                 │
│  NICKNAME (optional)            │
│  ┌─────────────────────────┐    │
│  │ Living Room TV          │    │
│  └─────────────────────────┘    │
│                                 │
│  ROOM                           │
│  ┌─────────────────────────┐    │
│  │ Living Room             │    │
│  └─────────────────────────┘    │
│                                 │
│  CONNECTION                     │
│  [📡 IR] [📶 Wi-Fi] [🔵 BLE]   │
│                                 │
│  [← Back]       [Save Device]   │
└─────────────────────────────────┘
```

---

### 4.4 Remote Control Screen — TV

```
┌─────────────────────────────────┐
│  ← Samsung QLED · Living Room   │
│  ● Online               [⚙️]   │
│─────────────────────────────────│
│                                 │
│         [  POWER  ]             │
│                                 │
│  [VOL−]  [MUTE]  [VOL+]        │
│  [CH−]           [CH+]         │
│                                 │
│       ┌────[▲]────┐             │
│       [◄] [ OK ] [►]            │
│       └────[▼]────┘             │
│  [BACK]         [HOME]          │
│                                 │
│  [NETFLIX] [YOUTUBE] [PRIME]    │
│                                 │
│  [1][2][3][4][5][6][7][8][9][0] │
│                                 │
│  [INPUT]  [MENU]  [SETTINGS]    │
│─────────────────────────────────│
│  [🏠 Home] [📺 Remote] [⚙️]    │  (Bottom Tab)
└─────────────────────────────────┘
```

---

### 4.5 Remote Control Screen — AC

```
┌─────────────────────────────────┐
│  ← Daikin Emura · Bedroom       │
│  ● Online               [⚙️]   │
│─────────────────────────────────│
│                                 │
│         [  POWER  ]             │
│                                 │
│  ┌─────────────────────────┐    │
│  │      Temperature        │    │
│  │                         │    │
│  │  [−]    24°C    [+]     │    │
│  │  ████████████████░░░░   │    │  (Slider 16–30°C)
│  └─────────────────────────┘    │
│                                 │
│  Mode:                          │
│  [❄️ Cool] [🌡️ Heat] [💨 Fan]  │
│  [💧 Dry]  [🔄 Auto]            │
│                                 │
│  Fan Speed:                     │
│  [Auto] [Low] [Med] [High]      │
│                                 │
│  Swing:  [Off] [Vertical] [All] │
│                                 │
│  Timer: [Off]  [1h] [2h] [4h]   │
│─────────────────────────────────│
│  [🏠 Home] [❄️ Remote] [⚙️]    │
└─────────────────────────────────┘
```

---

### 4.6 Settings Screen

```
┌─────────────────────────────────┐
│  Settings                       │
│─────────────────────────────────│
│                                 │
│  MY DEVICES                     │
│  Manage Devices              ›  │
│  Rooms                       ›  │
│                                 │
│  ACCOUNT                        │
│  Sign In / Account           ›  │
│  Cloud Backup & Sync         ›  │  (Pro feature — upsell)
│                                 │
│  ADVANCED                       │
│  IR Blaster Test             ›  │
│  Network Scan                ›  │
│  Macros & Automation         ›  │  (Pro feature)
│                                 │
│  APP                            │
│  Appearance (Dark / Light)   ›  │
│  Language                    ›  │
│  Notifications               ›  │
│                                 │
│  SUPPORT                        │
│  Help Center                 ›  │
│  Send Feedback               ›  │
│  App Version: 1.2.0             │
│                                 │
└─────────────────────────────────┘
```

---

## 5. Full User Flow Diagram

```
                    FIRST LAUNCH
                         │
              ┌──────────▼──────────┐
              │    Splash Screen     │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │   Welcome Screen    │
              └──────┬──────┬───────┘
                     │      │
             [Get Started] [Login]
                     │      │
              ┌──────▼──────▼───────┐
              │ Permission Requests │
              │  Network + BLE      │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │    Home Screen      │  ◄─────────────────┐
              │   (Empty State)     │                    │
              └──────────┬──────────┘                    │
                         │                               │
                  [+ Add Device]                    [Device added ✓]
                         │                               │
              ┌──────────▼──────────┐                    │
              │   Step 1: Category  │                    │
              └──────────┬──────────┘                    │
                         │ [Select]                      │
              ┌──────────▼──────────┐                    │
              │   Step 2: Brand     │                    │
              └──────────┬──────────┘                    │
                         │ [Select]                      │
              ┌──────────▼──────────┐                    │
              │   Step 3: Details   ├────────────────────┘
              └─────────────────────┘

              ┌──────────────────────────────────────┐
              │         Home Screen (has devices)    │
              └─────┬────────────┬───────────────────┘
                    │            │
             [Tap Device]    [FAB +]
                    │            │
         ┌──────────▼──┐    (Add Device Wizard)
         │ TV Remote   │
         │ AC Control  │
         │ etc.        │
         └─────────────┘
```

---

## 6. OTA Update Flow (User side)

```
App Launch
    │
    ├─ Check: local config version vs CDN version
    │
    ├─ Same version? ─── NO ───► Download new layout JSON (silent, background)
    │                              │
    YES                            ▼
    │                        Verify signature
    │                              │
    ▼                        Apply new layout
  Normal                     (no restart needed)
  Launch                           │
                             Show toast briefly:
                             "Remote layout updated"
```

---

## 7. Tenant Tier — Feature Matrix

| Feature | Starter | Pro | Enterprise |
|---|---|---|---|
| Brand apps | 1 | 5 | Unlimited |
| Device models | 100 | Unlimited | Unlimited |
| OTA layout push | ❌ | ✅ | ✅ |
| Custom theme | Basic | Full | Full + CSS |
| Cloud sync (users) | 1 000 DAU | 50 000 DAU | Unlimited |
| Analytics | Basic | Advanced | Custom + export |
| Custom domain (backend) | ❌ | ❌ | ✅ |
| SLA | ❌ | 99.5% | 99.9% |
| Dedicated support | ❌ | Email | Slack + CSM |
| EAS Build CI/CD | Manual | Auto (push-to-build) | Auto + custom runner |
| **Giá / tháng** | **$499** | **$1 999** | **$5 000+** |

---

## 8. Tech Mapping — Kiến trúc hiện tại → B2B Feature

| B2B Feature | Hiện trạng | Cần làm |
|---|---|---|
| Multi-tenant isolation | `tenant-service` scaffolded | Implement JWT tenant claim + row-level security |
| Theme injection | `ThemeProvider` + `BrandTheme` ✅ | Expose API endpoint để set theme per tenant |
| OTA layout push | `ota-service` scaffolded | Build signed JSON pipeline + CDN upload |
| Device catalog per tenant | `device-sdk/_template` + `DeviceRegistry` ✅ | Tenant config để enable/disable models |
| Analytics | ❌ | Add event tracking (Posthog / Mixpanel SDK) |
| Tenant portal (web) | ❌ | Vite + React dashboard (Phase 4.4) |
| EAS Build CI/CD | ❌ | GitHub Actions + EAS Build API trigger |
| Billing | ❌ | Stripe integration vào `tenant-service` |
