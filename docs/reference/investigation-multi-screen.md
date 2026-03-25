# Investigation: Per-Display Workspace Support for Jumpee

**Date**: 2026-03-25
**Purpose**: Investigate technical approaches for each challenge in adding multi-display awareness to Jumpee.

---

## Challenge 1: Display Identification

### Problem

`CGSCopyManagedDisplaySpaces` returns an array of dictionaries, each with a `"Display Identifier"` string. We need to understand the format of this identifier and how to map it to `NSScreen` instances for overlay placement.

### Findings

The `"Display Identifier"` returned by `CGSCopyManagedDisplaySpaces` uses one of two formats:

1. **UUID string** for external/secondary displays, e.g., `"37D8832A-2D66-02CA-B9F7-8F30A301B230"`. This is a CoreGraphics-internal UUID that uniquely identifies a display across sessions. It is NOT the same as `CGDirectDisplayID` (which is a `UInt32`).

2. **The literal string `"Main"`** for the built-in display on laptops, or sometimes for the primary display on desktop Macs.

The challenge is bridging from this UUID string to `NSScreen`. The bridge path is:

```
CGS Display Identifier (UUID string)
    -> CGDirectDisplayID (UInt32, obtained from CGSCopyManagedDisplaySpaces data or CoreGraphics display APIs)
    -> NSScreen (matched via NSScreen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")])
```

### Recommended Approach

**Use `NSScreen.deviceDescription` to get `CGDirectDisplayID`, then correlate with `CGSCopyManagedDisplaySpaces` display order.**

The specific mapping strategy:

1. Call `CGSCopyManagedDisplaySpaces` to get the per-display array. Each entry has `"Display Identifier"`.

2. Use `CGGetActiveDisplayList` (public CoreGraphics API) to get all active `CGDirectDisplayID` values. Alternatively, use `NSScreen.screens` and extract `CGDirectDisplayID` from each screen's `deviceDescription`:

```swift
for screen in NSScreen.screens {
    if let screenNumber = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? CGDirectDisplayID {
        let uuid = CGDisplayCreateUUIDFromDisplayID(screenNumber)?.takeRetainedValue()
        // uuid is a CFUUID that can be converted to string for matching
    }
}
```

3. `CGDisplayCreateUUIDFromDisplayID(_:)` is a **public** CoreGraphics function (available since macOS 10.2) that converts a `CGDirectDisplayID` to a `CFUUID`. Convert this UUID to a string and compare with the `"Display Identifier"` from `CGSCopyManagedDisplaySpaces`.

4. Special case: when `"Display Identifier"` is `"Main"`, match it to `CGMainDisplayID()` or to `NSScreen.screens.first` (the main display is always the first in the `NSScreen.screens` array on macOS, though this should be verified against `CGMainDisplayID()` for robustness).

**Implementation sketch for a helper function:**

```swift
func screenForDisplayIdentifier(_ displayID: String) -> NSScreen? {
    if displayID == "Main" {
        // Match to the main display
        let mainDisplayID = CGMainDisplayID()
        return NSScreen.screens.first { screen in
            let screenNumber = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? CGDirectDisplayID
            return screenNumber == mainDisplayID
        }
    }

    // For UUID-based identifiers, match via CGDisplayCreateUUIDFromDisplayID
    for screen in NSScreen.screens {
        guard let screenNumber = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? CGDirectDisplayID else { continue }
        if let uuid = CGDisplayCreateUUIDFromDisplayID(screenNumber) {
            let uuidString = CFUUIDCreateString(nil, uuid.takeRetainedValue()) as String?
            if uuidString == displayID {
                return screen
            }
        }
    }
    return nil
}
```

**Risk**: The UUID format returned by `CGDisplayCreateUUIDFromDisplayID` may include hyphens and uppercase formatting that differs slightly from the `"Display Identifier"` string in `CGSCopyManagedDisplaySpaces`. Case-insensitive comparison should be used. Testing on actual multi-display hardware is required to confirm the exact format match.

**Alternative approach (simpler, position-based)**: Since `CGSCopyManagedDisplaySpaces` returns displays in a consistent order and `NSScreen.screens` also returns screens in a deterministic order (main screen first, then others by position), a positional correlation might work: display 0 in CGS maps to `NSScreen.screens[0]`, etc. However, this is fragile -- the ordering may not be guaranteed to match across the two APIs. The UUID-based approach above is more robust.

---

## Challenge 2: Active Display Detection

### Problem

When the user switches spaces, we need to know which display currently owns the active space, so we can show the correct per-display menu and place the overlay on the right screen.

### Recommended Approach

**Cross-reference `CGSGetActiveSpace()` against the per-display space lists from `CGSCopyManagedDisplaySpaces`.**

