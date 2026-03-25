# Codebase Scan: Jumpee Multi-Screen Support

**Date**: 2026-03-25
**Purpose**: Analyze the existing Jumpee codebase to identify all integration points for per-display workspace management.

---

## 1. Project Structure

### Source Files

| File | Purpose |
|------|---------|
| `Sources/main.swift` | Entire application -- single-file Swift/AppKit menu bar app (~779 lines) |
| `build.sh` | Shell script that compiles with `swiftc`, creates `.app` bundle, signs ad-hoc |
| `package.sh` | Creates distribution zip |
| `build/Jumpee.app/` | Compiled application bundle |
| `dist/Jumpee-1.0.0.zip` | Distribution package |
| `homebrew-tap/Casks/jumpee.rb` | Homebrew cask formula |

### Config and Documentation

| File | Purpose |
|------|---------|
| `docs/design/configuration-guide.md` | Full config parameter reference |
| `docs/design/project-design.md` | Project design document |
| `docs/design/plan-001-spacenamer-menu-bar-app.md` | Original plan |
| `docs/design/plan-002-space-id-tracking.md` | Space-ID tracking plan |
| `docs/reference/refined-request-space-id-tracking.md` | Previous feature request |
| `docs/reference/codebase-scan-space-id-tracking.md` | Previous codebase scan |
| `Issues - Pending Items.md` | Issue tracker |
| `README.md` | User-facing documentation |

### Build

- Compiled via `swiftc -O -framework Cocoa -F /System/Library/PrivateFrameworks`
- No Xcode project, no Package.swift, no external dependencies
- Single source file compiles to a single binary
- Ad-hoc code signing (`codesign --force --sign -`)
- `LSUIElement = true` in Info.plist (no dock icon)
- Minimum macOS 13.0

---

## 2. Key Classes, Structs, and Functions

### 2.1 Private CGS API Declarations (Lines 6-13)

Three private CoreGraphics functions imported via `@_silgen_name`:

```swift
CGSMainConnectionID() -> Int32            // Get connection ID
CGSGetActiveSpace(_ cid: Int32) -> Int    // Get active space ID (global)
CGSCopyManagedDisplaySpaces(_ cid: Int32) -> CFArray  // Get all displays and their spaces
```

**Multi-display impact**: `CGSCopyManagedDisplaySpaces` already returns per-display data. This is the primary data source.

### 2.2 Configuration Structs (Lines 18-122)

#### `OverlayConfig` (Lines 18-38)
- Codable struct with: `enabled`, `opacity`, `fontName`, `fontSize`, `fontWeight`, `position`, `textColor`, `margin`
- Has a `static let defaultConfig` with hardcoded defaults
- **Multi-display impact**: Currently a single global overlay config. No per-display override capability.

#### `HotkeyConfig` (Lines 40-89)
- Codable struct with: `key`, `modifiers`
- Computed properties: `keyCode` (maps string to CGKeyCode), `carbonModifiers` (maps to Carbon modifier flags), `displayString` (for UI display)
- **Multi-display impact**: None -- hotkey is global and display-independent.

#### `JumpeeConfig` (Lines 91-122)
- Top-level config struct with: `spaces: [String: String]`, `showSpaceNumber: Bool`, `overlay: OverlayConfig`, `hotkey: HotkeyConfig`
- `spaces` is a flat dictionary mapping space ID (as string) to custom name
- Static `configDir` = `~/.Jumpee/`, static `configFile` = `~/.Jumpee/config.json`
- `load()` reads and decodes JSON; returns defaults if file missing or corrupt
- `save()` creates dir if needed, writes pretty-printed sorted JSON
- **Multi-display impact (CRITICAL)**: The flat `spaces: [String: String]` dict works because space IDs are globally unique. No structural change is strictly required for name resolution. However, if per-display config grouping is desired (e.g., future per-display overlay settings), a `displays` dict structure would be needed. The refined request offers this as a decision point.

### 2.3 Utility Extensions (Lines 124-156)

#### `NSColor.fromHex(_:)` (Lines 126-138)
- Parses `#RRGGBB` hex string to NSColor
- **Multi-display impact**: None.

#### `fontWeight(from:)` (Lines 143-156)
- Maps string names ("bold", "light", etc.) to `NSFont.Weight`
- **Multi-display impact**: None.

