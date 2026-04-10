# Jumpee - macOS Desktop/Space Naming & Navigation Tool

## Overview

Jumpee is a lightweight native macOS menu bar application that allows users to assign custom names to their Mission Control desktops (Spaces), jump between them via a global hotkey, and display a configurable watermark overlay on each desktop. Since macOS does not provide any public API to rename Spaces, Jumpee uses private CoreGraphics APIs to detect the current space and displays a user-defined name in the menu bar.

## Architecture

### Technology Stack
- **Language**: Swift (native macOS, required for menu bar apps and private CGS APIs)
- **Framework**: AppKit (NSStatusBar, NSMenu), Carbon (RegisterEventHotKey)
- **Build**: `swiftc` command-line compiler (no full Xcode required)
- **Packaging**: Standard `.app` bundle with Info.plist
- **Config**: JSON file at `~/.Jumpee/config.json`

### Key Components

1. **SpaceDetector** - Uses private CGS APIs to:
   - Get the current active space ID (ManagedSpaceID) via `CGSGetActiveSpace`
   - List all spaces across all displays via `CGSCopyManagedDisplaySpaces`
   - Map space IDs to ordinal positions (Desktop 1, 2, 3...)
   - Expose `getOrderedSpaces()` returning `[(position: Int, spaceID: Int)]` tuples for resolving both positional index and stable space ID
   - Filter by type (type 0 = regular desktop, type 4 = fullscreen app)

2. **JumpeeConfig** - Manages all configuration:
   - Stores config in `~/.Jumpee/config.json`
   - Maps space IDs (ManagedSpaceID as string keys) to custom names (e.g., `{"247": "Mail", "63": "Dev"}`)
   - One-time migration from position-based keys to space-ID keys occurs at startup when legacy config is detected
   - Overlay settings (opacity, font, size, weight, position, color, margin)
   - Hotkey settings (key, modifiers)
   - Auto-saves on every change

3. **MenuBarController** - The menu bar UI:
   - Shows current space's custom name (or "Desktop N" if unnamed)
   - Dropdown lists all spaces — click to navigate
   - "Rename Current Desktop..." for active space only
   - Toggle options for space numbers and overlay
   - Config file access and reload

4. **OverlayManager** - Desktop watermark:
   - Single transparent window at desktop level
   - Joins all spaces (`canJoinAllSpaces`)
   - Updates text on space change
   - Click-through (ignores mouse events)
   - Configurable font, size, weight, color, opacity, position, margin

5. **GlobalHotkeyManager** - Keyboard shortcut:
   - Uses Carbon `RegisterEventHotKey` API (no accessibility permissions needed)
   - Default: Cmd+J
   - Configurable key and modifier combination
   - Opens the status item menu programmatically

6. **SpaceNavigator** - Desktop switching:
   - Uses `osascript` subprocess to send Ctrl+number keystrokes via System Events
   - Closes menu before switching to avoid conflicts
   - Reopens menu after switch completes
   - Requires "Switch to Desktop N" shortcuts enabled in System Settings

7. **AppDelegate** - Application lifecycle:
   - LSUIElement (no dock icon)
   - Listens to `NSWorkspace.activeSpaceDidChangeNotification`
   - Updates menu bar and overlay on space change

### Private APIs Used

```swift
CGSMainConnectionID() -> Int32          // Get connection to window server
CGSGetActiveSpace(_ cid: Int32) -> Int  // Get current space ID
CGSCopyManagedDisplaySpaces(_ cid: Int32) -> CFArray  // List all spaces
```

These are private CoreGraphics APIs. They work on macOS but are not App Store safe (not needed — this is a personal tool).

### Data Flow

1. App starts -> registers Carbon hotkey, creates overlay, registers for space change notifications
2. User presses Cmd+J -> menu opens showing all desktops
3. User clicks a desktop -> menu closes -> `osascript` sends Ctrl+N -> space switches -> menu reopens
4. Space changes -> `SpaceDetector.getCurrentSpaceIndex()` called for display position, `getCurrentSpaceID()` called for config key lookup -> name looked up by space ID -> menu bar title and overlay updated
5. User renames desktop -> space ID retrieved via `getCurrentSpaceID()` -> config saved to `~/.Jumpee/config.json` with space ID as key -> UI updated
6. First launch after migration -> position-based config keys detected -> mapped to space IDs using current space ordering -> config rewritten with space-ID keys

### Configuration File

See `docs/design/configuration-guide.md` for full details.

## Limitations

- Uses private macOS APIs (may break with OS updates)
- Cannot modify the actual Mission Control labels (hard OS limitation)
- Overlay shows current space name only (cannot show different names per space in Mission Control thumbnails)
- Desktop switching requires "Switch to Desktop N" shortcuts enabled in System Settings
- Maximum 9 desktops for navigation (limited by Ctrl+1 through Ctrl+9 shortcuts)
- Space IDs (ManagedSpaceID) are stable across reboots and reorders but could theoretically be reassigned after a major macOS upgrade, requiring re-renaming

## Window Mover (v1.2 -- Move Window to Desktop)

This section describes the technical design for the "move focused window to Desktop N" feature. The full technical design is in `docs/design/technical-design-window-move.md`. The implementation plan is in `docs/design/plan-004-window-move-feature.md`.

### Approach

Jumpee synthesizes the macOS built-in "Move window to Desktop N" keyboard shortcuts (Ctrl+Shift+N) via CGEvent, using the same mechanism already used by SpaceNavigator for space switching (Ctrl+N). No CGS private APIs are used for the move operation.

This approach was chosen because the CGS space-assignment APIs (`CGSAddWindowsToSpaces`, `CGSRemoveWindowsFromSpaces`) are broken on macOS 15+ (Sequoia) due to Apple adding connection-rights checks to the WindowServer. System shortcut synthesis is the only reliable approach across macOS 13-26.

### Key Constraint

The user must enable "Move window to Desktop N" shortcuts in System Settings > Keyboard > Keyboard Shortcuts > Mission Control. These are disabled by default. This is the same class of requirement Jumpee already has for "Switch to Desktop N" navigation shortcuts.

### New Components

1. **WindowMover** (class, static methods) -- Synthesizes Ctrl+Shift+N keystrokes to move the focused window. Also checks whether the system shortcuts are enabled by reading `com.apple.symbolichotkeys.plist`. Located after `SpaceNavigator` in `main.swift`.

2. **MoveWindowConfig** (struct, Codable) -- Configuration for the move feature. Phase 1 contains only `enabled: Bool`. Located after `HotkeyConfig` in `main.swift`.

3. **"Move Window To..." submenu** -- Added to the Jumpee dropdown menu in `rebuildSpaceItems()`. Lists all desktops on the active display except the current one. Uses Shift+Cmd+1-9 as keyboard equivalents when the menu is open.

4. **"Set Up Window Moving..." menu item** -- Shown when the system shortcuts are not detected. Opens a guidance dialog with instructions and an "Open System Settings" button.

### Configuration

Optional `moveWindow` key in `~/.Jumpee/config.json`:

```json
{
    "moveWindow": {
        "enabled": true
    }
}
```

When absent, the feature is disabled. Existing configs work without modification.

### Behavior

- Move always switches to the target desktop (macOS 15+ forces this; no "stay behind" option).
- Visual feedback is implicit: the overlay and menu bar title update via the existing `activeSpaceDidChangeNotification` handler.
- Fullscreen windows, "Assign to All Desktops" windows, and system windows are silently ignored by macOS.

### Integration with Existing Code

- `SpaceNavigator.keyCodeForNumber(_:)` access changed from `private` to file-scope to allow reuse by `WindowMover`.
- `JumpeeConfig` gains an optional `moveWindow: MoveWindowConfig?` property.
- `MenuBarController.rebuildSpaceItems()` extended to add the move submenu when enabled.
- Two new `@objc` handlers added to `MenuBarController`: `moveWindowToSpace(_:)` and `showMoveWindowSetup()`.

### Phases

- **Phase 1** (this design): Menu-based invocation only. ~120 lines added to `main.swift`.
- **Phase 2** (future): Global hotkeys (Ctrl+Cmd+1-9), Move Left/Right One Space, configurable modifiers.
- **Phase 3** (future): Cross-display window movement.

## Multi-Display Workspace Support (v1.1)

This section describes the technical design for adding per-display workspace awareness to Jumpee. Currently, Jumpee flattens all macOS spaces into a single global list, discarding the display grouping returned by `CGSCopyManagedDisplaySpaces`. The v1.1 enhancement makes Jumpee display-aware: the menu shows only the active display's spaces, numbering and shortcuts are per-display, and the overlay appears on the correct screen.

### 1. New Data Structures

Two new structs are introduced to represent per-display space topology. These are defined in `Sources/main.swift` near the `SpaceDetector` class (after line 206).

```swift
struct SpaceInfo {
    let spaceID: Int          // ManagedSpaceID from CGSCopyManagedDisplaySpaces
    let localPosition: Int    // 1-based position within this display
    let globalPosition: Int   // 1-based position across all displays (for Ctrl+N navigation)
}

struct DisplayInfo {
    let displayID: String     // UUID from CGSCopyManagedDisplaySpaces ("Main" or UUID string)
    let spaces: [SpaceInfo]   // Ordered list of normal desktop spaces on this display
}
```

**Design rationale**:
- `SpaceInfo.localPosition` is used for menu item labels, menu bar title, overlay text, and rename dialog — all user-facing numbering is per-display.
- `SpaceInfo.globalPosition` is used exclusively for navigation — `SpaceNavigator.navigateToSpace(index:)` requires the global position because macOS Ctrl+1-9 shortcuts use global desktop numbering across all displays.
- `DisplayInfo.displayID` matches the `"Display Identifier"` key from `CGSCopyManagedDisplaySpaces`. It is either the literal string `"Main"` (for the built-in display on laptops) or a UUID string (e.g., `"37D8832A-2D66-02CA-B9F7-8F30A301B230"`) for external displays.
- The `DisplayInfo.spaces` array preserves the ordering from `CGSCopyManagedDisplaySpaces`, which determines the macOS global numbering.

### 2. SpaceDetector Changes

Four new methods are added to the `SpaceDetector` class. All existing methods (`getCurrentSpaceID()`, `getAllSpaceIDs()`, `getCurrentSpaceIndex()`, `getSpaceCount()`, `getOrderedSpaces()`) remain unchanged for backward compatibility.

#### 2.1 `getSpacesByDisplay() -> [DisplayInfo]`

Returns all displays and their spaces, preserving display grouping and computing both local and global positions.

**Full signature**:
```swift
func getSpacesByDisplay() -> [DisplayInfo]
```

**Pseudocode**:
```
1. Call CGSCopyManagedDisplaySpaces(connectionID), cast to [[String: Any]]
2. Initialize globalCounter = 1
3. For each display dictionary in the result array:
   a. Extract "Display Identifier" as String -> displayID
   b. Extract "Spaces" as [[String: Any]]
   c. Initialize localCounter = 1
   d. Initialize spacesForDisplay: [SpaceInfo] = []
   e. For each space dictionary in "Spaces":
      - Extract "ManagedSpaceID" as Int -> spaceID
      - Extract "type" as Int -> type
      - If type != 0, skip (fullscreen apps, dashboard)
      - Create SpaceInfo(spaceID: spaceID, localPosition: localCounter, globalPosition: globalCounter)
      - Append to spacesForDisplay
      - Increment localCounter
      - Increment globalCounter
   f. Create DisplayInfo(displayID: displayID, spaces: spacesForDisplay)
   g. Append to result array
4. Return result array
```

**Critical detail**: The iteration order over the `CGSCopyManagedDisplaySpaces` array determines globalPosition values. This order must match the global numbering macOS uses for Ctrl+1-9 shortcuts. The display that appears first in the array owns global positions 1 through N, the second display owns positions N+1 through M, and so on.

**Single-display behavior**: Returns a single `DisplayInfo` element. All `localPosition` values equal their corresponding `globalPosition` values. Behavior is identical to the current flattened approach.

#### 2.2 `getActiveDisplayID() -> String?`

Returns the display identifier string for the display containing the currently active space.

**Full signature**:
```swift
func getActiveDisplayID() -> String?
```

**Pseudocode**:
```
1. Get activeSpaceID = CGSGetActiveSpace(connectionID)
2. Get displays = getSpacesByDisplay()
3. For each display in displays:
   a. For each space in display.spaces:
      - If space.spaceID == activeSpaceID:
        return display.displayID
4. Return nil  // Should not happen in practice
```

**Edge case**: When "Displays have separate Spaces" is OFF in System Settings, `CGSCopyManagedDisplaySpaces` returns a single display entry containing all spaces. This method returns that single display's identifier, and all downstream logic treats it as single-display mode. No special-case code is needed.

#### 2.3 `getCurrentSpaceInfo() -> (displayID: String, localPosition: Int, globalPosition: Int)?`

Combined lookup that returns the active space's display identity and both position values in a single call. This is the primary method used by `MenuBarController.updateTitle()`, `MenuBarController.renameActiveSpace()`, and `OverlayManager.updateOverlay()`.

**Full signature**:
```swift
func getCurrentSpaceInfo() -> (displayID: String, localPosition: Int, globalPosition: Int)?
```

**Pseudocode**:
```
1. Get activeSpaceID = CGSGetActiveSpace(connectionID)
2. Get displays = getSpacesByDisplay()
3. For each display in displays:
   a. For each space in display.spaces:
      - If space.spaceID == activeSpaceID:
        return (displayID: display.displayID,
                localPosition: space.localPosition,
                globalPosition: space.globalPosition)
4. Return nil
```

**Consistency guarantee**: `globalPosition` from this method always equals the value returned by the existing `getCurrentSpaceIndex()` method. This can be used as a verification check during development.

#### 2.4 `displayIDToScreen(_ displayID: String) -> NSScreen?`

Maps a CGS display identifier string to the corresponding `NSScreen` instance. This is needed by `OverlayManager` to position the overlay on the correct physical screen.

