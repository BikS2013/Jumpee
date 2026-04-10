# Refined Request: Pin Window on Top (Always on Top)

**Date:** 2026-04-10
**Requested by:** User
**Raw request:** "I want you to examine and implement if possible an option to allow user to pin a window on top above any other window, and of course release it when he dont needed on top any more"

---

## 1. Feature Summary

Add an "always on top" (pin window on top) capability to Jumpee that allows the user to pin the currently focused window so it floats above all other windows on all desktops. The user must also be able to unpin (release) a pinned window to restore its normal z-order behavior. This feature integrates with Jumpee's existing menu bar dropdown, global hotkey system, and configuration file.

---

## 2. Functional Requirements

### Core Behavior

1. **FR-PIN-1: Pin Focused Window on Top**
   The user can pin the currently focused (frontmost) application window so it remains above all other non-pinned windows. The pinned window stays on top even when the user clicks on or interacts with other windows.

2. **FR-PIN-2: Unpin a Pinned Window**
   The user can unpin a previously pinned window to restore its normal z-order behavior. After unpinning, the window participates in the normal window stacking order.

3. **FR-PIN-3: Multiple Pinned Windows**
   Multiple windows can be pinned simultaneously. All pinned windows float above non-pinned windows. The relative z-order among pinned windows follows normal stacking rules (last focused is on top among pinned windows).

4. **FR-PIN-4: Pin State Tracking**
   Jumpee maintains an in-memory set of currently pinned windows (identified by CGWindowID or AXUIElement reference). This set is not persisted across app restarts -- all pins are released when Jumpee quits.

5. **FR-PIN-5: Pin Toggle Semantics**
   If the focused window is not pinned, the action pins it. If the focused window is already pinned, the action unpins it. This is a toggle operation.

6. **FR-PIN-6: Graceful Handling of Closed Windows**
   If a pinned window is closed by the user or its owning application, Jumpee silently removes it from the pinned set. No error dialog is shown.

### Implementation Approach

7. **FR-PIN-7: Accessibility API Window Level Manipulation**
   Pinning is achieved via the macOS Accessibility API by setting the target window's level to a floating level (above normal windows). The specific approach:
   - Use `AXUIElementCreateApplication(pid)` and `kAXFocusedWindowAttribute` to obtain the target window's AXUIElement.
   - Use `CGSSetWindowLevel` (private CGS API) or `CGWindowListCopyWindowInfo` + `CGSOrderWindow` to elevate the window's level to `kCGFloatingWindowLevel` (level 3) or `kCGMaximumWindowLevel`.
   - To unpin, restore the window level to `kCGNormalWindowLevel` (level 0).

   **Alternative approach (if CGS level APIs are unreliable):**
   - Use `NSRunningApplication` and Apple Script (`osascript`) to set the window level through the scripting bridge.

   **Note:** This is the aspect that requires investigation. The Accessibility API does not expose a public `kAXWindowLevelAttribute`. The implementation must rely on either:
   - Private `CGSSetWindowLevel(_:_:_:)` API (used by tools like Afloat, yabai, and AltTab), or
   - The `CGSOrderWindow` approach to place the window in a higher layer.

   The feasibility investigation should determine which private API is available and stable on macOS 13-15+.

8. **FR-PIN-8: Window Identification**
   Pinned windows are tracked by their `CGWindowID`, obtained via the existing private `_AXUIElementGetWindow` API already used by Jumpee's `WindowMover`.

### Configuration

9. **FR-PIN-9: Feature Enable/Disable**
   A `pinWindow` configuration section in `~/.Jumpee/config.json` controls whether the feature is available:
   ```json
   {
     "pinWindow": {
       "enabled": true
     }
   }
   ```
   When `enabled` is `false`, the menu items and hotkey for pin-on-top are hidden/not registered.

10. **FR-PIN-10: Pin Window Hotkey Configuration**
    A configurable global hotkey (default: Cmd+P) toggles pin state on the focused window. The hotkey is stored in `pinWindowHotkey` in the config:
    ```json
    {
      "pinWindowHotkey": {
        "key": "p",
        "modifiers": ["command"]
      }
    }
    ```
    Uses the same `HotkeyConfig` schema as the existing `hotkey` and `moveWindowHotkey` fields.

11. **FR-PIN-11: Hotkey Registration Lifecycle**
    The pin-window hotkey follows the same lifecycle as the move-window hotkey:
    - Registered only when `pinWindow.enabled` is `true`
    - Re-registered on config reload (Cmd+R)
    - Unregistered when feature is disabled

---

## 3. User Interface

### Menu Bar Dropdown

12. **FR-PIN-12: Pin/Unpin Menu Item**
    A menu item in the Jumpee dropdown allows toggling the pin state of the focused window:
    - When the focused window is **not pinned**: displays "Pin Window on Top" with keyboard equivalent Cmd+P (or the configured hotkey).
    - When the focused window **is pinned**: displays "Unpin Window" with the same keyboard equivalent.
    - The menu item appears in the existing menu structure, logically grouped near the "Move Window To..." submenu (both are window-management operations).

