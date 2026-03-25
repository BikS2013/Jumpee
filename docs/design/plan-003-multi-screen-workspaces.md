# Plan 003: Per-Display (Multi-Screen) Workspace Support

**Date**: 2026-03-25
**Status**: Planned
**Source file**: `Sources/main.swift` (single-file architecture, ~779 lines)

---

## Summary

Jumpee currently flattens all macOS spaces into a single global list, discarding display grouping from `CGSCopyManagedDisplaySpaces`. This plan adds per-display awareness: the menu shows only the active display's spaces, numbering and shortcuts are per-display, and the overlay appears on the correct screen.

**Config format**: No change. The flat `spaces: { spaceID: name }` dictionary is preserved because space IDs are globally unique across displays. Display grouping is a runtime concern only.

**Backward compatibility**: Single-display users see zero behavioral change. All existing methods are preserved; new methods supplement them.

---

## Phase A: SpaceDetector Enhancement

### Objective

Add per-display space data retrieval to `SpaceDetector` while keeping all existing methods intact for backward compatibility.

### A.1 -- Add `DisplaySpaceInfo` struct

**Location**: Insert after the `SpaceDetector` class declaration (after line 206 in `Sources/main.swift`), or as a nested type inside `SpaceDetector`.

```swift
struct DisplaySpaceInfo {
    let displayID: String               // CGS "Display Identifier" (UUID or "Main")
    let localPosition: Int              // 1-based position within this display
    let globalPosition: Int             // 1-based position across all displays
    let spaceID: Int                    // ManagedSpaceID
}
```

**Acceptance criteria**:
- Struct compiles and is usable from `SpaceDetector` and all callers.
- Fields are immutable (`let`).

**Risks**: None. Pure data type.

---

### A.2 -- Add `getSpacesByDisplay()` method

**Class**: `SpaceDetector`
**Insert after**: `getOrderedSpaces()` (line 205)

**Signature**:
```swift
func getSpacesByDisplay() -> [(displayID: String, spaces: [(localPosition: Int, globalPosition: Int, spaceID: Int)])]
```

**Implementation logic**:
1. Call `CGSCopyManagedDisplaySpaces(connectionID)` (same API already used in `getAllSpaceIDs()`).
2. Iterate the returned `[[String: Any]]` array. Each element represents one display.
3. For each display, extract `"Display Identifier"` as `String`.
4. For each display, extract `"Spaces"` array, filter to `type == 0` (normal desktops).
5. Maintain a running `globalCounter` starting at 1 that increments across all displays.
6. For each space within a display, record `(localPosition: localCounter, globalPosition: globalCounter, spaceID: managedSpaceID)`.
7. Return the array of `(displayID, spaces)` tuples preserving the display order from the CGS API.

**Critical detail**: The display order in `CGSCopyManagedDisplaySpaces` determines the global numbering that macOS uses for Ctrl+1-9 shortcuts. This ordering must be preserved exactly.

**Acceptance criteria**:
- With a single display, returns one element whose spaces match `getAllSpaceIDs()` with correct 1-based positions.
- With multiple displays, each display's spaces have independent `localPosition` starting at 1, while `globalPosition` continues sequentially across displays.
- `type != 0` spaces (fullscreen apps) are excluded.
- Existing `getAllSpaceIDs()`, `getCurrentSpaceIndex()`, `getOrderedSpaces()`, `getSpaceCount()` continue to work unchanged.

**Risks**:
- Display ordering in `CGSCopyManagedDisplaySpaces` might not match macOS global Ctrl+N numbering. Must verify on multi-display hardware. Mitigation: the enumeration order from this API is the same order macOS uses internally.

---

### A.3 -- Add `getActiveDisplayID()` method

**Class**: `SpaceDetector`

**Signature**:
```swift
func getActiveDisplayID() -> String?
```

**Implementation logic**:
1. Get active space ID via `CGSGetActiveSpace(connectionID)`.
2. Call `getSpacesByDisplay()`.
3. Iterate displays; find the display whose `spaces` array contains a tuple where `spaceID == activeSpaceID`.
4. Return that display's `displayID`.
5. Return `nil` if not found (should not happen in practice).

