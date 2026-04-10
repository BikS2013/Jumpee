# Plan 006: Pin Window on Top (Always on Top)

**Date:** 2026-04-10
**Version target:** v1.4.0
**Status:** Ready for implementation
**Prerequisites:** Investigation complete (see `docs/reference/investigation-pin-window-on-top.md`)

---

## 1. Overview

Add the ability for users to pin any focused window "always on top" so it floats above all other non-pinned windows. The feature integrates with Jumpee's existing menu bar dropdown, global hotkey system, and configuration file.

**Two implementation paths are defined:**
- **Simple Path (Option A):** Direct `CGSSetWindowLevel` call on the target window. Trivial to implement (~80 lines). Uncertain whether macOS allows cross-app window level changes via Jumpee's own CGS connection.
- **Complex Path (Option B):** ScreenCaptureKit overlay that captures the target window and renders it in a Jumpee-owned floating NSWindow. Proven approach used by commercial tools (Floaty, TopWindow). Substantially more code and requires an additional Screen Recording permission.

**Strategy:** Start with a quick feasibility spike for Option A. If it works, proceed with the Simple Path. If it fails, outline Option B for a future plan.

---

## 2. Phase 0: Feasibility Spike (Option A Test)

**Goal:** Determine whether `CGSSetWindowLevel` can change another app's window level when called with Jumpee's own `CGSMainConnectionID()`.

**Time estimate:** 1-2 hours

### Step 0.1: Add Private API Declarations

Add to the top of `Sources/main.swift`, after the existing `@_silgen_name` declarations (after line ~29):

```swift
@_silgen_name("CGSSetWindowLevel")
func CGSSetWindowLevel(_ connection: Int32, _ windowID: CGWindowID, _ level: Int32) -> CGError

@_silgen_name("CGSGetWindowLevel")
func CGSGetWindowLevel(_ connection: Int32, _ windowID: CGWindowID, _ level: UnsafeMutablePointer<Int32>) -> CGError
```

### Step 0.2: Add Temporary Test Function

Add a temporary static function (can be placed inside a temporary `PinTest` class or at the end of the file) that:

1. Gets the focused window via `AXUIElementCreateSystemWide()` + `kAXFocusedApplicationAttribute` + `kAXFocusedWindowAttribute` (existing pattern from `WindowMover`)
2. Gets the `CGWindowID` via `_AXUIElementGetWindow` (already declared in Jumpee)
3. Reads the current level with `CGSGetWindowLevel(CGSMainConnectionID(), windowID, &level)`
4. Sets the level to `3` (kCGFloatingWindowLevel) with `CGSSetWindowLevel(CGSMainConnectionID(), windowID, 3)`
5. Reads the level again to verify the change took effect
6. Logs all results via `NSLog`

### Step 0.3: Wire Test to a Temporary Hotkey or Menu Item

Add a temporary "Test Pin" menu item in `setupMenu()` that calls the test function.

### Step 0.4: Build, Run, and Test

```bash
cd Jumpee && bash build.sh
open build/Jumpee.app
```

Test procedure:
1. Open a standard app window (e.g., Terminal, Safari, TextEdit)
2. Focus that window
3. Trigger the test (via temporary menu item)
4. Check Console.app or terminal for NSLog output
5. Click on other windows -- does the test window remain on top?

### Step 0.5: Evaluate Results

**Success criteria (proceed to Simple Path):**
- `CGSSetWindowLevel` returns `.success` (error code 0)
- The target window visually stays on top when clicking other windows
- The behavior persists across focus changes (clicking other apps)

**Additional tests if initially successful:**
- Test on multiple app windows (Terminal, Safari, Finder, a third-party app)
- Test pinning multiple windows simultaneously
- Test unpinning by setting level back to `0` (kCGNormalWindowLevel)
- Test whether the level persists after switching spaces and back
- Test whether macOS resets the level on any event (app activation, mission control)

**Failure criteria (defer to Complex Path / Option B):**
- `CGSSetWindowLevel` returns a non-zero error code
- Returns success but the window does NOT visually stay on top
- Level resets immediately on the next focus change

