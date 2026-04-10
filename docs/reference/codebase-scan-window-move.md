# Codebase Scan: Window Movement Feature Integration

**Date:** 2026-04-10  
**Purpose:** Map the existing Jumpee architecture to identify integration points for window-to-space movement  

---

## 1. Project Overview

| Attribute | Value |
|-----------|-------|
| Language | Swift (no SwiftUI, pure AppKit) |
| Framework | Cocoa + Carbon.HIToolbox |
| Build system | Single `swiftc` invocation via `build.sh` (no Xcode project, no SPM) |
| Source | Single file: `Sources/main.swift` (~917 lines) |
| Bundle ID | `com.local.jumpee` |
| Min macOS | 13.0 (Ventura) |
| Code signing | Ad-hoc (`codesign --force --sign -`) |
| Config | `~/.Jumpee/config.json` (JSON, `Codable` structs) |
| App type | Menu bar only (`LSUIElement = true`, activation policy `.accessory`) |

### Directory Layout

```
Jumpee/
  Sources/main.swift          -- entire application source
  build.sh                    -- compile + bundle + codesign
  package.sh                  -- packaging script
  docs/design/                -- plans, configuration guide, project design
  docs/reference/             -- investigation reports, refined requests
  homebrew-tap/               -- Homebrew cask formula
  build/                      -- output (.app bundle, gitignored)
```

---

## 2. Module Map

The single source file is organized into clearly marked `// MARK:` sections. All types are top-level (no nesting).

### 2.1 Private CGS API Declarations (lines 5-13)

```swift
@_silgen_name("CGSMainConnectionID")
func CGSMainConnectionID() -> Int32

@_silgen_name("CGSGetActiveSpace")
func CGSGetActiveSpace(_ cid: Int32) -> Int

@_silgen_name("CGSCopyManagedDisplaySpaces")
func CGSCopyManagedDisplaySpaces(_ cid: Int32) -> CFArray
```

These are the only three private CGS functions currently declared. The window-move feature will need additional declarations here (e.g., `CGSAddWindowsToSpaces`, `CGSRemoveWindowsFromSpaces`, or `CGSMoveWindowsToManagedSpace`).

### 2.2 Configuration Structs (lines 18-122)

| Struct | Purpose |
|--------|---------|
| `OverlayConfig` | Overlay appearance: enabled, opacity, font, position, color, margin |
| `HotkeyConfig` | Global hotkey: key name, modifier list, computed `keyCode`, `carbonModifiers`, `displayString` |
| `JumpeeConfig` | Root config: `spaces` (dict of spaceID->name), `showSpaceNumber`, `overlay`, `hotkey` |

`JumpeeConfig` has static `load()` and instance `save()` methods. Config path: `~/.Jumpee/config.json`.

**Integration point:** A new `MoveWindowConfig` section (or additions to `HotkeyConfig`) will be needed for move-window hotkey bindings and the follow/stay preference.

### 2.3 Utility Extensions (lines 124-156)

- `NSColor.fromHex(_:)` -- hex string to NSColor
- `fontWeight(from:)` -- string to `NSFont.Weight`

No integration needed here.

### 2.4 Space Detection (lines 158-293)

#### Data Structures

| Type | Fields | Purpose |
|------|--------|---------|
| `SpaceInfo` | `spaceID: Int`, `localPosition: Int`, `globalPosition: Int` | Single space metadata |
| `DisplayInfo` | `displayID: String`, `spaces: [SpaceInfo]` | One display's spaces |

#### `SpaceDetector` class

Holds `connectionID: Int32` (obtained once via `CGSMainConnectionID()` in `init()`).

| Method | Returns | Purpose |
|--------|---------|---------|
| `getCurrentSpaceID()` | `Int` | Calls `CGSGetActiveSpace(connectionID)` |
| `getAllSpaceIDs()` | `[Int]` | Parses `CGSCopyManagedDisplaySpaces`, filters `type == 0` (regular desktops, excludes fullscreen spaces) |
| `getCurrentSpaceIndex()` | `Int?` | 1-based global index of current space |
| `getSpaceCount()` | `Int` | Total regular desktop count |
| `getOrderedSpaces()` | `[(position, spaceID)]` | All spaces with global positions |
| `getSpacesByDisplay()` | `[DisplayInfo]` | Spaces grouped by display, with both local and global positions |
| `getActiveDisplayID()` | `String?` | Display UUID containing current space |
| `getCurrentSpaceInfo()` | tuple? | Full info: displayID, localPosition, globalPosition, spaceID |
| `displayIDToScreen(_:)` | `NSScreen?` | Maps CGS display UUID to NSScreen |

