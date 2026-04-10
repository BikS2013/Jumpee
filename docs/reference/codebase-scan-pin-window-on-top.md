# Codebase Scan: Pin Window on Top

**Date:** 2026-04-10
**Purpose:** Provide architectural context for implementing the "pin window on top" feature.

---

## 1. Project Overview

Jumpee is a single-file Swift/AppKit menu bar app compiled with `swiftc` (no SPM/Xcode project). The entire application lives in one source file:

- **Source:** `Sources/main.swift` (~1567 lines)
- **Build:** `build.sh` -- compiles with `swiftc -O -framework Cocoa`, creates `.app` bundle, ad-hoc code-signs
- **Config:** `~/.Jumpee/config.json` (JSON, loaded/saved via `Codable`)
- **Current version:** 1.3.0

The app runs as a menu bar accessory (`LSUIElement = true`, `.accessory` activation policy) with no Dock icon.

---

## 2. Module Map

All code is in `Sources/main.swift`. The file is organized with `// MARK:` sections. Below are the key classes/structs, their line ranges, and responsibilities.

### Private CGS API Declarations (lines 4-29)

```swift
@_silgen_name("CGSMainConnectionID") func CGSMainConnectionID() -> Int32
@_silgen_name("CGSGetActiveSpace") func CGSGetActiveSpace(_ cid: Int32) -> Int
@_silgen_name("CGSCopyManagedDisplaySpaces") func CGSCopyManagedDisplaySpaces(_ cid: Int32) -> CFArray
@_silgen_name("CGSGetSymbolicHotKeyValue") func CGSGetSymbolicHotKeyValue(...)
@_silgen_name("CGSIsSymbolicHotKeyEnabled") func CGSIsSymbolicHotKeyEnabled(...)
@_silgen_name("CGSSetSymbolicHotKeyEnabled") func CGSSetSymbolicHotKeyEnabled(...)
@_silgen_name("_AXUIElementGetWindow") func _AXUIElementGetWindow(...)
```

**Relevance:** The pin feature will add two new declarations here:
- `CGSSetWindowLevel(_ connection: Int32, _ windowID: CGWindowID, _ level: Int32) -> CGError`
- `CGSGetWindowLevel(_ connection: Int32, _ windowID: CGWindowID, _ level: UnsafeMutablePointer<Int32>) -> CGError`

### Configuration Structs (lines 32-152)

| Struct | Lines | Purpose |
|--------|-------|---------|
| `OverlayConfig` | 34-54 | Overlay appearance settings (Codable) |
| `HotkeyConfig` | 56-105 | Key + modifiers for global hotkeys (Codable). Has `keyCode`, `carbonModifiers`, `displayString` computed properties. |
| `MoveWindowConfig` | 107-111 | Simple `{ enabled: Bool }` struct for move-window feature toggle |
| `JumpeeConfig` | 113-152 | Top-level config. Contains `spaces`, `showSpaceNumber`, `overlay`, `hotkey`, `moveWindow?`, `moveWindowHotkey?`. Has `load()` and `save()` methods. |

**Relevance:** The pin feature adds:
- `PinWindowConfig` struct (analogous to `MoveWindowConfig`): `{ enabled: Bool }`
- `pinWindow: PinWindowConfig?` field on `JumpeeConfig`
- `pinWindowHotkey: HotkeyConfig?` field on `JumpeeConfig`
- `effectivePinWindowHotkey` computed property (following `effectiveMoveWindowHotkey` pattern at line 123)

### SpaceDetector (lines 201-323)

Manages all space/display detection via private CGS APIs. Not directly relevant to pin-on-top, but the `connectionID` pattern (line 204: `CGSMainConnectionID()`) is the same connection needed for `CGSSetWindowLevel`.

### OverlayWindow / OverlayManager (lines 327-473)

Desktop watermark overlay. Not directly relevant, but demonstrates how Jumpee creates its own windows with specific `NSWindow.Level` values (line 341: `CGWindowLevelForKey(.desktopWindow) + 1`).

### SpaceNavigator (lines 477-514)

Static class for navigating between spaces via synthesized keyboard events. Includes `checkAccessibility()` (line 492) which prompts for Accessibility permissions.

### WindowMover (lines 518-647)

**Most relevant existing class.** Static class that moves the focused window to another desktop.

Key patterns used by WindowMover that pin-on-top will reuse:

1. **Getting the focused window via Accessibility API** (lines 551-564):
   ```swift
   let systemWide = AXUIElementCreateSystemWide()
   var focusedApp: CFTypeRef?
   AXUIElementCopyAttributeValue(systemWide, kAXFocusedApplicationAttribute as CFString, &focusedApp)
   var focusedWindow: CFTypeRef?
   AXUIElementCopyAttributeValue(focusedApp as! AXUIElement, kAXFocusedWindowAttribute as CFString, &focusedWindow)
   let window = focusedWindow as! AXUIElement
   ```

