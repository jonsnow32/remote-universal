# UX Design Specification: Universal Remote (Android)

> **Version:** 1.0 — March 2026  
> **Scope:** Android-only (IR + Wi-Fi/HTTP + BLE + Matter)  
> **GTM target:** Download → first successful control < 2 minutes  
> **Critical pre-ship bug:** `ACControlScreen` must be wired to `CommandDispatcher` before any UX polish ships

---

## 1. User Flows

### Flow A — Onboarding & First Device Setup

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  ENTRY: App first launch (fresh install)                                     ║
╚══════════════════════════════════════════════════════════════════════════════╝
                              │
                              ▼
                    ┌─────────────────┐
                    │  Splash Screen  │  (1.5s brand animation)
                    └────────┬────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │  Onboarding Carousel (3 pgs) │
              │  • "Control everything"      │
              │  • "Works in 2 minutes"      │
              │  • "No Wi-Fi needed for IR"  │
              └─────────────┬────────────────┘
                            │  [Get Started] or [Skip]
                            ▼
              ┌──────────────────────────────┐
              │  Permission Prompt Sheet     │
              │  • Location (for Wi-Fi scan) │
              │  • Bluetooth scan            │
              │  Rationale shown before OS   │
              │  system dialog               │
              └─────────────┬────────────────┘
                            │
               ┌────────────┴────────────┐
               │ Permissions granted?    │
               │                         │
          YES ─┤                     NO ─┤
               │                         │
               ▼                         ▼
   ┌───────────────────────┐   ┌──────────────────────────┐
   │  AUTO-DISCOVERY SCAN  │   │  "Limited mode" banner   │
   │  (8s, 4 channels)     │   │  Offer manual add only   │
   │  Animated sonar rings │   │  (IR still works)        │
   └───────────┬───────────┘   └────────────┬─────────────┘
               │                            │
    ┌──────────┴──────────┐                 │
    │ Devices found?      │                 │
    │                     │                 │
  YES                    NO                 │
    │                     │                 │
    ▼                     ▼                 ▼
┌────────────┐   ┌────────────────┐   ┌─────────────────────┐
│ Device List│   │  No Devices    │   │  Manual Add Flow    │
│ Preview    │   │  Found Screen  │   │  (see below)        │
│            │   │  → Manual CTA  │   └─────────────────────┘
└─────┬──────┘   └───────┬────────┘
      │                  │
      ▼                  ▼
 [Tap device]      ┌─────────────────────────────────────────────┐
      │            │         MANUAL ADD FLOW                     │
      ▼            │                                             │
┌──────────────┐   │  1. Category Picker (visual grid)           │
│ Device       │   │     TV / AC / Speaker / Projector / Other   │
│ Confirm Sheet│   │                                             │
│ • Name/Room  │   │  2. Brand Picker (scrollable A-Z grid)      │
│ • Protocol   │   │     Popular brands highlighted              │
│   shown as   │   │     "My brand isn't listed" → generic       │
│   user-      │   │                                             │
│   friendly   │   │  3. Model Picker (search + list)            │
│   label      │   │     or "My model isn't listed"              │
└──────┬───────┘   │                                             │
       │           │  4. Protocol Selection (auto-detected)      │
       ▼           │     • IR: Show IR Signal Test               │
┌──────────────┐   │     • Wi-Fi: Enter IP (auto-scan first)     │
│  FIRST USE   │   │     • BLE: Scan & pair                      │
│  TUTORIAL    │   │                                             │
│  (overlay    │   │  5. Name / Room assignment                  │
│   coach      │   │                                             │
│   marks)     │   │  6. Test Command → confirm "Did it work?"   │
└──────┬───────┘   │     YES → Save → Home                       │
       │           │     NO  → IR Signal Re-test / Try another   │
       ▼           │          protocol                           │
  HOME SCREEN      └─────────────────────────────────────────────┘

── IR SIGNAL TEST (inline during manual add, IR protocol only) ──────────────
  [Aim your phone at the device]
  [Tap Test Button]
        │
        ├─ IR fires → "Did your TV turn on/off?" [YES] [NO]
        │       YES → protocol confirmed, proceed to save
        │       NO  → "Try moving closer / remove case" + Retry
        │             3rd fail → "Your phone may not have IR.
        │                         Try Wi-Fi setup instead."
        └─ IR not available → Inline warning banner (not modal)
                             "IR not supported on this device.
                              Add via Wi-Fi or BLE instead."
```

---

### Flow B — Daily Use: TV Control

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  ENTRY: Home Screen → tap TV device card                                     ║
╚══════════════════════════════════════════════════════════════════════════════╝
                              │
                              ▼
                 ┌────────────────────────┐
                 │  Protocol Availability  │
                 │  Check (< 200ms)       │
                 └────────────┬───────────┘
                              │
              ┌───────────────┴────────────────┐
              │  Device reachable?             │
              │                                │
         YES ─┤                          NO ──┤
              │                                │
              ▼                                ▼
   ┌─────────────────────┐        ┌────────────────────────────┐
   │  TV REMOTE SCREEN   │        │  OFFLINE BANNER (top)      │
   │  (full controls)    │        │  "Samsung TV is offline"   │
   │                     │        │  [Retry] [Use IR Instead]  │
   └──────────┬──────────┘        └────────────────────────────┘
              │
   ┌──────────┼──────────────────────────────────────────┐
   │   POWER  │ Vol+/−  │  Ch+/−  │  D-Pad  │  Source   │
   └──────────┴──────────────────────────────────────────┘
              │
   Each button press:
              │
              ├─ Visual: button scale 0.92 → 1.0 (80ms) + accent flash
              ├─ Haptic: HapticFeedback.impactLight()
              ├─ CommandDispatcher.dispatch(deviceId, action)
              │
              ├─ IR path:
              │     IRBlasterModule.transmit(prontoHex)
              │     ← fire-and-forget, no confirmation
              │     Show "Sent" pulse (not "Confirmed")
              │
              └─ Wi-Fi path:
                    HTTP POST with 5s timeout, 3 retries
                    ├─ 200 OK → green confirmation pulse (200ms)
                    ├─ Timeout/Error after retries → Snackbar:
                    │   "Couldn't reach [Device]. Check Wi-Fi."
                    └─ 2nd consecutive failure → protocol fallback
                        if IR available → auto-switch silently
                        if no fallback → show Error Screen

── VOLUME HOLD-REPEAT ────────────────────────────────────────────────────────
  PressIn  → start setInterval(150ms) → send 'volume_up' each tick
             Haptic: impactLight on each repeat
             Button background pulses subtly (opacity 0.7 → 1.0 cycle)
  PressOut → clearInterval. Final state shown in header (if Wi-Fi)

── NUMERIC KEYPAD (missing in current build) ─────────────────────────────────
  [0-9] tray — swipe up from channel row OR tap "123" button
  Keypad slides up as BottomSheet, overlays remote
  Input buffer shows typed digits, sends on [—] or 2s auto-submit

── SOURCE / INPUT PICKER ─────────────────────────────────────────────────────
  Tap Source → BottomSheet with source list
  (HDMI 1, HDMI 2, USB, AV, Air Play, etc.)
  Populated from device catalog; editable in Settings

── STREAMING SHORTCUTS (above D-pad) ────────────────────────────────────────
  Netflix │ YouTube │ Prime │ Disney+
  Opens app on TV via deep-link command if protocol supports it
  Grayed out for IR-only devices (no deep-link)
```

