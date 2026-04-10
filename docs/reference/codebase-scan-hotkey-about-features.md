# Codebase Scan: Hotkey, About, and Hotkey Config UI Features

## 1. Project Overview

- **Language**: Swift (single-file, no Xcode project)
- **Frameworks**: AppKit (Cocoa), Carbon.HIToolbox (global hotkeys), private CoreGraphics APIs (CGS*)
- **Build**: `build.sh` -- compiles `Sources/main.swift` with `swiftc -O`, creates `.app` bundle with `Info.plist`, ad-hoc codesigns
- **Current Version**: 1.2.2 (set in `build.sh` Info.plist, both `CFBundleVersion` and `CFBundleShortVersionString`)
- **Config**: `~/.Jumpee/config.json` -- JSON, loaded/saved via `Codable` structs
- **App type**: Menu bar only (`LSUIElement = true`, activation policy `.accessory`)

### Directory Layout

```
Jumpee/
  Sources/main.swift          # Entire application (~1200 lines)
  build.sh                    # Build script (shell)
  package.sh                  # Packaging script for distribution
  dist/                       # Versioned release zips
  homebrew-tap/               # Homebrew cask formula
  docs/design/                # Design docs, plans, config guide
  docs/reference/             # Investigation & codebase scan docs
  CLAUDE.md                   # Project conventions
  Issues - Pending Items.md   # Issue tracker
  README.md
```

## 2. Module Map

All code resides in `/Users/giorgosmarinos/aiwork/coding-platform/macbook-desktop/Jumpee/Sources/main.swift`. The file is organized by `// MARK:` sections.

### Private CGS API Declarations (lines 1-30)

Free functions declared via `@_silgen_name`:
- `CGSMainConnectionID`, `CGSGetActiveSpace`, `CGSCopyManagedDisplaySpaces` -- space detection
- `CGSGetSymbolicHotKeyValue`, `CGSIsSymbolicHotKeyEnabled`, `CGSSetSymbolicHotKeyEnabled` -- reading/toggling system "Switch to Desktop N" shortcuts
- `_AXUIElementGetWindow` -- getting CGWindowID from AXUIElement (used by WindowMover)

### Configuration Structs (lines 32-145)

| Struct | Lines | Purpose |
|--------|-------|---------|
| `OverlayConfig` | 34-54 | Overlay appearance settings (opacity, font, position, color, margin) |
| `HotkeyConfig` | 56-105 | Key + modifiers for a global hotkey; has `keyCode`, `carbonModifiers`, `displayString` computed properties |
| `MoveWindowConfig` | 107-111 | `enabled: Bool` -- gates the move-window feature |
| `JumpeeConfig` | 113-145 | Top-level config with `spaces`, `showSpaceNumber`, `overlay`, `hotkey`, `moveWindow?`; has `load()` and `save()` |

**Key observations for new features**:
- `JumpeeConfig` currently has no `moveWindowHotkey` property -- this must be added.
- `HotkeyConfig` already has `displayString` (e.g., "Command+J") which the Hotkey Config UI needs.
- `HotkeyConfig.keyCode` returns `CGKeyCode?` from a fixed map of supported keys (a-z, 0-9, space, return, tab, escape). The hotkey editor must validate against this map.
- `JumpeeConfig.load()` falls back to a default config if the file is missing or unparseable. The `moveWindow` field is already optional (`MoveWindowConfig?`).

### Color / Font Helpers (lines 147-179)

- `NSColor.fromHex(_:)` -- hex string to NSColor
- `fontWeight(from:)` -- string to `NSFont.Weight`

### SpaceDetector (lines 183-316)

Class that wraps all CGS space queries. Key methods:
- `getCurrentSpaceID() -> Int` -- active space ID
- `getAllSpaceIDs() -> [Int]` -- all space IDs across all displays (type==0 filter for real desktops)
- `getSpacesByDisplay() -> [DisplayInfo]` -- spaces grouped by display with local/global positions
- `getActiveDisplayID() -> String?` -- which display the current space belongs to
- `getCurrentSpaceInfo()` -- returns tuple of (displayID, localPosition, globalPosition, spaceID)
- `displayIDToScreen(_:) -> NSScreen?` -- maps CGS display UUID to NSScreen