### 2.4 SpaceDetector (Lines 160-206) -- CRITICAL CLASS

```swift
class SpaceDetector {
    let connectionID: Int32

    init()                          // Calls CGSMainConnectionID()
    func getCurrentSpaceID() -> Int // Calls CGSGetActiveSpace(connectionID)
    func getAllSpaceIDs() -> [Int]   // Calls CGSCopyManagedDisplaySpaces, FLATTENS result
    func getCurrentSpaceIndex() -> Int?  // Finds current space in flattened list (1-based)
    func getSpaceCount() -> Int          // Count of all spaces across all displays
    func getOrderedSpaces() -> [(position: Int, spaceID: Int)]  // Enumerated flat list
}
```

#### `getAllSpaceIDs()` -- THE KEY FLATTENING POINT (Lines 171-186)

This method iterates over the `CGSCopyManagedDisplaySpaces` result, which is an array of dictionaries -- one per display. Each dictionary contains:
- `"Display Identifier"` -- UUID string (e.g., `"37D8832A-..."`) or `"Main"`
- `"Spaces"` -- array of space dictionaries, each with `"ManagedSpaceID"` (Int) and `"type"` (Int, 0 = normal desktop)
- `"Current Space"` -- dictionary with the currently active space on that display

**Current behavior**: The method loops over all displays and appends all space IDs with `type == 0` into a single flat `[Int]` array. The display identity and grouping are discarded.

**Multi-display integration point**: This is where display grouping must be preserved. A new method (or modified return type) should return something like `[(displayID: String, spaces: [Int])]` or a dictionary `[String: [Int]]`.

#### `getCurrentSpaceIndex()` (Lines 188-195)
- Finds the current space ID in the flattened list and returns 1-based index
- **Multi-display impact**: Must return per-display index instead of global index. E.g., if Display B's 2nd space is active, return 2, not the global position.

#### `getOrderedSpaces()` (Lines 201-205)
- Returns `(position, spaceID)` tuples from the flattened list
- Position is 1-based global
- **Multi-display impact**: Must be scoped to a specific display.

### 2.5 OverlayWindow (Lines 210-306)

```swift
class OverlayWindow: NSWindow {
    init(screen: NSScreen, text: String, config: OverlayConfig)
    func updateText(_ text: String, config: OverlayConfig)
    private func positionLabel(in containerView: NSView, config: OverlayConfig)
}
```

- Creates a borderless, transparent, mouse-ignoring window at desktop level
- `collectionBehavior = [.canJoinAllSpaces, .stationary]` -- appears on all spaces
- Accepts an `NSScreen` parameter in `init` and sizes the window to `screen.frame`
- Positions a text label according to the `position` config value (top-left, center, bottom-right, etc.)
- **Multi-display impact**: The window init already accepts `screen: NSScreen`, so it can target any screen. However, `.canJoinAllSpaces` means the single overlay window appears on all spaces. For multi-display, separate overlay windows per display may be needed, or the overlay should only appear on the active display's screen.

### 2.6 OverlayManager (Lines 310-355) -- NEEDS CHANGES

```swift
class OverlayManager {
    private var overlayWindow: OverlayWindow?
    private let spaceDetector: SpaceDetector

    init(spaceDetector: SpaceDetector)
    func updateOverlay(config: JumpeeConfig)
    func removeAllOverlays()
}
```

#### `updateOverlay(config:)` (Lines 318-349) -- KEY METHOD

Current flow:
1. Check `config.overlay.enabled` -- if false, remove overlays
2. Get `NSScreen.main` -- **hardcoded to main screen**
3. Get `spaceDetector.getCurrentSpaceIndex()` -- **global index**
4. Get space ID, look up name in `config.spaces`
5. Format display text (with or without space number)
6. Create or update the single `OverlayWindow`

**Multi-display integration points**:
- Line 324: `NSScreen.main` must be replaced with the screen corresponding to the active display. Requires mapping CGS display identifier to `NSScreen` instance via `NSScreen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")]` or `CGDirectDisplayID`.
- Line 325: `getCurrentSpaceIndex()` must return per-display index.
- The manager holds a single `overlayWindow`. For multi-display, it may need a dictionary of windows per screen, or simply move/recreate the single overlay on the correct screen when the active display changes.