### Step 0.6: Clean Up

Remove the temporary test function and menu item regardless of outcome. The real implementation follows in Phase 1.

---

## 3. Phase 1: Simple Path (Option A -- CGSSetWindowLevel)

**Precondition:** Phase 0 spike confirmed that `CGSSetWindowLevel` works for cross-app windows.

**Time estimate:** 4-6 hours

All changes are in `Sources/main.swift`.

### Step 1.1: Private API Declarations (Already Done in Phase 0)

The `CGSSetWindowLevel` and `CGSGetWindowLevel` declarations added in Step 0.1 are kept permanently.

### Step 1.2: Add PinWindowConfig Struct

Add after `MoveWindowConfig` (~line 111):

```swift
// MARK: - Pin Window Config
struct PinWindowConfig: Codable {
    var enabled: Bool
}
```

Follows the exact pattern of `MoveWindowConfig`.

### Step 1.3: Extend JumpeeConfig

Add to `JumpeeConfig` struct (after `moveWindowHotkey`):

```swift
var pinWindow: PinWindowConfig?
var pinWindowHotkey: HotkeyConfig?

var effectivePinWindowHotkey: HotkeyConfig {
    return pinWindowHotkey ?? HotkeyConfig(key: "p", modifiers: ["command", "control"])
}
```

- `pinWindow` is optional for backward compatibility (existing configs without it load fine)
- Default hotkey is Ctrl+Cmd+P (avoids conflict with Cmd+P = Print in most apps)
- The default follows the same exception pattern as `effectiveMoveWindowHotkey` (documented in "Issues - Pending Items.md")

### Step 1.4: Add WindowPinner Static Class

Add after `WindowMover` class (~line 647), before `HotkeySlot`:

```swift
// MARK: - Window Pinner
class WindowPinner {
    private static var pinnedWindows: Set<CGWindowID> = []

    static func togglePin() {
        // 1. Get focused app via AXUIElement (same pattern as WindowMover)
        // 2. Get focused window
        // 3. Get CGWindowID via _AXUIElementGetWindow
        // 4. If already pinned: set level to 0 (kCGNormalWindowLevel), remove from set
        // 5. If not pinned: set level to 3 (kCGFloatingWindowLevel), add to set
        // 6. Log result via NSLog
    }

    static func isPinned(_ windowID: CGWindowID) -> Bool {
        return pinnedWindows.contains(windowID)
    }

    static func unpinAll() {
        for windowID in pinnedWindows {
            let _ = CGSSetWindowLevel(CGSMainConnectionID(), windowID, 0)
        }
        pinnedWindows.removeAll()
    }

    static func cleanupClosedWindows() {
        // Get all visible window IDs via CGWindowListCopyWindowInfo
        // Remove any pinnedWindows entries not in the active list
    }

    static func getFocusedWindowID() -> CGWindowID? {
        // Extract the AXUIElement -> CGWindowID pattern into a reusable method
        // Returns nil if any step fails
    }

    static var pinnedCount: Int {
        return pinnedWindows.count
    }
}
```

**Key implementation details for `togglePin()`:**
- Use `CGSMainConnectionID()` as the connection ID (same as space detection)
- Pin level: `Int32(CGWindowLevelForKey(.floatingWindow))` or literal `3`
- Unpin level: `Int32(CGWindowLevelForKey(.normalWindow))` or literal `0`
- Check `CGSSetWindowLevel` return value; if not `.success`, log error and return without modifying the set
- Call `cleanupClosedWindows()` at the start to prune stale entries

**Key implementation details for `cleanupClosedWindows()`:**
- Use `CGWindowListCopyWindowInfo(.optionAll, kCGNullWindowID)` to get all window IDs
- Extract `kCGWindowNumber` from each dictionary entry
- Remove any entry in `pinnedWindows` not found in the active list

### Step 1.5: Extend HotkeySlot Enum

Add `.pinWindow` case:

```swift
private enum HotkeySlot {
    case dropdown
    case moveWindow
    case pinWindow
}
```