**Full signature**:
```swift
func displayIDToScreen(_ displayID: String) -> NSScreen?
```

**Pseudocode**:
```
1. If displayID == "Main":
   a. Get mainDisplayID = CGMainDisplayID()
   b. For each screen in NSScreen.screens:
      - Extract screenNumber from screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as CGDirectDisplayID
      - If screenNumber == mainDisplayID: return screen
   c. Return nil

2. For each screen in NSScreen.screens:
   a. Extract screenNumber from screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as CGDirectDisplayID
   b. Call CGDisplayCreateUUIDFromDisplayID(screenNumber) -> CFUUID?
   c. Convert CFUUID to string via CFUUIDCreateString(nil, uuid) -> String?
   d. Compare uuidString with displayID using case-insensitive comparison
   e. If match: return screen

3. Return nil  // Display not found (may have been disconnected)
```

**Implementation detail — `CGDisplayCreateUUIDFromDisplayID`**: This is a **public** CoreGraphics function available since macOS 10.2. It is accessible through `import Cocoa` (no additional import needed). It returns an `Unmanaged<CFUUID>?` which must be unwrapped with `.takeRetainedValue()` before converting to a string.

**UUID format risk**: The UUID string format from `CGDisplayCreateUUIDFromDisplayID` may differ in case from the `"Display Identifier"` returned by `CGSCopyManagedDisplaySpaces`. Case-insensitive comparison (`.caseInsensitiveCompare(_:) == .orderedSame`) mitigates this. Must be verified on actual multi-display hardware.

**Note**: This method is placed on `SpaceDetector` rather than as a standalone function because it is logically part of the space/display detection responsibility and has access to no instance state (it could alternatively be a static method or a free function near `OverlayManager`). The placement decision is a matter of code organization within the single-file architecture.

### 3. MenuBarController Changes

#### 3.1 `rebuildSpaceItems()` Changes

**Current behavior** (line 592): Calls `spaceDetector.getOrderedSpaces()` to get ALL spaces globally, creates menu items numbered 1-N globally, stores global position in `item.tag`.

**New behavior**: Filters spaces to the active display, uses per-display numbering, adds a display header, and stores globalPosition in `item.tag` for navigation.

**Detailed changes**:

```
1. Call spaceDetector.getSpacesByDisplay() -> [DisplayInfo]
2. Call spaceDetector.getCurrentSpaceID() -> activeSpaceID
3. Find the DisplayInfo whose spaces array contains activeSpaceID
   -> activeDisplay: DisplayInfo
4. Extract activeDisplay.spaces -> spacesOnActiveDisplay: [SpaceInfo]

5. Add display header (disabled NSMenuItem):
   - If activeDisplay.displayID == "Main":
     title = "Display: Built-in"
   - Else:
     title = "Display: \(activeDisplay.displayID.prefix(8))..."
   - Insert as first item after "Desktops:" label
   - Include in spaceMenuItems array for cleanup on rebuild

6. For each space in spacesOnActiveDisplay:
   a. Look up custom name: config.spaces[String(space.spaceID)]
   b. Format display name:
      - With name: "Desktop \(space.localPosition) - \(name)"
      - Without name: "Desktop \(space.localPosition)"
   c. Set keyEquivalent:
      - space.localPosition <= 9 ? String(space.localPosition) : ""
      - Cmd+1 through Cmd+9 correspond to per-display positions
   d. Set item.tag = space.globalPosition
      (This is the critical mapping: menu shows localPosition but tag stores
       globalPosition for SpaceNavigator.navigateToSpace(index:))
   e. Mark current space with .on state if space.spaceID == activeSpaceID

7. Append "Rename Current Desktop..." item (unchanged)
8. Update toggle item titles (unchanged)
```

**Menu layout with two displays** (Display A active, 3 spaces):
```
Jumpee
---
Desktops:
Display: Built-in
  * Desktop 1 - Development     Cmd+1
    Desktop 2 - Terminal         Cmd+2
    Desktop 3                    Cmd+3
  Rename Current Desktop...      Cmd+N
---
Hide Space Number
Disable Overlay
---
Open Config File...       Cmd+,
Reload Config             Cmd+R
---
Quit Jumpee               Cmd+Q
```

**Key design decision**: Spaces from other displays are NOT shown in the menu. This is by design per FR3 and FR4 — the user interacts only with the active display's spaces. Showing all displays would create confusing shortcut numbering (Cmd+3 for an item labeled "Desktop 1" on Display B).

#### 3.2 `updateTitle()` Changes

**Current behavior** (line 574): Uses `spaceDetector.getCurrentSpaceIndex()` which returns a global index.

**New behavior**:
```
1. Call spaceDetector.getCurrentSpaceInfo()
   -> (displayID, localPosition, globalPosition)?
2. If nil, set title to "?" and return
3. Look up custom name: config.spaces[String(spaceDetector.getCurrentSpaceID())]
4. Format title using localPosition (not globalPosition):
   - With name + showSpaceNumber: "\(localPosition): \(name)"
   - With name only: "\(name)"
   - Without name: "Desktop \(localPosition)"
```

**Example**: Display B's 2nd space named "Browser" shows "2: Browser" in the menu bar, not "5: Browser" (where 5 would be the global position if Display A has 3 spaces).

#### 3.3 `renameActiveSpace()` Changes

**Current behavior** (line 675): Uses `spaceDetector.getCurrentSpaceIndex()` (global) in the dialog title.

**New behavior**:
```
1. Call spaceDetector.getCurrentSpaceInfo()
   -> (displayID, localPosition, globalPosition)?
2. Use localPosition in dialog title: "Rename Desktop \(localPosition)"
3. Space ID lookup and name saving remain unchanged
   (keyed by spaceID which is globally unique — no display scoping needed)
```

**Config impact**: None. The flat `spaces: { "spaceID": "name" }` dictionary works correctly because space IDs are globally unique. Renaming a space on Display A does not affect Display B.

#### 3.4 `spaceDidChange()` — No Code Changes Needed

**Current behavior** (line 659): Calls `updateTitle()` and `overlayManager.updateOverlay(config:)`.

**Why no changes**: The `NSWorkspace.activeSpaceDidChangeNotification` fires on any space change, including switching between displays. Since `updateTitle()` and `updateOverlay()` will be updated to use per-display logic (sections 3.2 and 4), this handler automatically picks up the correct display context on each invocation. The notification is display-agnostic — it simply triggers a refresh, and the refresh methods determine the current display.

#### 3.5 `navigateToSpace(_:)` — No Code Changes Needed

**Current behavior** (line 664): Reads `sender.tag` and passes it to `SpaceNavigator.navigateToSpace(index:)`.

**Why no changes**: In section 3.1, `item.tag` is set to `space.globalPosition`. The `navigateToSpace(_:)` method reads this tag and passes it directly to `SpaceNavigator`, which sends the corresponding Ctrl+N keystroke. Since the tag already contains the correct global position, the keystroke targets the right desktop.

The guard comparison `if spaceIndex != currentIndex` compares `sender.tag` (globalPosition) against `spaceDetector.getCurrentSpaceIndex()` (also global). Both are global values, so the comparison remains correct.

### 4. OverlayManager Changes

#### 4.1 New Private Property

Add a property to track the current display for the overlay:
```swift
private var currentDisplayID: String?
```

This avoids unnecessary window frame changes when only the space changes (same display) versus when the display changes.

#### 4.2 `updateOverlay(config:)` Changes

**Current behavior** (line 318): Uses `NSScreen.main` and `spaceDetector.getCurrentSpaceIndex()` (global).

**New behavior**:
```
1. Guard config.overlay.enabled (unchanged)

2. Call spaceDetector.getCurrentSpaceInfo()
   -> (displayID, localPosition, globalPosition)?

3. Determine target screen:
   a. Call spaceDetector.displayIDToScreen(info.displayID) -> NSScreen?
   b. If nil, fall back to NSScreen.main (defensive — display may have disconnected)

4. Look up custom name using spaceID (unchanged logic)

5. Format displayText using localPosition (not globalPosition):
   - With name + showSpaceNumber: "\(localPosition): \(name)"
   - Without: "Desktop \(localPosition)"

6. If overlayWindow exists:
   a. If info.displayID != currentDisplayID (display changed):
      - Call overlayWindow.updateScreen(targetScreen, config: config.overlay)
      - Update currentDisplayID = info.displayID
   b. Call overlayWindow.updateText(displayText, config: config.overlay)

7. If overlayWindow is nil (first creation):
   a. Create OverlayWindow(screen: targetScreen, text: displayText, config: config.overlay)
   b. Set currentDisplayID = info.displayID
   c. Call window.orderFront(nil)
```

#### 4.3 New `updateScreen(_:config:)` Method on OverlayWindow

A new method is added to `OverlayWindow` (after `updateText(_:config:)` at line 267) to reposition the overlay on a different screen without recreating the window.

**Signature**:
```swift
func updateScreen(_ screen: NSScreen, config: OverlayConfig)
```

**Implementation**:
```
1. self.setFrame(screen.frame, display: true)
   // macOS uses a global coordinate system where each screen has a unique
   // frame origin. Setting the frame to screen.frame positions the window
   // exactly on that screen.

2. if let contentView = self.contentView:
   a. contentView.frame = NSRect(origin: .zero, size: screen.frame.size)
   b. positionLabel(in: contentView, config: config)
```

**Why single-overlay approach**: The design uses a single `OverlayWindow` instance that moves between screens (Option A from the investigation). This is simpler than maintaining one overlay per display (Option B) and matches the current single-window architecture. The `.canJoinAllSpaces` collection behavior is retained — the window appears on all spaces, but since it is sized and positioned to one specific screen's frame (using global coordinates), it only visually covers that screen. Per-display overlay configuration (Option B's advantage) is explicitly out of scope for v1.1.

### 5. Display Connect/Disconnect Handling

#### 5.1 Register for Screen Parameter Changes

**Location**: `MenuBarController.registerForSpaceChanges()` (line 651).

**Current behavior**: Registers only for `NSWorkspace.activeSpaceDidChangeNotification`.

**New behavior**: Additionally register for `NSApplication.didChangeScreenParametersNotification` on `NotificationCenter.default` (note: this is a different notification center than `NSWorkspace.shared.notificationCenter`).

```swift
private func registerForSpaceChanges() {
    NSWorkspace.shared.notificationCenter.addObserver(
        self,
        selector: #selector(spaceDidChange),
        name: NSWorkspace.activeSpaceDidChangeNotification,
        object: nil)

    NotificationCenter.default.addObserver(
        self,
        selector: #selector(screenParametersDidChange),
        name: NSApplication.didChangeScreenParametersNotification,
        object: nil)
}
```

#### 5.2 New Handler: `screenParametersDidChange(_:)`

```swift
@objc private func screenParametersDidChange(_ notification: Notification) {
    updateTitle()
    overlayManager.updateOverlay(config: config)
}
```

**Why this is needed**: When a display is disconnected, macOS moves spaces from the disconnected display to the remaining display. The `activeSpaceDidChangeNotification` may or may not fire during this reassignment. `didChangeScreenParametersNotification` guarantees detection of screen topology changes and triggers a refresh of the menu bar title and overlay position.

**What happens on disconnect**:
- `updateTitle()` recalculates using the new topology — spaces that moved to the remaining display get new local positions.
- `updateOverlay()` repositions the overlay to the remaining screen via `displayIDToScreen()`.
- Config data for the disconnected display's spaces remains in `config.json` as harmless unused entries. When the display is reconnected, space names are restored automatically (keyed by globally unique space IDs).

**What happens on connect**:
- New spaces may appear for the connected display. `getSpacesByDisplay()` picks them up on the next menu open or space change.
- The overlay continues showing on the currently active display.

**Debounce consideration**: `didChangeScreenParametersNotification` may fire multiple times in rapid succession during connect/disconnect. The calls to `updateTitle()` and `updateOverlay()` are idempotent and lightweight, so rapid-fire invocations are harmless. If performance issues arise (unlikely), a 0.5-second debounce timer can be added.

### 6. Config Compatibility

**No changes to config format**. The existing flat `spaces: { "spaceID": "name" }` dictionary is preserved without modification.

**Why no migration is needed**:
- Space IDs (`ManagedSpaceID`) are globally unique across all displays. A space ID on Display A will never collide with one on Display B.
- The flat dictionary resolves names correctly regardless of which display owns each space — the lookup is `config.spaces[String(spaceID)]`, and `spaceID` is unique.
- Display grouping is a runtime concern only, determined by cross-referencing space IDs against `CGSCopyManagedDisplaySpaces` output at each menu open and space change.
- Single-display users see zero behavioral change.

**Existing configs work without modification**:
- A config created on a single-display setup works correctly when a second display is connected.
- A config with space names from multiple displays works correctly when one display is disconnected (unused entries are harmlessly ignored).
- The `migratePositionBasedConfig()` migration (line 492) continues to work — it uses `getAllSpaceIDs()` which remains unchanged.

**Future consideration**: If per-display overlay settings or user-friendly display aliases are added in a later version, a `displays` grouping can be introduced in the config at that time. The flat `spaces` dict can coexist with a `displays` dict since they serve different purposes.

### 7. Component Interaction Flow: Space Switch on Multi-Display Setup

This describes the complete event flow when a user switches from Display A's Space 2 to Display B's Space 1, in a setup where Display A has 3 spaces and Display B has 2 spaces.