### 2.7 SpaceNavigator (Lines 359-396) -- NEEDS GLOBAL-TO-PER-DISPLAY MAPPING

```swift
class SpaceNavigator {
    static func navigateToSpace(index: Int)     // Sends Ctrl+N keystroke
    static func checkAccessibility()            // Prompts for AX permissions
    private static func keyCodeForNumber(_ n: Int) -> Int  // Maps 1-9 to key codes
}
```

#### `navigateToSpace(index:)` (Lines 360-371)
- Sends `Ctrl+<number>` keystroke via `CGEvent`
- The `index` parameter is used directly as the global desktop number
- macOS interprets `Ctrl+N` as "Switch to Desktop N" globally across all displays
- **Multi-display impact (CRITICAL)**: When the user presses Cmd+3 in the menu (meaning "3rd space on the active display"), Jumpee must compute the global position of that space. E.g., if Display A has 3 spaces and Display B's 2nd space is targeted, the global index would be 5 (3 + 2). The caller (`navigateToSpace(_:)` in MenuBarController) must pass the global position, not the per-display position.

### 2.8 GlobalHotkeyManager (Lines 400-456)

- Registers a global hotkey via Carbon `RegisterEventHotKey` API
- Calls `globalMenuBarController?.openMenu()` on trigger
- **Multi-display impact**: None -- the hotkey simply opens the menu.

### 2.9 MenuBarController (Lines 460-751) -- CENTRAL CONTROLLER, NEEDS EXTENSIVE CHANGES

```swift
class MenuBarController: NSObject {
    let statusItem: NSStatusItem
    private let spaceDetector: SpaceDetector
    private var config: JumpeeConfig
    private var spaceMenuItems: [NSMenuItem]
    private let overlayManager: OverlayManager
    private var hotkeyManager: GlobalHotkeyManager?
}
```

#### `init()` (Lines 468-486)
- Creates SpaceDetector, loads config, creates OverlayManager
- Calls `migratePositionBasedConfig()`, `setupMenu()`, `updateTitle()`
- Registers for space change notifications
- Sets up global hotkey
- Triggers initial overlay update after 0.5s delay

#### `migratePositionBasedConfig()` (Lines 492-520)
- Migrates old position-based config keys ("1", "2") to space-ID-based keys
- Uses the flattened `getAllSpaceIDs()` to map positions to IDs
- **Multi-display impact**: This migration uses global positions. With multi-display, positions would be ambiguous. Since this is a legacy migration for old configs, it should remain as-is (it only runs if ALL keys are small integers).

#### `updateTitle()` (Lines 574-590)
- Gets `getCurrentSpaceIndex()` (global) and `getCurrentSpaceID()`
- Looks up custom name, formats as "N: Name" or just "Name"
- **Multi-display impact**: Must use per-display index instead of global index.

#### `rebuildSpaceItems()` (Lines 592-649) -- KEY MENU BUILDING METHOD
- Removes old space menu items
- Calls `spaceDetector.getOrderedSpaces()` -- gets ALL spaces globally
- Iterates all spaces, creates menu items with global position and Cmd+N shortcuts
- Marks current space with checkmark
- Adds "Rename Current Desktop..." item
- **Multi-display integration points**:
  - Must filter to only show spaces belonging to the active display
  - Position numbering must be per-display (1, 2, 3... for that display only)
  - Cmd+N shortcuts must map to per-display positions
  - Could add a display header/label showing which display's spaces are shown

#### `navigateToSpace(_:)` (Lines 664-673)
- Gets space index from menu item `tag` (currently global position)
- Sends navigation keystroke via `SpaceNavigator.navigateToSpace(index:)`
- **Multi-display impact**: The tag stores a global position, but with per-display numbering, the tag must either store the global position (for navigation) or the per-display position must be translated to global before calling SpaceNavigator.

#### `renameActiveSpace()` (Lines 675-717)
- Gets current space index and ID
- Shows rename dialog
- Saves name keyed by space ID
- **Multi-display impact**: Minimal -- space ID is already globally unique, so the name mapping works regardless of display. The dialog title shows the space index, which should be per-display.

#### `spaceDidChange(_:)` (Lines 659-662)
- Called when `NSWorkspace.activeSpaceDidChangeNotification` fires
- Updates title and overlay
- **Multi-display impact**: This notification fires on any space change, including switching between displays. The handler already calls updateTitle() and updateOverlay(), which will need the per-display awareness built into their dependencies.