2. **`_AXUIElementGetWindow` for CGWindowID** (declared at line 28, not directly called in WindowMover but available):
   ```swift
   @_silgen_name("_AXUIElementGetWindow")
   func _AXUIElementGetWindow(_ element: AXUIElement, _ windowID: UnsafeMutablePointer<CGWindowID>) -> AXError
   ```

3. **System shortcut enablement check** (lines 643-647):
   ```swift
   static func areSystemShortcutsEnabled() -> Bool
   ```

### HotkeySlot Enum (lines 651-654)

```swift
private enum HotkeySlot {
    case dropdown
    case moveWindow
}
```

**Relevance:** Add a `.pinWindow` case here.

### GlobalHotkeyManager (lines 686-752)

Manages Carbon hotkey registration. Currently handles two hotkeys:
- `hotkeyRef` (id=1) for dropdown
- `moveWindowHotkeyRef` (id=2) for move-window

Key method signature (line 691):
```swift
func register(config: HotkeyConfig, moveWindowConfig: HotkeyConfig?)
```

**Relevance:** Extend to accept a third optional `pinWindowConfig: HotkeyConfig?` parameter and register with id=3. Add `pinWindowHotkeyRef` field.

### hotkeyEventHandler (lines 660-684)

Global C function dispatching hotkey events by ID:
```swift
switch hotKeyID.id {
case 1: globalMenuBarController?.openMenu()
case 2: globalMenuBarController?.openMoveWindowMenu()
default: break
}
```

**Relevance:** Add `case 3: globalMenuBarController?.togglePinWindow()`.

### MenuBarController (lines 756-1547)

The main controller class (~800 lines). Manages:
- Status bar item and menu
- Space detection and overlay updates
- Hotkey registration lifecycle
- All user interactions (rename, navigate, move window, config, about)

Key methods for integration:

| Method | Lines | Relevance |
|--------|-------|-----------|
| `init()` | 764-782 | Setup sequence; calls `reRegisterHotkeys()` |
| `openMoveWindowMenu()` | 788-830 | Pattern for popup menu at cursor -- pin feedback could follow similar UX |
| `setupMenu()` | 869-953 | Static menu items. Add pin/unpin item and pin hotkey editor item here |
| `rebuildSpaceItems()` | 973-1148 | Dynamic menu items rebuilt on open. Pin/unpin text should update here based on focused window state |
| `reRegisterHotkeys()` | 1511-1518 | Calls `hotkeyManager?.register(...)` -- extend to pass pin config |
| `reloadConfig()` | 1527-1532 | Reloads config and re-registers hotkeys |
| `editHotkey(slot:)` | 1355-1499 | Hotkey editor dialog. Already supports multiple slots via `HotkeySlot` enum |
| `quit()` | 1534-1538 | Cleanup -- should call `WindowPinner.unpinAll()` |

### AppDelegate (lines 1551-1558)

Minimal delegate; creates `MenuBarController` on launch.

### Main entry point (lines 1562-1566)

```swift
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
```

---

## 3. Conventions

### Coding Patterns

1. **Single-file architecture:** Everything in `Sources/main.swift`. No modules, no packages.
2. **Static utility classes:** `WindowMover` and `SpaceNavigator` use only static methods -- no instances. `WindowPinner` should follow the same pattern.
3. **Private APIs via `@_silgen_name`:** All private CGS APIs are declared at the top of the file with their C function signatures.
4. **Accessibility API pattern:** `AXUIElementCreateSystemWide()` -> `kAXFocusedApplicationAttribute` -> `kAXFocusedWindowAttribute` -> cast to `AXUIElement`. This pattern is established in `WindowMover.moveToSpace()` (lines 551-564).
5. **MARK sections:** Code is organized with `// MARK: -` comments.
6. **Codable config:** All config structs conform to `Codable`. Optional fields (like `moveWindow`, `moveWindowHotkey`) use Swift optionals for backward compatibility with existing config files.
7. **Feature gating:** Optional features use a `FeatureConfig` struct with `enabled: Bool` (see `MoveWindowConfig`). Menu items and hotkeys are conditionally shown/registered.
8. **Carbon hotkey IDs:** Unique UInt32 IDs with a shared signature (`0x4A4D5045` = "JMPE"). Current IDs: 1 (dropdown), 2 (move-window).
9. **Hotkey editor:** Generic `editHotkey(slot:)` method dispatches on `HotkeySlot` enum. Adding a new slot is straightforward.
10. **Menu tag convention:** Static items use tags for lookup: 100 (toggle space number), 101 (toggle overlay), 200 (rename), 300 (dropdown hotkey), 301 (move-window hotkey).

### Config Approach

- File: `~/.Jumpee/config.json`
- Loaded with `JSONDecoder`, saved with `JSONEncoder` (pretty-printed, sorted keys)
- New optional fields are backward-compatible (existing configs without `pinWindow` will work)
- Default hotkeys are provided via computed properties (e.g., `effectiveMoveWindowHotkey`)
- Exception to no-default-fallback rule is documented in "Issues - Pending Items.md"

