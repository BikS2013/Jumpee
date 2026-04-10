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