This is the most reliable approach and avoids depending on mouse position or key window location.

```swift
func getActiveDisplayInfo() -> (displayID: String, spaces: [Int], localIndex: Int)? {
    let currentSpaceID = CGSGetActiveSpace(connectionID)
    let spacesInfo = CGSCopyManagedDisplaySpaces(connectionID) as! [[String: Any]]

    for display in spacesInfo {
        guard let displayID = display["Display Identifier"] as? String,
              let spaces = display["Spaces"] as? [[String: Any]] else { continue }

        let normalSpaces = spaces.compactMap { space -> Int? in
            guard let id = space["ManagedSpaceID"] as? Int,
                  let type = space["type"] as? Int, type == 0 else { return nil }
            return id
        }

        if let localIdx = normalSpaces.firstIndex(of: currentSpaceID) {
            return (displayID: displayID, spaces: normalSpaces, localIndex: localIdx + 1)
        }
    }
    return nil
}
```

**Why not use `"Current Space"` from the CGS data?** Each display entry in `CGSCopyManagedDisplaySpaces` includes a `"Current Space"` key showing which space is active on that display. However, this tells us what is current per-display but does not tell us which display is the globally focused one. When macOS has two displays, both have a "current space" -- only one of them matches `CGSGetActiveSpace()`. So the cross-reference approach is correct: find which display's space list contains the globally active space ID.

**Edge case**: When "Displays have separate Spaces" is OFF in System Settings, `CGSCopyManagedDisplaySpaces` returns a single display entry containing all spaces. In this case, the behavior naturally falls back to single-display mode -- the single entry's space list will always contain the active space. No special handling needed.

---

## Challenge 3: Per-Display Space Indexing

### Problem

Currently, `getCurrentSpaceIndex()` returns a global 1-based index across all displays. For multi-display, we need a per-display index (1 to M where M is the number of spaces on the active display).

### Recommended Approach

**Add a new method `getPerDisplaySpaceInfo()` to `SpaceDetector` that returns both the per-display index and display context.**

Define a struct to hold per-display space information:

```swift
struct DisplaySpaceInfo {
    let displayID: String           // CGS display identifier
    let localIndex: Int             // 1-based position within this display
    let globalIndex: Int            // 1-based position across all displays
    let spaceID: Int                // The space's ManagedSpaceID
    let displaySpaces: [Int]        // All space IDs on this display (ordered)
    let allDisplays: [(displayID: String, spaces: [Int])]  // All displays and their spaces
}
```

This struct provides everything needed by all consumers:
- `localIndex` for menu display and title bar (Challenge 3)
- `globalIndex` for navigation keystrokes (Challenge 4)
- `displayID` for overlay screen mapping (Challenge 5)
- `displaySpaces` for menu building (Challenge 6)
- `allDisplays` for global index calculation

**Keep existing methods intact** (`getAllSpaceIDs()`, `getCurrentSpaceIndex()`, etc.) for backward compatibility during development. The new method supplements rather than replaces them.

---

## Challenge 4: Global Position Calculation

### Problem

macOS Ctrl+1 through Ctrl+9 shortcuts use global numbering. When the user clicks "Desktop 2" on Display B in the menu, we need to send the correct global Ctrl+N keystroke.

### Recommended Approach

**Calculate global position by summing space counts of all displays that appear before the target display in the `CGSCopyManagedDisplaySpaces` array.**

The formula:

```
globalIndex = (sum of space counts on all preceding displays) + localIndex
```

Example:
- Display A: 4 spaces
- Display B: 3 spaces
- User clicks "Desktop 2" on Display B
- Global index = 4 + 2 = 6
- Jumpee sends Ctrl+6

**Implementation**: The `DisplaySpaceInfo` struct from Challenge 3 already provides `allDisplays`. Calculate the offset:

```swift
func globalIndexForLocalIndex(_ localIndex: Int, onDisplay targetDisplayID: String, allDisplays: [(displayID: String, spaces: [Int])]) -> Int {
    var offset = 0
    for (displayID, spaces) in allDisplays {
        if displayID == targetDisplayID {
            return offset + localIndex
        }
        offset += spaces.count
    }
    return localIndex // fallback
}
```

**Critical assumption**: The display order in `CGSCopyManagedDisplaySpaces` matches the global numbering used by macOS for Ctrl+N shortcuts. This is believed to be true based on community documentation of this private API, but it MUST be verified on actual multi-display hardware. If the order does not match, navigation will jump to the wrong space.

**Mitigation**: If ordering proves unreliable, an alternative approach is to store the global position alongside each space during the `CGSCopyManagedDisplaySpaces` parse, using the overall enumeration order. Since this is the same order macOS uses internally to number spaces, it should be consistent.