**Acceptance criteria**:
- Returns the `displayID` string (UUID or `"Main"`) of the display containing the currently active space.
- With a single display, returns that display's identifier.
- Returns `nil` only when space detection fails entirely.

**Risks**:
- Two CGS calls (`CGSGetActiveSpace` + `CGSCopyManagedDisplaySpaces`). Negligible performance cost since both are already called on every menu open and space change.

---

### A.4 -- Add `getSpaceInfoForCurrentSpace()` method

**Class**: `SpaceDetector`

**Signature**:
```swift
func getSpaceInfoForCurrentSpace() -> DisplaySpaceInfo?
```

**Implementation logic**:
1. Get active space ID via `CGSGetActiveSpace(connectionID)`.
2. Call `getSpacesByDisplay()`.
3. Iterate all displays and their spaces to find the tuple where `spaceID == activeSpaceID`.
4. Construct and return a `DisplaySpaceInfo` with the matching `displayID`, `localPosition`, `globalPosition`, and `spaceID`.
5. Return `nil` if not found.

**Acceptance criteria**:
- Returns complete position information for the current space: both per-display and global positions.
- `localPosition` is 1-based relative to the owning display.
- `globalPosition` matches what `getCurrentSpaceIndex()` would return (backward compatible).
- With a single display, `localPosition == globalPosition`.

**Risks**: None beyond those already identified for `getSpacesByDisplay()`.

---

### A.5 -- Backward compatibility verification

**Existing methods that must NOT change behavior**:

| Method | Current behavior | Must remain |
|--------|-----------------|-------------|
| `getCurrentSpaceID() -> Int` | Returns `CGSGetActiveSpace` result | Unchanged |
| `getAllSpaceIDs() -> [Int]` | Returns flattened list of all space IDs | Unchanged |
| `getCurrentSpaceIndex() -> Int?` | Returns 1-based global index | Unchanged |
| `getSpaceCount() -> Int` | Returns total space count | Unchanged |
| `getOrderedSpaces() -> [(position: Int, spaceID: Int)]` | Returns global position tuples | Unchanged |

**Acceptance criteria**:
- All unit/manual tests that use existing methods continue to pass.
- `migratePositionBasedConfig()` in `MenuBarController` continues to work (it uses `getAllSpaceIDs()`).

---

## Phase B: Menu Bar Controller Updates

### Objective

Make the menu display only the active display's spaces with per-display numbering and correct navigation.

### B.1 -- Modify `rebuildSpaceItems()`

**Class**: `MenuBarController`
**Method**: `rebuildSpaceItems()` (currently line 592)

**Current behavior**: Calls `spaceDetector.getOrderedSpaces()` to get ALL spaces globally, numbers them 1-N globally, stores global position in `item.tag`.

**New behavior**:

```swift
private func rebuildSpaceItems()
```

Changes:
1. Call `spaceDetector.getSpacesByDisplay()` to get per-display space data.
2. Call `spaceDetector.getCurrentSpaceID()` to identify the active space.
3. Find which display contains the active space (iterate displays, find matching spaceID).
4. Extract only that display's spaces for menu item creation.
5. Add a display header item (disabled `NSMenuItem`) showing the display identifier. For `"Main"`, show `"Display: Built-in"`. For UUID strings, show `"Display: <first 8 chars>..."` (truncated for readability).
6. Create menu items numbered 1 through M (per-display `localPosition`), not the global count.
7. Set `item.keyEquivalent` to per-display position string (1-9) so Cmd+1-9 corresponds to per-display positions.
8. **Store `globalPosition` in `item.tag`** so that `navigateToSpace(_:)` sends the correct Ctrl+N keystroke.
9. Mark the active space with checkmark (`.on` state) using spaceID comparison (same as current).
10. Keep the "Rename Current Desktop..." item at the end (unchanged).

**Display header item detail**:
- Insert a disabled `NSMenuItem` with the display label just before the space items.
- Include this item in the `spaceMenuItems` array so it gets cleaned up on rebuild.