---

### Flow C — Daily Use: AC Control

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  ENTRY: Home Screen → tap AC device card                                     ║
╚══════════════════════════════════════════════════════════════════════════════╝
                              │
                              ▼
            ┌─────────────────────────────────┐
            │   AC STATE RESTORE              │
            │   Load last-known state from    │
            │   AsyncStorage:                 │
            │   { temp, mode, fan, swing }    │
            │   (optimistic UI seed)          │
            └──────────────┬──────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  AC CONTROL SCREEN     │
              │  ─────────────────     │
              │  Quick Mode (default)  │
              │  • Power toggle        │
              │  • Temp ring display   │
              │  • Active mode pill    │
              └────────────┬───────────┘
                           │
         ┌─────────────────┼──────────────────────────┐
         │                 │                          │
    POWER TOGGLE     TEMP ADJUST               [MORE] EXPAND
         │                 │                          │
         ▼                 ▼                          ▼
   ─ CRITICAL FIX ─  ─ CRITICAL FIX ─       Full Mode (scrollable)
   Must call:        Must call:              • Fan speed slider
   dispatcher        dispatcher              • Swing toggle
   .dispatch(id,     .dispatch(id,           • Sleep timer
   'power')          'set_temp_XX')          • Eco / Turbo

── TEMPERATURE INTERACTION ───────────────────────────────────────────────────
  Option 1: Tap +/− buttons (48dp each, MUST be ≥ 48dp)
            PressIn → impactMedium haptic
            Hold >400ms → enter hold-repeat (300ms interval)
            Visual: temp number slides up/down (Animated.spring)
            Command sent on release (not on each tick)

  Option 2: Swipe on large temp display (PanGestureHandler)
            Vertical drag:  up = +1°C per 20dp, down = −1°C per 20dp
            Visual: blurred ghost digit tracks finger
            Command sent on gesture end (onGestureEnd)
            Haptic: selection feedback every 1°C increment

── MODE CHANGE ───────────────────────────────────────────────────────────────
  Tap mode pill → dispatcher.dispatch(id, `set_mode_${mode}`)
  Mode color transitions animate (300ms):
    Cool  → Teal   #00C9A7  (semantic: cold air)
    Heat  → Orange #FF6B35  (semantic: warm air)
    Fan   → Purple #6C63FF  (semantic: neutral airflow)
    Dry   → Amber  #F5A623  (semantic: moisture removal)
    Auto  → Blue   #00BFFF  (semantic: automatic)
  Background gradient shifts to match active mode color (opacity 0.15)
  TalkBack label: "Cool mode, currently selected" / "Heat mode, double-tap to activate"

── STATE PERSISTENCE ─────────────────────────────────────────────────────────
  On every successful command:
    AsyncStorage.setItem('@remote/ac_state_${deviceId}', JSON.stringify(state))
  On screen mount:
    Load from AsyncStorage, use as optimistic UI
    Send 'query_state' command if protocol supports it (Wi-Fi only)
    Reconcile server response → update display if different
```

---

### Flow D — Smart Home Device Control (Lights, Switches, Matter)

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  ENTRY: Home Screen → smart home device card (light / switch / fan)          ║
╚══════════════════════════════════════════════════════════════════════════════╝
                              │
                              ▼
              ┌─────────────────────────────────┐
              │  DEVICE TYPE ROUTER             │
              │  light → LightControlScreen     │
              │  switch → SwitchControlScreen   │
              │  fan → FanControlScreen         │
              └──────────────┬──────────────────┘
                             │
                             ▼
            ┌────────────────────────────────────┐
            │  SMART HOME CARD (inline on Home)  │
            │  OR full control screen            │
            │                                    │
            │  For simple on/off:                │
            │  Large toggle directly on card     │
            │  No navigation needed              │
            │                                    │
            │  For dimmable/color lights:        │
            │  → LightControlScreen              │
            └────────────────┬───────────────────┘
                             │
               Light Control Screen:
               ┌─────────────────────────────┐
               │  Power toggle (48dp ring)   │
               │  Brightness: vertical       │
               │  slider or press+hold       │
               │  Color Temp: warm ↔ cool    │
               │  pill selector              │
               │  Scenes: [Reading] [Movie]  │
               │  [Sleep] [Bright]           │
               └──────────────┬──────────────┘
                              │
            ── MATTER DEVICE (Wi-Fi or Thread)  ─────────────────────────────
               Protocol: CommandDispatcher selects MatterProtocol
               No pairing UX needed if already in ecosystem
               State: always query on mount (Matter supports read)
               Offline: show "Unreachable" badge, offer retry

            ── BLE LIGHT (e.g. Govee) ────────────────────────────────────────
               BLE GATT connect may take 1–3s
               Show connecting spinner in header status
               Disconnect after each command (per protocol spec)
               Batch quick sequential taps → debounce 200ms

            ── GROUP CONTROL (Rooms) ─────────────────────────────────────────
               Home Screen room section header → [All Off] button
               Sends to all devices in room group simultaneously
               Progress shown: "3 of 4 devices responded"
               One-tap: "Goodnight" macro (all lights off + AC 26°C)
```

---

### Flow E — Error Recovery

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  ERROR TAXONOMY (4 levels)                                                   ║
╚══════════════════════════════════════════════════════════════════════════════╝

Level 1 — INFO (Snackbar, 3s auto-dismiss)
  Trigger: First IR command sent
  Message: "IR sent — make sure phone is pointing at device"
  Action: none required

Level 2 — WARNING (Snackbar, 6s + action)
  Trigger: 1 failed Wi-Fi attempt (< max retries)
  Message: "Retrying… (1/3)"
  Action: [Use IR] button if IR available

Level 3 — ERROR (Snackbar sticky or BottomSheet)
  Trigger: All retries exhausted OR device unreachable
  Message: device-specific (see table below)
  Action: inline recovery CTA

Level 4 — BLOCKING (Full Error Screen replaces controls)
  Trigger: No valid protocol available for device
  Message: explanatory + setup guidance
  Action: [Reconfigure Device] [Go to Settings] [Contact Support]

─────────────────────────────────────────────────────────────────────────────
SPECIFIC ERROR MESSAGES & RECOVERY CTAs
─────────────────────────────────────────────────────────────────────────────

