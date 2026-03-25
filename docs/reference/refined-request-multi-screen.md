# Refined Request: Multi-Screen (Per-Display) Workspace Management

## 1. Objective

Jumpee currently treats all macOS spaces as a single flat list, regardless of which display they belong to. The user wants Jumpee to be **display-aware**: maintain separate workspace name lists for each connected display, show only the workspaces belonging to the currently active display in the menu bar dropdown, and allow switching only between spaces on that display.

This makes Jumpee usable and accurate in multi-monitor setups where each display has its own independent set of spaces.

---

## 2. Functional Requirements

### FR1: Detect Which Display Is Currently Active/Focused

- Determine which physical display contains the currently active space.
- The `CGSCopyManagedDisplaySpaces` API already returns space data grouped by display. Each top-level entry in the returned array corresponds to a display and includes a `"Display Identifier"` key (a UUID string such as `"37D8832A-2D66-02CA-B9F7-8F30A301B230"` or the special `"Main"` identifier).
- Cross-reference the active space ID (from `CGSGetActiveSpace`) against the per-display space lists to determine which display is currently active.

### FR2: Maintain Separate Workspace Name Lists Per Display

- The config must store workspace names scoped to each display, so that space names on Display A are independent of space names on Display B.
- Each display's workspace list must be identified by its display identifier (the UUID string from `CGSCopyManagedDisplaySpaces`).
- If a display has no named spaces in the config, all its desktops appear as "Desktop N" (same as current unnamed behavior).

### FR3: Show Only the Workspaces Belonging to the Active Display in the Menu

- When the menu bar dropdown opens, rebuild the space list to show only the spaces that belong to the display where the active space resides.
- The menu header or a label should indicate which display's spaces are being shown (e.g., the display identifier or a user-assigned display alias if implemented in the future).
- Space numbering in the menu should be per-display (i.e., Desktop 1, Desktop 2... relative to that display, not a global count across all displays).

### FR4: Allow Switching Only Between Spaces on the Active Display

- The Cmd+1 through Cmd+9 shortcuts in the menu must correspond to the per-display space positions, not global positions.
- `SpaceNavigator.navigateToSpace(index:)` currently sends Ctrl+N keystrokes, which macOS interprets as "Switch to Desktop N" globally. This must be adjusted so that the index passed corresponds to the correct global position for the target space.
- Mapping: when the user presses Cmd+3 in the menu for Display B, Jumpee must calculate the global position of Display B's 3rd space (which might be global position 7, for example) and send Ctrl+7.

### FR5: Update Menu Bar Title to Show the Current Space Name on the Active Display

- The menu bar title must reflect the name and per-display position of the current space.
- When the user switches spaces (including switching to a different display), the title must update to show the correct per-display position and name.
- Example: if Display B's 2nd space is named "Browser", the menu bar shows "2: Browser" (not the global position).

### FR6: Overlay Should Show on the Correct Display

- The overlay watermark must appear on the display that owns the currently active space.
- Currently, the overlay uses `NSScreen.main`. This must be changed to find the `NSScreen` corresponding to the active display.
- Mapping between `CGSCopyManagedDisplaySpaces` display identifiers and `NSScreen` instances can be done via `NSScreen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")]` or by matching the `"Display Identifier"` from the CGS API to `CGDirectDisplayID` values.
- When the user switches to a space on a different display, the overlay must move to that display.

### FR7: Config Must Store Per-Display Workspace Mappings

- The `spaces` key in the config must transition from a flat `{ spaceID: name }` dictionary to a structure that groups space names by display.
- **Proposed config structure**:

```json
{
  "displays": {
    "37D8832A-2D66-02CA-B9F7-8F30A301B230": {
      "spaces": {
        "42": "Development",
        "15": "Terminal"
      }
    },
    "5A1F9C3B-4E77-11EA-A2D0-0242AC120002": {
      "spaces": {
        "8": "Email",
        "23": "Browser"
      }
    }
  },
  "showSpaceNumber": true,
  "overlay": { ... },
  "hotkey": { ... }
}
```

- Alternatively, the flat `spaces` dict can be kept as-is (since space IDs are globally unique across displays), and display grouping is done only at runtime. This is simpler but does not allow per-display overlay settings in the future. **Decision point for implementation.**

---

## 3. Non-Functional Requirements

### NFR1: Backward Compatibility with Single-Display Configs

- Existing `~/.Jumpee/config.json` files that use the flat `spaces: { spaceID: name }` format must continue to work without manual intervention.
- On load, if the old flat format is detected, Jumpee must:
  - Use the flat mapping as before (space IDs are already globally unique, so names resolve correctly).
  - Optionally migrate the flat format to the new per-display format on the first space rename operation.
- Single-display users must see no behavioral change.

### NFR2: Performance

- Display detection and space-to-display mapping must not introduce perceptible latency when opening the menu or switching spaces.
- `CGSCopyManagedDisplaySpaces` is already called on every menu open; parsing display info from the same call adds negligible overhead.

### NFR3: Graceful Handling of Display Changes

- When a display is connected or disconnected, macOS may reassign spaces. Jumpee must handle this gracefully:
  - Named spaces that move to another display retain their names (since names are keyed by space ID).
  - If a display disappears, its config entries remain in the config file (they are simply unused until the display is reconnected).

---

