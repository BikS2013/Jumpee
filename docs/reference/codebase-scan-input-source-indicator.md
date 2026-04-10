# Codebase Scan: Input Source Indicator Feature

**Date:** 2026-04-10
**Purpose:** Analyze Jumpee's existing architecture to identify integration points for the input source indicator feature.

---

## 1. Project Overview

| Attribute | Value |
|-----------|-------|
| **Language** | Swift (AppKit/Cocoa) |
| **Build system** | Shell script (`build.sh`) using `swiftc` directly -- no Xcode project or SPM |
| **Source files** | Single file: `Sources/main.swift` (~2050 lines) |
| **Build output** | `build/Jumpee.app` (standard .app bundle with Info.plist, ad-hoc code signed) |
| **Config location** | `~/.Jumpee/config.json` |
| **Frameworks** | `Cocoa`, `Carbon.HIToolbox` (already imported) |
| **macOS target** | 13.0+ |
| **App type** | Menu bar only (`LSUIElement = true`, activation policy `.accessory`) |

### Directory Layout

```
Jumpee/
  Sources/
    main.swift            # ALL application code (single file)
  build.sh                # Compiles with swiftc, creates .app bundle, code-signs
  build/                  # Build output (.app bundle)
  dist/                   # Distribution artifacts
  homebrew-tap/           # Homebrew cask formula
  docs/
    design/               # Plans, project design, config guide
    reference/            # Codebase scans, investigations, refined requests
  CLAUDE.md
  README.md
  Issues - Pending Items.md
```

---

## 2. Module Map

All code lives in `Sources/main.swift`. The file is organized with `// MARK:` sections. Below are the key modules (top-to-bottom order in the file):

### Private CGS API Declarations (lines 1-43)
- `CGSMainConnectionID`, `CGSGetActiveSpace`, `CGSCopyManagedDisplaySpaces`
- Symbolic hotkey APIs (`CGSGetSymbolicHotKeyValue`, etc.)
- `_AXUIElementGetWindow`, `CGSSetWindowLevel`, `CGSGetWindowLevel`
- `JumpeeCGWindowListCreateImage` (workaround for deprecated API)

### Configuration Structs (lines 47-179)
- **`OverlayConfig: Codable`** -- watermark overlay settings (enabled, opacity, fontName, fontSize, fontWeight, position, textColor, margin). Has `static let defaultConfig`.
- **`HotkeyConfig: Codable`** -- key + modifiers, with computed properties `keyCode`, `carbonModifiers`, `displayString`. Has `static let defaultConfig`.
- **`MoveWindowConfig: Codable`** -- just `enabled: Bool`.
- **`PinWindowConfig: Codable`** -- just `enabled: Bool`.
- **`JumpeeConfig: Codable`** -- root config struct with fields: `spaces`, `showSpaceNumber`, `overlay`, `hotkey`, `moveWindow?`, `moveWindowHotkey?`, `pinWindow?`, `pinWindowHotkey?`. Has `load()` and `save()` methods. Optional feature configs are `nil` when absent.

### Utility Extensions (lines 182-213)
- `NSColor.fromHex(_:)` -- hex string to NSColor
- `fontWeight(from:)` -- string to `NSFont.Weight`

### SpaceDetector (lines 217-350)
- Detects current space ID, enumerates all spaces across displays
- `getCurrentSpaceInfo()` returns displayID, localPosition, globalPosition, spaceID
- `getActiveDisplayID()` -- returns UUID string of the display containing active space
- `displayIDToScreen(_:)` -- maps display UUID to `NSScreen`

### OverlayWindow (lines 354-450)
- `NSWindow` subclass for the desktop watermark
- Borderless, click-through (`ignoresMouseEvents = true`)
- Level: `desktopWindow + 1` (below everything, on the desktop)
- Collection behavior: `.canJoinAllSpaces`, `.stationary`
- `updateText(_:config:)` method to change text and restyle
- Private `positionLabel(in:config:)` handles positioning via config's `position` string

### OverlayManager (lines 454-500)
- Manages a single `OverlayWindow?` instance
- `updateOverlay(config:)` -- creates or updates the overlay based on current space and config
- `removeAllOverlays()` -- tears down the overlay window

### SpaceNavigator (lines 504-541)
- Static methods for navigating to a space via CGEvent keyboard simulation
- `checkAccessibility()` -- prompts for Accessibility permissions

### WindowMover (lines 545-674)
- Moves focused window to another space via mouse-drag simulation + hotkey firing
- Uses Accessibility API + CGS symbolic hotkey APIs

### PinOverlayWindow (lines 682-831)
- `NSWindow` subclass that mirrors a foreign window via screen capture
- Level: `floatingWindow` (above normal windows)
- 60fps timer for capture refresh
- **Different from OverlayWindow** -- this mirrors another window's content, not text

### WindowPinner (lines 835-1006)
- Static manager for pin overlays, keyed by `CGWindowID`
- `togglePin()`, `pin()`, `unpin()`, `unpinAll()`
- Screen Recording permission prompt