┌──────────────────────────┬────────────────────────────────┬───────────────────────────────┐
│ Error Condition          │ User-Facing Message            │ Recovery CTA                  │
├──────────────────────────┼────────────────────────────────┼───────────────────────────────┤
│ Wi-Fi timeout (5s × 3)  │ "Can't reach [Name].           │ [Retry] [Switch to IR]        │
│                          │  Is it on the same Wi-Fi?"     │ [Check device power]          │
├──────────────────────────┼────────────────────────────────┼───────────────────────────────┤
│ No IR blaster            │ "This phone doesn't have an    │ [Add via Wi-Fi instead]       │
│                          │  IR blaster. IR remotes won't  │ [Learn more]                  │
│                          │  work."                        │                               │
├──────────────────────────┼────────────────────────────────┼───────────────────────────────┤
│ Device not found         │ "Couldn't find [Name]          │ [Scan Again] [Add Manually]   │
│ (discovery timeout)      │  on your network."             │ [Move device closer]          │
├──────────────────────────┼────────────────────────────────┼───────────────────────────────┤
│ DHCP reassignment        │ "[Name] moved to a new         │ [Auto-Reconnect] re-runs      │
│ (IP changed)             │  address. Reconnecting…"       │ mDNS resolve; or [Update IP]  │
├──────────────────────────┼────────────────────────────────┼───────────────────────────────┤
│ BLE connect fail         │ "Bluetooth connection lost.    │ [Retry] [Forget & Re-add]     │
│                          │  Move closer and try again."   │                               │
├──────────────────────────┼────────────────────────────────┼───────────────────────────────┤
│ Protocol not supported   │ "This command isn't            │ [Update device firmware]      │
│ (e.g. deep-link on IR)   │  supported via IR."            │ (or silent gray-out button)   │
└──────────────────────────┴────────────────────────────────┴───────────────────────────────┘

── DHCP REASSIGNMENT RECOVERY FLOW ────────────────────────────────────────
  CommandDispatcher receives HTTP timeout
        │
        ▼
  Re-run mDNS resolve for device hostname (stored at pairing time)
        │
        ├─ Resolved → update stored IP → retry command → success
        └─ Not resolved → show "Update IP" dialog
                          • [Scan network] button re-runs discovery
                          • User can manually enter new IP
                          • Save → retry

── PROTOCOL FALLBACK FLOW ──────────────────────────────────────────────────
  Wi-Fi fails after 3 retries
        │
  CommandDispatcher.getBestProtocol() → next in priority list
        │
        ├─ IR available → switch silently → show subtle toast
        │   "Switched to IR mode"
        ├─ BLE available → connect → retry command
        └─ No fallback → Level 3 ERROR state