### OverlayWindow (lines 320-416)

`NSWindow` subclass -- borderless, transparent, ignores mouse, sits just above desktop level. Has `updateText(_:config:)` and internal `positionLabel(in:config:)`.

### OverlayManager (lines 420-466)

Manages single `OverlayWindow?`. Methods: `updateOverlay(config:)`, `removeAllOverlays()`.

### SpaceNavigator (lines 470-507)

Static methods:
- `navigateToSpace(index:)` -- posts Ctrl+N keyboard event via CGEvent
- `checkAccessibility()` -- prompts for Accessibility permissions via AXIsProcessTrusted
- `keyCodeForNumber(_:)` -- maps 1-9 to virtual key codes

### WindowMover (lines 511-640)

Static methods:
- `moveToSpace(index:)` -- mouse-drag simulation approach (Amethyst-style): grabs title bar, fires space-switch hotkey while dragging, releases after 400ms
- `areSystemShortcutsEnabled() -> Bool` -- checks if symbolic hotkey 118 is enabled

### GlobalHotkeyManager (lines 642-700)

**This is a critical integration point.**

Current structure:
- Free function `hotkeyEventHandler` at line 646 -- the Carbon event handler callback; calls `globalMenuBarController?.openMenu()`
- Global variable `globalMenuBarController` at line 644 -- bridges the C callback to the controller
- Class `GlobalHotkeyManager` (line 653):
  - Single `hotkeyRef: EventHotKeyRef?` and `handlerRef: EventHandlerRef?`
  - `hotkeyID` with signature `0x4A4D5045` ("JMPE") and id `1`
  - `register(config:)` -- unregisters first, then installs handler + registers hotkey
  - `unregister()` / `deinit`

**For the move-window hotkey**: The current design has a single handler that always calls `openMenu()`. To support two hotkeys:
- Need a second `EventHotKeyID` with a different `id` (e.g., id=2)
- The `hotkeyEventHandler` must inspect `GetEventParameter` to determine which hotkey fired (read the `EventHotKeyID` from the event), or use two separate handlers
- Alternative: the handler reads the hotkey ID from the event and dispatches accordingly

### MenuBarController (lines 704-1173)

The main controller class. Extends `NSObject`, conforms to `NSMenuDelegate`.

**Properties** (lines 705-710):
- `statusItem: NSStatusItem`
- `spaceDetector: SpaceDetector`
- `config: JumpeeConfig`
- `spaceMenuItems: [NSMenuItem]` -- dynamically inserted items, cleared/rebuilt on each menu open
- `overlayManager: OverlayManager`
- `hotkeyManager: GlobalHotkeyManager?`

**init()** (lines 712-730):
- Creates status item, loads config, creates overlay manager
- Calls `migratePositionBasedConfig()`, `setupMenu()`, `updateTitle()`, `registerForSpaceChanges()`
- Sets `globalMenuBarController = self`
- Creates and registers `hotkeyManager`
- Schedules overlay update after 0.5s

**setupMenu()** (lines 766-816) -- builds the static menu structure:
```
"Jumpee" (bold header, disabled)
---
"Desktops:" (disabled)
[separator -- space items inserted here dynamically by rebuildSpaceItems()]
"Hide/Show Space Number"      (tag 100)
"Disable/Enable Overlay"      (tag 101)
---
"Open Config File..."         Cmd+,
"Reload Config"               Cmd+R
---
"Quit Jumpee"                 Cmd+Q
```

**rebuildSpaceItems()** (lines 836-998) -- called from `menuWillOpen`. Inserts dynamic items after "Desktops:" header:
- Per-display headers (if multi-display)
- Desktop items with Cmd+1-9 shortcuts, checkmark on current
- "Rename Current Desktop..." (tag 200, Cmd+N)
- "Move Window To..." submenu (only if `moveWindow?.enabled == true`)
- "Set Up Window Moving..." setup item (conditional)
- Updates toggle item titles