```
User opens Jumpee menu (Cmd+J or clicks menu bar)
  |
  v
MenuBarController.menuWillOpen()
  |
  v
rebuildSpaceItems()
  |-- spaceDetector.getSpacesByDisplay()
  |     Returns: [
  |       DisplayInfo(displayID: "Main", spaces: [
  |         SpaceInfo(spaceID: 42, localPosition: 1, globalPosition: 1),
  |         SpaceInfo(spaceID: 15, localPosition: 2, globalPosition: 2),  <-- active
  |         SpaceInfo(spaceID: 63, localPosition: 3, globalPosition: 3)
  |       ]),
  |       DisplayInfo(displayID: "37D8832A-...", spaces: [
  |         SpaceInfo(spaceID: 8,  localPosition: 1, globalPosition: 4),
  |         SpaceInfo(spaceID: 23, localPosition: 2, globalPosition: 5)
  |       ])
  |     ]
  |
  |-- spaceDetector.getCurrentSpaceID() -> 15  (Display A, Space 2)
  |
  |-- Active display = "Main" (contains spaceID 15)
  |
  |-- Menu shows only Display A's 3 spaces:
  |     "Desktop 1 - Development"  Cmd+1  tag=1
  |     "Desktop 2 - Terminal" *   Cmd+2  tag=2  (checked)
  |     "Desktop 3"                Cmd+3  tag=3
  |
  v
User clicks "Desktop 1" on Display B
  (But Display B's spaces are NOT shown — user must first switch
   to Display B via Mission Control or mouse focus, then reopen menu)

--- Alternative flow: User switches display via Mission Control ---

User clicks on Display B (macOS activates Display B's space)
  |
  v
NSWorkspace.activeSpaceDidChangeNotification fires
  |
  v
MenuBarController.spaceDidChange()
  |
  +-- updateTitle()
  |     |-- spaceDetector.getCurrentSpaceInfo()
  |     |     Returns: (displayID: "37D8832A-...", localPosition: 1, globalPosition: 4)
  |     |-- config.spaces["8"] -> "Email"
  |     |-- Menu bar title: "1: Email"  (localPosition, not globalPosition 4)
  |
  +-- overlayManager.updateOverlay(config:)
        |-- spaceDetector.getCurrentSpaceInfo()
        |     Returns: (displayID: "37D8832A-...", localPosition: 1, globalPosition: 4)
        |-- spaceDetector.displayIDToScreen("37D8832A-...")
        |     |-- Iterates NSScreen.screens
        |     |-- Calls CGDisplayCreateUUIDFromDisplayID for each screen
        |     |-- Matches UUID string -> Returns NSScreen for external display
        |-- "37D8832A-..." != currentDisplayID ("Main")
        |     -> overlayWindow.updateScreen(externalScreen, config: overlay)
        |        |-- setFrame(externalScreen.frame, display: true)
        |        |-- Repositions label within new frame
        |-- currentDisplayID = "37D8832A-..."
        |-- overlayWindow.updateText("1: Email", config: overlay)

--- User now opens menu on Display B ---

User presses Cmd+J
  |
  v
menuWillOpen()
  |
  v
rebuildSpaceItems()
  |-- Active display = "37D8832A-..." (contains active spaceID 8)
  |-- Menu shows only Display B's 2 spaces:
  |     "Desktop 1 - Email" *      Cmd+1  tag=4  (checked, globalPosition=4)
  |     "Desktop 2 - Browser"      Cmd+2  tag=5  (globalPosition=5)
  |
  v
User clicks "Desktop 2 - Browser" (or presses Cmd+2)
  |
  v
navigateToSpace(sender)
  |-- sender.tag = 5  (globalPosition)
  |-- spaceDetector.getCurrentSpaceIndex() -> 4  (globalPosition of current)
  |-- 5 != 4, so proceed
  |-- statusItem.menu?.cancelTracking()
  |-- After 0.3s delay:
        SpaceNavigator.navigateToSpace(index: 5)
          |-- keyCodeForNumber(5) -> 23  (key code for "5" key)
          |-- Posts CGEvent: Ctrl+5 key down
          |-- Posts CGEvent: Ctrl+5 key up
          |-- macOS switches to global Desktop 5
              (which is Display B's 2nd space, spaceID 23)
  |
  v
NSWorkspace.activeSpaceDidChangeNotification fires
  |
  v
spaceDidChange()
  |-- updateTitle()
  |     -> "2: Browser"  (localPosition=2 on Display B)
  |-- updateOverlay()
        -> Same display ("37D8832A-..."), no screen move needed
        -> Text updates to "2: Browser"
```

### 8. Summary of Changes by Component

| Component | Change | Lines Affected | Complexity |
|-----------|--------|----------------|------------|
| New: `SpaceInfo` struct | New data type | Insert near line 206 | Low |
| New: `DisplayInfo` struct | New data type | Insert near line 206 | Low |
| `SpaceDetector` | Add `getSpacesByDisplay()` | New method | Medium |
| `SpaceDetector` | Add `getActiveDisplayID()` | New method | Low |
| `SpaceDetector` | Add `getCurrentSpaceInfo()` | New method | Low |
| `SpaceDetector` | Add `displayIDToScreen()` | New method | Medium |
| `MenuBarController.rebuildSpaceItems()` | Filter by active display, per-display numbering, display header, globalPosition in tag | Lines 592-649 | Medium |
| `MenuBarController.updateTitle()` | Use localPosition from `getCurrentSpaceInfo()` | Lines 574-590 | Low |
| `MenuBarController.renameActiveSpace()` | Use localPosition in dialog title | Lines 675-717 | Low |
| `MenuBarController.registerForSpaceChanges()` | Add `didChangeScreenParametersNotification` observer | Lines 651-657 | Low |
| `MenuBarController` | Add `screenParametersDidChange()` handler | New method | Low |
| `OverlayManager` | Add `currentDisplayID` property | Line 311 area | Low |
| `OverlayManager.updateOverlay()` | Use `getCurrentSpaceInfo()` + `displayIDToScreen()`, track display changes | Lines 318-349 | Medium |
| `OverlayWindow` | Add `updateScreen(_:config:)` method | After line 267 | Low |
| `SpaceNavigator` | No changes | — | None |
| `JumpeeConfig` | No changes | — | None |
| `GlobalHotkeyManager` | No changes | — | None |
| `AppDelegate` | No changes | — | None |

### 9. Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Display order in `CGSCopyManagedDisplaySpaces` may not match Ctrl+N global numbering | High | Must verify on multi-display hardware before release. The enumeration order is believed to match macOS internal numbering based on community documentation of the private API. |
| UUID format mismatch between `CGDisplayCreateUUIDFromDisplayID` and CGS `"Display Identifier"` | Medium | Use case-insensitive string comparison. Test with actual external displays to confirm format alignment. |
| `didChangeScreenParametersNotification` rapid-fire on connect/disconnect | Low | Handler calls are idempotent. Add 0.5s debounce timer if performance issues arise. |
| Overlay window bleeds across screens when repositioned | Low | Use `screen.frame` (global coordinates) with `setFrame(_:display:)`. The global coordinate system ensures each screen has a unique frame origin. |
| "Displays have separate Spaces" OFF mode | Low | `CGSCopyManagedDisplaySpaces` returns a single display entry. All methods naturally fall back to single-display behavior — `localPosition == globalPosition`, one `DisplayInfo` element, overlay on the only screen. |
| Private API behavior changes in future macOS versions | Medium | No new private APIs introduced. All new code uses public APIs (`CGDisplayCreateUUIDFromDisplayID`, `CGMainDisplayID`, `NSScreen`). Same baseline risk as current codebase. |

## Move Window Hotkey, Hotkey Configuration UI, About Dialog (v1.3.0)

This section describes the technical design for three features added in v1.3.0. The full technical design is in `docs/design/technical-design-v1.3.0-hotkey-about.md`. The implementation plan is in `docs/design/plan-005-hotkey-about-features.md`.

### Feature Summary

| Feature | Description |
|---------|-------------|
| Move Window Hotkey | Second global Carbon hotkey (default Cmd+M) opens a popup menu at the cursor to move the focused window to another desktop |
| Hotkey Configuration UI | In-app modal NSAlert dialogs to edit hotkey bindings without manual JSON editing |
| About Dialog | "About Jumpee..." menu item showing version (from Info.plist), setup instructions, and config info |

### Architecture Changes

#### Dual-Hotkey Carbon Event System

```
+-----------------------------------+
|   macOS Carbon Event System       |
|   (kEventHotKeyPressed)           |
+-----------------+-----------------+
                  |
                  v
+-----------------+-----------------+
| hotkeyEventHandler()             |
| (free function, C callback)      |
|                                  |
| GetEventParameter -> hotKeyID    |
|                                  |
|   id==1 --> openMenu()           |  Status item dropdown
|   id==2 --> openMoveWindowMenu() |  Floating popup at cursor
+----------------------------------+
                  ^
                  |  (registered by)
+----------------------------------+
| GlobalHotkeyManager              |
|                                  |
| hotkeyRef       (id=1, Cmd+J)   |  Always registered
| moveWindowHotkeyRef (id=2, Cmd+M)|  Only if moveWindow.enabled
| handlerRef      (shared handler) |
|                                  |
| register(config:moveWindowConfig:)|
| unregister() -- cleans up both   |
+----------------------------------+
```

The Carbon event handler uses `GetEventParameter` with `kEventParamDirectObject`/`typeEventHotKeyID` to extract the `EventHotKeyID` struct from each event. The `id` field (UInt32) distinguishes hotkey 1 (dropdown) from hotkey 2 (move window). A single `InstallEventHandler` call handles both hotkeys; each `RegisterEventHotKey` produces a separate `EventHotKeyRef`.

#### Configuration Schema Extension

One new optional property added to `JumpeeConfig`:

```json
{
    "hotkey": { "key": "j", "modifiers": ["command"] },
    "moveWindowHotkey": { "key": "m", "modifiers": ["command"] },
    "moveWindow": { "enabled": true },
    "overlay": { "..." },
    "showSpaceNumber": true,
    "spaces": { "..." }
}
```

- `moveWindowHotkey` is optional. When absent and `moveWindow.enabled` is true, defaults to Cmd+M.
- This is a documented exception to the project's "no default fallback" rule (recorded in the project's memory file).
- A computed property `effectiveMoveWindowHotkey` centralizes the default logic.
- Backward compatible: existing configs without `moveWindowHotkey` load without error.

#### Menu Layout After v1.3.0

```
About Jumpee...
Jumpee (bold header, disabled)
---
Desktops:
  [display header, if multi-display]
  [dynamic space items with Cmd+1-9]
  Rename Current Desktop...         Cmd+N        tag=200
  Move Window To... >               [submenu]    (if moveWindow.enabled)
---
Hide Space Number                                tag=100
Disable Overlay                                  tag=101
---
Hotkeys:                            (disabled)
  Dropdown Hotkey: Cmd+J...                      tag=300
  Move Window Hotkey: Cmd+M...                   tag=301 (hidden if disabled)
---
Open Config File...                 Cmd+,
Reload Config                       Cmd+R
---
Quit Jumpee                         Cmd+Q
```

### New Components

1. **Move Window Popup** (`openMoveWindowMenu()` on `MenuBarController`) -- Builds a temporary `NSMenu` listing desktops on the active display (excluding current), pops it up at `NSEvent.mouseLocation` using `NSMenu.popUp(positioning:at:in:)` with `in: nil` (screen coordinates). Selection handler `moveWindowFromPopup(_:)` uses the same 300ms delay + `WindowMover.moveToSpace()` pattern as the existing submenu.

2. **Hotkey Editor** (`editHotkey(slot:)` on `MenuBarController`) -- `NSAlert` with accessory view containing a key text field and four modifier checkboxes (Command, Control, Option, Shift). Three validation rules: at least one modifier, key in `HotkeyConfig.keyCode` map, no conflict with the other Jumpee hotkey. On save: mutates config, calls `config.save()`, re-registers both hotkeys via `reRegisterHotkeys()`.

3. **About Dialog** (`showAboutDialog()` on `MenuBarController`) -- Standard `NSAlert` with `.informational` style. Version read from `Bundle.main.infoDictionary?["CFBundleShortVersionString"]` with fallback to `"dev"` when running unpackaged. Includes Accessibility permissions, desktop shortcut, and config file instructions.

4. **HotkeySlot enum** -- Private enum with cases `.dropdown` and `.moveWindow`, used by `editHotkey(slot:)` to determine which config property to edit.

### Integration with Existing Code

- `GlobalHotkeyManager.register()` signature changes from `(config: HotkeyConfig)` to `(config: HotkeyConfig, moveWindowConfig: HotkeyConfig?)`.
- Three call sites updated: `MenuBarController.init()`, `reloadConfig(_:)`, and the new `reRegisterHotkeys()` helper.
- `rebuildSpaceItems()` extended to update hotkey menu item titles (tags 300, 301) and toggle visibility of tag 301 based on `moveWindow.enabled`.
- `setupMenu()` extended with About item (after header) and Hotkeys section (between overlay toggle and config items).
- `build.sh` version bumped from 1.2.2 to 1.3.0.

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Cmd+M conflicts with system Minimize shortcut | Medium | Documented; configurable via Hotkey Config UI |
| Popup steals focus, WindowMover fails | Medium | 300ms delay (proven pattern); can capture AXUIElement before popup if needed |
| Multi-monitor popup positioning | Low | `NSEvent.mouseLocation` + `in: nil` uses global screen coordinates |
| User enters unsupported key in editor | Low | Validated against `HotkeyConfig.keyCode` map; error shown |

## Pin Window on Top Feature (v1.4.0)

This section describes the detailed technical design for the "pin window on top" (always-on-top) feature. The requirements are in `docs/reference/refined-request-pin-window-on-top.md`. The implementation plan is in `docs/design/plan-006-pin-window-on-top.md`. The technical investigation is in `docs/reference/investigation-pin-window-on-top.md`.

### Feature Summary

Allow users to pin any focused window "always on top" so it floats above all other non-pinned windows. The feature uses the private `CGSSetWindowLevel` API (Option A from the implementation plan) to directly change the target window's level in the WindowServer. If Option A fails during the Phase 0 feasibility spike, the feature falls back to Option B (ScreenCaptureKit overlay), which would require a separate detailed design.

### 1. New Private API Declarations

**Location:** `Sources/main.swift`, lines 27-29 (after the existing `_AXUIElementGetWindow` declaration, before the `// MARK: - Configuration` comment at line 32).