**Acceptance criteria**:
- With two displays (A with 3 spaces, B with 2 spaces), opening the menu while on Display B shows only 2 space items numbered "Desktop 1" and "Desktop 2".
- Cmd+1 and Cmd+2 shortcuts appear on those items.
- The display header shows an identifier for Display B.
- Switching to Display A and reopening the menu shows 3 space items for Display A.
- The `item.tag` for Display B's "Desktop 2" contains the global position (e.g., 5 if Display A has 3 spaces).

**Risks**:
- The "Desktops:" header item is found by title string matching (`item.title == "Desktops:"`). If the display header is added after "Desktops:", the insertion index logic must account for it. Alternative: change the "Desktops:" item to include the display label directly, avoiding a separate header item.
- Menu items for the "other" display are not shown, so users cannot navigate to a different display's spaces from the menu. This is by design per FR4.

---

### B.2 -- Modify `updateTitle()`

**Class**: `MenuBarController`
**Method**: `updateTitle()` (currently line 574)

**Current behavior**: Calls `spaceDetector.getCurrentSpaceIndex()` which returns a global index, displays "N: Name" or "Desktop N".

**New behavior**:

```swift
func updateTitle()
```

Changes:
1. Call `spaceDetector.getSpaceInfoForCurrentSpace()` to get `DisplaySpaceInfo`.
2. Use `info.localPosition` instead of the global index for the displayed number.
3. Use `info.spaceID` for config name lookup (same as current).
4. Format string remains the same: `"\(localPosition): \(name)"` or `"Desktop \(localPosition)"`.

**Acceptance criteria**:
- On Display B's 2nd space (global position 5), the menu bar shows "2: Name" (not "5: Name").
- On a single display, behavior is identical to current (localPosition == globalPosition).

**Risks**: None. `getSpaceInfoForCurrentSpace()` handles all the complexity.

---

### B.3 -- Verify `navigateToSpace(_:)` -- NO CHANGE NEEDED

**Class**: `MenuBarController`
**Method**: `navigateToSpace(_:)` (currently line 664)

**Current behavior**: Reads `sender.tag` as the space index and passes it to `SpaceNavigator.navigateToSpace(index:)`.

**Why no change**: In B.1, we store the `globalPosition` in `item.tag`. `navigateToSpace(_:)` reads `sender.tag` and passes it directly to `SpaceNavigator`. Since `sender.tag` already contains the global position, the Ctrl+N keystroke will be correct.

**One adjustment needed**: The comparison `if spaceIndex != currentIndex` currently compares against `spaceDetector.getCurrentSpaceIndex()` (global index). Since `sender.tag` now stores globalPosition and `getCurrentSpaceIndex()` also returns a global index, this comparison remains correct.

**Acceptance criteria**:
- Clicking "Desktop 2" on Display B (which has `tag = 5` if Display A has 3 spaces) sends Ctrl+5, switching to the correct space.
- Clicking the already-active space does nothing (same as current).

**Risks**: None if B.1 correctly stores globalPosition in tag.

---

### B.4 -- Modify `renameActiveSpace()`

**Class**: `MenuBarController`
**Method**: `renameActiveSpace()` (currently line 675)

**Current behavior**: Uses `spaceDetector.getCurrentSpaceIndex()` (global) in the dialog title: "Rename Desktop N".

**New behavior**:

```swift
@objc private func renameActiveSpace()
```

Changes:
1. Call `spaceDetector.getSpaceInfoForCurrentSpace()` to get `DisplaySpaceInfo`.
2. Use `info.localPosition` in the dialog title: "Rename Desktop \(localPosition)".
3. Space ID lookup and name saving remain unchanged (keyed by spaceID, which is globally unique).

**Acceptance criteria**:
- On Display B's 2nd space, the dialog title shows "Rename Desktop 2" (not the global position).
- Saving a name correctly updates `config.spaces[spaceID]`.

**Risks**: None.

---

## Phase C: Overlay Manager Updates

### Objective

Place the overlay on the screen corresponding to the active display instead of always using `NSScreen.main`.

### C.1 -- Add `displayIDToScreen()` helper function

**Location**: Add as a free function or as a static method on `OverlayManager`. Place near the `OverlayManager` class (around line 310).