#### `reloadConfig(_:)` (Lines 739-744)
- Reloads config from disk, updates title, overlay, hotkey
- **Multi-display impact**: None beyond what updateTitle/updateOverlay need.

### 2.10 NSMenuDelegate Extension (Lines 755-759)
- `menuWillOpen(_:)` calls `rebuildSpaceItems()` each time the menu opens
- **Multi-display impact**: Good -- the menu is rebuilt fresh each time, so display-aware filtering is naturally triggered.

### 2.11 AppDelegate and Main (Lines 763-778)
- Standard NSApplication setup with `.accessory` activation policy (no dock icon)
- **Multi-display impact**: None.

---

## 3. Patterns and Conventions

### Coding Style
- Single-file architecture -- all types in `Sources/main.swift`
- MARK comments divide sections: `// MARK: - Section Name`
- Classes over structs for stateful components
- Structs for data/config types
- Computed properties for derived values (e.g., `keyCode`, `carbonModifiers`)
- Static factory methods (e.g., `JumpeeConfig.load()`, `OverlayConfig.defaultConfig`)

### Error Handling
- Permissive: uses `try?` throughout -- failures are silently ignored
- Config load falls back to defaults if file missing or corrupt
- No logging framework; uses `print()` for migration messages

### Config Loading/Saving
- JSON file at `~/.Jumpee/config.json`
- Loaded via `JSONDecoder`, saved via `JSONEncoder` with pretty printing and sorted keys
- No schema validation beyond Codable conformance
- Directory created on save if needed

### Event Model
- Space changes detected via `NSWorkspace.activeSpaceDidChangeNotification`
- Menu rebuilt fresh on every open (via `NSMenuDelegate.menuWillOpen`)
- Global hotkey via Carbon `RegisterEventHotKey`
- Navigation via simulated `CGEvent` keystrokes (Ctrl+N)

---

## 4. Integration Points for Multi-Display Support

### 4.1 SpaceDetector -- Per-Display Data Available but Flattened

**Location**: `getAllSpaceIDs()` at line 171

**Current state**: The raw `CGSCopyManagedDisplaySpaces` data is cast to `[[String: Any]]` -- an array of display dictionaries. Each display dictionary contains:
- `"Display Identifier"` (String) -- display UUID
- `"Spaces"` (Array of dicts) -- each with `"ManagedSpaceID"` (Int) and `"type"` (Int)
- `"Current Space"` (Dict) -- currently active space on that display

The method iterates ALL displays and flattens ALL space IDs into one `[Int]` array. The display identifier and per-display grouping are **discarded at line 175-183**.

**Required change**: Add new methods that preserve display grouping. Keep `getAllSpaceIDs()` for backward compatibility. New methods needed:
- `getSpacesPerDisplay() -> [(displayID: String, spaceIDs: [Int])]`
- `getDisplayForActiveSpace() -> String?` (which display owns the current space)
- `getPerDisplayIndex() -> Int?` (position of current space within its display)
- `getGlobalIndexForDisplaySpace(displayID: String, localIndex: Int) -> Int?`

### 4.2 MenuBarController -- Must Filter by Display

**Location**: `rebuildSpaceItems()` at line 592

**Current state**: Shows ALL spaces from ALL displays in one flat list.