### Step 1.6: Extend hotkeyEventHandler

Add case 3 to the switch statement (~line 674):

```swift
case 3: globalMenuBarController?.togglePinWindow()
```

### Step 1.7: Extend GlobalHotkeyManager

1. Add field: `private var pinWindowHotkeyRef: EventHotKeyRef?`
2. Extend `register()` signature to accept `pinWindowConfig: HotkeyConfig?`
3. Register with `EventHotKeyID(signature: 0x4A4D5045, id: 3)` when config is provided
4. Unregister `pinWindowHotkeyRef` in `unregister()` method

### Step 1.8: Extend MenuBarController

#### 1.8a: Add `togglePinWindow()` Method

Public method called by the hotkey handler:

```swift
func togglePinWindow() {
    WindowPinner.togglePin()
    // Optionally: play NSSound.beep() or show brief feedback
}
```

#### 1.8b: Extend `setupMenu()`

Add two new items in the menu, conditional on `config.pinWindow?.enabled == true`:

1. **"Pin Window on Top" / "Unpin Window"** item (tag 302)
   - Placed near the "Move Window To..." submenu (both are window-management operations)
   - Action: calls `togglePinWindow()`
   - Key equivalent: matches configured hotkey display string

2. **"Pin Window Hotkey: Ctrl+Cmd+P..."** item (tag 303) in the Hotkeys section
   - Action: calls `editHotkey(slot: .pinWindow)`
   - Only visible when `pinWindow.enabled` is true

#### 1.8c: Extend `rebuildSpaceItems()`

Update the pin/unpin menu item text based on the focused window's pin state:
1. Call `WindowPinner.cleanupClosedWindows()` to prune stale entries
2. Get focused window ID via `WindowPinner.getFocusedWindowID()`
3. If pinned: set title to "Unpin Window"
4. If not pinned: set title to "Pin Window on Top"
5. Update hotkey display text for tag 303

**Important edge case:** When the Jumpee menu activates, the focused app may change to Jumpee itself. The pin item should reflect the state of the previously focused window. Use the same approach as the move-window popup pattern -- capture the focused window ID before the menu opens.

#### 1.8d: Extend `editHotkey(slot:)`

Add `.pinWindow` case:
- Current config: `config.effectivePinWindowHotkey`
- Default: `HotkeyConfig(key: "p", modifiers: ["command", "control"])`
- On save: write to `config.pinWindowHotkey`, call `config.save()`, call `reRegisterHotkeys()`
- Conflict check: verify against both dropdown hotkey and move-window hotkey (3-way check)

#### 1.8e: Extend `reRegisterHotkeys()`

Pass pin config to `hotkeyManager`:

```swift
func reRegisterHotkeys() {
    hotkeyManager?.register(
        config: config.effectiveHotkey,
        moveWindowConfig: config.moveWindow?.enabled == true ? config.effectiveMoveWindowHotkey : nil,
        pinWindowConfig: config.pinWindow?.enabled == true ? config.effectivePinWindowHotkey : nil
    )
}
```

#### 1.8f: Extend `quit()`

Call `WindowPinner.unpinAll()` before `NSApp.terminate(nil)` to restore all pinned windows to normal z-order.

### Step 1.9: Build and Test

```bash
cd Jumpee && bash build.sh
```

**Test checklist:**

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | Pin a Terminal window via hotkey (Ctrl+Cmd+P) | Window stays on top when clicking other windows |
| 2 | Unpin the same window via hotkey | Window returns to normal z-order |
| 3 | Pin via menu item "Pin Window on Top" | Same as #1; menu item changes to "Unpin Window" |
| 4 | Unpin via menu item "Unpin Window" | Same as #2; menu item changes to "Pin Window on Top" |
| 5 | Pin multiple windows from different apps | All pinned windows float above non-pinned windows |
| 6 | Close a pinned window | No crash; window silently removed from pinned set |
| 7 | Pin window, switch space, switch back | Window should still be pinned on return |
| 8 | Quit Jumpee with pinned windows | All windows restored to normal z-order |
| 9 | Config: `pinWindow.enabled: false` | No pin menu items, no hotkey registered |
| 10 | Config: absent `pinWindow` key | Same as #9 (backward compatible) |
| 11 | Reload config (Cmd+R) with changed hotkey | New hotkey takes effect immediately |
| 12 | Edit pin hotkey via Hotkeys menu | Dialog works; new hotkey saved and registered |
| 13 | Conflict check: set pin hotkey = dropdown hotkey | Error shown; save rejected |
| 14 | Test on Safari, Finder, TextEdit, a third-party app | Pin works across different app types |
| 15 | Pin a fullscreen window | Graceful failure (no crash; pin may silently no-op) |