**Action methods**:
| Method | Line | Trigger |
|--------|------|---------|
| `navigateToSpace(_:)` | 1024 | Click desktop item; closes menu, 300ms delay, calls `SpaceNavigator.navigateToSpace` |
| `moveWindowToSpace(_:)` | 1038 | Click move-window submenu item; closes menu, 300ms delay, calls `WindowMover.moveToSpace` |
| `showMoveWindowSetup()` | 1051 | Setup dialog for window moving |
| `renameActiveSpace()` | 1098 | NSAlert with text field for renaming |
| `toggleSpaceNumber()` | 1141 | Toggles `showSpaceNumber`, saves, updates |
| `toggleOverlay()` | 1148 | Toggles `overlay.enabled`, saves, updates |
| `openConfig(_:)` | 1154 | Opens config file in default editor |
| `reloadConfig(_:)` | 1161 | Reloads config, updates title/overlay, re-registers hotkey |
| `quit(_:)` | 1168 | Unregisters hotkey, removes overlays, terminates |

**NSMenuDelegate** (lines 1177-1181):
- `menuWillOpen(_:)` calls `rebuildSpaceItems()`

### AppDelegate (lines 1185-1192)

- `applicationDidFinishLaunching`: checks accessibility, creates `MenuBarController`

### Main entry point (lines 1196-1200)

- Creates `NSApplication.shared`, sets delegate, sets `.accessory` activation policy, runs

## 3. Conventions

### Coding Patterns

1. **Single-file architecture**: Everything in `Sources/main.swift`, organized by `// MARK:` sections
2. **Codable structs for config**: All config types conform to `Codable` with `static let defaultConfig` for defaults
3. **NSAlert for dialogs**: `renameActiveSpace()` and `showMoveWindowSetup()` both use `NSAlert` with `runModal()` -- blocking the main thread, which is the expected pattern
4. **Delayed actions after menu close**: Both `navigateToSpace` and `moveWindowToSpace` close the menu with `cancelTracking()` then dispatch after 300ms
5. **Tag-based item identification**: Menu items use tags (100 for toggle, 101 for overlay, 200 for rename) for later lookup
6. **Dynamic menu items**: `spaceMenuItems` array tracks all dynamically inserted items; they're removed at the start of `rebuildSpaceItems()` and re-inserted
7. **Config save pattern**: Mutate `config`, call `config.save()`, then update UI (`updateTitle()`, `overlayManager.updateOverlay(config:)`)
8. **Global variable bridge for Carbon callbacks**: `globalMenuBarController` bridges C-style Carbon hotkey callbacks to the ObjC/Swift world

### Config Approach

- Single JSON file at `~/.Jumpee/config.json`
- Loaded with `JumpeeConfig.load()` (returns default if file missing)
- Saved with `config.save()` (pretty-printed, sorted keys)
- Manual reload via Cmd+R in menu
- Optional fields use Swift optionals (e.g., `moveWindow: MoveWindowConfig?`)

### Version Management

- Version is hardcoded in `build.sh` Info.plist generation (line 39-40): `CFBundleVersion` and `CFBundleShortVersionString` both set to `1.2.2`
- No version constant in Swift code -- the About dialog should read it from `Bundle.main.infoDictionary`

## 4. Integration Points

### Feature 1: Move Window Hotkey

**Config change** -- Add to `JumpeeConfig` (line 113):
- New property: `var moveWindowHotkey: HotkeyConfig?`
- This is a sibling to `hotkey` and `moveWindow`

**GlobalHotkeyManager changes** (lines 642-700):
- The Carbon event handler (`hotkeyEventHandler`, line 646) currently always calls `openMenu()`. It must be extended to dispatch based on which hotkey ID fired.
- Approach: Read `EventHotKeyID` from the event using `GetEventParameter(event, kEventParamDirectObject, typeEventHotKeyID, ...)`. If id==1, call `openMenu()`. If id==2, call a new `openMoveWindowMenu()`.
- Register a second `EventHotKeyRef` with id=2 for the move-window hotkey.
- The handler installation (`InstallEventHandler`) only needs to happen once for both hotkeys.