13. **FR-PIN-13: Pinned Windows Indicator (Optional Enhancement)**
    If multiple windows are pinned, a "Pinned Windows" submenu could list all currently pinned windows with an option to unpin each individually or "Unpin All". This is a secondary enhancement -- the minimum viable feature only needs the toggle for the focused window.

14. **FR-PIN-14: Menu Item Visibility**
    The pin/unpin menu item is only visible when `pinWindow.enabled` is `true` in the config.

### Hotkey Configuration UI

15. **FR-PIN-15: Hotkey Editor for Pin Window**
    A "Pin Window Hotkey: Cmd+P" entry appears in the Hotkeys section of the menu (alongside the existing dropdown and move-window hotkey entries). Clicking it opens the same hotkey editor dialog used for the other hotkeys. Only visible when `pinWindow.enabled` is `true`.

### Visual Feedback

16. **FR-PIN-16: Visual Indication of Pinned State**
    When a window is pinned, Jumpee should provide visual feedback. Options to investigate:
    - A brief notification or overlay flash (e.g., "Pinned" / "Unpinned" text shown momentarily).
    - A small pin icon badge in the menu bar text (e.g., prepending a pin emoji to the space name while any window on the current space is pinned).
    - Menu bar title suffix (e.g., "3: Browser [pin]").

    The minimum viable approach is a simple NSSound system beep or no feedback beyond the menu item text changing. Visual feedback approach should be determined during implementation.

---

## 4. Integration Points

### Existing Jumpee Architecture

- **HotkeyConfig struct**: The `pinWindowHotkey` uses the identical `HotkeyConfig` codable struct already defined for `hotkey` and `moveWindowHotkey`.
- **Carbon Event Handler**: A third `EventHotKeyID` is added to the existing shared Carbon event handler that dispatches dropdown (id=1) and move-window (id=2) hotkeys. Pin-window gets id=3.
- **Config loading/saving**: `JumpeeConfig` struct gains `pinWindow` (object with `enabled: Bool`) and `pinWindowHotkey` (optional `HotkeyConfig`).
- **Menu rebuilding**: The `rebuildMenu()` method adds the pin/unpin item and the hotkey editor item, conditional on `pinWindow.enabled`.
- **Accessibility API**: Reuses the existing pattern of `AXUIElementCreateSystemWide()` + `kAXFocusedApplicationAttribute` + `kAXFocusedWindowAttribute` already used by `WindowMover`.
- **Private API**: Adds `CGSSetWindowLevel` (or equivalent) to the existing set of private CGS API declarations at the top of `main.swift`.
- **WindowMover interaction**: Pinned windows can still be moved between desktops via the move-window feature. The pin state should be preserved after a move (the window remains on top on the target desktop).

### New Components

- **WindowPinner class**: A new static class (similar to `WindowMover`) that encapsulates:
  - `pinnedWindows: Set<CGWindowID>` -- tracking set
  - `togglePin()` -- main toggle operation
  - `isPinned(windowID:)` -- query method
  - `unpinAll()` -- cleanup method
  - `cleanupClosedWindows()` -- periodic or event-driven cleanup

---

## 5. Acceptance Criteria

1. **AC-1**: With `pinWindow.enabled: true`, pressing the configured hotkey (default Cmd+P) while a non-pinned window is focused causes that window to remain above all other normal windows, even when clicking on other windows.
2. **AC-2**: Pressing the hotkey again while the same pinned window is focused restores it to normal z-order behavior.
3. **AC-3**: Multiple windows from different applications can be pinned simultaneously, and all float above non-pinned windows.
4. **AC-4**: The Jumpee dropdown menu shows "Pin Window on Top" when the focused window is not pinned, and "Unpin Window" when it is pinned. Clicking the menu item toggles the state.
5. **AC-5**: The pin-window hotkey appears in the Hotkeys section of the menu and can be reconfigured via the hotkey editor dialog.
6. **AC-6**: With `pinWindow.enabled: false` (or the key absent), no pin-related menu items or hotkey are present.
7. **AC-7**: Closing a pinned window does not cause a crash or error; the window is silently removed from the pinned set.
8. **AC-8**: Config reload (Cmd+R) correctly registers/unregisters the pin-window hotkey based on the updated config.
9. **AC-9**: The feature works on macOS 13 (Ventura), 14 (Sonoma), and 15 (Sequoia).
10. **AC-10**: Pinning works for standard application windows (e.g., Safari, Terminal, Finder). Fullscreen windows and system UI elements are handled gracefully (no crash; pin may silently fail).

---

## 6. Constraints

### macOS API Constraints

- **No public API for window level manipulation of other apps' windows.** The Accessibility API (`AXUIElement`) does not expose a writable window-level attribute. The implementation must use private CoreGraphics Session (CGS) APIs, specifically:
  - `CGSSetWindowLevel(connection, windowID, level)` -- sets the window level
  - `CGSGetWindowLevel(connection, windowID, &level)` -- reads the current window level
  These are the same class of private APIs Jumpee already uses (`CGSGetActiveSpace`, `CGSCopyManagedDisplaySpaces`, `CGSGetSymbolicHotKeyValue`).