**Required changes**:
1. Determine which display is active (by finding which display's space list contains the current space ID)
2. Filter `getOrderedSpaces()` to only that display's spaces
3. Number spaces 1, 2, 3... per-display instead of globally
4. In `navigateToSpace(_:)`, translate per-display position to global position for the Ctrl+N keystroke
5. Optionally add a display identifier label in the menu

**Location**: `updateTitle()` at line 574

**Required change**: Use per-display index instead of global `getCurrentSpaceIndex()`.

### 4.3 OverlayManager -- Must Target Correct Screen

**Location**: `updateOverlay(config:)` at line 318, specifically line 324

**Current state**: Uses `NSScreen.main` which returns the screen containing the key window (usually the primary display).

**Required changes**:
1. Determine which `NSScreen` corresponds to the active display
2. Map CGS display identifier to `NSScreen` via `NSScreen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")]` to get `CGDirectDisplayID`, then correlate with the CGS display UUID
3. Position the overlay on that screen instead of `NSScreen.main`
4. When the active display changes (space change notification), move or recreate the overlay on the new screen

**Additional consideration**: The overlay uses `.canJoinAllSpaces` collection behavior (line 229). With multiple displays, this means the single overlay window appears on all spaces of all displays. For multi-display:
- Either create one overlay per display and show/hide as needed
- Or change collection behavior and recreate the overlay on the active screen each time
- Or keep `.canJoinAllSpaces` but reposition the window frame to match the active screen

### 4.4 Config -- Per-Display Structure

**Current state**: `spaces: [String: String]` is a flat dict of space-ID-to-name.

**Key insight**: Because space IDs are globally unique across all displays, the flat dict **already works correctly for multi-display** -- a space ID on Display A will never collide with one on Display B. No structural change to the spaces dict is required for basic functionality.

**Optional enhancement**: The refined request proposes a `displays` dict grouping spaces by display. This is only needed if:
- Per-display overlay settings are desired (out of scope per the request)
- Display aliases are desired (out of scope per the request)
- Visual organization of the config file is important

**Recommendation from refined request**: Keep the flat `spaces` dict for simplicity. Display grouping is a runtime concern only.

### 4.5 SpaceNavigator -- Global Position Calculation

**Location**: `navigateToSpace(index:)` at line 360

**Current state**: Sends `Ctrl+<index>` where index is passed directly.

**Required change**: The caller must ensure `index` is the **global** desktop position, not the per-display position. The translation logic belongs in the caller (MenuBarController), not in SpaceNavigator itself. SpaceNavigator can remain unchanged -- it just needs to receive the correct global index.

**Translation formula**: `globalIndex = (sum of space counts on all displays before the active display) + localIndex`

The display ordering in the `CGSCopyManagedDisplaySpaces` array determines the global numbering.

---

## 5. Summary of Changes by Component

| Component | Scope of Change | Complexity |
|-----------|----------------|------------|
| `SpaceDetector` | Add new methods preserving per-display data | Medium |
| `MenuBarController.rebuildSpaceItems()` | Filter spaces by active display, per-display numbering | Medium |
| `MenuBarController.updateTitle()` | Use per-display index | Low |
| `MenuBarController.navigateToSpace(_:)` | Translate per-display to global index | Medium |
| `MenuBarController.renameActiveSpace()` | Use per-display index in dialog text | Low |
| `OverlayManager.updateOverlay()` | Target correct NSScreen | Medium |
| `SpaceNavigator` | No change needed | None |
| `JumpeeConfig` | No structural change required (flat spaces dict works) | None |
| `OverlayWindow` | Already accepts `screen` parameter | None |
| `GlobalHotkeyManager` | No change needed | None |
| `AppDelegate` / main | No change needed | None |

---

## 6. Risk Areas

1. **Display-to-NSScreen mapping**: Correlating CGS `"Display Identifier"` UUIDs to `NSScreen` instances requires going through `CGDirectDisplayID`. The mapping path is: CGS UUID -> find in `CGSCopyManagedDisplaySpaces` -> match to `NSScreen.screens` via `deviceDescription["NSScreenNumber"]`. This mapping logic does not exist in the codebase today.

2. **Global position calculation**: The order of displays in the `CGSCopyManagedDisplaySpaces` array must match macOS's internal global numbering for Ctrl+N shortcuts. If the ordering is inconsistent, navigation will jump to the wrong space. Testing with actual multi-display hardware is essential.

3. **Display connect/disconnect**: When a display is plugged in or removed, macOS reassigns spaces. The `NSWorkspace.activeSpaceDidChangeNotification` should fire, but Jumpee may also need to observe `NSApplication.didChangeScreenParametersNotification` to detect screen changes that don't involve a space switch.

4. **"Displays have separate Spaces" setting**: When this macOS setting is OFF, all displays share one space set. The `CGSCopyManagedDisplaySpaces` output changes structure. Jumpee should detect this and fall back to single-display behavior.

5. **Overlay `.canJoinAllSpaces` behavior**: The current overlay window uses `.canJoinAllSpaces` which makes it visible on every space. With multi-display, if separate overlay windows are created per display, each would show on all spaces of all displays unless collection behavior is adjusted.