**Insert after line 29** (after `func _AXUIElementGetWindow(...)`):

```swift
// Private CGS APIs for window level manipulation (pin-on-top feature)
@_silgen_name("CGSSetWindowLevel")
func CGSSetWindowLevel(_ connection: Int32, _ windowID: CGWindowID, _ level: Int32) -> CGError

@_silgen_name("CGSGetWindowLevel")
func CGSGetWindowLevel(_ connection: Int32, _ windowID: CGWindowID, _ level: UnsafeMutablePointer<Int32>) -> CGError
```

**Design notes:**
- The function signatures match the CGSInternal reverse-engineered headers (`NUIKit/CGSInternal/CGSWindow.h`).
- `CGSSetWindowLevel` takes a CGS connection ID (obtained via `CGSMainConnectionID()`), a window ID (`CGWindowID` aka `UInt32`), and a window level (`Int32`). Returns `CGError` (`.success` = 0 on success).
- `CGSGetWindowLevel` reads the current level into an `UnsafeMutablePointer<Int32>`.
- These follow the exact same `@_silgen_name` pattern as the six existing private API declarations at lines 6-29.
- The `CGS` prefix functions may have `SLS` (SkyLight) equivalents on macOS 13+. Both appear available as of macOS 15. We use `CGS` for consistency with the existing codebase.

### 2. PinWindowConfig Struct

**Location:** `Sources/main.swift`, after `MoveWindowConfig` (line 111), before `JumpeeConfig` (line 113).

**Insert after line 111:**

```swift
struct PinWindowConfig: Codable {
    /// Whether the pin-window feature is enabled.
    /// When false, the "Pin Window on Top" menu item and hotkey are hidden/not registered.
    var enabled: Bool
}
```

**Design notes:**
- Follows the exact pattern of `MoveWindowConfig` (line 107-111): a simple Codable struct with a single `enabled: Bool` field.
- Config key in `~/.Jumpee/config.json`: `"pinWindow": { "enabled": true }`.
- When absent from the config file, the feature is disabled (backward compatible with existing configs).

### 3. PinWindowHotkeyConfig (uses existing HotkeyConfig)

No new struct is needed. The pin-window hotkey uses the existing `HotkeyConfig` struct (lines 56-105), which already supports `key`, `modifiers`, `keyCode`, `carbonModifiers`, and `displayString`.

**Config key in `~/.Jumpee/config.json`:**

```json
{
    "pinWindowHotkey": {
        "key": "p",
        "modifiers": ["command", "control"]
    }
}
```

**Default: Ctrl+Cmd+P** -- "P" is mnemonic for "Pin". The Ctrl+Cmd combination avoids conflict with Cmd+P (Print) in virtually all macOS apps. This is the same kind of documented exception to the "no default fallback" rule as `effectiveMoveWindowHotkey`.

### 4. JumpeeConfig Extensions

**Location:** `Sources/main.swift`, inside `struct JumpeeConfig` (lines 113-152).

#### 4.1 New Fields

**Insert after line 119** (after `var moveWindowHotkey: HotkeyConfig?`):

```swift
var pinWindow: PinWindowConfig?
var pinWindowHotkey: HotkeyConfig?
```

#### 4.2 New Computed Property

**Insert after line 125** (after `effectiveMoveWindowHotkey` computed property closing brace):

```swift
/// Resolved pin-window hotkey: explicit config or default Ctrl+Cmd+P.
/// Documented exception to the no-default-fallback rule (see Issues - Pending Items.md).
var effectivePinWindowHotkey: HotkeyConfig {
    return pinWindowHotkey ?? HotkeyConfig(key: "p", modifiers: ["command", "control"])
}
```

**Design notes:**
- `pinWindow` and `pinWindowHotkey` are both optional (`?`) for backward compatibility. Existing configs without these keys will decode without error.
- The `effectivePinWindowHotkey` computed property follows the exact pattern of `effectiveMoveWindowHotkey` at line 123.
- The default hotkey exception must be recorded in `Issues - Pending Items.md` before implementation.

### 5. WindowPinner Class

**Location:** `Sources/main.swift`, after the `WindowMover` class (line 647), before `// MARK: - Hotkey Slot` (line 649).

**Insert after line 647:**

```swift
// MARK: - Window Pinner

class WindowPinner {
    /// Tracks pinned windows: maps CGWindowID -> original window level before pinning.
    /// This allows restoring the exact original level on unpin, not just assuming level 0.
    private static var pinnedWindows: [CGWindowID: Int32] = [:]

    /// Toggle pin state of the currently focused window.
    /// If the focused window is not pinned, pins it (sets level to kCGFloatingWindowLevel).
    /// If the focused window is already pinned, unpins it (restores original level).
    /// Returns: true if window is now pinned, false if unpinned, nil if operation failed.
    @discardableResult
    static func togglePin() -> Bool? {
        cleanupClosedWindows()

        guard let windowID = getFocusedWindowID() else {
            NSLog("[Jumpee] WindowPinner: Failed to get focused window ID")
            return nil
        }

        if let originalLevel = pinnedWindows[windowID] {
            // Currently pinned -> unpin (restore original level)
            let err = CGSSetWindowLevel(CGSMainConnectionID(), windowID, originalLevel)
            if err == .success {
                pinnedWindows.removeValue(forKey: windowID)
                NSLog("[Jumpee] WindowPinner: Unpinned window %u (restored level %d)", windowID, originalLevel)
                return false
            } else {
                NSLog("[Jumpee] WindowPinner: CGSSetWindowLevel failed on unpin (error %d)", err.rawValue)
                // Remove from tracking anyway since we can't manage it
                pinnedWindows.removeValue(forKey: windowID)
                return nil
            }
        } else {
            // Not pinned -> pin (elevate to floating level)
            // First, read current level so we can restore it later
            var currentLevel: Int32 = 0
            let getErr = CGSGetWindowLevel(CGSMainConnectionID(), windowID, &currentLevel)
            if getErr != .success {
                NSLog("[Jumpee] WindowPinner: CGSGetWindowLevel failed (error %d), assuming level 0", getErr.rawValue)
                currentLevel = 0
            }

            let floatingLevel = Int32(CGWindowLevelForKey(.floatingWindow))  // value: 3
            let setErr = CGSSetWindowLevel(CGSMainConnectionID(), windowID, floatingLevel)
            if setErr == .success {
                pinnedWindows[windowID] = currentLevel
                NSLog("[Jumpee] WindowPinner: Pinned window %u (original level %d, new level %d)",
                      windowID, currentLevel, floatingLevel)
                return true
            } else {
                NSLog("[Jumpee] WindowPinner: CGSSetWindowLevel failed on pin (error %d)", setErr.rawValue)
                return nil
            }
        }
    }

    /// Check whether a given window is currently pinned.
    static func isPinned(_ windowID: CGWindowID) -> Bool {
        return pinnedWindows[windowID] != nil
    }

    /// Unpin all currently pinned windows, restoring their original levels.
    /// Called on Jumpee quit to leave windows in a clean state.
    static func unpinAll() {
        let conn = CGSMainConnectionID()
        for (windowID, originalLevel) in pinnedWindows {
            let err = CGSSetWindowLevel(conn, windowID, originalLevel)
            if err != .success {
                NSLog("[Jumpee] WindowPinner: Failed to restore level for window %u (error %d)",
                      windowID, err.rawValue)
            }
        }
        pinnedWindows.removeAll()
        NSLog("[Jumpee] WindowPinner: Unpinned all windows")
    }

    /// Remove entries for windows that have been closed by the user or their owning app.
    /// Uses CGWindowListCopyWindowInfo to get active window IDs and prunes stale entries.
    static func cleanupClosedWindows() {
        guard !pinnedWindows.isEmpty else { return }

        guard let windowList = CGWindowListCopyWindowInfo(.optionAll, kCGNullWindowID) as? [[String: Any]] else {
            return
        }

        let activeIDs = Set(windowList.compactMap { $0[kCGWindowNumber as String] as? CGWindowID })
        let staleIDs = pinnedWindows.keys.filter { !activeIDs.contains($0) }

        for staleID in staleIDs {
            pinnedWindows.removeValue(forKey: staleID)
            NSLog("[Jumpee] WindowPinner: Removed closed window %u from pinned set", staleID)
        }
    }

    /// Get the CGWindowID of the currently focused window.
    /// Reuses the AXUIElement pattern from WindowMover (lines 551-564 of main.swift).
    /// Returns nil if any step fails (no focused app, no focused window, or AX error).
    static func getFocusedWindowID() -> CGWindowID? {
        let systemWide = AXUIElementCreateSystemWide()

        var focusedApp: CFTypeRef?
        guard AXUIElementCopyAttributeValue(systemWide,
              kAXFocusedApplicationAttribute as CFString, &focusedApp) == .success else {
            return nil
        }

        var focusedWindow: CFTypeRef?
        guard AXUIElementCopyAttributeValue(focusedApp as! AXUIElement,
              kAXFocusedWindowAttribute as CFString, &focusedWindow) == .success else {
            return nil
        }

        var windowID: CGWindowID = 0
        guard _AXUIElementGetWindow(focusedWindow as! AXUIElement, &windowID) == .success else {
            return nil
        }

        return windowID
    }

    /// Number of currently pinned windows.
    static var pinnedCount: Int {
        return pinnedWindows.count
    }
}
```

**Design notes:**
- **Dictionary instead of Set:** `pinnedWindows` is `[CGWindowID: Int32]` (mapping window ID to its original level before pinning), not `Set<CGWindowID>`. This ensures we can restore the exact original level on unpin, which is important for windows that may already have non-standard levels (e.g., utility panels).
- **`getFocusedWindowID()`** extracts the common AXUIElement pattern from `WindowMover.moveToSpace()` (lines 551-564) into a reusable static method. This is the same pattern: `AXUIElementCreateSystemWide()` -> `kAXFocusedApplicationAttribute` -> `kAXFocusedWindowAttribute` -> `_AXUIElementGetWindow`.
- **`cleanupClosedWindows()`** uses `CGWindowListCopyWindowInfo(.optionAll, kCGNullWindowID)` to enumerate all system windows and prunes any pinned entries not found. Called at the start of `togglePin()` and before menu rebuild.
- **Pin level:** `Int32(CGWindowLevelForKey(.floatingWindow))` which evaluates to `3` (kCGFloatingWindowLevel). This places pinned windows above normal windows but below system UI (menu bar, Dock, etc.).
- **`unpinAll()`** restores all pinned windows to their original levels. Called from `MenuBarController.quit()`.
- **Logging:** All operations log via `NSLog` for debugging, matching the existing pattern in `WindowMover`.
- **`@discardableResult` on `togglePin()`:** Returns `Bool?` -- `true` if now pinned, `false` if unpinned, `nil` if failed. Callers can use this for visual feedback or ignore it.

### 6. HotkeySlot Extension

**Location:** `Sources/main.swift`, line 651-654 (`private enum HotkeySlot`).

**Change from:**

```swift
private enum HotkeySlot {
    case dropdown
    case moveWindow
}
```

**Change to:**

```swift
private enum HotkeySlot {
    case dropdown
    case moveWindow
    case pinWindow
}
```

### 7. hotkeyEventHandler Extension

**Location:** `Sources/main.swift`, inside `hotkeyEventHandler` function, lines 673-681 (the `switch hotKeyID.id` block).

**Change from:**

```swift
DispatchQueue.main.async {
    switch hotKeyID.id {
    case 1:
        globalMenuBarController?.openMenu()
    case 2:
        globalMenuBarController?.openMoveWindowMenu()
    default:
        break
    }
}
```

**Change to:**

```swift
DispatchQueue.main.async {
    switch hotKeyID.id {
    case 1:
        globalMenuBarController?.openMenu()
    case 2:
        globalMenuBarController?.openMoveWindowMenu()
    case 3:
        globalMenuBarController?.togglePinWindow()
    default:
        break
    }
}
```

### 8. GlobalHotkeyManager Extensions

**Location:** `Sources/main.swift`, `class GlobalHotkeyManager` (lines 686-752).

#### 8.1 New Field

**Insert after line 688** (after `private var moveWindowHotkeyRef: EventHotKeyRef?`):

```swift
private var pinWindowHotkeyRef: EventHotKeyRef?
```

#### 8.2 Extended register() Signature

**Change line 691 from:**

```swift
func register(config: HotkeyConfig, moveWindowConfig: HotkeyConfig?)
```

**Change to:**

```swift
func register(config: HotkeyConfig, moveWindowConfig: HotkeyConfig?, pinWindowConfig: HotkeyConfig?)
```

#### 8.3 New Registration Block

**Insert after line 731** (after the move-window hotkey registration closing brace `}`), before the `register()` method closing brace:

```swift
// Register pin-window hotkey (id=3), only if config provided
if let pwConfig = pinWindowConfig, let keyCode = pwConfig.keyCode {
    let pinWindowID = EventHotKeyID(signature: OSType(0x4A4D_5045), id: 3)
    RegisterEventHotKey(
        UInt32(keyCode),
        pwConfig.carbonModifiers,
        pinWindowID,
        GetApplicationEventTarget(),
        0,
        &pinWindowHotkeyRef
    )
}
```

**Design notes:**
- Hotkey ID `3` continues the sequence: dropdown=1, move-window=2, pin-window=3.
- Signature `0x4A4D5045` ("JMPE") is shared across all three hotkeys, matching the existing convention.
- Registration is conditional: only when `pinWindowConfig` is non-nil (feature enabled and config provided).

#### 8.4 Extended unregister() Method

**Insert after line 741** (after the `moveWindowHotkeyRef` unregistration block), before the `handlerRef` cleanup:

```swift
if let ref = pinWindowHotkeyRef {
    UnregisterEventHotKey(ref)
    pinWindowHotkeyRef = nil
}
```

### 9. MenuBarController Changes

#### 9.1 New `togglePinWindow()` Method