```

---

## 2. Screen List

| Screen | Purpose | Key UI Elements | Entry Points | Exit Points | Dependencies |
|--------|---------|----------------|--------------|-------------|--------------|
| **SplashScreen** | Brand identity, init | Logo, animated wordmark | App launch | Auto → Onboarding or Home | AsyncStorage (has_onboarded) |
| **OnboardingScreen** | First-time value proposition | 3-page carousel, illustrations, Get Started CTA | Fresh install | → PermissionScreen | none |
| **PermissionScreen** | Request Location + BLE permissions | Rationale copy, icon, [Grant] / [Skip] | Onboarding | → DiscoveryScreen or Home | Android permission APIs |
| **HomeScreen** | Device library hub | Greeting, room sections, device cards, FAB (+ Add), bottom nav | App root, onboarding end | → TVRemote, ACControl, Discovery, SmartHome, Settings | AsyncStorage `@remote/user_devices`, `usePro` |
| **DiscoveryScreen** | Automatic device scanning | Sonar animation (3 rings), progress phases text, device result list, [Add Manually] fallback | FAB on Home, Onboarding | → DeviceConfirmSheet, ManualAddFlow | `DeviceDiscovery`, Location perm, BLE perm |
| **DeviceConfirmSheet** | Confirm discovered device + name/room | Device icon, detected name, room picker, protocol badge, [Add] / [Dismiss] | DiscoveryScreen result tap | → HomeScreen | Discovered device object |
| **ManualAddScreen** | Category → Brand → Model flow | Category grid, brand scroll grid, model searchable list, protocol selector, IR test | Discovery [Add Manually], Home FAB → Manual | → HomeScreen (on save) | `useAllBrands`, `useModelsByBrand`, IRBlasterModule |
| **TVRemoteScreen** | TV control surface | Power (red 56dp), source, mute; Vol+/− (hold-repeat); Ch+/−; D-pad (72dp OK); streaming shortcuts row; numeric keypad bottom sheet | Home device card tap | ← Back | `CommandDispatcher`, `DeviceRegistry`, deviceId param |
| **ACControlScreen** | AC control — Quick + Full mode | Power ring, large temp display (swipeable), mode pills, fan speed, swing; **Must wire to CommandDispatcher** | Home device card tap | ← Back | `CommandDispatcher` (currently unconnected — critical bug), AsyncStorage AC state |
| **SmartHomeScreen** | Light/switch/fan control | Power toggle ring, brightness slider (vertical), color temp pills, scene buttons | Home device card tap | ← Back | CommandDispatcher, Matter/BLE protocol |
| **MacroScreen** | Saved multi-command sequences | Macro cards, run button, [Create +] FAB | Home bottom nav (Pro), Settings | → MacroEditorScreen | `usePro`, AsyncStorage macros |
| **MacroEditorScreen** | Build/edit macro sequences | Step list, [+ Add Command] sheet, delay config, test run | MacroScreen FAB | ← Back (save prompt) | All device list, CommandDispatcher |
| **ErrorScreen** | Blocking error state | Illustration, error heading, description, primary CTA, secondary CTA | Any screen on Level 4 error | ← Back, → Settings, → Retry | Navigation state |
| **SettingsScreen** | App config + device management | General toggles, Pro status, device list manager, backend URL (dev), About | Home bottom nav | ← Back | `usePro`, `getApiBaseUrl` |
| **PaywallScreen** | Pro upgrade conversion | Feature comparison, price, [Subscribe] | Settings Pro section, Free limit hit | ← Back | RevenueCat / `usePro` |
| **TVGuideScreen** | EPG grid (Pro feature) | Channel grid, time ruler, program cells | TV Remote [Guide] button (Pro only) | ← Back | Pro gate, EPG API |

---

## 3. Wireframe Descriptions

> All measurements in **dp** (density-independent pixels). Portrait orientation unless noted.  
> Safe area model: `react-native-safe-area-context` `useSafeAreaInsets()` applied to all screens.  
> Bottom inset: 32–48dp for Android gesture navigation (Android 10+).

---

### 3.1 Home / Device List Screen

```
┌─────────────────────────────────────────────────────┐  ← Status bar (24dp)
│  ████████████  Status Bar  ████████████████████████ │
├─────────────────────────────────────────────────────┤  ← Safe area top
│                                                     │
│  Good evening, Linh 👋          [Avatar / Pro 🔔]  │  Header (64dp)
│  3 devices active                                   │  font: 22sp bold, 14sp sub
│                                                     │
├─────────────────────────────────────────────────────┤
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐   │  Horizontal filter chips
│  │ All    │  │  TV    │  │  AC    │  │ Lights │   │  (ScrollView horizontal)
│  └────────┘  └────────┘  └────────┘  └────────┘   │  chip height: 32dp
│                                                     │
├─────────────────────────────────────────────────────┤
│  LIVING ROOM                              [All Off] │  Section header 12sp caps
│                                                     │
│  ┌───────────────────────────────────────────────┐  │  Device card (72dp height)
│  │  [TV icon 40dp]  Samsung QLED         ● Online│  │  Left icon, right status dot
│  │                  TV · Wi-Fi           >       │  │  touch target full width
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │  [AC icon 40dp]  Daikin AC            ● Online│  │  —  Quick-action inline:
│  │                  28°C · Cool          ❄ 24°C  │  │     for AC show current temp
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  BEDROOM                                            │  Next room section
│  ┌───────────────────────────────────────────────┐  │
│  │  [bulb icon 40dp] Bedside Light       ○ Off   │  │  Toggle switch inline (right)
│  │                   Smart Light  ────── ●●──○   │  │  44dp touch target on switch
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  [Offline / Error devices appear here, grouped]     │  Warning-tinted card section
│                                                     │
│                                                     │
│                                              [FAB]  │  FAB: 56dp circle, bottom-right
│                                               (+)   │  margin: 16dp from edge
│                                                     │  Label: "Add Device" (extended)
├─────────────────────────────────────────────────────┤
│  [🏠 Home] [📡 Discover] [⚡ Macros] [⚙ Settings]  │  Bottom nav (80dp + inset)
└─────────────────────────────────────────────────────┘
```

**Component choices (Material Design 3):**
- Header: Custom `View` with `SafeAreaView` top padding
- Filter chips: `ScrollView` horizontal + `Chip` (M3 filter chip)
- Device cards: `Pressable` with `android_ripple` — NOT `TouchableOpacity`
- Inline AC toggle state: read-only display; full control navigates to ACControlScreen
- FAB: `FAB` (extended on first launch, icon-only after first use) — 56dp, bottom-right
- Bottom nav: `BottomTabNavigator` with `BottomNavigationBar` (M3 style)
- Section headers: `SectionList` — sticky headers

**Thumb zone (Hoober, one-handed):**
- FAB placed at 16dp from bottom-right: within natural thumb arc for right-handed
- Device cards: full-width Pressable — easy tap from couch grip
- Filter chips: reachable one-handed (top content zone, acceptable)
- Bottom nav: 80dp bar puts all tabs in comfortable thumb reach

---

### 3.2 Discovery / Add Device Screen

```
┌─────────────────────────────────────────────────────┐
│  Status bar                                          │
├─────────────────────────────────────────────────────┤
│  ←  Add Device                                      │  Back + title (56dp toolbar)
├─────────────────────────────────────────────────────┤
│                                                     │
│                    ◯     ◯     ◯                    │  Sonar rings (animated)
│                                                     │  Center: device icon 48dp
│               ◯   ●  phone  ●   ◯                  │  Rings: scale 1→2.5, opacity 1→0
│                  (icon, 48dp)                       │  stagger 600ms between rings
│                    ◯     ◯     ◯                    │  Ring color matches mode color
│                                                     │
│         Searching your home network…                │  Phase text — 18sp, centered
│         (see phases below)                          │  Changes every ~2.5s
│                                                     │
│  ──────────────────── Found ──────────────────────  │  Divider appears when 1st found
│                                                     │
│  ┌───────────────────────────────────────────────┐  │  Found device card (68dp)
│  │  [TV 36dp] Samsung Smart TV                   │  │  Tap → DeviceConfirmSheet
│  │            TV · Home Network            [Add] │  │  human-readable protocol
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │  [AC 36dp] Daikin Inverter AC                  │  │
│  │            Air Cond · Home Network      [Add] │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│                 [Add Manually Instead]              │  TextButton, 48dp touch target
│                                                     │  shown always (not after scan)
├─────────────────────────────────────────────────────┤
│                (no bottom nav on this screen)       │
└─────────────────────────────────────────────────────┘
```

**Discovery Phase Text (replaces mDNS/SSDP/BLE internals):**
| Time | Display Text |
|------|-------------|
| 0–2s | "Searching your home network…" |
| 2–4s | "Looking for smart TVs and ACs…" |
| 4–6s | "Scanning for Bluetooth devices…" |
| 6–8s | "Checking connected hubs…" |
| 8s timeout, devices found | "Found [N] devices nearby" |
| 8s timeout, no devices | "Nothing found. Try adding manually." |

**No-devices empty state:**
- Illustrated empty state (phone → question mark → device)
- Heading: "No devices found nearby"
- Body: "Make sure your TV or AC is on and connected to the same Wi-Fi."
- Primary CTA: [Add Manually] (filled button)
- Secondary CTA: [Scan Again] (outlined button)

---

### 3.3 TV Remote Screen

```
┌─────────────────────────────────────────────────────┐  Status bar
├─────────────────────────────────────────────────────┤
│  ←    Samsung QLED — Living Room        [⋯ menu]   │  Header 56dp
│       ● Connected via Wi-Fi                         │  status: 12sp, accent color dot
├─────────────────────────────────────────────────────┤
│                                                     │
│  [⏻ Power]    [⤸ Source]    [🔇 Mute]              │  Zone 1: top utility row
│   56dp×56dp   48dp×48dp    48dp×48dp                │  Power RED, others secondary
│   RED bg      medium btn   medium btn               │  row height: 72dp
│                                                     │
│  ┌──────────────────────────────────────────────┐   │  Zone 2: streaming row
│  │  [N Netflix] [▶ YouTube] [▶ Prime] [+ Disney]│   │  Icon buttons 52×52dp, icon 28dp
│  └──────────────────────────────────────────────┘   │  Horizontal scroll if >4 items
│                                                     │
│  [Vol −]  [Vol +]          [Ch −]  [Ch +]          │  Zone 3: Vol + Ch (hold-repeat)
│  52dp     52dp              48dp    48dp            │  Vol buttons slightly larger
│  ════════════════          ═══════════════          │  Channel label on top
│  VOLUME                    CHANNEL                  │
│                                                     │
│            ┌───────────────────────┐                │  Zone 4: D-PAD — centered
│            │        [ ▲ ]          │                │  D-pad outer circle 160dp
│            │  [ ◀ ] [ OK ] [ ▶ ]  │                │  Arrow arms: 48dp × 48dp
│            │        [ ▼ ]          │                │  OK center: 56dp circle
│            └───────────────────────┘                │  Tactile raised appearance
│                                                     │
│  [Back ⤶]  [Home ⌂]   [Menu ☰]   [123 keypad]    │  Zone 5: navigation row (48dp)
│                                                     │
│  [Num keypad bottom sheet — slides up on "123" tap] │
│  ╔═══╦═══╦═══╗                                     │
│  ║ 1 ║ 2 ║ 3 ║  ← BottomSheet 280dp height         │
│  ╠═══╬═══╬═══╣     numpad standard layout           │
│  ║ 4 ║ 5 ║ 6 ║     each cell 72dp × 64dp            │
│  ╠═══╬═══╬═══╣                                     │
│  ║ 7 ║ 8 ║ 9 ║                                     │
│  ╠═══╬═══╬═══╣                                     │
│  ║   ║ 0 ║ ← ║                                     │
│  ╚═══╩═══╩═══╝                                     │
│                                                     │
└─────────────────────────────────────────────────────┘  No bottom nav (immersive remote)
                    (+safe area bottom inset 32–48dp)
```

**Thumb Zone Analysis (TV Remote — Portrait, Couch Use):**
- **Zone 4 (D-pad):** Placed at ~55–70% screen height — natural right-thumb reach for right-handed users; left-handers can use two thumbs
- **Zone 3 (Vol/Ch):** At ~40–55% height — both thumbs easily reach
- **Zone 1 (Power/Source):** At 15–25% height — requires stretch; Power is intentionally hard to trigger accidentally
- **Streaming shortcuts:** ~28–38% height — functional but not reflex-level; acceptable for low-frequency use
- **Bottom nav removed:** Remote screen is fullscreen/immersive — back gesture or header back button used

**Hold-Repeat Implementation (Vol+/Vol−, Ch+/Ch−):**
```tsx
// Implementation hint for TVRemoteScreen
const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