**New method on MenuBarController**:
- `openMoveWindowMenu()` -- constructs a temporary `NSMenu` with desktops on the active display (reusing the same logic as the "Move Window To..." submenu in `rebuildSpaceItems()` lines 930-972), then pops it up at the mouse cursor location.

**Registration in MenuBarController.init()** (line 724-725):
- After registering the main hotkey, also register the move-window hotkey if `moveWindow?.enabled == true`.

**Reload behavior** in `reloadConfig(_:)` (line 1161):
- Must also re-register the move-window hotkey.

**Quit cleanup** in `quit(_:)` (line 1168):
- Must also unregister the move-window hotkey.

### Feature 2: Hotkey Configuration UI

**Menu placement** -- In `setupMenu()` (line 766), add a new section between the overlay toggle (line 796) and the "Open Config File..." separator (line 798):
```
---
"Hotkeys:" (disabled header)
"Dropdown Hotkey: Cmd+J..."
"Move Window Hotkey: Cmd+M..."  (only if moveWindow.enabled)
---
```

**Hotkey editor dialog**: New method like `editHotkey(slot:)` using `NSAlert` with accessory view containing:
- NSTextField for key input (single character)
- NSButton checkboxes for Command, Control, Option, Shift
- Follow the `renameActiveSpace()` pattern (lines 1098-1139) for dialog construction

**Conflict detection**: Compare the two `HotkeyConfig` values before saving. The `HotkeyConfig` struct already has `key` and `modifiers` which can be compared directly.

**Save and apply**: After saving to config, call `hotkeyManager?.register(config:)` to immediately apply -- same as `reloadConfig` does.

**Refresh menu items**: The hotkey display text in menu items should update after saving. Since `rebuildSpaceItems()` is called on each menu open, the static items in `setupMenu()` need their titles updated. Use tags to find and update them, similar to tags 100/101.

### Feature 3: About Dialog

**Menu placement** -- In `setupMenu()` (line 766), add "About Jumpee..." as the first item, before the "Jumpee" header (line 769). Or immediately after the header, before the separator at line 774.

Per the refined request, placement is: after the "Jumpee" header and before the "Desktops:" separator. So insert at line 774 (before `menu.addItem(NSMenuItem.separator())`).

**Implementation**: New `@objc` method `showAboutDialog()`:
- Use `NSAlert` with `.informational` style
- Read version from `Bundle.main.infoDictionary?["CFBundleShortVersionString"]` with fallback to `"dev"`
- Static informative text with setup instructions
- Single "OK" button

### Build Script Changes

In `build.sh` (line 39-40), update version from `1.2.2` to `1.3.0`.

### Summary of Lines to Modify

| Area | File | Lines | Change |
|------|------|-------|--------|
| Config struct | main.swift | 113-118 | Add `moveWindowHotkey: HotkeyConfig?` to JumpeeConfig |
| Hotkey handler | main.swift | 646-650 | Dispatch based on hotkey ID |
| GlobalHotkeyManager | main.swift | 653-700 | Support two hotkeys with different IDs |
| MenuBarController init | main.swift | 712-730 | Register move-window hotkey |
| setupMenu | main.swift | 766-816 | Add "About Jumpee...", "Hotkeys:" section |
| rebuildSpaceItems | main.swift | 836-998 | (Hotkey items are static, not dynamic -- no change here) |
| reloadConfig | main.swift | 1161-1166 | Re-register move-window hotkey |
| quit | main.swift | 1168-1172 | Unregister move-window hotkey |
| New methods | main.swift | (new) | `openMoveWindowMenu()`, `showAboutDialog()`, `editHotkey(slot:)` |
| Version | build.sh | 39-40 | Change 1.2.2 to 1.3.0 |