**Location:** `Sources/main.swift`, inside `class MenuBarController`, after `openMoveWindowMenu()` (line 830).

**Insert after line 830:**

```swift
func togglePinWindow() {
    guard config.pinWindow?.enabled == true else { return }
    let result = WindowPinner.togglePin()
    if result != nil {
        NSSound.beep()  // Brief auditory feedback
    }
}
```

**Design notes:**
- Public method (no `private`), called by `hotkeyEventHandler` via `globalMenuBarController?.togglePinWindow()`.
- Guard checks feature enablement for safety.
- `NSSound.beep()` provides minimal auditory feedback on success. This can be replaced with a visual indicator in a future enhancement.

#### 9.2 New Menu Items in setupMenu()

**Location:** `Sources/main.swift`, inside `setupMenu()`, after the move-window hotkey item (line 933) and before the separator at line 935.

**Insert after line 933** (after `menu.addItem(moveHotkeyItem)`):

```swift
let pinHotkeyItem = NSMenuItem(
    title: "Pin Window Hotkey: \(config.effectivePinWindowHotkey.displayString)...",
    action: #selector(editPinWindowHotkey),
    keyEquivalent: ""
)
pinHotkeyItem.target = self
pinHotkeyItem.tag = 303
pinHotkeyItem.isHidden = !(config.pinWindow?.enabled == true)
menu.addItem(pinHotkeyItem)
```

**Design notes:**
- Tag 303 follows the convention: 300 (dropdown hotkey), 301 (move-window hotkey), 303 (pin-window hotkey).
- Tag 302 is reserved for the dynamic "Pin Window on Top" / "Unpin Window" menu item added in `rebuildSpaceItems()`.
- Hidden when `pinWindow.enabled` is false or absent.

#### 9.3 Dynamic Pin/Unpin Item in rebuildSpaceItems()

**Location:** `Sources/main.swift`, inside `rebuildSpaceItems()`, after the "Move Window To..." submenu block (after line 1109), and before the "Set Up Window Moving..." block (line 1111).

**Insert after line 1109** (after `spaceMenuItems.append(moveSubmenuItem)`), inside a new conditional block:

```swift
// --- Pin Window on Top item (after Move Window submenu) ---
if config.pinWindow?.enabled == true {
    insertIndex += 1

    // Determine pin state of the previously focused window
    // Note: When the menu opens, focus may shift to Jumpee. We capture
    // the focused window ID at this point; the AX focus may have already
    // changed. If so, the item defaults to "Pin Window on Top".
    let focusedWindowID = WindowPinner.getFocusedWindowID()
    let isCurrentlyPinned = focusedWindowID != nil && WindowPinner.isPinned(focusedWindowID!)

    let pinTitle = isCurrentlyPinned ? "Unpin Window" : "Pin Window on Top"
    let pinItem = NSMenuItem(
        title: pinTitle,
        action: #selector(pinWindowAction),
        keyEquivalent: ""
    )
    pinItem.target = self
    pinItem.tag = 302
    menu.insertItem(pinItem, at: insertIndex)
    spaceMenuItems.append(pinItem)
}
```

**Design notes:**
- The item title is dynamic: "Pin Window on Top" when the focused window is not pinned, "Unpin Window" when it is.
- Tag 302 is used for this dynamic item.
- The focused window ID detection has a known edge case: when the Jumpee menu opens, macOS may shift focus to Jumpee itself. This means `getFocusedWindowID()` might return Jumpee's own window ID or nil. In practice, this is mitigated because the hotkey (Ctrl+Cmd+P) is the primary interaction path for pinning, and the menu item is a secondary convenience. The menu item will default to "Pin Window on Top" if the focused window cannot be determined.
- Placement: after the "Move Window To..." submenu and before the "Set Up Window Moving..." item, grouping all window management operations together.

#### 9.4 New @objc Action Methods

**Insert near the other action methods (after `moveWindowFromPopup` at line 837):**

```swift
@objc private func pinWindowAction(_ sender: NSMenuItem) {
    statusItem.menu?.cancelTracking()
    // Short delay for menu to close and target app to regain focus
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
        self?.togglePinWindow()
    }
}

@objc private func editPinWindowHotkey() {
    editHotkey(slot: .pinWindow)
}
```

**Design notes:**
- `pinWindowAction` uses the same 300ms delay pattern as `navigateToSpace(_:)` and `moveWindowToSpace(_:)` -- this ensures the previously focused app regains focus after the Jumpee menu closes.
- `editPinWindowHotkey` delegates to the existing `editHotkey(slot:)` method.

#### 9.5 rebuildSpaceItems() Hotkey Title Updates

**Location:** `Sources/main.swift`, inside `rebuildSpaceItems()`, after the existing hotkey title update block (lines 1136-1147).

**Insert after line 1147** (after the tag 301 update block closing brace):

```swift
if let item = menu.item(withTag: 303) {
    if config.pinWindow?.enabled == true {
        item.title = "Pin Window Hotkey: \(config.effectivePinWindowHotkey.displayString)..."
        item.isHidden = false
    } else {
        item.isHidden = true
    }
}
```

#### 9.6 editHotkey(slot:) Extension for .pinWindow

**Location:** `Sources/main.swift`, inside `editHotkey(slot:)` (lines 1355-1500).

**Change the switch block at lines 1361-1372 from:**

```swift
switch slot {
case .dropdown:
    currentConfig = config.hotkey
    slotName = "Dropdown"
    defaultConfig = HotkeyConfig(key: "j", modifiers: ["command"])
    otherConfig = config.effectiveMoveWindowHotkey
case .moveWindow:
    currentConfig = config.effectiveMoveWindowHotkey
    slotName = "Move Window"
    defaultConfig = HotkeyConfig(key: "m", modifiers: ["command"])
    otherConfig = config.hotkey
}
```

**Change to:**

```swift
// Collect all other active hotkey configs for conflict checking
var otherConfigs: [HotkeyConfig] = []

switch slot {
case .dropdown:
    currentConfig = config.hotkey
    slotName = "Dropdown"
    defaultConfig = HotkeyConfig(key: "j", modifiers: ["command"])
    if config.moveWindow?.enabled == true {
        otherConfigs.append(config.effectiveMoveWindowHotkey)
    }
    if config.pinWindow?.enabled == true {
        otherConfigs.append(config.effectivePinWindowHotkey)
    }
case .moveWindow:
    currentConfig = config.effectiveMoveWindowHotkey
    slotName = "Move Window"
    defaultConfig = HotkeyConfig(key: "m", modifiers: ["command"])
    otherConfigs.append(config.hotkey)
    if config.pinWindow?.enabled == true {
        otherConfigs.append(config.effectivePinWindowHotkey)
    }
case .pinWindow:
    currentConfig = config.effectivePinWindowHotkey
    slotName = "Pin Window"
    defaultConfig = HotkeyConfig(key: "p", modifiers: ["command", "control"])
    otherConfigs.append(config.hotkey)
    if config.moveWindow?.enabled == true {
        otherConfigs.append(config.effectiveMoveWindowHotkey)
    }
}
```

**Design notes:**
- The conflict check changes from a 2-way comparison to N-way. Instead of a single `otherConfig`, we collect all active hotkey configs into `otherConfigs: [HotkeyConfig]`.
- The conflict validation (lines 1459-1478) must be updated to iterate over `otherConfigs` instead of comparing against a single `otherConfig`.

**Change the conflict check block (lines 1459-1478) from the single `otherConfig` comparison to:**

```swift
// Check for conflict with any other active Jumpee hotkey
let newModsNormalized = Set(newModifiers.map { $0.lowercased() })
for otherConfig in otherConfigs {
    let otherModsNormalized = Set(otherConfig.modifiers.map { $0.lowercased() })
    if newConfig.key.lowercased() == otherConfig.key.lowercased()
        && newModsNormalized == otherModsNormalized {
        showValidationError(
            title: "Hotkey Conflict",
            message: "This combination is already used by another Jumpee hotkey (\(otherConfig.displayString))."
        )
        return
    }
}
```

**Change the save block (lines 1480-1485) to add the .pinWindow case:**

```swift
switch slot {
case .dropdown:
    config.hotkey = newConfig
case .moveWindow:
    config.moveWindowHotkey = newConfig
case .pinWindow:
    config.pinWindowHotkey = newConfig
}
```

**Change the reset-to-default block (lines 1489-1498) to add the .pinWindow case:**

```swift
switch slot {
case .dropdown:
    config.hotkey = defaultConfig
case .moveWindow:
    config.moveWindowHotkey = defaultConfig
case .pinWindow:
    config.pinWindowHotkey = defaultConfig
}
```

#### 9.7 reRegisterHotkeys() Extension

**Location:** `Sources/main.swift`, line 1511-1518.

**Change from:**

```swift
private func reRegisterHotkeys() {
    hotkeyManager?.register(
        config: config.hotkey,
        moveWindowConfig: config.moveWindow?.enabled == true
            ? config.effectiveMoveWindowHotkey
            : nil
    )
}
```

**Change to:**

```swift
private func reRegisterHotkeys() {
    hotkeyManager?.register(
        config: config.hotkey,
        moveWindowConfig: config.moveWindow?.enabled == true
            ? config.effectiveMoveWindowHotkey
            : nil,
        pinWindowConfig: config.pinWindow?.enabled == true
            ? config.effectivePinWindowHotkey
            : nil
    )
}
```

#### 9.8 quit() Extension

**Location:** `Sources/main.swift`, line 1534-1538.

**Change from:**

```swift
@objc private func quit(_ sender: NSMenuItem) {
    hotkeyManager?.unregister()
    overlayManager.removeAllOverlays()
    NSApp.terminate(nil)
}
```

**Change to:**

```swift
@objc private func quit(_ sender: NSMenuItem) {
    WindowPinner.unpinAll()
    hotkeyManager?.unregister()
    overlayManager.removeAllOverlays()
    NSApp.terminate(nil)
}
```

**Design notes:**
- `WindowPinner.unpinAll()` is called **before** `hotkeyManager?.unregister()` to ensure all pinned windows are restored to their original z-order before the app exits.
- This prevents orphaned floating windows that would stay on top permanently after Jumpee quits.

### 10. About Dialog Update

**Location:** `Sources/main.swift`, inside `showAboutDialog()` (lines 1304-1345).

**Add to the informative text, after the "Window Moving (optional)" section (line 1331):**

```swift
4. Window Pinning (optional)
   Pin any window "always on top" with \
   Ctrl+Cmd+P (configurable). Set \
   "pinWindow": {"enabled": true} in your config file.
```

### 11. Menu Layout After v1.4.0

```
About Jumpee...
Jumpee (bold header, disabled)
---
Desktops:
  [display header, if multi-display]
  [dynamic space items with Cmd+1-9]
  Rename Current Desktop...         Cmd+N        tag=200
  Move Window To... >               [submenu]    (if moveWindow.enabled)
  Pin Window on Top                              tag=302  (if pinWindow.enabled)
  Set Up Window Moving...                        (if shortcuts not enabled)
---
Hide Space Number                                tag=100
Disable Overlay                                  tag=101
---
Hotkeys:                            (disabled)
  Dropdown Hotkey: Cmd+J...                      tag=300
  Move Window Hotkey: Cmd+M...                   tag=301 (if moveWindow.enabled)
  Pin Window Hotkey: Ctrl+Cmd+P...               tag=303 (if pinWindow.enabled)
---
Open Config File...                 Cmd+,
Reload Config                       Cmd+R
---
Quit Jumpee                         Cmd+Q
```

### 12. Configuration Changes

#### New Config Keys

```json
{
    "pinWindow": {
        "enabled": true
    },
    "pinWindowHotkey": {
        "key": "p",
        "modifiers": ["command", "control"]
    }
}
```

#### Config Behavior Matrix

| Scenario | Behavior |
|----------|----------|
| `pinWindow` absent from config | Feature disabled (backward compatible) |
| `pinWindow.enabled: false` | Feature disabled, no menu items, no hotkey |
| `pinWindow.enabled: true`, `pinWindowHotkey` absent | Feature enabled, default Ctrl+Cmd+P |
| `pinWindow.enabled: true`, `pinWindowHotkey` present | Feature enabled, custom hotkey |
| `pinWindow` present but malformed (e.g., missing `enabled` field) | JSON decode error; `JumpeeConfig.load()` returns default config (existing behavior for any malformed config) |

### 13. Window Level Constants Reference

| Constant | Value | Use in Pin Feature |
|----------|----------|-----|
| `kCGNormalWindowLevel` | 0 | Default level; restore target on unpin |
| `kCGFloatingWindowLevel` | 3 | Pin target; set via `CGWindowLevelForKey(.floatingWindow)` |
| `kCGModalPanelWindowLevel` | 8 | Not used (too high) |
| `kCGStatusWindowLevel` | 25 | Not used (would cover menu bar) |

### 14. Insertion Point Summary

This table summarizes where each change goes in `Sources/main.swift`, referenced by line numbers from the current codebase (1567 lines total).