- **Private API stability risk.** Private CGS APIs can change between macOS versions. The `CGSSetWindowLevel` API has been stable since macOS 10.x and is used by established tools (yabai, Afloat, AltTab), but there is no guarantee of future compatibility.

- **System Integrity Protection (SIP).** The CGS window-level APIs work without disabling SIP, unlike some of yabai's more invasive features (e.g., space manipulation). This feature should work with SIP enabled.

- **Accessibility permissions required.** Jumpee already requires Accessibility permissions. No additional permissions are needed for this feature.

### Window Type Limitations

- Fullscreen windows cannot be meaningfully pinned (they occupy a dedicated space).
- Windows assigned to "All Desktops" are already visible everywhere; pinning adds the on-top behavior.
- Some system windows (e.g., the Dock, Notification Center) have system-managed levels and may not respond to level changes.
- Certain apps with custom window implementations (e.g., Electron apps with frameless windows) may behave differently.

### Behavioral Constraints

- Pin state is in-memory only and does not survive Jumpee restart. This is intentional -- persistent pinning across reboots would require re-identifying windows by title/app, which is fragile.
- The pinned window stays on top within its current space. Whether it appears on top when switching to another space where the window is not present is governed by macOS window management, not by Jumpee.
- The feature does not make windows "sticky" (visible on all desktops). That is a separate capability. Pin-on-top only affects z-order, not space assignment.

### Build Constraints

- Must compile as a single-file Swift app with `swiftc` (no SPM or Xcode project).
- Must work with ad-hoc code signing.
- No external dependencies.

---

## 7. Out of Scope

The following are explicitly **not** part of this feature request:

1. **Make window sticky (visible on all desktops)** -- This is a different feature. Pin-on-top only affects z-ordering, not space assignment.
2. **Per-app pin rules** -- Automatically pinning windows from specific applications (e.g., "always pin Calculator on top"). This could be a future enhancement.
3. **Persistent pin state across restarts** -- Pin state is session-only.
4. **Pin state visual border/highlight on the window itself** -- Drawing overlays or borders on other apps' windows requires injection or overlay windows, which is a much more complex feature.
5. **Keyboard shortcut to cycle through pinned windows** -- Not requested.
6. **Drag-to-pin or other non-hotkey/non-menu activation methods** -- Not requested.
7. **Integration with Mission Control or Stage Manager** -- Pin behavior in these modes is governed by macOS and not controllable by Jumpee.
8. **Window transparency or opacity changes when pinned** -- Not requested.

---

## 8. Investigation Required

Before implementation, the following must be verified:

1. **CGSSetWindowLevel availability**: Confirm that `CGSSetWindowLevel(_ connection: Int32, _ windowID: CGWindowID, _ level: Int32) -> CGError` is callable via `@_silgen_name` on macOS 13-15. Document the exact function signature.

2. **CGSGetWindowLevel availability**: Confirm the read counterpart exists for restoring original window level.

3. **Cross-app window level changes**: Verify that Jumpee (with Accessibility permissions) can change the window level of windows owned by other applications, not just its own windows.

4. **Level persistence across focus changes**: Verify that once a window's level is set to floating, it stays at that level even when the user focuses other windows. Some reports suggest macOS may reset window levels under certain conditions.

5. **Interaction with move-window feature**: Test that moving a pinned window to another desktop preserves its elevated window level.

6. **Default hotkey conflict check**: Verify that Cmd+P does not conflict with common system or application shortcuts (Cmd+P is Print in most apps -- consider Cmd+T, Cmd+Shift+P, or Ctrl+Cmd+P as alternatives).

---

## 9. Suggested Default Hotkey

Given that Cmd+P conflicts with Print in virtually all macOS applications, the recommended default hotkey alternatives are:

| Option | Pros | Cons |
|--------|------|------|
| **Ctrl+Cmd+P** | "P" for Pin, unlikely conflict | Three-key combo |
| **Cmd+Shift+T** | "T" for Top, two modifiers | May conflict with "reopen tab" in browsers |
| **Ctrl+Cmd+T** | "T" for Top, unlikely conflict | Three-key combo |

**Recommendation**: Use **Ctrl+Cmd+P** as the default, since "P" is mnemonic for "Pin" and the Ctrl+Cmd combination is rarely used by standard apps.

---

## 10. Config Example (Complete)

```json
{
  "hotkey": {
    "key": "j",
    "modifiers": ["command"]
  },
  "moveWindow": {
    "enabled": true
  },
  "moveWindowHotkey": {
    "key": "m",
    "modifiers": ["command", "shift"]
  },
  "pinWindow": {
    "enabled": true
  },
  "pinWindowHotkey": {
    "key": "p",
    "modifiers": ["command", "control"]
  },
  "overlay": {
    "enabled": true,
    "opacity": 0.15,
    "fontName": "Helvetica Neue",
    "fontSize": 72,
    "fontWeight": "bold",
    "position": "top-center",
    "textColor": "#FF0000",
    "margin": 40
  },
  "showSpaceNumber": true,
  "spaces": {
    "42": "Mail & Calendar",
    "15": "Development"
  }
}
```
