# Macro Feature — Quick Actions

## Overview

Macros (called **Quick Actions** in the UI) let users trigger a sequence of device commands with a single tap. Each macro stores an ordered list of steps, where each step targets one device command with a configurable delay after it completes.

---

## Scope & Design Philosophy

### What macros ARE
- **Local, on-device automation** — no cloud dependency, no scheduling
- **Instant execution** — tap to run right now
- **Multi-device sequences** — TV on, HDMI switch, AC set, all in order
- **Honest UX** — per-step status so users know exactly what succeeded or failed

### What macros are NOT
- Not scheduled/time-based triggers (that's a future "Schedules" feature)
- Not conditional logic (if–then) — steps always run in order
- Not cross-account shared macros (planned for Pro cloud sync)

---

## Data Model

### `StoredMacro`
Persisted in AsyncStorage under key `@remote/macros`.

```ts
interface StoredMacro {
  id: string;          // e.g. "macro_1700000000000_abc12"
  name: string;        // User-visible name
  iconName: string;    // Ionicons icon name
  color: string;       // Hex colour for icon/accent
  steps: StoredMacroStep[];
  createdAt: number;   // Unix ms
  updatedAt: number;
}
```

### `StoredMacroStep`
```ts
interface StoredMacroStep {
  id: string;
  deviceId: string;         // Links to StoredDevice.id
  deviceNickname: string;   // Cached — shown even if device is later deleted
  deviceCategory: string;   // Used for icon look-up
  deviceColor: string;      // Cached for visual consistency
  action: string;           // Command key e.g. "power_on", "vol_up"
  actionLabel: string;      // Display string e.g. "Volume Up"
  delayAfterMs: number;     // Wait time AFTER this step before next (default 500ms)
}
```

---

## Execution Model

### Retry strategy

| Protocol | Retries | Rationale |
|---|---|---|
| IR (infrared) | 2× | Fire-and-forget; cheap to resend; receiver can't confirm |
| Wi-Fi / HTTP | 1× | Has TCP ACK; one retry recovers transient failure |
| BLE | 1× | Connection confirmation available |

### Failure handling
- `continueOnError: true` (default) — remaining steps execute even if one fails
- Each step result is captured: `success`, `failed`, `skipped`, or `aborted`
- AbortSignal support — user can tap **Stop** to cancel mid-run; remaining steps become `skipped`

### Current simulation
Until CommandDispatcher is fully wired to live devices, execution is **simulated** based on the device's `is_online` flag in AsyncStorage:
- Online device → `success` (120–300ms simulated latency)
- Offline device → `failed` with "Device is offline" error

When real protocol integration lands, only `runMacro()` in `macroStore.ts` needs to be updated — the UI layer is already built to handle async step results.

---

## UX Flow

### MacroScreen (list)
1. Empty state → prompt to create first macro
2. Each row shows: icon, name, step count, **Run** button
3. Tap row → `MacroEditorScreen` (edit mode)
4. Tap **Run** → `MacroRunModal`

### MacroRunModal (3 phases)
1. **Preview** — shows all steps; user confirms by tapping "Run Now"
2. **Running** — live per-step indicators:
   - `pending` — dim numbered circle
   - `running` — spinner + pulsing highlight
   - `success` — green checkmark + duration (e.g. "OK · 142ms")
   - `failed` — red X + error message
   - `skipped` — grey, if run was aborted
3. **Done** — summary ("X/N steps succeeded · 2.1s"), "Run Again" if any failed, "Close"

### MacroEditorScreen
1. Name input
2. Icon picker (scrollable row of Ionicons)
3. Colour picker (8 preset swatches)
4. Steps list with per-step:
   - Up/down reorder buttons
   - Delete button
   - Delay input (ms) between steps
5. **Add Step** → bottom sheet picker:
   - Phase 1: pick device from stored devices
   - Phase 2: pick command from category command catalog
6. **Create Macro** / **Save Changes** button
7. **Delete** button (edit mode only, with confirmation)

---

## Command Catalog

Commands are defined per device category in `CATEGORY_COMMANDS` (in `macroStore.ts`).

| Category | Sample commands |
|---|---|
| `tv` | power_toggle, power_on/off, vol_up/down, mute, hdmi1/2, netflix, youtube |
| `ac` | power_on/off, temp_up/down, mode_cool/heat, fan_auto/high/low, swing |
| `speaker` | power_toggle, vol_up/down, mute, play, pause, next, prev |
| `soundbar` | power_toggle, vol_up/down, mute, mode_tv/music/movie |
| `projector` | power_on/off, source_hdmi, vol_up/down |
| `fan` | power_on/off, speed_up/down, oscillate |
| `light` | power_on/off, bright_up/down, warm/cool white |
| `other` | power_toggle, power_on/off |

---

## File Structure

```
apps/remote-universal/src/
  lib/
    macroStore.ts         AsyncStorage CRUD + execution simulator + CATEGORY_COMMANDS
  hooks/
    useMacros.ts          React hook: macros[], create, update, remove, reorder
  components/
    MacroRunModal.tsx     Run progress bottom sheet (preview → running → done)
  screens/
    MacroScreen.tsx       List view with Run buttons + empty state
    MacroEditorScreen.tsx  Name/icon/color/steps editor + step picker

packages/core/src/
  types/
    Command.ts            MacroStepStatus, MacroStepResult, MacroRunResult, MacroRunOptions
  commands/
    MacroEngine.ts        Core execution engine with retry + progress callbacks
```

---

## Known Limitations

1. **No real hardware dispatch** — currently simulated; each step either succeeds or fails based on the device's stored `is_online` flag
2. **No pre-flight reachability check** — devices are not pinged before run; "offline" is based on the last-seen status
3. **IR confirmation impossible** — IR is fire-and-forget; we retry but cannot verify the command was received
4. **No step timeout** — a frozen Wi-Fi device could block the queue indefinitely (to be fixed with per-step timeout in CommandDispatcher)
5. **Macros reference device by ID** — if a device is deleted from HomeScreen, its cached `deviceNickname` is still shown but the command will fail

---

## Future Roadmap

- [ ] Wire CommandDispatcher to real protocol implementations
- [ ] Add per-step timeout (default 5s)
- [ ] Pre-flight ping check before run
- [ ] Cloud sync for macros (Pro tier)
- [ ] Macro Templates ("Movie Night starter kit")
- [ ] Widget / home screen shortcut to run a macro
- [ ] Scheduled macros ("Run Sleep Mode at 11 PM")