**Signature**:
```swift
func screenForDisplayIdentifier(_ displayID: String) -> NSScreen?
```

**Implementation logic**:

```swift
func screenForDisplayIdentifier(_ displayID: String) -> NSScreen? {
    if displayID == "Main" {
        let mainDisplayID = CGMainDisplayID()
        return NSScreen.screens.first { screen in
            let screenNumber = screen.deviceDescription[
                NSDeviceDescriptionKey("NSScreenNumber")
            ] as? CGDirectDisplayID
            return screenNumber == mainDisplayID
        }
    }

    for screen in NSScreen.screens {
        guard let screenNumber = screen.deviceDescription[
            NSDeviceDescriptionKey("NSScreenNumber")
        ] as? CGDirectDisplayID else { continue }
        if let uuid = CGDisplayCreateUUIDFromDisplayID(screenNumber) {
            let uuidString = CFUUIDCreateString(nil, uuid.takeRetainedValue()) as String?
            if let uuidStr = uuidString,
               uuidStr.caseInsensitiveCompare(displayID) == .orderedSame {
                return screen
            }
        }
    }
    return nil
}
```

**Key details**:
- Uses `CGDisplayCreateUUIDFromDisplayID()` -- a public CoreGraphics API (available since macOS 10.2).
- Uses case-insensitive comparison for UUID strings (the format from `CGDisplayCreateUUIDFromDisplayID` may differ in case from `CGSCopyManagedDisplaySpaces`).
- Handles the special `"Main"` identifier by matching against `CGMainDisplayID()`.
- Returns `nil` if no matching screen found (e.g., display was disconnected between detection and mapping).

**Acceptance criteria**:
- Given the display identifier `"Main"`, returns the NSScreen corresponding to the built-in display.
- Given a UUID display identifier, returns the correct NSScreen for that external display.
- Returns `nil` when given a display identifier for a disconnected display.
- Does not crash when `NSScreen.screens` is empty (edge case).

**Risks**:
- **UUID format mismatch**: The UUID string format from `CGDisplayCreateUUIDFromDisplayID` may include or omit hyphens, or use different casing than `CGSCopyManagedDisplaySpaces`. Case-insensitive comparison mitigates this, but must be tested on actual hardware with at least two displays.
- **`CGDisplayCreateUUIDFromDisplayID` import**: This function is in the `CoreGraphics` framework which is already linked via `import Cocoa`. No additional import needed, but verify at compile time.

---

### C.2 -- Add `updateScreen(_:config:)` to `OverlayWindow`

**Class**: `OverlayWindow`
**Insert after**: `updateText(_:config:)` (line 267)

**Signature**:
```swift
func updateScreen(_ screen: NSScreen, config: OverlayConfig)
```

**Implementation logic**:
1. Call `self.setFrame(screen.frame, display: true)` to reposition and resize the window to the target screen.
2. Update `contentView.frame` to match the new screen size (origin at `(0,0)`, size from `screen.frame.size`).
3. Call `positionLabel(in: contentView, config: config)` to reposition the label within the new frame.

**Why this works**: macOS uses a global coordinate system where each screen has a unique frame origin. Setting the window frame to `screen.frame` places it exactly on that screen. The `.canJoinAllSpaces` behavior means the window appears on all spaces, but since it is sized to one specific screen, it only visually covers that screen.

**Acceptance criteria**:
- Calling `updateScreen(displayBScreen, config:)` moves the overlay from Display A to Display B.
- The overlay text is correctly positioned within the new screen's bounds.
- The overlay does not bleed onto adjacent screens.

**Risks**:
- Retina vs non-Retina screens may have different `frame` vs `visibleFrame` characteristics. Using `screen.frame` (full screen bounds) is correct since the overlay is desktop-level and should cover the entire screen area.

---

### C.3 -- Modify `OverlayManager.updateOverlay(config:)`

**Class**: `OverlayManager`
**Method**: `updateOverlay(config:)` (currently line 318)

**Current behavior**: Uses `NSScreen.main` and `spaceDetector.getCurrentSpaceIndex()` (global).

**New behavior**:

```swift
func updateOverlay(config: JumpeeConfig)
```