| Change | After Line | Before Line | Description |
|--------|-----------|-------------|-------------|
| CGSSetWindowLevel + CGSGetWindowLevel declarations | 29 | 32 | Two new `@_silgen_name` functions |
| PinWindowConfig struct | 111 | 113 | New Codable struct |
| pinWindow + pinWindowHotkey fields | 119 | 121 | Two new optional properties on JumpeeConfig |
| effectivePinWindowHotkey computed property | 125 | 127 | Default hotkey logic |
| WindowPinner class | 647 | 649 | Full static class (~120 lines) |
| `.pinWindow` case on HotkeySlot | 653 | 654 | New enum case |
| `case 3:` in hotkeyEventHandler | 678 | 679 | Dispatch to togglePinWindow() |
| pinWindowHotkeyRef field | 688 | 689 | New EventHotKeyRef on GlobalHotkeyManager |
| register() signature change | 691 | 691 | Add pinWindowConfig parameter |
| Pin hotkey registration block | 731 | 732 | RegisterEventHotKey with id=3 |
| Pin hotkey unregistration block | 741 | 742 | UnregisterEventHotKey |
| togglePinWindow() method | 830 | 832 | New method on MenuBarController |
| pinWindowAction + editPinWindowHotkey | 837 | 839 | New @objc action methods |
| Pin hotkey menu item in setupMenu() | 933 | 935 | Tag 303, static item |
| Pin/Unpin dynamic item in rebuildSpaceItems() | 1109 | 1111 | Tag 302, dynamic item |
| Tag 303 title update in rebuildSpaceItems() | 1147 | 1148 | Update pin hotkey display |
| .pinWindow case in editHotkey() switch | 1361-1372 | N/A | Extend all three switch blocks |
| N-way conflict check | 1459-1478 | N/A | Replace 2-way with N-way |
| reRegisterHotkeys() pinWindowConfig | 1511-1518 | N/A | Pass pin config to register() |
| WindowPinner.unpinAll() in quit() | 1534 | 1535 | Before hotkeyManager.unregister() |
| About dialog text | 1331 | 1332 | Mention pin feature |

### 15. Estimated Code Impact

- **New lines added:** ~170-200 lines (WindowPinner class ~120, menu/hotkey integration ~50-80)
- **Lines modified:** ~40 lines (config struct, register() signature, editHotkey switch, conflict check, reRegisterHotkeys, quit)
- **Total file size after:** ~1737-1767 lines (from current 1567)
- **No new files:** All changes in `Sources/main.swift`
- **No new frameworks:** No additional `-framework` flags in `build.sh`
- **No new permissions:** Reuses existing Accessibility permission

### 16. Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| `CGSSetWindowLevel` does not work cross-app (WindowServer ownership check) | HIGH | Phase 0 feasibility spike tests this first. If it fails, proceed to Option B (ScreenCaptureKit overlay) per plan-006 |
| macOS resets window level on focus change or app activation | MEDIUM | If detected in spike, add a periodic timer (e.g., every 2 seconds) to re-assert floating level for all pinned windows |
| macOS resets window level on space switch | MEDIUM | Re-assert pinned window levels in `spaceDidChange()` handler after space transition |
| Private API `CGSSetWindowLevel` removed in future macOS version | MEDIUM | Feature-gated via `pinWindow.enabled`; graceful failure (log + no-op); `CGSGetWindowLevel` return value checked before attempting set |
| Menu item shows wrong pin state (focus shifts to Jumpee on menu open) | MEDIUM | Hotkey is the primary interaction path; menu item is secondary convenience. Accept that menu item may sometimes show "Pin Window on Top" even for a pinned window |
| Ctrl+Cmd+P conflicts with some niche application | LOW | Fully configurable via hotkey editor; Ctrl+Cmd combination is rarely used by standard apps |
| Closed windows leave orphan entries in pinnedWindows | LOW | `cleanupClosedWindows()` called at start of `togglePin()` and in `rebuildSpaceItems()` |
| Quitting Jumpee with pinned windows leaves them floating | LOW | `unpinAll()` called in `quit()` before `NSApp.terminate()` |

## Input Source Indicator (v1.5.0)

This section describes the detailed technical design for the input source (keyboard language) indicator feature. The requirements are in `docs/reference/refined-request-input-source-indicator.md`. The implementation plan is in `docs/design/plan-007-input-source-indicator.md`. The technical investigation is in `docs/reference/investigation-input-source-indicator.md`. The codebase scan is in `docs/reference/codebase-scan-input-source-indicator.md`.

### Feature Summary

Add an input source monitoring feature that detects the current macOS keyboard input source (e.g., "U.S.", "Greek", "British") and displays it as a large, visible HUD-style indicator overlay positioned directly below the menu bar. The indicator updates in real time via event-driven notifications. The feature is toggled on/off via the config file and a menu item.

**No new frameworks, permissions, or build changes are required.** The TIS (Text Input Source Services) APIs are available through the already-imported `Carbon.HIToolbox`. The `DistributedNotificationCenter` is part of Foundation. No Accessibility or Screen Recording permissions are needed.

### 1. Architecture Overview

The feature follows the established pattern: **Config struct + Window class + Manager class + MenuBarController integration**.

```
+--------------------------------------------+
|  ~/.Jumpee/config.json                     |
|  "inputSourceIndicator": {                 |
|      "enabled": true,                      |
|      "fontSize": 60, ...                   |
|  }                                         |
+--------------------+-----------------------+
                     |
                     v  (decoded into)
+--------------------------------------------+
|  InputSourceIndicatorConfig : Codable      |
|  (struct with optional appearance props    |
|   and effective* computed properties)      |
+--------------------+-----------------------+
                     |
                     v  (consumed by)
+--------------------------------------------+    +------------------------------------------+
|  InputSourceIndicatorManager               |    |  DistributedNotificationCenter           |
|  - owns InputSourceIndicatorWindow?        |<---| "AppleSelectedInputSourcesChanged-       |
|  - subscribes to input source change notif |    |  Notification"                           |
|  - calls TIS APIs on notification          |    +------------------------------------------+
|  - creates/updates/destroys window         |
|  - repositions on space/screen change      |    +------------------------------------------+
+--------------------+-----------------------+    |  TIS APIs (Carbon.HIToolbox)             |
                     |                            |  TISCopyCurrentKeyboardInputSource()     |
                     v  (creates)                 |  TISGetInputSourceProperty()             |
+--------------------------------------------+    +------------------------------------------+
|  InputSourceIndicatorWindow : NSWindow     |
|  - borderless, click-through, transparent  |
|  - floatingWindow + 1 level                |
|  - .canJoinAllSpaces, .stationary          |
|  - auto-sized to text + padding (pill)     |
|  - centered below menu bar on active screen|
+--------------------------------------------+
```

**Integration with MenuBarController:**

```
MenuBarController
  |
  +-- inputSourceManager: InputSourceIndicatorManager?  (new property)
  |
  +-- init():            create & start manager if enabled
  +-- setupMenu():       add toggle item (tag 102)
  +-- rebuildSpaceItems(): update toggle item title
  +-- spaceDidChange():  call inputSourceManager?.refresh()
  +-- screenParametersDidChange(): call inputSourceManager?.refresh()
  +-- reloadConfig():    start/stop/reconfigure manager
  +-- quit():            call inputSourceManager?.stop()
  +-- toggleInputSourceIndicator(): new @objc action method
```

### 2. New Types — Detailed Interface Definitions

#### 2.1 InputSourceIndicatorConfig (Codable struct)

**Location in main.swift:** After `PinWindowConfig` (line 130), before `struct JumpeeConfig` (line 132).

```swift
struct InputSourceIndicatorConfig: Codable {
    // --- Required field ---
    var enabled: Bool

    // --- Optional appearance fields (nil = use documented default) ---
    var fontSize: Double?
    var fontName: String?
    var fontWeight: String?          // "regular", "bold", "heavy", "light", "medium", etc.
    var textColor: String?           // Hex color string, e.g. "#FFFFFF"
    var opacity: Double?             // 0.0 - 1.0 for text opacity
    var backgroundColor: String?     // Hex color string for background pill
    var backgroundOpacity: Double?   // 0.0 - 1.0 for background opacity
    var backgroundCornerRadius: Double?  // Corner radius in points
    var verticalOffset: Double?      // Additional pixels below menu bar

    // --- Documented default constants ---
    // (Exception to no-default-fallback rule: see Issues - Pending Items.md, item 16.
    //  Follows precedent of moveWindowHotkey item 11 and pinWindowHotkey item 12.)
    static let defaultFontSize: Double = 60
    static let defaultFontName: String = "Helvetica Neue"
    static let defaultFontWeight: String = "bold"
    static let defaultTextColor: String = "#FFFFFF"
    static let defaultOpacity: Double = 0.8
    static let defaultBackgroundColor: String = "#000000"
    static let defaultBackgroundOpacity: Double = 0.3
    static let defaultBackgroundCornerRadius: Double = 10
    static let defaultVerticalOffset: Double = 0

    // --- Resolved computed properties ---
    var effectiveFontSize: Double { fontSize ?? Self.defaultFontSize }
    var effectiveFontName: String { fontName ?? Self.defaultFontName }
    var effectiveFontWeight: String { fontWeight ?? Self.defaultFontWeight }
    var effectiveTextColor: String { textColor ?? Self.defaultTextColor }
    var effectiveOpacity: Double { opacity ?? Self.defaultOpacity }
    var effectiveBackgroundColor: String { backgroundColor ?? Self.defaultBackgroundColor }
    var effectiveBackgroundOpacity: Double { backgroundOpacity ?? Self.defaultBackgroundOpacity }
    var effectiveBackgroundCornerRadius: Double { backgroundCornerRadius ?? Self.defaultBackgroundCornerRadius }
    var effectiveVerticalOffset: Double { verticalOffset ?? Self.defaultVerticalOffset }
}
```

**Design rationale:**
- All appearance properties are `Optional` so that absent JSON keys decode to `nil` rather than causing a decode error. The `effective*` computed properties apply the documented defaults.
- The `enabled` field is non-optional (`Bool`, not `Bool?`). When present in JSON, it must be true or false. The entire `inputSourceIndicator` section being absent means the feature is disabled (the field on `JumpeeConfig` is `Optional`).
- The pattern mirrors `OverlayConfig` (rich appearance config) but with optional properties + defaults rather than a `static let defaultConfig`. This is because the input source indicator is an optional feature, while the overlay has always been part of the app.

**Addition to JumpeeConfig (line 140, after `var pinWindowHotkey: HotkeyConfig?`):**

```swift
var inputSourceIndicator: InputSourceIndicatorConfig?
```

**Estimated lines:** ~45

#### 2.2 InputSourceIndicatorWindow (NSWindow subclass)

**Location in main.swift:** After `OverlayManager` (line 500), before `// MARK: - Space Navigation` (line 502).

```swift
// MARK: - Input Source Indicator Window

class InputSourceIndicatorWindow: NSWindow {
    private let label: NSTextField
    private let backgroundView: NSView
    private let horizontalPadding: CGFloat = 20
    private let verticalPadding: CGFloat = 8

    // --- Initializer ---
    init(screen: NSScreen, text: String, config: InputSourceIndicatorConfig)
        // 1. Create label (NSTextField(labelWithString:))
        // 2. Create backgroundView (NSView with wantsLayer = true)
        // 3. Calculate text size via label.fittingSize
        // 4. Calculate window size: textSize + padding
        // 5. Calculate window position via positionRect(on:config:windowSize:)
        // 6. Call super.init(contentRect:styleMask:backing:defer:)
        //    with .borderless, .buffered, defer: false
        // 7. Configure window properties (see below)
        // 8. Build view hierarchy: contentView -> backgroundView -> label
        // 9. Apply styling from config

    // --- Public methods ---
    func updateText(_ text: String, config: InputSourceIndicatorConfig)
        // 1. Update label.stringValue
        // 2. Re-apply font/color/opacity from config (may have changed)
        // 3. label.sizeToFit()
        // 4. Recalculate window size
        // 5. Reposition via positionRect(on:config:windowSize:)
        // 6. Resize backgroundView to match
        // 7. Center label in backgroundView
        // 8. Call setFrame(_:display:) with new rect

    func reposition(on screen: NSScreen, config: InputSourceIndicatorConfig)
        // 1. Recalculate position for the new screen
        // 2. Call setFrame(_:display:) with current size but new position

    // --- Private methods ---
    private func menuBarHeight(for screen: NSScreen) -> CGFloat
        // Formula: screen.frame.maxY - screen.visibleFrame.maxY
        // Returns:
        //   ~25px on standard displays
        //   ~37px on notched MacBook Pro displays
        //   0px when menu bar is auto-hidden

    private func positionRect(on screen: NSScreen, config: InputSourceIndicatorConfig,
                              windowSize: NSSize) -> NSRect
        // 1. let mbHeight = menuBarHeight(for: screen)
        // 2. let verticalOffset = CGFloat(config.effectiveVerticalOffset)
        // 3. let x = screen.frame.origin.x + (screen.frame.width - windowSize.width) / 2
        // 4. let y = screen.frame.maxY - mbHeight - windowSize.height - verticalOffset
        // 5. return NSRect(x: x, y: y, width: windowSize.width, height: windowSize.height)

    private func applyStyle(config: InputSourceIndicatorConfig)
        // 1. Resolve font: NSFont(name:size:) ?? NSFont.systemFont(ofSize:weight:)
        //    using config.effectiveFontName, config.effectiveFontSize,
        //    fontWeight(from: config.effectiveFontWeight) [existing utility at line ~198]
        // 2. Set label.font, label.textColor (fromHex + opacity)
        // 3. Set backgroundView.layer?.backgroundColor (fromHex + backgroundOpacity)
        // 4. Set backgroundView.layer?.cornerRadius
}
```

**Window properties (set in init):**

| Property | Value | Rationale |
|----------|-------|-----------|
| `level` | `NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.floatingWindow)) + 1)` | Above normal windows, below status/menu bar. Same level as existing approach for floating UI. |
| `backgroundColor` | `.clear` | Window itself is transparent; the pill provides the background. |
| `isOpaque` | `false` | Required for transparency. |
| `hasShadow` | `false` | HUD-style indicator should not cast shadow. |
| `ignoresMouseEvents` | `true` | Fully click-through (NFR-ISI-3). |
| `collectionBehavior` | `[.canJoinAllSpaces, .stationary]` | Visible on all spaces, does not animate during space transitions. |

**View hierarchy:**

```
NSWindow
  └── contentView (NSView, clear background, wantsLayer = true)
        └── backgroundView (NSView, wantsLayer = true)
              │  layer.backgroundColor = hex(config.effectiveBackgroundColor)
              │      .withAlphaComponent(config.effectiveBackgroundOpacity)
              │  layer.cornerRadius = config.effectiveBackgroundCornerRadius
              │  frame = (0, 0, textWidth + 2*hPadding, textHeight + 2*vPadding)
              │
              └── label (NSTextField)
                    │  font = resolved from config
                    │  textColor = hex(config.effectiveTextColor)
                    │      .withAlphaComponent(config.effectiveOpacity)
                    │  alignment = .center
                    │  frame = (hPadding, vPadding, textWidth, textHeight)
```