---

## 4. Integration Points

### 4.1 New Private API Declarations (top of file, after line 29)

Add:
```swift
@_silgen_name("CGSSetWindowLevel")
func CGSSetWindowLevel(_ connection: Int32, _ windowID: CGWindowID, _ level: Int32) -> CGError

@_silgen_name("CGSGetWindowLevel")
func CGSGetWindowLevel(_ connection: Int32, _ windowID: CGWindowID, _ level: UnsafeMutablePointer<Int32>) -> CGError
```

### 4.2 New Config Structs (after `MoveWindowConfig`, ~line 111)

Add `PinWindowConfig` struct (same pattern as `MoveWindowConfig`).

### 4.3 JumpeeConfig Extensions (lines 113-152)

Add fields:
- `var pinWindow: PinWindowConfig?`
- `var pinWindowHotkey: HotkeyConfig?`
- `var effectivePinWindowHotkey: HotkeyConfig` (computed, default Ctrl+Cmd+P)

### 4.4 New WindowPinner Class (after WindowMover, ~line 647)

Static class with:
- `private static var pinnedWindows: Set<CGWindowID> = []`
- `static func togglePin()` -- gets focused window, gets CGWindowID via `_AXUIElementGetWindow`, toggles level
- `static func isPinned(_ windowID: CGWindowID) -> Bool`
- `static func unpinAll()`
- `static func cleanupClosedWindows()` -- check against `CGWindowListCopyWindowInfo`
- Uses `CGSMainConnectionID()` for the connection parameter

### 4.5 HotkeySlot Enum (line 651)

Add `.pinWindow` case.

### 4.6 hotkeyEventHandler (line 674)

Add `case 3: globalMenuBarController?.togglePinWindow()`.

### 4.7 GlobalHotkeyManager (lines 686-752)

- Add `private var pinWindowHotkeyRef: EventHotKeyRef?`
- Extend `register()` signature to accept `pinWindowConfig: HotkeyConfig?`
- Register with `EventHotKeyID(signature: 0x4A4D5045, id: 3)`
- Unregister in `unregister()`

### 4.8 MenuBarController (lines 756-1547)

- `setupMenu()`: Add "Pin Window on Top" / "Unpin Window" item (tag 302 suggested) and "Pin Window Hotkey: ..." item (tag 303), both conditional on `pinWindow.enabled`
- `rebuildSpaceItems()`: Update pin item title based on `WindowPinner.isPinned(currentFocusedWindowID)`
- Add `togglePinWindow()` method (called by hotkey handler)
- Add `editPinWindowHotkey()` method (calls `editHotkey(slot: .pinWindow)`)
- `editHotkey(slot:)`: Add `.pinWindow` case with appropriate defaults and conflict checks against the other two hotkeys
- `reRegisterHotkeys()`: Pass pin config to `hotkeyManager`
- `quit()`: Call `WindowPinner.unpinAll()` before termination

### 4.9 Focused Window CGWindowID Retrieval

The pattern to get CGWindowID from the focused window (combining existing code):
```swift
let systemWide = AXUIElementCreateSystemWide()
var focusedApp: CFTypeRef?
AXUIElementCopyAttributeValue(systemWide, kAXFocusedApplicationAttribute as CFString, &focusedApp)
var focusedWindow: CFTypeRef?
AXUIElementCopyAttributeValue(focusedApp as! AXUIElement, kAXFocusedWindowAttribute as CFString, &focusedWindow)
var windowID: CGWindowID = 0
_AXUIElementGetWindow(focusedWindow as! AXUIElement, &windowID)
```

Then use `CGSSetWindowLevel(CGSMainConnectionID(), windowID, level)` where:
- Pin: `level = 3` (kCGFloatingWindowLevel)
- Unpin: `level = 0` (kCGNormalWindowLevel)

### 4.10 Cleanup of Closed Pinned Windows

Use `CGWindowListCopyWindowInfo(.optionAll, kCGNullWindowID)` to get all active window IDs, then remove any pinned IDs not in the list. This can be called:
- Before checking `isPinned` in menu rebuild
- On space change notification
- On a periodic timer (optional)

---

## 5. Risk Areas

1. **CGSSetWindowLevel availability:** Must be verified on macOS 13-15. The function signature and behavior need testing. If unavailable, the feature cannot proceed.
2. **Level persistence:** macOS might reset window levels on certain events (app activation, space switch). Needs testing.
3. **Hotkey conflict:** Default Ctrl+Cmd+P is safe. The existing conflict-check logic in `editHotkey(slot:)` needs extension from 2-way to 3-way comparison.
4. **Menu state accuracy:** The pin/unpin menu item text depends on knowing the focused window's ID at menu-open time. If the focused app changes when Jumpee's menu activates, the window ID might refer to Jumpee itself rather than the target app. The `openMoveWindowMenu()` popup pattern avoids this issue for move-window; pin should similarly handle this.