**Limit**: macOS only supports Ctrl+1 through Ctrl+9, so a maximum of 9 total spaces across all displays can be navigated via keyboard. If there are more than 9 spaces globally, spaces beyond position 9 cannot be reached via Ctrl+N. The menu item should still be shown but without a keyboard shortcut. This is the same as the current limitation.

---

## Challenge 5: Overlay on Correct Screen

### Problem

The overlay currently targets `NSScreen.main`. It must instead appear on the screen corresponding to the active display.

### Recommended Approach

**Use the display-to-NSScreen mapping from Challenge 1, triggered on every space change.**

Modify `OverlayManager.updateOverlay(config:)`:

1. Get the `DisplaySpaceInfo` for the active space (includes `displayID`).
2. Call `screenForDisplayIdentifier(displayID)` to get the correct `NSScreen`.
3. Pass that screen to the overlay window.

**Overlay window management strategy**: Two options exist:

**Option A -- Single overlay, reposition on display change (Recommended)**:
- Keep a single `OverlayWindow` instance.
- When the active display changes, resize and reposition the window to the new screen's frame.
- Add an `updateScreen(_:)` method to `OverlayWindow` that updates the window frame and repositions the label.
- The `.canJoinAllSpaces` behavior is fine -- the window appears on all spaces, but since it is sized and positioned to one specific screen, it only visually shows on that screen.
- Simpler code, less memory, fewer window management issues.

```swift
func updateScreen(_ screen: NSScreen, config: OverlayConfig) {
    self.setFrame(screen.frame, display: true)
    if let contentView = self.contentView {
        contentView.frame = NSRect(origin: .zero, size: screen.frame.size)
        positionLabel(in: contentView, config: config)
    }
}
```

**Option B -- One overlay per display**:
- Create a dictionary `[String: OverlayWindow]` keyed by display identifier.
- Show/hide overlay windows as the active display changes.
- More complex, but enables future per-display overlay settings (out of scope).

**Recommendation**: Option A. It is simpler, matches the current single-window architecture, and the requirements explicitly state that per-display overlay config is out of scope. Migration to Option B can happen later if needed.

**Edge case**: When the overlay window's frame is set to a non-main screen, macOS may place it on the main screen if the target screen is not available. Using `setFrame(_:display:)` with the screen's actual frame rectangle (which includes position offset) handles this correctly -- macOS screen frames use a global coordinate system where each screen has a unique origin.

---

## Challenge 6: Menu Structure

### Problem

Should the menu show spaces grouped by display with headers, or only show the active display's spaces?

### Recommended Approach

**Show only the active display's spaces, with a display indicator header.**

Rationale:
- The requirements (FR3) explicitly state: "show only the spaces that belong to the display where the active space resides."
- Showing all displays' spaces would defeat the purpose of per-display awareness.
- The Cmd+1-9 shortcuts in the menu must correspond to per-display positions. If all displays were shown, shortcut assignment would be ambiguous.

**Menu layout**:

```
Jumpee
---
[Display: Main]           <-- disabled header item, shows display identifier
Desktops:
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

**Display header**: Show a simple label like `"Display: Main"` or `"Display: 37D8..."` (truncated UUID). For now, using the raw display identifier is acceptable. User-friendly display aliases (e.g., "Left Monitor") are explicitly out of scope and can be added later.

**Alternative considered -- Show all displays with headers**:

```
Jumpee
---
[Built-in Display]
  * Desktop 1 - Development     Cmd+1
    Desktop 2 - Terminal         Cmd+2
[External Display]
    Desktop 1 - Email            Cmd+3  <-- confusing: Cmd+3 for "Desktop 1"?
    Desktop 2 - Browser          Cmd+4