**Differences from OverlayWindow:**

| Aspect | OverlayWindow | InputSourceIndicatorWindow |
|--------|---------------|---------------------------|
| Size | Full screen frame | Sized to text + padding |
| Level | `desktopWindow + 1` (below everything) | `floatingWindow + 1` (above normal windows) |
| Background | None (transparent text on desktop) | Semi-transparent pill/rounded rectangle |
| Positioning | Configurable via `position` string | Fixed: centered horizontally, below menu bar |
| Content | Desktop name | Input source name |

**Estimated lines:** ~100

#### 2.3 InputSourceIndicatorManager (class)

**Location in main.swift:** After `InputSourceIndicatorWindow`, before `// MARK: - Space Navigation`.

```swift
// MARK: - Input Source Indicator Manager

class InputSourceIndicatorManager {
    // --- Properties ---
    private var window: InputSourceIndicatorWindow?
    private var currentDisplayedName: String = ""
    private let spaceDetector: SpaceDetector
    private var currentConfig: InputSourceIndicatorConfig?
    private var isObserving: Bool = false

    // --- Initializer ---
    init(spaceDetector: SpaceDetector)
        // Store the space detector reference. No side effects.

    // --- Public methods ---

    func start(config: JumpeeConfig)
        // 1. Guard config.inputSourceIndicator?.enabled == true; else return
        // 2. Store config.inputSourceIndicator in currentConfig
        // 3. Register DistributedNotificationCenter observer (if not already)
        // 4. Read current input source name via getCurrentInputSourceName()
        // 5. Store in currentDisplayedName
        // 6. Determine active screen via spaceDetector
        // 7. Create InputSourceIndicatorWindow(screen:text:config:)
        // 8. window?.orderFront(nil)
        // 9. Set isObserving = true

    func stop()
        // 1. Remove DistributedNotificationCenter observer
        // 2. window?.orderOut(nil)
        // 3. window = nil
        // 4. currentDisplayedName = ""
        // 5. currentConfig = nil
        // 6. isObserving = false

    func updateConfig(_ config: JumpeeConfig)
        // Three-way transition logic:
        // Case A: was disabled, now enabled -> call start(config:)
        // Case B: was enabled, now disabled -> call stop()
        // Case C: remains enabled -> update currentConfig, re-read input source,
        //         call window?.updateText(name, config:) to apply style changes,
        //         call refresh() to reposition

    func refresh()
        // 1. Guard currentConfig != nil and enabled
        // 2. Get active screen via spaceDetector.getCurrentSpaceInfo() + displayIDToScreen()
        // 3. Call window?.reposition(on: targetScreen, config: currentConfig!)

    // --- Private methods ---

    private func getCurrentInputSourceName() -> String
        // 1. let source = TISCopyCurrentKeyboardInputSource()
        // 2. Guard let namePtr = TISGetInputSourceProperty(source, kTISPropertyLocalizedName)
        // 3. let name = Unmanaged<CFString>.fromOpaque(namePtr).takeUnretainedValue() as String
        // 4. return name
        // CRITICAL: Use takeUnretainedValue() (Get rule), NOT takeRetainedValue()
        //           Using takeRetainedValue() causes double-free crash.

    @objc private func inputSourceDidChange(_ notification: Notification)
        // 1. let newName = getCurrentInputSourceName()
        // 2. Guard newName != currentDisplayedName (dedup guard)
        // 3. currentDisplayedName = newName
        // 4. Guard let config = currentConfig
        // 5. window?.updateText(newName, config: config)
}
```

**Notification registration details:**

```swift
DistributedNotificationCenter.default().addObserver(
    self,
    selector: #selector(inputSourceDidChange(_:)),
    name: NSNotification.Name("AppleSelectedInputSourcesChangedNotification"),
    object: nil,
    suspensionBehavior: .deliverImmediately
)
```

**Key design decisions:**
- **Dedup guard:** The notification may fire multiple times for a single input source switch (e.g., during complex IME transitions). The `guard newName != currentDisplayedName` prevents unnecessary window updates.
- **`isObserving` flag:** Prevents double-registration if `start()` is called multiple times without `stop()`.
- **Thread safety:** `DistributedNotificationCenter` delivers notifications on the same thread that registered the observer. Since `start()` is always called from the main thread (via `MenuBarController.init()` or `reloadConfig()`), all notifications arrive on the main thread. All UI updates (`NSWindow`, `NSTextField`) happen on the main thread. No synchronization primitives are needed.
- **Active screen detection:** Uses `spaceDetector.getCurrentSpaceInfo()` to get the display ID, then `spaceDetector.displayIDToScreen()` to map to `NSScreen`. Falls back to `NSScreen.main` if the display cannot be resolved (defensive: display may have been disconnected between calls).

**Estimated lines:** ~80

### 3. Data Flow Diagrams

#### 3.1 Input Source Change Flow

```
User switches keyboard input source (any method)
  |
  v
macOS posts "AppleSelectedInputSourcesChangedNotification"
via DistributedNotificationCenter
  |
  v (delivered on main thread, within ~1-5ms)
InputSourceIndicatorManager.inputSourceDidChange(_:)
  |
  +-- getCurrentInputSourceName()
  |     |-- TISCopyCurrentKeyboardInputSource() -> TISInputSource
  |     |-- TISGetInputSourceProperty(source, kTISPropertyLocalizedName) -> CFString
  |     |-- Unmanaged<CFString>.fromOpaque(ptr).takeUnretainedValue() as String
  |     +-- Returns e.g. "Greek"
  |
  +-- Guard: "Greek" != currentDisplayedName ("U.S.")  -> proceed
  |
  +-- currentDisplayedName = "Greek"
  |
  +-- window?.updateText("Greek", config: currentConfig!)
        |-- label.stringValue = "Greek"
        |-- label.font = NSFont(name: "Helvetica Neue", size: 60)
        |-- label.sizeToFit()
        |-- Recalculate window size to fit new text
        |-- positionRect(on: currentScreen, ...) -> new centered rect
        |-- setFrame(newRect, display: true)
        |-- Resize backgroundView, re-center label
        +-- Window visually updates on screen (sub-frame, <16ms)

Total latency: <10ms (notification delivery + TIS API call + view update)
```

#### 3.2 Space Change Flow

```
User switches to a different desktop/space
  |
  v
NSWorkspace.activeSpaceDidChangeNotification fires
  |
  v
MenuBarController.spaceDidChange(_:)
  |
  +-- updateTitle()          (existing)
  +-- overlayManager.updateOverlay(config:)  (existing)
  +-- inputSourceManager?.refresh()          (NEW)
        |
        +-- spaceDetector.getCurrentSpaceInfo()
        |     Returns: (displayID: "37D8832A-...", localPosition: 1, globalPosition: 4)
        |
        +-- spaceDetector.displayIDToScreen("37D8832A-...") -> NSScreen
        |
        +-- window?.reposition(on: externalScreen, config: currentConfig!)
              |-- menuBarHeight(for: externalScreen) -> 25 (external) or 37 (notched)
              |-- positionRect(...) -> new centered rect on correct screen
              +-- setFrame(newRect, display: true)
```

#### 3.3 Config Reload Flow

```
User presses Cmd+R (Reload Config)
  |
  v
MenuBarController.reloadConfig(_:)
  |
  +-- config = JumpeeConfig.load()    (existing)
  +-- updateTitle()                   (existing)
  +-- overlayManager.updateOverlay()  (existing)
  +-- reRegisterHotkeys()             (existing)
  |
  +-- (NEW) Input source indicator handling:
        |
        +-- Case: config.inputSourceIndicator?.enabled == true
        |     |
        |     +-- if inputSourceManager == nil:
        |     |     inputSourceManager = InputSourceIndicatorManager(spaceDetector:)
        |     |
        |     +-- inputSourceManager?.updateConfig(config)
        |           |
        |           +-- Case A (was off, now on): start(config:)
        |           +-- Case B (was on, now off): stop()
        |           +-- Case C (still on): update currentConfig, re-read input source,
        |                                   apply new style, reposition
        |
        +-- Case: config.inputSourceIndicator?.enabled != true
              |
              +-- inputSourceManager?.stop()
```

#### 3.4 Application Lifecycle Flow

```
App Launch (MenuBarController.init())
  |
  +-- config = JumpeeConfig.load()
  +-- overlayManager = OverlayManager(spaceDetector:)
  +-- setupMenu()    // includes tag 102 toggle item
  +-- updateTitle()
  +-- registerForSpaceChanges()
  +-- reRegisterHotkeys()
  |
  +-- (NEW) if config.inputSourceIndicator?.enabled == true:
  |     inputSourceManager = InputSourceIndicatorManager(spaceDetector:)
  |     inputSourceManager?.start(config: config)
  |       |-- Register DistributedNotificationCenter observer
  |       |-- Read current input source -> create window -> show
  |
  +-- DispatchQueue.main.asyncAfter(0.5): overlayManager.updateOverlay()

                    ...app runs...

App Quit (MenuBarController.quit(_:))
  |
  +-- inputSourceManager?.stop()     (NEW)
  |     |-- Remove notification observer
  |     |-- orderOut + nil the window
  |
  +-- WindowPinner.unpinAll()        (existing)
  +-- hotkeyManager?.unregister()    (existing)
  +-- overlayManager.removeAllOverlays()  (existing)
  +-- NSApp.terminate(nil)
```

### 4. Window Positioning Algorithm

#### 4.1 Menu Bar Height Calculation (Notch-Aware)

```swift
private func menuBarHeight(for screen: NSScreen) -> CGFloat {
    return screen.frame.maxY - screen.visibleFrame.maxY
}
```

**How this works with macOS coordinate system:**
- macOS uses a bottom-left origin global coordinate system.
- `screen.frame` is the full screen rectangle including the menu bar area.
- `screen.visibleFrame` is the usable area excluding the menu bar and Dock.
- `screen.frame.maxY` = top of the physical screen.
- `screen.visibleFrame.maxY` = top of the usable area (bottom of the menu bar).
- The difference is the menu bar height.

**Results by display type:**

| Display Type | screen.frame.height | screen.visibleFrame.maxY offset | menuBarHeight Result |
|-------------|--------------------|---------------------------------|---------------------|
| Standard external display | 1080 | ~1055 | ~25px |
| MacBook Pro with notch | 1117 | ~1080 | ~37px |
| Auto-hide menu bar (hidden) | 1080 | ~1080 | ~0px |
| Auto-hide menu bar (visible) | 1080 | ~1055 | ~25px |

**Important:** The Dock position does NOT affect this formula because we use `maxY` (top of screen), not `minY` (bottom). The Dock only affects `visibleFrame.origin.y` (the bottom), not `visibleFrame.maxY` (the top).

#### 4.2 Complete Positioning Calculation

```swift
private func positionRect(on screen: NSScreen, config: InputSourceIndicatorConfig,
                          windowSize: NSSize) -> NSRect {
    let mbHeight = menuBarHeight(for: screen)
    let verticalOffset = CGFloat(config.effectiveVerticalOffset)

    // Horizontal: centered on the screen
    let x = screen.frame.origin.x + (screen.frame.width - windowSize.width) / 2

    // Vertical: top edge of window touches bottom of menu bar (+ optional offset)
    // In macOS coordinates (bottom-left origin):
    //   screen.frame.maxY = top of screen
    //   screen.frame.maxY - mbHeight = bottom edge of menu bar
    //   Subtract windowSize.height to get the bottom edge of our window
    //   Subtract verticalOffset for additional user-configured spacing
    let y = screen.frame.maxY - mbHeight - windowSize.height - verticalOffset

    return NSRect(x: x, y: y, width: windowSize.width, height: windowSize.height)
}
```

**Visual representation (macOS coordinate system, Y increases upward):**

```
                    screen.frame.maxY
  +==========================================+  <- top of physical screen
  |            MENU BAR (25-37px)            |
  |==========================================|  <- screen.frame.maxY - mbHeight
  |  +-[  Greek  ]--+  <- indicator window   |  <- y + windowHeight
  |  +---------------+                       |  <- y (bottom of indicator)
  |                                          |
  |           (desktop content)              |
  |                                          |
  +==========================================+  <- screen.frame.origin.y
```

#### 4.3 Window Size Calculation

```swift
// Text measurement
label.stringValue = text
label.sizeToFit()
let textSize = label.fittingSize

// Window size = text + padding for the background pill
let windowWidth = textSize.width + horizontalPadding * 2   // 20pt * 2 = 40pt total
let windowHeight = textSize.height + verticalPadding * 2   // 8pt * 2 = 16pt total
let windowSize = NSSize(width: windowWidth, height: windowHeight)
```

**Example sizes at 60pt bold "Helvetica Neue":**

| Input Source Name | Approximate Text Width | Window Width | Window Height |
|-------------------|----------------------|--------------|--------------|
| "U.S." | ~100px | ~140px | ~88px |
| "Greek" | ~150px | ~190px | ~88px |
| "British" | ~185px | ~225px | ~88px |
| "Pinyin - Simplified" | ~460px | ~500px | ~88px |

All sizes are well within typical screen widths (1440px minimum).

### 5. Configuration Schema

#### 5.1 JSON Schema

```json
{
  "inputSourceIndicator": {
    "enabled": true,
    "fontSize": 60,
    "fontName": "Helvetica Neue",
    "fontWeight": "bold",
    "textColor": "#FFFFFF",
    "opacity": 0.8,
    "backgroundColor": "#000000",
    "backgroundOpacity": 0.3,
    "backgroundCornerRadius": 10,
    "verticalOffset": 0
  }
}
```