### Step 1.10: Update Version and Config Guide

1. Bump version in `build.sh` from 1.3.0 to 1.4.0
2. Update `docs/design/configuration-guide.md` with `pinWindow` and `pinWindowHotkey` fields
3. Update `docs/design/project-design.md` with the new WindowPinner section
4. Update `docs/design/project-functions.md` with new FRs (see Section 6 below)

---

## 4. Phase 2: Complex Path (Option B -- ScreenCaptureKit Overlay)

**Precondition:** Phase 0 spike determined that `CGSSetWindowLevel` does NOT work for cross-app windows.

**This phase is outlined only. Full detailed planning will be done if and when Option A fails.**

### High-Level Architecture

```
User triggers "Pin Window"
        |
        v
WindowPinManager.togglePin()
        |
        +-- Get focused window AXUIElement + CGWindowID
        +-- Find matching SCWindow via SCShareableContent
        +-- Create SCContentFilter for that window
        +-- Start SCStream (capture window content as frames)
        +-- Create FloatingOverlayWindow (NSWindow, level = .floating)
        +-- Render captured frames into overlay via CALayer/IOSurface
        +-- Track original window position via AX observer notifications
        +-- Set overlay to ignoresMouseEvents = true (click-through)
```

### Key Components (Option B)

1. **WindowPinManager** -- Orchestrates pinning/unpinning, manages multiple overlay windows
2. **WindowCaptureStream** -- Wraps SCStream for a single pinned window
3. **FloatingOverlayWindow** -- NSWindow subclass at `.floating` level, click-through
4. **WindowPositionTracker** -- AX observer for `kAXMovedNotification` and `kAXResizedNotification`

### Additional Requirements (Option B)

- **Framework:** Add `-framework ScreenCaptureKit` to `build.sh`
- **Permission:** Screen Recording (new user prompt)
- **Resource usage:** Continuous GPU capture while pinned; stop stream on unpin
- **Click-through:** `ignoresMouseEvents = true` on overlay window
- **Input forwarding:** User interacts with the original window through the click-through overlay
- **Window tracking:** Overlay must follow if user moves/resizes the original window

### Estimated Effort (Option B)

- 400-600 additional lines in `Sources/main.swift`
- 2-3 days implementation + testing
- Separate detailed plan document recommended if this path is needed

---

## 5. Implementation Order Summary

```
Phase 0: Feasibility Spike (1-2 hours)
    |
    +--[SUCCESS]--> Phase 1: Simple Path (4-6 hours)
    |                   |
    |                   +-- Step 1.1: API declarations (done in Phase 0)
    |                   +-- Step 1.2: PinWindowConfig struct
    |                   +-- Step 1.3: JumpeeConfig extension
    |                   +-- Step 1.4: WindowPinner class
    |                   +-- Step 1.5: HotkeySlot extension
    |                   +-- Step 1.6: hotkeyEventHandler extension
    |                   +-- Step 1.7: GlobalHotkeyManager extension
    |                   +-- Step 1.8: MenuBarController extensions
    |                   +-- Step 1.9: Build and test
    |                   +-- Step 1.10: Version bump, docs update
    |
    +--[FAILURE]--> Phase 2: Complex Path (outline only; create plan-007 if needed)
```

---

## 6. New Functional Requirements

The following FRs will be added to `docs/design/project-functions.md`:

- **FR-34: Pin Focused Window on Top** -- Toggle the focused window to float above all non-pinned windows.
- **FR-35: Unpin a Pinned Window** -- Restore a pinned window to normal z-order.
- **FR-36: Multiple Pinned Windows** -- Support pinning multiple windows simultaneously.
- **FR-37: Pin State Tracking** -- Track pinned windows in-memory by CGWindowID. Not persisted across restarts.
- **FR-38: Pin Toggle Semantics** -- If focused window is pinned, unpin it; if not pinned, pin it.
- **FR-39: Graceful Handling of Closed Pinned Windows** -- Silently remove closed windows from the pinned set.
- **FR-40: Pin Window Configuration** -- `pinWindow.enabled` in config controls feature availability.
- **FR-41: Pin Window Global Hotkey** -- Configurable hotkey (default Ctrl+Cmd+P) toggles pin on focused window.
- **FR-42: Pin/Unpin Menu Item** -- Menu item toggles between "Pin Window on Top" and "Unpin Window" based on focused window state.
- **FR-43: Pin Window Hotkey Editor** -- Hotkey editor dialog for the pin-window hotkey in the Hotkeys menu section.
- **FR-44: Pin Cleanup on Quit** -- All pinned windows restored to normal z-order when Jumpee quits.

---

## 7. Configuration Changes

### New Config Keys

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

### Config Behavior

| Scenario | Behavior |
|----------|----------|
| `pinWindow` absent | Feature disabled (backward compatible) |
| `pinWindow.enabled: false` | Feature disabled, no menu items or hotkey |
| `pinWindow.enabled: true`, `pinWindowHotkey` absent | Feature enabled, default Ctrl+Cmd+P |
| `pinWindow.enabled: true`, `pinWindowHotkey` present | Feature enabled, custom hotkey |

### Default Hotkey Exception

The default value for `pinWindowHotkey` (Ctrl+Cmd+P) follows the same exception pattern as `moveWindowHotkey` (Cmd+M). This exception to the "no default fallback" rule must be recorded in "Issues - Pending Items.md" before implementation.

---

## 8. Menu Layout After v1.4.0

```
About Jumpee...
Jumpee (bold header, disabled)
---
Desktops:
  [display header, if multi-display]
  [dynamic space items with Cmd+1-9]
  Rename Current Desktop...         Cmd+N        tag=200
  Move Window To... >               [submenu]    (if moveWindow.enabled)
  Pin Window on Top                 Ctrl+Cmd+P   tag=302  (if pinWindow.enabled)
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

---

## 9. Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| `CGSSetWindowLevel` does not work cross-app | HIGH | Phase 0 spike tests this first; Complex Path (Option B) is the fallback |
| macOS resets window level on focus change | MEDIUM | If detected in spike, add a periodic timer to re-assert level for pinned windows |
| macOS resets window level on space switch | MEDIUM | Re-assert levels in `spaceDidChange()` handler |
| Private API removed in future macOS | MEDIUM | Feature-gated via `pinWindow.enabled`; graceful failure (log + no-op) |
| Ctrl+Cmd+P conflicts with some app | LOW | Fully configurable via hotkey editor; Ctrl+Cmd combination is rarely used |
| Pin state not persisted across restarts | LOW | Intentional design decision; documented in requirements |
| Menu item shows wrong pin state (focus changes to Jumpee on menu open) | MEDIUM | Capture focused window ID before menu activation, same pattern as move-window popup |

---

## 10. Files Modified

| File | Change |
|------|--------|
| `Sources/main.swift` | All code changes (API declarations, config struct, WindowPinner class, hotkey integration, menu items) |
| `build.sh` | Version bump to 1.4.0 |
| `docs/design/project-design.md` | Add WindowPinner section |
| `docs/design/project-functions.md` | Add FR-34 through FR-44 |
| `docs/design/configuration-guide.md` | Add `pinWindow` and `pinWindowHotkey` documentation |
| `Issues - Pending Items.md` | Record default hotkey exception for `pinWindowHotkey` |