Changes:
1. Replace `NSScreen.main` with display-aware screen lookup:
   - Call `spaceDetector.getSpaceInfoForCurrentSpace()` to get `DisplaySpaceInfo`.
   - Call `screenForDisplayIdentifier(info.displayID)` to get the correct `NSScreen`.
   - Fall back to `NSScreen.main` if the mapping fails (defensive).
2. Use `info.localPosition` instead of `spaceDetector.getCurrentSpaceIndex()` for the space number in the overlay text.
3. Use `info.spaceID` for config name lookup (same as current).
4. When the overlay window already exists:
   - Call `overlayWindow.updateScreen(screen, config: config.overlay)` if the screen changed.
   - Call `overlayWindow.updateText(displayText, config: config.overlay)` to update text.
5. When creating a new overlay window, pass the resolved screen (not `NSScreen.main`).

**Track the current screen**: Add a private property to `OverlayManager`:

```swift
private var currentScreenDisplayID: String?
```

On each update, compare the new `displayID` against `currentScreenDisplayID`. If different, call `updateScreen()` on the overlay window and update the stored ID. This avoids unnecessary frame changes when only the space (not the display) changed.

**Acceptance criteria**:
- Switching to a space on Display B places the overlay on Display B's screen.
- Switching back to Display A moves the overlay to Display A's screen.
- The overlay text shows the per-display position (e.g., "2: Browser" for Display B's 2nd space).
- On a single display, behavior is identical to current.

**Risks**:
- If `screenForDisplayIdentifier()` returns `nil` (display disconnected between detection and overlay update), the fallback to `NSScreen.main` prevents a crash but may show the overlay on the wrong screen momentarily.
- Rapid display switching could cause brief visual artifacts. The 0.3-second delay in `navigateToSpace()` provides a natural buffer.

---

## Phase D: Display Change Handling

### Objective

Detect when displays are connected or disconnected and refresh the space topology.

### D.1 -- Listen for `NSApplication.didChangeScreenParametersNotification`

**Class**: `MenuBarController`
**Method to modify**: `registerForSpaceChanges()` (currently line 651)

**Current behavior**: Registers only for `NSWorkspace.activeSpaceDidChangeNotification`.

**New behavior**: Additionally register for `NSApplication.didChangeScreenParametersNotification`.

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

**Note**: `NSWorkspace.activeSpaceDidChangeNotification` is on `NSWorkspace.shared.notificationCenter`, while `NSApplication.didChangeScreenParametersNotification` is on the default `NotificationCenter.default`. These are different notification centers.

**Acceptance criteria**:
- Observer is registered at init time alongside the existing space change observer.
- The handler is called when a display is connected or disconnected.

**Risks**: None for the registration itself.

---

### D.2 -- Add `screenParametersDidChange(_:)` handler

**Class**: `MenuBarController`

**Signature**:
```swift
@objc private func screenParametersDidChange(_ notification: Notification)
```

**Implementation logic**:
1. Call `updateTitle()` -- refreshes the menu bar title with potentially new display topology.
2. Call `overlayManager.updateOverlay(config: config)` -- repositions overlay for the new screen configuration.
3. The menu does not need explicit refresh because `menuWillOpen` triggers `rebuildSpaceItems()` which will naturally use the new topology on next open.

**Why this is needed**: When a display is disconnected, macOS may move spaces to the remaining display. The `activeSpaceDidChangeNotification` may or may not fire in this case. `didChangeScreenParametersNotification` guarantees we detect the topology change and update the overlay position and title.

**Acceptance criteria**:
- Disconnecting a display while Jumpee is running does not crash the app.
- After disconnecting a display, the menu bar title updates to reflect the new space topology.
- After disconnecting a display, the overlay repositions to the remaining screen.
- Config data for the disconnected display's spaces remains in `config.json` (harmless unused entries).
- Reconnecting the display restores correct behavior: spaces reappear with their names.

**Risks**:
- `didChangeScreenParametersNotification` may fire multiple times in quick succession during display connect/disconnect. Rapid-fire calls to `updateTitle()` and `updateOverlay()` are harmless since they are idempotent, but a debounce could be added if performance issues arise.
- When "Displays have separate Spaces" is OFF in System Settings, `CGSCopyManagedDisplaySpaces` returns a single display entry. The Phase A methods handle this naturally -- `getSpacesByDisplay()` returns one display, `localPosition == globalPosition`, and behavior matches single-display mode.

---

## Cross-Phase Dependencies

```
Phase A (SpaceDetector)
  |
  +---> Phase B (MenuBarController) -- depends on A.2, A.3, A.4
  |
  +---> Phase C (OverlayManager) -- depends on A.4
  |
  +---> Phase D (Display Change Handling) -- depends on B and C being complete
```

Phase B and Phase C can be developed in parallel once Phase A is complete. Phase D should be implemented last since it exercises the code paths from both B and C.

---

## Files Modified

| File | Changes |
|------|---------|
| `Sources/main.swift` | All changes (single-file architecture) |

No new files. No config format changes. No build script changes.

---

## Global Acceptance Criteria

These correspond to the acceptance criteria from the requirements document:

| # | Criterion | Phases |
|---|-----------|--------|
| AC1 | Menu shows only the active display's spaces | B.1 |
| AC2 | Space numbering is per-display (Desktop 1, 2, 3 per display) | A.2, B.1, B.2 |
| AC3 | Cmd+N shortcuts navigate to the Nth space of the active display | B.1, B.3 |
| AC4 | Renaming on Display A does not affect Display B | B.4 (config keyed by spaceID) |
| AC5 | Menu bar title shows per-display position and name | B.2 |
| AC6 | Overlay appears on the correct display | C.1, C.2, C.3 |
| AC7 | Existing single-display config works without errors | A.5 (backward compat) |
| AC8 | Disconnecting a display does not crash or lose config | D.1, D.2 |
| AC9 | Single-display behavior is identical to current version | All phases |

---

## Risk Summary

| Risk | Severity | Mitigation |
|------|----------|------------|
| Display order in `CGSCopyManagedDisplaySpaces` may not match Ctrl+N global numbering | High | Test on multi-display hardware before merging. The enumeration order is believed to match based on community documentation. |
| UUID format mismatch between `CGDisplayCreateUUIDFromDisplayID` and CGS `"Display Identifier"` | Medium | Use case-insensitive comparison. Test with actual external displays. |
| `didChangeScreenParametersNotification` rapid-fire on connect/disconnect | Low | Calls are idempotent. Add debounce (e.g., 0.5s) if needed. |
| Overlay window bleeds across screens when repositioned | Low | Use `screen.frame` (global coordinates) with `setFrame(_:display:)`. Test on multi-display. |
| "Displays have separate Spaces" OFF mode | Low | Falls back naturally to single-display: `CGSCopyManagedDisplaySpaces` returns one entry. No special code needed. |
| Private API behavior changes in future macOS versions | Medium | Same risk as current codebase. No new private APIs are introduced; all new code uses public APIs (`CGDisplayCreateUUIDFromDisplayID`, `CGMainDisplayID`, `NSScreen`). |

---

## Testing Strategy

### Manual Testing (Required -- No Automated Test Infrastructure)

1. **Single display**: Verify all existing behavior is unchanged (regression test).
2. **Two displays**:
   - Create 3 spaces on Display A, 2 on Display B.
   - Verify menu shows correct per-display spaces.
   - Verify Cmd+1, Cmd+2 navigate within the active display.
   - Verify overlay appears on the correct screen.
   - Rename spaces on each display independently.
3. **Display disconnect**: Unplug external display while Jumpee runs. Verify no crash, overlay moves to remaining display.
4. **Display reconnect**: Plug display back in. Verify spaces reappear with saved names.
5. **Config reload**: Edit `config.json` while running, press Cmd+R. Verify names update correctly per display.

### Diagnostic Logging

Add temporary `print()` statements during development to verify:
- Display identifiers returned by `CGSCopyManagedDisplaySpaces`
- UUID strings from `CGDisplayCreateUUIDFromDisplayID`
- Global vs local position calculations
- Screen frame values for overlay positioning

Remove diagnostic logging before final build.