#### 5.2 Property Reference

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `enabled` | `Bool` | Yes | N/A (section absent = disabled) | Master switch for the feature |
| `fontSize` | `Double` | No | `60` | Font size in points |
| `fontName` | `String` | No | `"Helvetica Neue"` | Font family name |
| `fontWeight` | `String` | No | `"bold"` | Font weight: "regular", "bold", "heavy", "light", "medium", "semibold", "ultraLight", "thin", "black" |
| `textColor` | `String` | No | `"#FFFFFF"` | Hex color code for text |
| `opacity` | `Double` | No | `0.8` | Text opacity (0.0 transparent to 1.0 opaque) |
| `backgroundColor` | `String` | No | `"#000000"` | Hex color code for background pill |
| `backgroundOpacity` | `Double` | No | `0.3` | Background pill opacity (0.0 = invisible, 1.0 = solid) |
| `backgroundCornerRadius` | `Double` | No | `10` | Corner radius for background pill (0 = square) |
| `verticalOffset` | `Double` | No | `0` | Additional pixels below the menu bar |

#### 5.3 Config Behavior Matrix

| Scenario | Behavior |
|----------|----------|
| `inputSourceIndicator` absent from config | Feature disabled. No monitoring, no window, no resources. |
| `inputSourceIndicator.enabled: false` | Feature disabled. Same as absent. |
| `inputSourceIndicator.enabled: true`, all appearance absent | Feature enabled with all defaults: 60pt white bold Helvetica Neue on dark semi-transparent pill. |
| `inputSourceIndicator.enabled: true`, partial appearance | Feature enabled. Specified properties used, unspecified use defaults. |
| `inputSourceIndicator.enabled: true`, full appearance | Feature enabled. All custom values used. |

#### 5.4 Minimal Enable Config

```json
{
  "inputSourceIndicator": {
    "enabled": true
  }
}
```

#### 5.5 Full Custom Config

```json
{
  "inputSourceIndicator": {
    "enabled": true,
    "fontSize": 48,
    "fontName": "SF Pro Display",
    "fontWeight": "semibold",
    "textColor": "#00FF00",
    "opacity": 0.9,
    "backgroundColor": "#333333",
    "backgroundOpacity": 0.5,
    "backgroundCornerRadius": 16,
    "verticalOffset": 10
  }
}
```

### 6. MenuBarController Integration Points

All modifications are within `class MenuBarController` in `Sources/main.swift`.

#### 6.1 New Instance Variable (after line 1142)

```swift
private var inputSourceManager: InputSourceIndicatorManager?
```

#### 6.2 Initialization (after line 1161, in init())

Insert after the overlay `asyncAfter` block:

```swift
if config.inputSourceIndicator?.enabled == true {
    inputSourceManager = InputSourceIndicatorManager(spaceDetector: spaceDetector)
    inputSourceManager?.start(config: config)
}
```

#### 6.3 Menu Toggle Item (in setupMenu(), after tag 101 overlay item, ~line 1288)

```swift
let isiTitle = config.inputSourceIndicator?.enabled == true
    ? "Disable Input Source Indicator"
    : "Enable Input Source Indicator"
let isiToggleItem = NSMenuItem(
    title: isiTitle,
    action: #selector(toggleInputSourceIndicator(_:)),
    keyEquivalent: ""
)
isiToggleItem.target = self
isiToggleItem.tag = 102
menu.addItem(isiToggleItem)
```

**Tag assignment:** `102` (next available after 100=space number toggle, 101=overlay toggle). The pin hotkey item uses tag 302, so 102 is free and follows the toggle group convention (100, 101, 102 for toggles vs 300+ for hotkey items).

#### 6.4 Toggle Action Method (new @objc method)

```swift
@objc private func toggleInputSourceIndicator(_ sender: NSMenuItem) {
    if config.inputSourceIndicator == nil {
        config.inputSourceIndicator = InputSourceIndicatorConfig(enabled: true)
    } else {
        config.inputSourceIndicator!.enabled.toggle()
    }
    config.save()

    if config.inputSourceIndicator?.enabled == true {
        if inputSourceManager == nil {
            inputSourceManager = InputSourceIndicatorManager(spaceDetector: spaceDetector)
        }
        inputSourceManager?.start(config: config)
    } else {
        inputSourceManager?.stop()
    }
}
```

#### 6.5 Menu Title Update (in rebuildSpaceItems(), after tag 101 update, ~line 1558)

```swift
if let item = menu.item(withTag: 103) {
    item.title = config.inputSourceIndicator?.enabled == true
        ? "Disable Input Source Indicator"
        : "Enable Input Source Indicator"
}
```

#### 6.6 Space Change Handler (in spaceDidChange(_:), line 1598)

Add after `overlayManager.updateOverlay(config: config)`:

```swift
inputSourceManager?.refresh()
```

#### 6.7 Screen Change Handler (in screenParametersDidChange(_:), line 1603)

Add after `overlayManager.updateOverlay(config: config)`:

```swift
inputSourceManager?.refresh()
```

#### 6.8 Config Reload (in reloadConfig(_:), after line 2013)

Add after `reRegisterHotkeys()`:

```swift
if config.inputSourceIndicator?.enabled == true {
    if inputSourceManager == nil {
        inputSourceManager = InputSourceIndicatorManager(spaceDetector: spaceDetector)
    }
    inputSourceManager?.updateConfig(config)
} else {
    inputSourceManager?.stop()
}
```

#### 6.9 Quit Handler (in quit(_:), before line 2017)

Add before `WindowPinner.unpinAll()`:

```swift
inputSourceManager?.stop()
```

### 7. Menu Layout After v1.5.0

```
About Jumpee...
Jumpee (bold header, disabled)
---
Desktops:
  [display header, if multi-display]
  [dynamic space items with Cmd+1-9]
  Rename Current Desktop...         Cmd+N        tag=200
  Move Window To... >               [submenu]    (if moveWindow.enabled)
  Pin Window on Top                              tag=400  (if pinWindow.enabled)
  Unpin All Windows                              tag=401  (if pinned count > 0)
  Set Up Window Moving...                        (if shortcuts not enabled)
---
Hide Space Number                                tag=100
Disable Overlay                                  tag=101
Disable Input Source Indicator                   tag=102  (NEW)
---
Hotkeys:                            (disabled)
  Dropdown Hotkey: Cmd+J...                      tag=300
  Move Window Hotkey: Cmd+M...                   tag=301 (if moveWindow.enabled)
  Pin Window Hotkey: Ctrl+Cmd+P...               tag=302 (if pinWindow.enabled)
---
Open Config File...                 Cmd+,
Reload Config                       Cmd+R
---
Quit Jumpee                         Cmd+Q
```

### 8. Error Handling Strategy

| Error Scenario | Handling | Rationale |
|----------------|----------|-----------|
| `TISCopyCurrentKeyboardInputSource()` returns nil properties | `getCurrentInputSourceName()` returns `"Unknown"` | Defensive fallback; should never happen on a properly configured macOS system |
| `TISGetInputSourceProperty()` returns nil for `kTISPropertyLocalizedName` | Same as above: return `"Unknown"` | Same rationale |
| `DistributedNotificationCenter` observer not firing | No explicit handling; indicator shows last known name | Notification is system-managed; failure would indicate a macOS-level issue |
| `spaceDetector.getCurrentSpaceInfo()` returns nil | `refresh()` returns early without repositioning | Same defensive pattern as `OverlayManager.updateOverlay()` |
| `spaceDetector.displayIDToScreen()` returns nil | Fall back to `NSScreen.main` | Display may have been disconnected between calls |
| `NSFont(name:size:)` returns nil (font not installed) | Fall back to `NSFont.systemFont(ofSize:weight:)` | Same pattern as `OverlayWindow` (line 380-381) |
| Config JSON malformed for `inputSourceIndicator` section | `JumpeeConfig.load()` returns default config; `inputSourceIndicator` is nil; feature disabled | Existing config error handling (line 158-168) |

### 9. Thread Safety Considerations

| Concern | Analysis | Conclusion |
|---------|----------|------------|
| `DistributedNotificationCenter` delivery thread | Delivers on the thread that registered the observer. Registration happens in `start()`, called from `MenuBarController.init()` or `reloadConfig()` -- both on main thread. | All notifications arrive on main thread. Safe. |
| `TISCopyCurrentKeyboardInputSource()` thread safety | The TIS APIs are designed to be called from any thread, but the returned `TISInputSource` is a Core Foundation object. Reading properties via `TISGetInputSourceProperty()` is thread-safe. | Called only from main thread (in notification handler). Safe. |
| `NSWindow` / `NSTextField` updates | All AppKit UI must be updated on the main thread. | All updates are in `inputSourceDidChange(_:)` which runs on main thread. Safe. |
| `inputSourceManager` property access | Accessed only from `MenuBarController` methods which are all main-thread (init, menu actions, notification handlers). | Single-threaded access. No synchronization needed. |
| `currentDisplayedName` property | Read/written only in `inputSourceDidChange(_:)` (main thread) and `start()`/`stop()` (main thread). | Single-threaded access. Safe. |

**Conclusion:** No concurrency primitives (locks, queues, actors) are needed. The entire feature operates on the main thread.

### 10. Coexistence with Existing Features

| Feature | Interaction | Details |
|---------|-------------|---------|
| Desktop watermark overlay | Independent. Zero interference. | Different windows: OverlayWindow at `desktopWindow + 1` (below everything) vs InputSourceIndicatorWindow at `floatingWindow + 1` (above normal windows). Different positions: watermark uses configurable position within full screen; indicator is centered below menu bar. Different triggers: watermark updates on space change; indicator updates on input source change. |
| Menu bar title | No interaction. | Menu bar shows space name; indicator shows input source name. |
| Global hotkeys | No new hotkey. | No new `HotkeySlot` case. No changes to `GlobalHotkeyManager`. |
| Pin window on top | Independent. | Pin overlay and indicator are at the same window level (`floatingWindow + 1` and `floatingWindow` respectively) but different positions. Pinned windows use `kCGFloatingWindowLevel` (3); indicator uses `floatingWindow + 1` which is higher. |
| Space change detection | Shared trigger. | Both overlay and indicator refresh on space change. The indicator only repositions (no text change); the overlay updates both text and position. |
| Config reload | Shared trigger. | Both overlay and indicator re-read their respective config sections on Cmd+R. |
| Move window | No interaction. | Moving windows does not affect input source or indicator. |

### 11. Insertion Point Summary

This table summarizes where each change goes in `Sources/main.swift`, referenced by line numbers from the current codebase (2049 lines total).

| Change | After Line | Before Line | Description | Est. Lines |
|--------|-----------|-------------|-------------|------------|
| `InputSourceIndicatorConfig` struct | 130 (PinWindowConfig) | 132 (JumpeeConfig) | New Codable struct with 10 props + defaults + computed | ~45 |
| `inputSourceIndicator` field on JumpeeConfig | 140 (pinWindowHotkey) | 142 (effectiveMoveWindowHotkey) | New optional property | 1 |
| `InputSourceIndicatorWindow` class | 500 (OverlayManager end) | 502 (Space Navigation) | New NSWindow subclass | ~100 |
| `InputSourceIndicatorManager` class | After new window class | 502 (Space Navigation) | Manager with notification observer + TIS APIs | ~80 |
| `inputSourceManager` instance var | 1142 (hotkeyManager) | 1144 (init) | Optional property on MenuBarController | 1 |
| Manager init in `init()` | 1161 (overlay asyncAfter) | -- | Create & start manager if enabled | ~4 |
| Toggle menu item in `setupMenu()` | 1288 (overlay toggle) | 1290 (separator) | Tag 102 menu item | ~10 |
| `toggleInputSourceIndicator` action | Near 1648 (unpinAllWindows) | -- | New @objc method | ~15 |
| Title update in `rebuildSpaceItems()` | 1558 (tag 101 update) | 1560 (hotkey updates) | Tag 102 title update | ~4 |
| `refresh()` in `spaceDidChange` | 1598 (overlay update) | -- | One-liner | 1 |
| `refresh()` in `screenParametersDidChange` | 1603 (overlay update) | -- | One-liner | 1 |
| Config reload handling | 2013 (reRegisterHotkeys) | -- | Start/stop/reconfigure | ~6 |
| `stop()` in `quit()` | 2016 (before WindowPinner) | 2017 (unpinAll) | One-liner | 1 |

**Total estimated new lines:** ~270 (bringing main.swift from ~2049 to ~2319)

### 12. About Dialog Update

**Location:** Inside `showAboutDialog()` (line 1759), add after the "Pin Window on Top" section:

```
5. Input Source Indicator (optional)
   Shows the active keyboard input source below
   the menu bar. Set "inputSourceIndicator":
   {"enabled": true} in your config file.
   No additional permissions required.
```

### 13. Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Input source changes during full-screen apps -- indicator covers content | Low | User can disable via config. Future: detect full-screen via `NSApplication.didChangeOcclusionState` |
| Auto-hide menu bar -- indicator sits at screen top when menu bar hidden | Low | `menuBarHeight()` returns 0; indicator is at very top. Acceptable for v1. |
| Duplicate notifications from `DistributedNotificationCenter` | Very Low | Dedup guard: skip update if name matches `currentDisplayedName` |
| Long input source names widen indicator past screen edge | Very Low | At 60pt, even "Pinyin - Simplified" (~500px) fits on 1440px+ screens. User can reduce `fontSize`. |
| `TISCopyCurrentKeyboardInputSource` returns nil | Very Low | Return "Unknown" string. Should never happen on a real macOS system. |
| File grows to ~2319 lines | Low | Acceptable per single-file architecture. No refactoring planned. |
| `AppleSelectedInputSourcesChangedNotification` stops being posted in future macOS | Very Low | This notification has been stable since macOS 10.5 (2007). Used by major third-party apps. |
| Memory leak from `TISCopyCurrentKeyboardInputSource` | Very Low | Swift ARC handles Core Foundation objects bridged via `Unmanaged`. The `takeUnretainedValue()` for the property pointer is correct per the "Get" naming convention. |