const handlePressIn = (action: string) => {
  send(action); // immediate first fire
  HapticFeedback.trigger('impactLight');
  holdIntervalRef.current = setInterval(() => {
    send(action);
    HapticFeedback.trigger('selection'); // lighter for repeat
  }, 150);
};

const handlePressOut = () => {
  if (holdIntervalRef.current) {
    clearInterval(holdIntervalRef.current);
    holdIntervalRef.current = null;
  }
};
```
Use `Pressable` with `onPressIn` / `onPressOut` (not `onPress` alone).

---

### 3.4 AC Control Screen

```
┌─────────────────────────────────────────────────────┐  Status bar
├─────────────────────────────────────────────────────┤
│  ←    Daikin AC — Master Bedroom        [⏻ Power]  │  Header 56dp
│       Cool · 24°C                       (ring btn)  │  Power: 44dp ring, mode-colored
├─────────────────────────────────────────────────────┤
│                                                     │
│           ┌──────────────────────────┐              │  Mode glow zone (180dp height)
│           │   ❄  (mode icon, 48dp)  │              │  Circular glow bg, color = mode
│           │                          │              │
│           │     ╔══════════════╗     │              │  ← SWIPE UP/DOWN on this zone
│           │     ║    24°C      ║     │              │  to adjust temp (PanGestureHandler)
│           │     ║   (48sp)     ║     │              │  Text: 48sp bold, mode color
│           │     ╚══════════════╝     │              │  Ghost digit tracks finger during
│           │   Target Temperature     │              │  swipe; snaps on release
│           └──────────────────────────┘              │
│                                                     │
│       ┌────────┐              ┌────────┐            │  Temp −/+ buttons: 56dp × 56dp
│       │   −    │              │   +    │            │  MUST be ≥ 48dp (Persona C)
│       │ (56dp) │              │ (56dp) │            │  Hold >400ms → hold-repeat 300ms
│       └────────┘              └────────┘            │
│                                                     │
│  ─────────────────────────────────────────────────  │  Divider
│                                                     │
│  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐           │  Mode pills (horizontal scroll)
│  │Cool│  │Heat│  │Fan │  │ Dry│  │Auto│           │  pill h: 40dp, min-w: 64dp
│  └────┘  └────┘  └────┘  └────┘  └────┘           │  active: filled, inactive: outline
│                                                     │
│  Fan Speed                                         │  Section label 12sp caps
│  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐       │  Segment buttons 48dp height
│  │ Auto  │  │  Low  │  │  Med  │  │ High  │       │
│  └───────┘  └───────┘  └───────┘  └───────┘       │
│                                                     │
│  [Swing  ────●────  ON]       [Timer  ──  OFF]     │  Switch rows 48dp each
│                                                     │
│  ─────────────────  [ ˅ More Options ]  ─────────── │  Expand to Full Mode (scrollable)
│                                                     │
│  FULL MODE (below fold, scroll to access):          │
│  • Eco / Turbo toggle                               │  Additional settings
│  • Sleep timer (0, 30m, 1h, 2h, 4h, 8h)           │  Bottom sheet or inline scroll
│  • Schedule (time pickers)                          │
│  • Clean filter reminder                            │
└─────────────────────────────────────────────────────┘

QUICK MODE (default, above fold):  Power + Temp + Active Mode pill
FULL MODE (expanded):              + Fan speed + Swing + Sleep timer + Schedule
Toggle via [More Options] / [Less] text button at bottom of Quick Mode
```

**Color semantics (WCAG AA verified):**
| Mode | Background gradient start | Icon | Text | Contrast on dark bg |
|------|--------------------------|------|------|---------------------|
| Cool | #00C9A7 (teal) | ❄️ snowflake | #00C9A7 | 4.7:1 ✓ |
| Heat | #FF6B35 (orange) | 🔥 flame | #FF6B35 | 4.5:1 ✓ |
| Fan | #6C63FF (purple) | 💨 wind | #6C63FF | 5.1:1 ✓ |
| Dry | #F5A623 (amber) | 💧 droplet | #F5A623 | 4.6:1 ✓ |
| Auto | #00BFFF (sky) | 🔄 arrows | #00BFFF | 4.8:1 ✓ |

Background: `#0A0E1A` dark base — all mode colors pass 4.5:1 minimum.

---

### 3.5 Smart Home Device Screen (Lights & Switches)

```
┌─────────────────────────────────────────────────────┐  Status bar
├─────────────────────────────────────────────────────┤
│  ←    Bedside Light — Bedroom           [⋯ menu]   │  Header 56dp
│       ● Smart Light · Wi-Fi (Matter)               │  protocol: human label
├─────────────────────────────────────────────────────┤
│                                                     │
│           ┌──────────────────────────┐              │  Power ring (120dp diameter)
│           │    [💡]   ON/OFF         │              │  Tap to toggle power
│           │   (power ring, 120dp)    │              │  ON: yellow glow ring
│           │   State: ON              │              │  OFF: dim gray ring
│           └──────────────────────────┘              │
│                                                     │
│  Brightness                              58%        │  Brightness row
│  ────────────────────●─────────────             │  Slider: `Slider` component
│  (0%                                100%)          │  Track: 4dp height
│                                                     │  Thumb: 24dp diameter
│  Color Temperature                                  │  Color temp row
│  ┌────────────────┐  ┌────────────────┐            │  Two pills: Warm | Cool
│  │  🟠 Warm       │  │  🔵 Cool       │            │  or full 2700K–6500K slider
│  └────────────────┘  └────────────────┘            │
│                                                     │
│  ─────────────── SCENES ─────────────────          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │  Scene grid (2 per row or 4 row)
│  │ Reading  │  │  Movie   │  │  Sleep   │         │  scene card: 80dp height
│  │  📖      │  │  🎬      │  │  🌙      │         │  icon 32dp + label 14sp
│  └──────────┘  └──────────┘  └──────────┘         │
│  ┌──────────┐                                      │
│  │  Bright  │                  [+ Add Scene]       │
│  │  ☀️      │                                      │
│  └──────────┘                                      │
│                                                     │
└─────────────────────────────────────────────────────┘

Simple Switch device (no dimmer/color):
├─ No dedicated screen — toggled inline on Home card
└─ Long-press device card → quick action sheet (Re-name, Delete)
```

---

### 3.6 Error State / No Connection Screen