### HotkeySlot & GlobalHotkeyManager (lines 1010-1132)
- Enum `HotkeySlot`: `.dropdown`, `.moveWindow`, `.pinWindow`
- Carbon Event API hotkey registration with IDs 1, 2, 3
- `register(config:moveWindowConfig:pinWindowConfig:)` method

### MenuBarController (lines 1136-2022)
- **Central controller** -- owns `statusItem`, `spaceDetector`, `config`, `overlayManager`, `hotkeyManager`
- `init()`: loads config, sets up menu, registers for space changes, registers hotkeys, triggers initial overlay
- `setupMenu()`: builds the static menu structure with tag-based items
- `rebuildSpaceItems()`: dynamically rebuilds desktop list, move-window submenu, pin-window items each time menu opens (called from `menuWillOpen`)
- `reloadConfig()`: reloads from disk, updates title, overlay, and re-registers hotkeys
- Notification observers: `NSWorkspace.activeSpaceDidChangeNotification`, `NSApplication.didChangeScreenParametersNotification`
- Menu item tags: 100 (space number toggle), 101 (overlay toggle), 200 (rename), 300-302 (hotkey items), 400-401 (pin items)

### AppDelegate (lines 2034-2041)
- Creates `MenuBarController` on launch
- Calls `SpaceNavigator.checkAccessibility()`

### Main (lines 2045-2049)
- Creates `NSApplication`, sets `.accessory` activation policy, runs app loop

---

## 3. Conventions

### Configuration Pattern
1. **Feature config struct** is a simple `Codable` struct (e.g., `MoveWindowConfig`, `PinWindowConfig`). Minimal -- usually just `enabled: Bool`.
2. **Optional field on `JumpeeConfig`** -- feature sections are `Optional` (e.g., `moveWindow: MoveWindowConfig?`). When absent from JSON, field is `nil` and feature is disabled.
3. **Appearance config** uses a richer struct when needed (e.g., `OverlayConfig` has font/color/position properties with a `defaultConfig` static).
4. **Default exception pattern**: For hotkey defaults, computed properties like `effectiveMoveWindowHotkey` provide fallback values. These are documented exceptions to the project's no-default-fallback rule, recorded in "Issues - Pending Items.md".

### Feature Integration Pattern
1. Add config struct(s)
2. Add optional field to `JumpeeConfig`
3. Create window/manager class if needed
4. Wire into `MenuBarController`:
   - Add instance variable for the manager
   - Initialize in `init()`
   - Add menu items in `setupMenu()` and/or `rebuildSpaceItems()`
   - Update in `reloadConfig()`
   - Clean up in `quit()`
5. If feature needs hotkey: add a `HotkeySlot` case, register in `GlobalHotkeyManager`

### Overlay Window Pattern (relevant for the indicator)
- Subclass `NSWindow`
- `styleMask: .borderless`, `backgroundColor: .clear`, `isOpaque: false`, `ignoresMouseEvents: true`
- Set appropriate `level` (desktop watermark uses `desktopWindow + 1`; pin overlay uses `floatingWindow`)
- Set `collectionBehavior` (`.canJoinAllSpaces`, `.stationary` for persistent overlays)
- Content is an `NSTextField` (for text) or `NSImageView` (for images)

### Menu Pattern
- Static items created in `setupMenu()` with unique `tag` values for later lookup
- Dynamic items created in `rebuildSpaceItems()`, tracked in `spaceMenuItems` array, and removed/rebuilt each time menu opens
- Toggle items change their title text (e.g., "Enable Overlay" / "Disable Overlay")
- Features hidden via `item.isHidden = true` when disabled

### Notification Pattern
- Space changes: `NSWorkspace.activeSpaceDidChangeNotification` -> `spaceDidChange(_:)`
- Screen changes: `NSApplication.didChangeScreenParametersNotification` -> `screenParametersDidChange(_:)`
- Both trigger `updateTitle()` and `overlayManager.updateOverlay(config:)`

---

## 4. Integration Points for Input Source Indicator

### 4.1 New Config Struct
Add `InputSourceIndicatorConfig: Codable` following the pattern of `OverlayConfig` (rich appearance config with defaults). Add `inputSourceIndicator: InputSourceIndicatorConfig?` to `JumpeeConfig`.

**Location:** After `PinWindowConfig` (around line 131), before `JumpeeConfig`.

### 4.2 New Window Class: `InputSourceIndicatorWindow`
Create a new `NSWindow` subclass similar to `OverlayWindow` but with key differences:
- **Window level**: Higher than `OverlayWindow` (which uses `desktopWindow + 1`). Should use `floatingWindow + 1` or similar to appear above normal windows but below alerts/menu bar.
- **Position**: Horizontally centered, vertically just below the menu bar (use `screen.frame.height - screen.visibleFrame.height` to compute menu bar height dynamically).
- **Background**: Semi-transparent pill/rectangle behind text (unlike `OverlayWindow` which has no background).
- **Collection behavior**: `.canJoinAllSpaces`, `.stationary` (same as `OverlayWindow`).