**Key integration points:**
- `connectionID` (line 173) is the CGS connection ID needed by `CGSMoveWindowsToManagedSpace` and similar APIs.
- `getAllSpaceIDs()` and `getSpacesByDisplay()` provide the target space IDs needed for move operations.
- The `type == 0` filter (line 190) correctly excludes fullscreen spaces -- the move feature should use the same filter or explicitly handle fullscreen spaces.
- `getActiveDisplayID()` enables multi-display awareness (FR-6 in the refined request).

### 2.5 Overlay System (lines 296-443)

| Class | Purpose |
|-------|---------|
| `OverlayWindow` | Borderless, transparent, mouse-ignoring window at desktop level. Shows space name as watermark. Uses `collectionBehavior: [.canJoinAllSpaces, .stationary]`. |
| `OverlayManager` | Manages single overlay instance. `updateOverlay(config:)` creates/updates; `removeAllOverlays()` tears down. |

**Integration point:** The overlay could be used for visual feedback when a window is moved (FR-5). A brief flash or text change could indicate "Moved to Desktop N".

### 2.6 Space Navigation (lines 447-484)

```swift
class SpaceNavigator {
    static func navigateToSpace(index: Int)    // synthesizes Ctrl+N key events
    static func checkAccessibility()            // prompts for AX trust if needed
    private static func keyCodeForNumber(_ n: Int) -> Int  // maps 1-9 to keycodes
}
```

**Space switching mechanism:** Synthesizes `CGEvent` key press/release with `.maskControl` modifier, posted to `.cghidEventTap`. This simulates pressing Ctrl+1 through Ctrl+9, which macOS interprets as "Switch to Desktop N" (requires user to have enabled these shortcuts in System Settings).

**Key integration points:**
- `navigateToSpace(index:)` is the pattern a "follow window" behavior would use after moving the window.
- `keyCodeForNumber(_:)` maps desktop numbers 1-9 to their macOS virtual keycodes (accounts for the non-sequential layout: 5->23, 6->22, 7->26, etc.).
- `checkAccessibility()` already handles the AX permission prompt. The window-move feature needs AX permissions for `_AXUIElementGetWindow` -- this is already covered.
- For the "synthesize Move Window to Desktop N" approach (Option E in the refined request), a similar `CGEvent` synthesis with different modifiers would be needed.

### 2.7 Global Hotkey Manager (lines 486-544)

```swift
// Module-level
private var globalMenuBarController: MenuBarController?

func hotkeyEventHandler(...) -> OSStatus {
    // dispatches to globalMenuBarController?.openMenu()
}

class GlobalHotkeyManager {
    private var hotkeyRef: EventHotKeyRef?
    private var handlerRef: EventHandlerRef?
    private let hotkeyID = EventHotKeyID(signature: 0x4A4D5045, id: 1) // "JMPE"
    
    func register(config: HotkeyConfig)
    func unregister()
}
```

Uses Carbon `RegisterEventHotKey` / `InstallEventHandler` API. Currently registers a single global hotkey (default Cmd+J) that opens the menu.

**Key integration points:**
- The hotkey system only supports **one hotkey** currently (id: 1). Window-move hotkeys would need either:
  - Multiple `EventHotKeyID` registrations (e.g., id: 2 through 10 for Ctrl+Cmd+1 through Ctrl+Cmd+9), or
  - A CGEvent tap approach (more flexible, can intercept arbitrary key combos).
- The `hotkeyEventHandler` is a C-function-pointer callback dispatched via a module-level `globalMenuBarController` reference -- same pattern would work for additional hotkey handlers.
- Each `EventHotKeyID` needs a unique `id` field and the handler must switch on it.

### 2.8 Menu Bar Controller (lines 548-890)

`MenuBarController: NSObject, NSMenuDelegate` -- the central coordinator class.

| Property | Type | Purpose |
|----------|------|---------|
| `statusItem` | `NSStatusItem` | Menu bar button |
| `spaceDetector` | `SpaceDetector` | Space enumeration |
| `config` | `JumpeeConfig` | Current config |
| `spaceMenuItems` | `[NSMenuItem]` | Dynamic space items (rebuilt on menu open) |
| `overlayManager` | `OverlayManager` | Overlay lifecycle |
| `hotkeyManager` | `GlobalHotkeyManager?` | Global hotkey registration |