```

This is rejected because:
- Cmd+N shortcut numbering becomes confusing (Cmd+3 navigates to a space labeled "Desktop 1")
- The requirements say "allow switching only between spaces on the active display" (FR4)
- Clicking a space on an inactive display would require a cross-display navigation which has different mechanics

**Implementation in `rebuildSpaceItems()`**:

1. Call `getPerDisplaySpaceInfo()` to get the active display's info.
2. Update the "Desktops:" header to include display identification (or add a separate header item).
3. Iterate only over `displaySpaces` from the active display.
4. Number spaces 1 through M (per-display).
5. Store the **global** position in the menu item's `tag` for navigation (or store both local and global positions using the `representedObject` property).

---

## Challenge 7: Backward Compatibility

### Problem

Existing config files use `spaces: { "spaceID": "name" }`. Will this work with multi-display?

### Recommended Approach

**Keep the flat `spaces` dictionary. No config migration is needed.**

Rationale:
- Space IDs (`ManagedSpaceID`) are globally unique across all displays. A space ID on Display A will never collide with one on Display B.
- The flat `spaces: { "42": "Development", "15": "Terminal", "8": "Email" }` format resolves correctly regardless of which display owns each space.
- Display grouping is a runtime concern only -- determined by cross-referencing space IDs against `CGSCopyManagedDisplaySpaces` output.
- Single-display users see zero behavioral change.

**What this means for implementation**:
- `JumpeeConfig` struct remains unchanged.
- No config file format migration code is needed.
- The `renameActiveSpace()` method continues to save names keyed by space ID -- works identically for multi-display.
- If a display is disconnected, its space names remain in the config file (harmless unused entries). When reconnected, names are restored automatically.

**Future consideration**: If per-display overlay settings or display aliases are added later, a `displays` grouping can be introduced at that time. The flat `spaces` dict can coexist with a `displays` dict since they serve different purposes.

---

## Summary of Recommended Approaches

| Challenge | Approach | Complexity |
|-----------|----------|------------|
| 1. Display identification | `CGDisplayCreateUUIDFromDisplayID` to map `NSScreen` to CGS display UUID | Medium |
| 2. Active display detection | Cross-reference `CGSGetActiveSpace()` against per-display space lists | Low |
| 3. Per-display indexing | New `DisplaySpaceInfo` struct from `SpaceDetector` | Medium |
| 4. Global position calculation | Sum preceding display space counts + local index | Low |
| 5. Overlay on correct screen | Single overlay window, reposition via `setFrame` on display change | Medium |
| 6. Menu structure | Show only active display's spaces with display header | Low |
| 7. Backward compatibility | Keep flat `spaces` dict, no migration needed | None |

---

## Implementation Order

The recommended implementation sequence, based on dependencies:

1. **SpaceDetector enhancements** (Challenges 2, 3, 4): Add `getPerDisplaySpaceInfo()` and `DisplaySpaceInfo` struct. This is the foundation everything else depends on.

2. **Display-to-NSScreen mapping** (Challenge 1): Add `screenForDisplayIdentifier()` helper. Needed by the overlay but can be developed in parallel with step 1.

3. **MenuBarController updates** (Challenge 6): Update `rebuildSpaceItems()` to filter by active display, use per-display numbering, and store global positions for navigation. Update `updateTitle()` to use per-display index. Update `navigateToSpace()` to use global index from the menu item.

4. **OverlayManager updates** (Challenge 5): Replace `NSScreen.main` with display-aware screen lookup. Add screen repositioning to `OverlayWindow`.

5. **Testing on multi-display hardware** (all challenges): Verify display ordering, UUID matching, and navigation correctness.

---

## Technical Research Guidance

**Research needed: Yes**

The following topics require validation on actual multi-display hardware before implementation:

1. **CGS Display Identifier format verification**: Confirm the exact string format of `"Display Identifier"` returned by `CGSCopyManagedDisplaySpaces` and whether it matches the UUID string produced by `CFUUIDCreateString(CGDisplayCreateUUIDFromDisplayID(...))`. Test with at least two displays to capture both the `"Main"` special case and a UUID-based identifier.

2. **Display ordering vs. global space numbering**: Verify that the order of displays in the `CGSCopyManagedDisplaySpaces` array matches the global numbering used by macOS for Ctrl+1 through Ctrl+9 shortcuts. Create spaces on two displays and test whether the enumeration order produces correct Ctrl+N navigation targets.

3. **`CGDisplayCreateUUIDFromDisplayID` availability**: This is a public CoreGraphics function, but confirm it is available and works correctly on macOS 13+ (the minimum target). Check if it requires any special import beyond `import Cocoa`.

4. **Overlay window behavior across screens**: Test that `setFrame(screen.frame, display: true)` correctly positions a borderless, desktop-level, `.canJoinAllSpaces` window on the intended screen using the global coordinate system. Verify the window does not bleed onto adjacent screens.

5. **"Displays have separate Spaces" OFF behavior**: Confirm that when this System Setting is disabled, `CGSCopyManagedDisplaySpaces` returns a single display entry, causing Jumpee to naturally fall back to single-display behavior without special-case code.

6. **Display connect/disconnect handling**: Verify whether `NSWorkspace.activeSpaceDidChangeNotification` fires when a display is connected or disconnected, or whether `NSApplication.didChangeScreenParametersNotification` is also needed to detect screen topology changes that may not trigger a space change.

**Topics that do NOT need further research** (well-understood from codebase analysis):
- Config backward compatibility (flat `spaces` dict works as-is)
- SpaceNavigator keystroke injection (no changes needed, receives global index)
- Global hotkey management (display-independent)
- Menu rebuild lifecycle (`menuWillOpen` triggers fresh rebuild each time)