**Location:** After `OverlayWindow` class (around line 450).

### 4.3 New Manager Class: `InputSourceIndicatorManager`
Similar to `OverlayManager` but:
- Manages input source monitoring (subscribe to `kTISNotifySelectedKeyboardInputSourceChanged` via `DistributedNotificationCenter`)
- Calls `TISCopyCurrentKeyboardInputSource()` and `TISGetInputSourceProperty(_, kTISPropertyLocalizedName)` to get the input source name
- Creates/updates/destroys `InputSourceIndicatorWindow`
- Methods: `start(config:)`, `stop()`, `updateConfig(_:)`, `refresh()` (for space/display changes)

**Import note:** `Carbon.HIToolbox` is already imported (line 2), which provides access to TIS functions. No new framework imports needed.

**Location:** After `OverlayManager` class (around line 500).

### 4.4 MenuBarController Integration
The following modifications are needed in `MenuBarController`:

1. **New instance variable** (around line 1142):
   ```swift
   private var inputSourceManager: InputSourceIndicatorManager?
   ```

2. **Initialize in `init()`** (around line 1158, after overlay setup):
   ```swift
   if config.inputSourceIndicator?.enabled == true {
       inputSourceManager = InputSourceIndicatorManager(spaceDetector: spaceDetector)
       inputSourceManager?.start(config: config)
   }
   ```

3. **Menu toggle item** in `setupMenu()` (around line 1288, after overlay toggle):
   - New item with unique tag (e.g., 102): "Enable Input Source Indicator" / "Disable Input Source Indicator"
   - Action toggles `config.inputSourceIndicator?.enabled` and calls `save()`

4. **Update in `rebuildSpaceItems()`**: Update toggle item title based on current state.

5. **Space change handler** `spaceDidChange(_:)` (line 1596): Add call to `inputSourceManager?.refresh()` to reposition on display change.

6. **Screen change handler** `screenParametersDidChange(_:)` (line 1601): Same as above.

7. **Config reload** `reloadConfig(_:)` (line 2009): Start/stop/reconfigure the input source manager based on new config.

8. **Quit** `quit(_:)` (line 2016): Add `inputSourceManager?.stop()`.

### 4.5 Menu Item Tags (Available)
Currently used tags: 100, 101, 200, 300, 301, 302, 400, 401. The input source indicator toggle should use **tag 102** (next available in the toggle group).

### 4.6 Input Source Monitoring API
The required APIs are available via `Carbon.HIToolbox` (already imported):
- `TISCopyCurrentKeyboardInputSource() -> TISInputSource`
- `TISGetInputSourceProperty(_: TISInputSource, _: CFString) -> CFTypeRef?` with `kTISPropertyLocalizedName`
- Notification: `DistributedNotificationCenter.default().addObserver(forName: NSNotification.Name("AppleSelectedInputSourcesChangedNotification"), ...)` -- this is the standard notification for input source changes.

### 4.7 No New Permissions Required
The TIS APIs do not require Accessibility, Screen Recording, or any special permissions. This is confirmed in the refined request (NFR-ISI-4).

### 4.8 Build System
No changes needed to `build.sh`. The single `Sources/main.swift` compilation already links `Cocoa` and `Carbon.HIToolbox`.

---

## 5. Key Differences from Existing Overlay

| Aspect | Desktop Watermark (`OverlayWindow`) | Input Source Indicator |
|--------|--------------------------------------|----------------------|
| Content | Space name text | Input source name text |
| Position | Configurable (top/bottom/center) | Fixed: centered, below menu bar |
| Window level | `desktopWindow + 1` (below everything) | `floatingWindow + 1` (above normal windows) |
| Background | None (transparent text only) | Semi-transparent pill/rectangle |
| Trigger | Space change | Input source change notification |
| Config struct | `OverlayConfig` (rich) | `InputSourceIndicatorConfig` (rich, similar) |
| Manager | `OverlayManager` | `InputSourceIndicatorManager` (new) |

---

## 6. Risk Areas

1. **Single-file architecture**: All code is in one ~2050-line file. Adding ~200-300 lines for this feature is feasible but the file will approach 2300+ lines. No refactoring is planned.

2. **Menu bar height detection**: Need to dynamically calculate menu bar height to position the indicator. The formula `screen.frame.height - screen.visibleFrame.height - (screen.visibleFrame.origin.y - screen.frame.origin.y)` handles Dock position and notch displays correctly. The existing `OverlayWindow` does not do this (it uses configurable margins), so this is new logic.

3. **DistributedNotificationCenter vs CFNotificationCenter**: The input source change notification (`AppleSelectedInputSourcesChangedNotification`) is delivered via `DistributedNotificationCenter`. This is well-documented and reliable.

4. **Default values exception**: The input source indicator config properties use defaults (fontSize: 60, fontWeight: "bold", etc.). This must be documented as an exception in "Issues - Pending Items.md" before implementation, following the pattern established for `moveWindowHotkey` and `pinWindowHotkey`.