## 4. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC1 | With two displays connected, opening the Jumpee menu shows only the spaces belonging to the display where the focused window/space resides. | Connect two displays, create multiple spaces on each. Open menu on each display and verify only that display's spaces appear. |
| AC2 | Space numbering in the menu is per-display: Display A shows Desktop 1, 2, 3 and Display B independently shows Desktop 1, 2, 3. | Count space items in the menu for each display. |
| AC3 | Cmd+N shortcuts in the menu navigate to the Nth space of the active display, not the Nth global space. | On Display B with 3 spaces, press Cmd+2 and verify it navigates to Display B's 2nd space. |
| AC4 | Renaming a desktop on Display A does not affect Display B's names. | Rename a space on Display A, verify Display B's spaces are unchanged. |
| AC5 | The menu bar title shows the per-display position and name of the current space. | Switch spaces across displays and verify the title updates correctly. |
| AC6 | The overlay watermark appears on the correct display. | Switch to a space on Display B and verify the overlay text appears on Display B, not Display A. |
| AC7 | An existing single-display config (flat `spaces` dict) loads and works without errors. | Copy an old config, launch Jumpee, verify all space names appear correctly. |
| AC8 | Disconnecting a display does not crash Jumpee or lose config data. | Unplug a display while Jumpee is running. Verify no crash and the config file retains all entries. |
| AC9 | With a single display connected, Jumpee behaves identically to the current version. | Run on a single-display Mac and verify no regression. |

---

## 5. Constraints

| Constraint | Detail |
|-----------|--------|
| Platform | macOS only (AppKit / Cocoa) |
| Language | Swift (no SwiftUI, no external dependencies) |
| Architecture | Single `main.swift` file (current convention) |
| APIs | Private CoreGraphics APIs: `CGSMainConnectionID`, `CGSGetActiveSpace`, `CGSCopyManagedDisplaySpaces` |
| Navigation | Desktop switching uses simulated Ctrl+N keystrokes via `CGEvent`, which relies on Mission Control shortcuts being enabled |
| Permissions | Accessibility permissions required for keystroke injection |
| Config | Single JSON file at `~/.Jumpee/config.json` |

---

## 6. Assumptions

| # | Assumption |
|---|-----------|
| A1 | `CGSCopyManagedDisplaySpaces` returns an array where each element represents one display, containing a `"Display Identifier"` string and a `"Spaces"` array of spaces belonging to that display. |
| A2 | Each display's spaces are listed in positional order (Space 1 first, Space 2 second, etc.) within that display's entry. |
| A3 | macOS assigns spaces to displays independently when "Displays have separate Spaces" is enabled in System Settings > Desktop & Dock. This feature is assumed to be ON. |
| A4 | Space IDs (`ManagedSpaceID`) are globally unique across all displays, so a given space ID never appears on two displays simultaneously. |
| A5 | macOS Ctrl+N keyboard shortcuts for switching desktops use a global numbering across all displays (not per-display). Jumpee must translate per-display positions to global positions. |
| A6 | The active space (from `CGSGetActiveSpace`) always belongs to exactly one display at a time. |
| A7 | `NSScreen.screens` provides a list of all connected screens that can be correlated with CGS display identifiers, enabling overlay placement on the correct display. |
| A8 | When "Displays have separate Spaces" is disabled in System Settings, all displays share a single space set. In this mode, Jumpee should behave as if there is one display (current behavior). |

---

## 7. Out of Scope

| Item | Rationale |
|------|-----------|
| Per-display overlay configuration (different fonts, colors, positions per screen) | Future enhancement; not requested. |
| User-friendly display aliases (e.g., "Left Monitor", "MacBook Screen") | Nice to have but not part of the current request. Can be added later. |
| Support for more than 9 spaces per display | macOS only provides Ctrl+1 through Ctrl+9 shortcuts; this is a system limitation. |
| Automatic space creation or deletion | Jumpee only names and navigates existing spaces. |
| Multi-display overlay (showing the overlay on all displays simultaneously) | Only the active display's overlay needs to update. |
| Display arrangement or positioning logic | Jumpee does not need to know physical screen layout. |
| Support for "Displays have separate Spaces" being OFF | When this setting is off, all displays share spaces. Jumpee should simply fall back to single-display behavior. No special multi-display logic is needed. |
| Drag-and-drop reordering of spaces between displays | This is a macOS Mission Control feature, not a Jumpee concern. |

---

## 8. Key Implementation Notes

These are not requirements but observations to guide implementation:

1. **`CGSCopyManagedDisplaySpaces` already provides per-display data.** The current `SpaceDetector.getAllSpaceIDs()` method iterates over all displays but flattens the result. The fix is to preserve the display grouping.

2. **Global vs. per-display position mapping.** The Ctrl+N shortcut uses global desktop numbering. If Display A has 3 spaces and Display B has 2 spaces, then Display B's spaces might be globally numbered 4 and 5. Jumpee must compute this offset when navigating.

3. **The `"Current Space"` key** in each display's `CGSCopyManagedDisplaySpaces` entry indicates which space is currently active on that display. This can be used as an alternative to `CGSGetActiveSpace` for per-display active space detection.

4. **Config migration strategy.** Since space IDs are globally unique, the existing flat `spaces` dict works correctly even in multi-display mode -- names resolve by space ID regardless of which display owns the space. Migration to a per-display structure is optional and can be deferred.