**Key methods:**

| Method | Purpose |
|--------|---------|
| `init()` | Creates status item, loads config, migrates old config, sets up menu, registers hotkey, starts overlay |
| `openMenu()` | Programmatically clicks the status item button |
| `setupMenu()` | Builds static menu items (header, toggle items, config, reload, quit) |
| `updateTitle()` | Sets menu bar title to current space name |
| `rebuildSpaceItems()` | Dynamically rebuilds desktop list on menu open; groups by display; assigns Cmd+1-9 shortcuts to active display only |
| `registerForSpaceChanges()` | Observes `NSWorkspace.activeSpaceDidChangeNotification` and `NSApplication.didChangeScreenParametersNotification` |
| `navigateToSpace(_:)` | Menu item action: closes menu, then calls `SpaceNavigator.navigateToSpace(index:)` after 300ms delay |
| `renameActiveSpace()` | Shows NSAlert dialog for renaming |
| `reloadConfig(_:)` | Reloads config, updates UI and hotkey |

**Integration points for window-move menu items:**
- `rebuildSpaceItems()` (line 680) is where "Move to Desktop N" submenu or menu items would be added.
- `navigateToSpace(_:)` (line 804) is the pattern for the "follow" behavior: cancel menu tracking, delay, then act.
- The `menuWillOpen(_:)` delegate (line 895) triggers `rebuildSpaceItems()` each time the menu opens -- new items will automatically appear.

### 2.9 App Delegate and Main (lines 902-917)

```swift
class AppDelegate: NSObject, NSApplicationDelegate {
    var menuBarController: MenuBarController?
    func applicationDidFinishLaunching(_:) {
        SpaceNavigator.checkAccessibility()
        menuBarController = MenuBarController()
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
```

Standard AppKit lifecycle. No window controller, no storyboards.

---

## 3. Conventions

### 3.1 Coding Patterns

- **Single-file architecture**: Everything in `main.swift`. No modules, no protocols, minimal abstraction.
- **MARK sections**: Code organized with `// MARK: -` comments for logical separation.
- **Static methods for stateless operations**: `SpaceNavigator` uses only static methods.
- **Instance methods for stateful classes**: `SpaceDetector`, `OverlayManager`, `MenuBarController` are instance-based.
- **Error suppression**: `try?` used throughout -- errors are silently ignored (config load, save, etc.).
- **Module-level global**: `globalMenuBarController` is used as a bridge between Carbon C callbacks and Swift classes.

### 3.2 Configuration Approach

- All config in a single `JumpeeConfig` struct (Codable).
- Nested structs for logical grouping (`OverlayConfig`, `HotkeyConfig`).
- Defaults defined as static properties on each struct.
- Config loaded at `MenuBarController.init()` and on explicit reload.
- No environment variables, no CLI arguments -- JSON file only.

### 3.3 Hotkey Registration Pattern

1. Define a `HotkeyConfig` struct with key name + modifier list.
2. Convert to Carbon types (`CGKeyCode` via lookup table, `UInt32` modifier mask via bitwise OR).
3. Register via `RegisterEventHotKey` with `GetApplicationEventTarget()`.
4. Handle via C-compatible function pointer (`hotkeyEventHandler`).
5. Route to Swift class via module-level global reference.

### 3.4 Space Switching Pattern

1. Get target space's **global position** (1-based across all displays).
2. Map position to macOS virtual keycode via `keyCodeForNumber(_:)`.
3. Create `CGEvent` with `.maskControl` modifier.
4. Post key-down + key-up to `.cghidEventTap`.
5. macOS handles the actual space switch (requires "Switch to Desktop N" shortcuts enabled).

### 3.5 Multi-Display Handling

- Spaces are enumerated per-display via `getSpacesByDisplay()`.
- Each space has both a `localPosition` (within its display) and `globalPosition` (across all displays).
- The `globalPosition` is used for navigation (Ctrl+N shortcuts are global).
- Menu items for non-active displays are indented and lack Cmd+N shortcuts.

---

## 4. Integration Points for Window Movement

### 4.1 New CGS API Declarations (add after line 13)

The following private APIs will likely be needed:

```swift
// Option A: Direct move (used by yabai)
@_silgen_name("CGSAddWindowsToSpaces")
func CGSAddWindowsToSpaces(_ cid: Int32, _ wids: CFArray, _ sids: CFArray)

@_silgen_name("CGSRemoveWindowsFromSpaces")
func CGSRemoveWindowsFromSpaces(_ cid: Int32, _ wids: CFArray, _ sids: CFArray)

// Option B: Single-call move
@_silgen_name("CGSMoveWindowsToManagedSpace")
func CGSMoveWindowsToManagedSpace(_ cid: Int32, _ wids: CFArray, _ sid: Int)

// For getting window ID from AX element
@_silgen_name("_AXUIElementGetWindow")
func _AXUIElementGetWindow(_ element: AXUIElement, _ wid: UnsafeMutablePointer<CGWindowID>) -> AXError
```

### 4.2 Window Identification (new class or extension)

A new `WindowMover` class (or static methods) would need to:

1. Get the frontmost application: `NSWorkspace.shared.frontmostApplication`
2. Create an AXUIElement for it: `AXUIElementCreateApplication(pid)`
3. Get the focused window: `AXUIElementCopyAttributeValue(app, kAXFocusedWindowAttribute, &window)`
4. Get the CGWindowID: `_AXUIElementGetWindow(window, &windowID)`

This leverages the existing Accessibility permission that `SpaceNavigator.checkAccessibility()` already ensures.

### 4.3 Space Resolution

The existing `SpaceDetector` already provides everything needed:
- `connectionID` (line 173) -- pass to CGS move APIs
- `getCurrentSpaceID()` -- source space for remove operation
- `getAllSpaceIDs()` / `getSpacesByDisplay()` -- target space lookup by position
- `getActiveDisplayID()` -- for multi-display-aware targeting (FR-6)

No modifications to `SpaceDetector` are required -- it's a pure read-only query class.

### 4.4 Hotkey Registration (extend `GlobalHotkeyManager`)

Current state: one hotkey (id: 1). Options:

**Option A -- Extend Carbon hotkeys:** Register additional `EventHotKeyID` entries (id: 2-10) for move hotkeys. The handler function would need to extract the hotkey ID from the event and dispatch accordingly. Modify `hotkeyEventHandler` to read `kEventParamDirectObject` and switch on the ID.

**Option B -- CGEvent tap:** Install a `CGEvent.tapCreate` to intercept key events globally. More flexible (can match arbitrary modifiers) but more complex. This would be a separate mechanism from the existing Carbon hotkey system.

**Recommended:** Option A (Carbon hotkeys) for consistency with the existing pattern.

### 4.5 Configuration Extension

Add to `JumpeeConfig`:

```swift
struct MoveWindowConfig: Codable {
    var enabled: Bool
    var followWindow: Bool          // FR-4: stay vs follow
    var hotkeyModifiers: [String]   // e.g., ["control", "command"]
    var useSystemShortcuts: Bool    // Option E: synthesize system "Move window" shortcuts
}
```

### 4.6 Menu Integration

In `MenuBarController.rebuildSpaceItems()` (line 680), after the space list, add a "Move Window" submenu or integrate move actions alongside navigation items. Pattern: same as `navigateToSpace(_:)` but calling the move API instead of `SpaceNavigator.navigateToSpace()`.

### 4.7 Visual Feedback (FR-5)

The existing `OverlayManager.updateOverlay(config:)` could be extended with a temporary message mode, or a brief `NSUserNotification` / `UNUserNotificationCenter` notification. The overlay approach is more consistent with the existing architecture.

### 4.8 Follow Behavior (FR-4)

After the CGS move call:
1. If `followWindow = true`: call `SpaceNavigator.navigateToSpace(index:)` to switch to the target space.
2. If `followWindow = false`: no additional action; the window disappears from the current space.

---

## 5. Risk Areas

| Risk | Detail |
|------|--------|
| **CGS API stability** | `CGSAddWindowsToSpaces` / `CGSRemoveWindowsFromSpaces` are undocumented and could break in future macOS versions |
| **SIP interaction** | Some CGS window APIs may behave differently under SIP; needs testing on stock macOS 14/15 |
| **Fullscreen spaces** | The `type == 0` filter in `getAllSpaceIDs()` excludes fullscreen spaces; moving fullscreen windows may require special handling or explicit exclusion |
| **Multi-hotkey Carbon** | Expanding from 1 to 10+ Carbon hotkeys requires careful ID management and handler routing |
| **Window ID retrieval** | `_AXUIElementGetWindow` is private; `CGWindowListCopyWindowInfo` is a fallback but requires PID+title matching |
| **Single-file growth** | At ~917 lines, the file is manageable but adding ~200+ lines for window movement will push toward ~1100+ lines |