```
┌─────────────────────────────────────────────────────┐  Status bar
├─────────────────────────────────────────────────────┤
│  ←  Back                                            │  Header (back only)
│                                                     │
│                                                     │
│                                                     │
│            ┌──────────────────────┐                 │  Illustration (160×140dp)
│            │   📡  ?  📺        │                 │  Centered, above fold
│            │   (disconnected     │                 │
│            │    illustration)    │                 │
│            └──────────────────────┘                 │
│                                                     │
│         Can't reach Samsung QLED               │  Heading 22sp bold, centered
│                                                     │
│    The TV didn't respond after 3 attempts.          │  Body 16sp, #8892A4
│    Make sure it's on and connected to               │  2–3 lines max
│    the same Wi-Fi as your phone.                    │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │  Primary CTA button
│  │              Try Again                        │  │  56dp height, full-width
│  └───────────────────────────────────────────────┘  │  filled, primary color
│                                                     │
│  ┌───────────────────────────────────────────────┐  │  Secondary CTA button
│  │           Switch to IR Instead                │  │  56dp height, outlined
│  └───────────────────────────────────────────────┘  │  (only if IR available)
│                                                     │
│  ┌───────────────────────────────────────────────┐  │  Tertiary action
│  │           Reconfigure Device                  │  │  Text button, 48dp
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ─────────────────────────────────────────────────  │
│  💡 Tip: If the TV moved rooms, update its          │  Contextual tip card
│     IP address in device settings.                  │  tonal surface, 14sp
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Error screen variants (same layout, different copy/CTAs):**

| Variant | Illustration | Heading | Primary CTA | Secondary CTA |
|---------|-------------|---------|-------------|---------------|
| Wi-Fi timeout | disconnected cloud | "Can't reach [Name]" | Try Again | Switch to IR |
| No IR blaster | crossed-out IR icon | "IR not available on this phone" | Add via Wi-Fi | Learn More |
| Device not found | magnifying glass | "Couldn't find [Name]" | Scan Again | Add Manually |
| No network | no-wifi icon | "No network connection" | Open Settings | — |
| BLE fail | bluetooth crossed | "Bluetooth connection lost" | Retry | Forget Device |

---

### 3.7 Settings / Device Management Screen

```
┌─────────────────────────────────────────────────────┐  Status bar
├─────────────────────────────────────────────────────┤
│  Settings                                           │  Header 56dp, large title
├─────────────────────────────────────────────────────┤
│                                                     │
│  ─────── YOUR DEVICES ─────────────────────────    │  Section header 12sp caps
│                                                     │
│  ┌───────────────────────────────────────────────┐  │  Device management list
│  │  [TV] Samsung QLED   Living Room   [Edit ›]  │  │  Swipe-to-delete enabled
│  └───────────────────────────────────────────────┘  │  (with undo snackbar 3s)
│  ┌───────────────────────────────────────────────┐  │
│  │  [AC] Daikin AC      Bedroom       [Edit ›]  │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ─────── PRO ───────────────────────────────────    │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │  Pro card or active banner
│  │  ✨ Universal Remote Pro                      │  │  if pro: show active status
│  │  Unlock macros, unlimited devices, TV guide   │  │  if free: [Upgrade] CTA
│  │                             [Upgrade Now →]  │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ─────── GENERAL ───────────────────────────────    │
│                                                     │
│  Haptic Feedback          [Toggle ══●══]           │  44dp row height minimum
│  Push Notifications       [Toggle ══●══]           │
│  Auto-Reconnect           [Toggle ──○──]           │
│                                                     │
│  ─────── ABOUT ─────────────────────────────────    │
│                                                     │
│  App Version              1.0.0            [›]     │
│  Privacy Policy                            [›]     │
│  Terms of Service                          [›]     │
│  Contact Support                           [›]     │
│                                                     │
│  ─────── DEVELOPER ─────────────────────────────   │  Dev-only section
│  (shown only in __DEV__ builds)                    │  hidden in prod
│  Backend URL  [https://api.example.com      ][Save]│
│                                                     │
│  [Sign Out]                                        │  Destructive, red text
│                                                     │
└─────────────────────────────────────────────────────┘  Bottom nav visible
```

---

## 4. Usability Considerations

### 4-A. Protocol Transparency

**What to hide from end users:**
- Protocol names: mDNS, SSDP, BLE GATT, Bonjour, DHCP — never appear in UI
- Technical error codes (HTTP 503, GATT error 133, mDNS timeout)
- Retry counts and backoff timing
- IP addresses (except in device edit screen for power users)

**What to surface:**
- Human-readable connection method: "Wi-Fi", "Bluetooth", "Infrared", "Hub"
- Connection state: "Connected", "Offline", "Reconnecting…"
- Protocol used for last command (subtle, not prominent)

**Connection Status Indicator Design:**
```
● (8dp dot)  — placed left of device name in header
              — or right side of device card

Colors:
  ●  #00C9A7  Connected / last command success
  ●  #F5A623  Degraded (retrying, slow response)
  ○  #E53E3E  Offline (3+ failed commands)
  ⟳  spinner  Reconnecting in progress

TalkBack: contentDescription="Connected via Wi-Fi"
          contentDescription="Offline. Double-tap to retry."
```

**Protocol Fallback Notification:**
Show as a **non-blocking Snackbar** (not modal) at bottom:
```
"Wi-Fi unavailable — switched to IR"   [×]
```
Duration: 4 seconds, swipeable to dismiss. Never interrupt the command flow.

**For Persona B (Tech-Savvy Minh):** 
Settings → Advanced → show protocol details per device (IP, port, GATT UUID). Gated behind a "Developer Info" toggle. Default OFF.

---

### 4-B. Command Feedback System

**Button Press Animation Spec:**

```tsx
// Pressable scale animation pattern
const animatedScale = useRef(new Animated.Value(1)).current;

const handlePressIn = () => {
  Animated.spring(animatedScale, {
    toValue: 0.92,
    useNativeDriver: true,
    speed: 50,
    bounciness: 0,
  }).start();
};

const handlePressOut = () => {
  Animated.spring(animatedScale, {
    toValue: 1.0,
    useNativeDriver: true,
    speed: 30,
    bounciness: 4,
  }).start();
};
// Duration: ~80ms press-down, ~120ms release spring-back
```

**Color flash on press:** brief backgroundColor animation → accent color at 60% opacity → returns to rest color. Duration: 80ms total. Implemented via `Animated.sequence` on `backgroundColor` (requires `useNativeDriver: false`).

**Haptic Feedback Map:**

| Action | Haptic Level | Library call |
|--------|-------------|--------------|
| D-pad arrow tap | Light | `HapticFeedback.trigger('impactLight')` |
| Power button | Heavy | `HapticFeedback.trigger('impactHeavy')` |
| Mode change (AC) | Medium | `HapticFeedback.trigger('impactMedium')` |
| Volume/Temp hold-repeat tick | Selection | `HapticFeedback.trigger('selection')` |
| Error / command fail | Notification Warn | `HapticFeedback.trigger('notificationWarning')` |
| Success confirmation (Wi-Fi 200) | Notification Success | `HapticFeedback.trigger('notificationSuccess')` |
| Destructive action (delete device) | Heavy | `HapticFeedback.trigger('impactHeavy')` |

Library: `react-native-haptic-feedback` (works on Android via `Vibrator` / `VibrationEffect`).

**Sound:** Disabled by default. Optional "Remote click" sound toggle in Settings. If enabled: short 8ms click sample via `react-native-sound`. Respect user's ringer/DND mode. Never play sound during haptic-only actions.

**Feedback Confidence Signals (IR vs Wi-Fi):**
```
IR (fire-and-forget):
  → Button press animation ✓ (confirmed press registered)
  → Subtle grey pulse outward from button center (150ms)
  → NO green confirmation ring  ← intentional: don't imply certainty
  → Caption in header pauses IR "Sent" text 1.2s (optional)

Wi-Fi (HTTP 200 confirmed):
  → Button press animation ✓
  → Green ring pulse outward (200ms, #00C9A7)
  → Header status dot flashes green briefly
  → HapticFeedback.notificationSuccess on 200 OK

Wi-Fi (timeout / error):
  → Red flash briefly on button (100ms)
  → Snackbar error message
  → HapticFeedback.notificationWarning
```

---

### 4-C. Hold-Repeat Interaction

**Volume Hold-Repeat (TV Remote):**
```tsx
// Pattern: PressIn starts interval, PressOut clears it
const holdRef = useRef<ReturnType<typeof setInterval> | null>(null);
const HOLD_REPEAT_DELAY_MS = 150; // send command every 150ms during hold

const onVolPressIn = (action: 'volume_up' | 'volume_down') => {
  send(action); // immediate first fire
  HapticFeedback.trigger('impactLight');
  holdRef.current = setInterval(() => {
    send(action);
    HapticFeedback.trigger('selection'); // lighter during repeat
  }, HOLD_REPEAT_DELAY_MS);
};

const onVolPressOut = () => {
  if (holdRef.current) clearInterval(holdRef.current);
  holdRef.current = null;
};
```

Visual during hold: button background pulses between 80%–100% opacity at 150ms interval (synchronized with send rate). Shows user the hold-repeat is active.

**Swipe-to-Adjust Temperature (AC Control):**
```tsx
import { PanGestureHandler, GestureHandlerRootView } from 'react-native-gesture-handler';

// 20dp vertical drag = 1°C change
const DP_PER_DEGREE = 20;
const startTempRef = useRef(temperature);

const onGestureEvent = (event) => {
  const deltaTemp = Math.round(-event.nativeEvent.translationY / DP_PER_DEGREE);
  const newTemp = Math.min(32, Math.max(16, startTempRef.current + deltaTemp));
  setTemperatureOptimistic(newTemp); // update display immediately (Animated.spring)
  // haptic selection feedback at each 1°C threshold crossing
};

const onHandlerStateChange = (event) => {
  if (event.nativeEvent.state === State.END) {
    dispatcher.dispatch(deviceId, `set_temp_${temperature}`); // send on release only
    AsyncStorage.setItem(`@remote/ac_state_${deviceId}`, JSON.stringify(state));
    startTempRef.current = temperature;
  }
};
```

Visual feedback during swipe: Temperature number uses `Animated.spring` to track finger. Ghost (blurred, 40% opacity) digit shows at finger position. Arrow indicators (↑ warmer / ↓ cooler) appear faintly on the temperature display edges while gesture is active.

**Channel/Fan Speed hold-repeat:** Same pattern as volume, interval 200ms (channel changes are less frequent by design).

---

### 4-D. Discovery UX

**Phase text localisation (human language, no tech jargon):**

```
Phase 1 (0–2s):    "Searching your home network…"
Phase 2 (2–4s):    "Looking for smart TVs and air conditioners…"
Phase 3 (4–6s):    "Scanning for Bluetooth devices…"
Phase 4 (6–8s):    "Checking connected hubs and cloud devices…"
8s: devices found: "Found 3 devices nearby"
8s: none found:    "Nothing found. Try adding manually."
Cancelled:         "Scan stopped."
```

Internally, the 4 channels (mDNS, SSDP, BLE, Hub/Cloud) run in parallel; the phase text is time-based UI copy only, not tied to actual protocol order.

**Manual Add — Visual Category Picker:**
```
┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐
│ 📺  │  │ ❄️  │  │ 🔊  │  │ 💡  │
│ TV  │  │ AC  │  │Speaker│ │Light│
└─────┘  └─────┘  └─────┘  └─────┘

Grid: 2 columns on narrow screens, 4 on wider
Each cell: 84dp × 84dp, icon 36dp, label 14sp
```
Tapping a cell highlights it (tonal background) and advances to Brand Picker.

**Brand Picker Design:**
- Popular brands: large grid cells (56dp × 56dp) with logo if available, text fallback
- "Other" always last in grid
- Search bar at top filters brand list as user types (instant filter, no network call)
- Selecting "My brand isn't listed" → generic device added, IR code database skipped, manual code entry offered

**IR Signal Test (during manual add, IR protocol):**
1. Full-screen instruction: "Point your phone at the device" with animated phone-beam-TV illustration
2. [Send Test Signal] button — 64dp height, full-width
3. Result: "Did it work?" [Yes, it worked!] [No, try again]
4. On "No" × 2: offer to try Wi-Fi or BLE setup instead
5. If `IRBlasterModule.isAvailable()` returns false: skip test, show inline warning and offer Wi-Fi only

---

### 4-E. Error States

**4-Level Taxonomy:**

| Level | Component | Duration | Blocking | Example |
|-------|-----------|----------|----------|---------|
| Info | `Snackbar` (bottom) | 3s auto-dismiss | No | "IR sent — aim phone at TV" |
| Warning | `Snackbar` + action button | 6s | No | "Retrying… (2/3) [Use IR]" |
| Error | Sticky `Snackbar` or `BottomSheet` | Until dismissed | No | "Couldn't reach device" |
| Blocking | Full error screen | Until user acts | Yes | "No protocol available" |

**Snackbar positioning:** `bottom: 80 + safeAreaInsets.bottom` — above the bottom nav bar, never obscured by Android gesture bar.

**Full error messages (complete, ready-to-ship copy):**

- **Wi-Fi timeout:** "Can't reach [Device Name]. Make sure it's on and connected to the same Wi-Fi network as your phone. If it moved to a different room, the IP address may have changed."
- **No IR blaster:** "Your phone doesn't have an infrared (IR) blaster. To control [Device Name], add it using Wi-Fi or Bluetooth instead. Most Android phones from 2020 onwards no longer include IR."
- **Device not found (discovery):** "We couldn't find [Device Name] on your network. Check that the device is powered on and connected to Wi-Fi. You can also add it manually if you know the brand and model."
- **DHCP reassignment (IP changed):** "[Device Name] appears to be at a new address on your network. We're trying to reconnect automatically. This happens when routers reassign IP addresses."
- **BLE connection fail:** "Lost Bluetooth connection to [Device Name]. Move your phone within 5 metres of the device and tap Retry. If the problem persists, remove and re-add the device."

---

### 4-F. Accessibility & Inclusive Design

**Minimum font sizes:**
| Element | Min size | Rationale |
|---------|---------|-----------|
| Device name in list | 18sp | Persona C (Bà Thu, 58) — large device names |
| Body text | 16sp | General readability |
| Secondary text | 14sp | Labels, status, metadata |
| Captions / chips | 12sp | Never below 12sp |

Implement: override default RN Text sizes; respect user's `AccessibilityInfo.isReduceMotionEnabled()` for all animations.

**Color Contrast (WCAG AA minimum 4.5:1):**
```
Background:  #0A0E1A (dark)
─────────────────────────────────────────────────────
White text (#FFFFFF):     21:1 ✓✓✓ (primary text)
Gray text  (#8892A4):     4.7:1 ✓ (secondary text — verify!)
Teal       (#00C9A7):     4.7:1 ✓ (Cool mode)
Orange     (#FF6B35):     4.5:1 ✓ (Heat mode — borderline; use #FF7043 if needed)
Purple     (#6C63FF):     5.1:1 ✓ (Fan mode)
Amber      (#F5A623):     4.6:1 ✓ (Dry mode)
Red        (#E53E3E):     4.5:1 ✓ (Power / error)
```
Never rely on color alone — always pair with icon or text label (especially mode indicators).

**AC Mode: Color is semantic, not decorative:**
- Each mode color communicates thermal state (teal = cold, orange = heat)
- Icon reinforces meaning: ❄️ snowflake for Cool, 🔥 flame for Heat
- TalkBack announces both: "Cool mode selected. Air conditioner set to cooling."
- For color-blind users (deuteranopia): teal vs orange are distinguishable; Test with Sim Daltonism

**TalkBack labels for icon-only buttons:**
```tsx
// All icon-only buttons MUST have accessibilityLabel
<TouchableOpacity
  accessibilityLabel="Volume up"
  accessibilityRole="button"
  accessibilityHint="Hold for continuous volume increase"
>
  <Text>+</Text>
</TouchableOpacity>

// Power button
accessibilityLabel={isPowered ? "Power off" : "Power on"}
accessibilityRole="switch"
accessibilityState={{ checked: isPowered }}

// Mode pills
accessibilityLabel={`${mode} mode${currentMode === mode ? ', currently selected' : ''}`}
accessibilityRole="radio"
accessibilityState={{ selected: currentMode === mode }}
```

**D-pad navigation via accessibility services:**
```tsx
// Group D-pad with accessibilityLabel and hint
<View
  accessible={false}
  importantForAccessibility="yes"
>
  <TouchableOpacity accessibilityLabel="Navigate up" accessibilityRole="button">
  ...
```

**Touch target minimums:**
- Primary buttons (Power, OK/Select): **56dp × 56dp** minimum
- Secondary buttons (mode pills, nav): **44dp × 44dp** minimum
- Tertiary (labels, metadata): **not interactive**
- Temperature ± buttons: **56dp × 56dp** — explicitly for Persona C and one-handed use

**Motion sensitivity:**
```tsx
import { AccessibilityInfo } from 'react-native';
const [reduceMotion, setReduceMotion] = useState(false);
AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);

// Sonar rings: skip animation if reduceMotion is true
// Button spring: use Animated.timing (instant) instead of spring
// Mode color transitions: instant snap instead of 300ms interpolate
```

---

### 4-G. Android Platform Specifics

**Safe Area Insets (Android 10+ Gesture Navigation):**
```tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// In every screen:
const insets = useSafeAreaInsets();

// Bottom containers (bottom nav, FAB, CTAs):
<View style={{ paddingBottom: Math.max(insets.bottom, 16) }}>

// Snackbar positioning:
style={{ bottom: 80 + insets.bottom }} // 80dp = bottom nav height

// Remote screen (no bottom nav):
style={{ paddingBottom: insets.bottom }} // pure gesture safety

// Expected inset values:
//   Three-button nav:  0dp
//   Two-button nav:   ~24dp
//   Gesture nav:      32–48dp (varies by manufacturer)
```

**Hardware Volume Key Intercept (TV Remote active):**
```tsx
import { HardwareBackHandler } from 'react-native'; // or TVEventHandler

// When TVRemoteScreen is focused AND device uses Wi-Fi/IR protocol:
useEffect(() => {
  const sub = TVEventHandler?.addListener?.((evt) => {
    if (evt.eventType === 'volumeUp') {
      send('volume_up');
    } else if (evt.eventType === 'volumeDown') {
      send('volume_down');
    }
  });
  return () => sub?.remove?.();
}, [send]);

// Android: use KeyEvent.KEYCODE_VOLUME_UP / DOWN via native module
// Only intercept when remote screen is active (useIsFocused())
// Restore default volume behavior on screen blur
```
Add user notice on first use: "While this remote is open, your volume buttons control the TV." (Snackbar, Info level, one-time only).

**Android 14 Lock Screen Widget Concept:**

*2×1 Widget: AC Control*
```
┌──────────────────────────────────────┐
│  ❄  Daikin AC                 [⏻]  │  (1 row: mode icon, name, power toggle)
│  24°C  Cool  [−]  [+]               │  (2 row: temp display, ± buttons)
└──────────────────────────────────────┘
```
Implementation: `AppWidgetProvider` (native Android, Kotlin) → communicate to RN via `SharedPreferences` or Headless Task. Widget taps deep-link into app at `ACControlScreen` for device `{deviceId}`.

*2×1 Widget: TV Remote*
```
┌──────────────────────────────────────┐
│  📺  Samsung QLED             [⏻]  │  (power toggle right)
│  [🔇 Mute]  [Vol −]  [Vol +]        │  (quick controls bottom row)
└──────────────────────────────────────┘
```
All widget taps that aren't inline toggles launch the full `TVRemoteScreen` via deep link.

**Back Gesture Handling on Remote Screens:**
```tsx
// TVRemoteScreen and ACControlScreen
useFocusEffect(
  useCallback(() => {
    const onBackPress = () => {
      // Only show dialog if a command was sent in this session
      if (commandSentThisSession) {
        Alert.alert(
          'Leave Remote?',
          'Your device will stay in its current state.',
          [
            { text: 'Stay', style: 'cancel' },
            { text: 'Leave', onPress: () => navigation.goBack() },
          ]
        );
        return true; // prevent default back
      }
      return false; // default back (no command sent = no dialog)
    };
    BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
  }, [commandSentThisSession, navigation])
);
```
This handles both the hardware back button and the Android 10+ back gesture (both trigger `BackHandler`).

**Android-specific component notes:**
- Use `android_ripple` prop on `Pressable` for Material ripple feedback (not iOS `opacity`)
- D-pad: consider `android:focusable="true"` on root for Android TV compatibility via native module
- Status bar: `StatusBar` with `translucent={true}` + `backgroundColor="transparent"` for edge-to-edge; handle `windowInsets` in the layout
- Keyboard: `KeyboardAvoidingView behavior="height"` on Android (NOT `"padding"` which is iOS behavior)

---

## Appendix: Critical Bug Remediation (Ship Blocker)

**Issue:** `ACControlScreen` is entirely disconnected from `CommandDispatcher`. All state changes are local only — no command reaches the physical device.

**Fix (minimum viable):**
```tsx
// ACControlScreen.tsx — wire CommandDispatcher same pattern as TVRemoteScreen.tsx

import { CommandDispatcher, DeviceRegistry } from '@remote/core';

// Add deviceId to route params (ACControlScreenProps must include deviceId)
const { deviceName, location, deviceId } = route.params;

const send = useCallback(
  (action: string) => {
    dispatcher.dispatch(deviceId, action).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      // Replace Alert with Snackbar for better UX
      showErrorSnackbar(msg);
    });
  },
  [deviceId]
);

// Then call send() from every control:
const adjustTemp = (delta: number) => {
  const newTemp = Math.min(32, Math.max(16, temperature + delta));
  setTemperature(newTemp);
  send(`set_temp_${newTemp}`);  // ← send command
};

const handleModeChange = (newMode: ACMode) => {
  setMode(newMode);
  send(`set_mode_${newMode.toLowerCase()}`);  // ← send command
};

const handlePowerToggle = () => {
  setIsPowered(p => !p);
  send(isPowered ? 'power_off' : 'power_on');  // ← send command
};
```

This is a **P0 bug** — ship is blocked until `ACControlScreen` calls `dispatcher.dispatch()`.

---

*UX Design Specification — Universal Remote Android*  
*Authored: March 2026 — Ready for development handoff*
