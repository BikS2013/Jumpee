# Technical Design: Move Window to Desktop Feature

**Date:** 2026-04-10
**Status:** Ready for Implementation
**Implements:** plan-004-window-move-feature.md (Phase 1)
**Target File:** `Sources/main.swift` (single-file app, currently 917 lines)

---

## 1. Summary

This design adds "move focused window to Desktop N" capability to Jumpee using synthesized macOS system keyboard shortcuts (Ctrl+Shift+N). The feature adds approximately 100 lines to `main.swift`, introduces one new class (`WindowMover`), one new config struct (`MoveWindowConfig`), a submenu in the Jumpee dropdown, and a setup-guidance menu item.

No CGS private APIs are used for the move operation. The approach relies exclusively on CGEvent synthesis of the macOS built-in "Move window to Desktop N" shortcuts, which the user must enable in System Settings.

---

## 2. New Code Components

### 2.1 WindowMover Class

**Location in main.swift:** Insert after the `SpaceNavigator` class (after line 484, before the `// MARK: - Global Hotkey Manager` section at line 486).

**MARK header:** `// MARK: - Window Mover`

```swift
// MARK: - Window Mover

class WindowMover {

    /// Move the focused window to the given desktop by synthesizing the macOS
    /// "Move window to Desktop N" system shortcut (Ctrl+Shift+N).
    ///
    /// Requires the user to have enabled "Move window to Desktop N" shortcuts
    /// in System Settings > Keyboard > Keyboard Shortcuts > Mission Control.
    ///
    /// - Parameter index: 1-based global desktop position (1 through 9).
    ///   Matches the global numbering used by SpaceNavigator.navigateToSpace(index:).
    static func moveToSpace(index: Int) {
        guard index >= 1 && index <= 9 else { return }
        let keyCode = SpaceNavigator.keyCodeForNumber(index)
        let source = CGEventSource(stateID: .hidSystemState)

        if let keyDown = CGEvent(keyboardEventSource: source,
                                 virtualKey: CGKeyCode(keyCode), keyDown: true) {
            keyDown.flags = [.maskControl, .maskShift]
            keyDown.post(tap: .cghidEventTap)
        }
        if let keyUp = CGEvent(keyboardEventSource: source,
                                virtualKey: CGKeyCode(keyCode), keyDown: false) {
            keyUp.flags = [.maskControl, .maskShift]
            keyUp.post(tap: .cghidEventTap)
        }
    }

    /// Check whether the macOS "Move window to Desktop N" system shortcuts
    /// appear to be enabled by reading com.apple.symbolichotkeys.plist.
    ///
    /// Checks plist key 52 ("Move window to Desktop 1") as a representative
    /// shortcut. If this key is enabled, we assume all move-window shortcuts
    /// are configured.
    ///
    /// - Returns: `true` if the shortcut is enabled, `false` if disabled,
    ///   absent, or unreadable.
    ///
    /// - Note: The plist key number 52 is based on community documentation.
    ///   It must be verified on the target macOS version by enabling the
    ///   shortcut in System Settings and inspecting the plist diff.
    ///   See plan-004 Section 8.2 for the verification procedure.
    static func areSystemShortcutsEnabled() -> Bool {
        let prefsURL = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Preferences/com.apple.symbolichotkeys.plist")

        guard let data = try? Data(contentsOf: prefsURL),
              let plist = try? PropertyListSerialization.propertyList(
                  from: data, format: nil) as? [String: Any],
              let hotkeys = plist["AppleSymbolicHotKeys"] as? [String: Any] else {
            return false
        }

        // Key 52 = "Move window to Desktop 1" (community-sourced, needs verification)
        guard let entry = hotkeys["52"] as? [String: Any] else {
            return false  // Key absent = shortcut never configured
        }

        return (entry["enabled"] as? Bool) == true
    }
}
```

**Key design decisions:**

1. **Static methods only** -- mirrors the `SpaceNavigator` pattern. No instance state needed.
2. **Reuses `SpaceNavigator.keyCodeForNumber(_:)`** -- requires changing its access level from `private` to package-level (see Section 3.1).
3. **No CGS APIs** -- the move is handled entirely by the OS when it receives the synthesized shortcut.
4. **Guard on index range** -- prevents synthesizing invalid key events for positions > 9 or < 1.

---

### 2.2 MoveWindowConfig Struct

**Location in main.swift:** Insert after the `HotkeyConfig` struct (after line 89, before `struct JumpeeConfig`).

```swift
struct MoveWindowConfig: Codable {
    /// Whether the move-window feature is enabled.
    /// When false, the "Move Window To..." submenu is hidden.
    var enabled: Bool

    // No followWindow toggle -- macOS 15+ always follows the window.
    // No hotkeyModifiers -- Phase 1 uses menu-only invocation.
    // Phase 2 may add global hotkey configuration here.
}
```

**Design rationale:**

- Minimal for Phase 1: only `enabled` is needed.
- No `followWindow` field: macOS 15+ forces following. Including it would be misleading.
- No `hotkeyModifiers` field: Phase 1 is menu-only. Phase 2 (global Ctrl+Cmd+1-9 hotkeys) can add this later.
- No default value: the field is optional on `JumpeeConfig` (see below).

---

### 2.3 JumpeeConfig Extension

**Location in main.swift:** Modify the existing `JumpeeConfig` struct (lines 91-122).

**Change:** Add an optional `moveWindow` property.

```swift
struct JumpeeConfig: Codable {
    var spaces: [String: String]
    var showSpaceNumber: Bool
    var overlay: OverlayConfig
    var hotkey: HotkeyConfig
    var moveWindow: MoveWindowConfig?  // NEW -- optional for backward compat

    // ... existing static properties and methods unchanged ...
}
```

**Backward compatibility:** The `moveWindow` key is optional (`MoveWindowConfig?`). Existing config files that lack this key will decode successfully with `moveWindow == nil`. When `nil`, the feature is disabled and no submenu appears.

**Default when creating fresh config (in `load()` fallback):** `moveWindow` is not included in the default config. The user must explicitly add `"moveWindow": { "enabled": true }` or use the setup flow.

---

## 3. Modifications to Existing Code

### 3.1 SpaceNavigator.keyCodeForNumber -- Access Level Change

**Current (line 470):**
```swift
private static func keyCodeForNumber(_ n: Int) -> Int {
```

**New:**
```swift
static func keyCodeForNumber(_ n: Int) -> Int {
```

**Rationale:** `WindowMover.moveToSpace(index:)` must call this method. Since all code lives in `main.swift`, removing `private` makes it accessible file-wide. No behavioral change.

---

### 3.2 MenuBarController -- Move Window Submenu

**Location:** Inside `rebuildSpaceItems()` (line 680), after the "Rename Current Desktop..." item is added (after line 770).

**New code to insert:** Add a "Move Window To..." submenu and a "Set Up Window Moving..." item.

```swift
// --- Move Window submenu (after the Rename item) ---

// Only show if moveWindow feature is enabled in config
if config.moveWindow?.enabled == true {
    insertIndex += 1  // skip past Rename item

    let moveSubmenuItem = NSMenuItem(title: "Move Window To...", action: nil,
                                      keyEquivalent: "")
    let moveSubmenu = NSMenu()

    // Add a destination item for each desktop on the active display,
    // excluding the current desktop
    for display in displays {
        let isActiveDisplay = display.displayID == activeDisplayID
        guard isActiveDisplay else { continue }

        for space in display.spaces {
            if space.spaceID == currentSpaceID { continue }  // skip current

            let key = String(space.spaceID)
            let customName = config.spaces[key]
            let displayName: String
            if let name = customName, !name.isEmpty {
                displayName = "Desktop \(space.localPosition) - \(name)"
            } else {
                displayName = "Desktop \(space.localPosition)"
            }

            // Shift+Cmd+N as keyboard equivalent (active only when menu is open)
            let keyEquiv = space.localPosition <= 9
                ? String(space.localPosition) : ""
            let moveItem = NSMenuItem(title: displayName,
                                       action: #selector(moveWindowToSpace(_:)),
                                       keyEquivalent: keyEquiv)
            moveItem.keyEquivalentModifierMask = [.command, .shift]
            moveItem.target = self
            moveItem.tag = space.globalPosition
            moveSubmenu.addItem(moveItem)
        }
    }

    moveSubmenuItem.submenu = moveSubmenu
    menu.insertItem(moveSubmenuItem, at: insertIndex)
    spaceMenuItems.append(moveSubmenuItem)
}

// "Set Up Window Moving..." item -- always shown when feature is enabled
// or when it hasn't been configured yet
if config.moveWindow?.enabled == true || config.moveWindow == nil {
    insertIndex += 1
    let setupItem = NSMenuItem(title: "Set Up Window Moving...",
                                action: #selector(showMoveWindowSetup),
                                keyEquivalent: "")
    setupItem.target = self
    // Only show if shortcuts are NOT enabled (acts as guidance trigger)
    if config.moveWindow?.enabled == true
        && WindowMover.areSystemShortcutsEnabled() {
        // Shortcuts already enabled -- hide the setup item
    } else {
        menu.insertItem(setupItem, at: insertIndex)
        spaceMenuItems.append(setupItem)
    }
}
```

**Menu layout when feature is enabled:**

```
Jumpee
---
Desktops:
  * Desktop 1 - Development     Cmd+1
    Desktop 2 - Terminal         Cmd+2
    Desktop 3                    Cmd+3
  Rename Current Desktop...      Cmd+N
  Move Window To...            >
    Desktop 2 - Terminal         Shift+Cmd+2
    Desktop 3                    Shift+Cmd+3
---
Hide Space Number
...
```

---

### 3.3 MenuBarController -- Move Action Handler

**Location:** After `navigateToSpace(_:)` (after line 813).

```swift
/// Handle "Move Window To > Desktop N" submenu selection.
/// Closes the menu, waits for the previously-focused app to regain focus,
/// then synthesizes the Ctrl+Shift+N system shortcut.
@objc private func moveWindowToSpace(_ sender: NSMenuItem) {
    let targetGlobalPosition = sender.tag
    statusItem.menu?.cancelTracking()

    // Wait 300ms for Jumpee's menu to close and the target app to regain focus.
    // This is the same delay used by navigateToSpace(_:) and is proven reliable.
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
        WindowMover.moveToSpace(index: targetGlobalPosition)
    }
}
```

**Design notes:**
- The 300ms delay matches the existing `navigateToSpace(_:)` pattern (line 809).
- After the move, macOS switches to the target desktop automatically, which fires `activeSpaceDidChangeNotification`, triggering the standard `spaceDidChange()` handler. The overlay and menu bar title update automatically.

---

### 3.4 MenuBarController -- Setup Guidance Handler

**Location:** After the move action handler (directly after `moveWindowToSpace(_:)`).

```swift
/// Show a setup dialog guiding the user to enable "Move window to Desktop N"
/// shortcuts in System Settings.
@objc private func showMoveWindowSetup() {
    let alert = NSAlert()
    alert.messageText = "Set Up Window Moving"

    if WindowMover.areSystemShortcutsEnabled() {
        alert.informativeText = """
            The "Move window to Desktop N" shortcuts are enabled. \
            You can move windows using the Jumpee menu \
            (Move Window To... submenu).
            """
        alert.addButton(withTitle: "OK")
        NSApp.activate(ignoringOtherApps: true)
        alert.runModal()
        return
    }

    alert.informativeText = """
        To move windows between desktops, enable the \
        "Move window to Desktop N" keyboard shortcuts in macOS:

        1. Open System Settings > Keyboard > Keyboard Shortcuts
        2. Select "Mission Control" in the left panel
        3. Enable checkboxes for "Move window to Desktop 1" \
        through "Move window to Desktop 9"
        4. Ensure key combinations are Ctrl+Shift+1 through Ctrl+Shift+9

        After enabling, add this to your ~/.Jumpee/config.json:
        "moveWindow": { "enabled": true }
        """
    alert.addButton(withTitle: "Open System Settings")
    alert.addButton(withTitle: "Cancel")

    NSApp.activate(ignoringOtherApps: true)
    let response = alert.runModal()

    if response == .alertFirstButtonReturn {
        if let url = URL(string:
            "x-apple.systempreferences:com.apple.preference.keyboard?Shortcuts") {
            NSWorkspace.shared.open(url)
        }
    }
}
```

---

## 4. Integration Points Map

This table maps each new component to its exact insertion location within the existing MARK sections of `main.swift`.

| New Component | Insert After | MARK Section | Approximate Line |
|---|---|---|---|
| `MoveWindowConfig` struct | `HotkeyConfig` struct closing brace | `// MARK: - Configuration` | After line 89 |
| `moveWindow: MoveWindowConfig?` property | `hotkey: HotkeyConfig` line in `JumpeeConfig` | `// MARK: - Configuration` | After line 95 |
| `keyCodeForNumber` access change | Existing method | `// MARK: - Space Navigation` | Line 470 |
| `WindowMover` class | `SpaceNavigator` class closing brace | New `// MARK: - Window Mover` | After line 484 |
| Move submenu code in `rebuildSpaceItems()` | "Rename Current Desktop..." insertion | `// MARK: - Menu Bar Controller` | After line 770 |
| `moveWindowToSpace(_:)` handler | `navigateToSpace(_:)` method | `// MARK: - Menu Bar Controller` | After line 813 |
| `showMoveWindowSetup()` handler | `moveWindowToSpace(_:)` method | `// MARK: - Menu Bar Controller` | After moveWindowToSpace |

---

## 5. Configuration Schema

### 5.1 Phase 1 Config Addition

```json
{
    "spaces": { "42": "Development", "15": "Terminal" },
    "showSpaceNumber": true,
    "overlay": { ... },
    "hotkey": { ... },
    "moveWindow": {
        "enabled": true
    }
}
```

### 5.2 Backward Compatibility

- `moveWindow` is optional in `JumpeeConfig`. If absent, the feature is disabled.
- Existing config files without `moveWindow` continue to work without modification.
- The `JumpeeConfig.load()` fallback (fresh config creation) does not include `moveWindow`.

### 5.3 Phase 2 Config Extension (Future)

```json
{
    "moveWindow": {
        "enabled": true,
        "hotkeyModifiers": ["control", "command"]
    }
}
```

Phase 2 adds `hotkeyModifiers` for global Ctrl+Cmd+1-9 hotkeys. This is documented here for forward-planning but is NOT implemented in Phase 1.

---

## 6. Complete Method Signatures

### 6.1 WindowMover

```swift
class WindowMover {
    /// Synthesize Ctrl+Shift+N to move the focused window to Desktop N.
    /// - Parameter index: 1-based global desktop position (1-9).
    static func moveToSpace(index: Int) -> Void

    /// Check if "Move window to Desktop 1" shortcut is enabled in system prefs.
    /// - Returns: true if enabled, false otherwise.
    static func areSystemShortcutsEnabled() -> Bool
}
```

### 6.2 MoveWindowConfig

```swift
struct MoveWindowConfig: Codable {
    var enabled: Bool
}
```

### 6.3 JumpeeConfig (modified)

```swift
struct JumpeeConfig: Codable {
    var spaces: [String: String]
    var showSpaceNumber: Bool
    var overlay: OverlayConfig
    var hotkey: HotkeyConfig
    var moveWindow: MoveWindowConfig?  // NEW
    // ... existing static properties and methods unchanged ...
}
```

### 6.4 SpaceNavigator (modified)

```swift
class SpaceNavigator {
    static func navigateToSpace(index: Int) -> Void
    static func checkAccessibility() -> Void
    static func keyCodeForNumber(_ n: Int) -> Int  // was private, now file-scope
}
```

### 6.5 MenuBarController (new methods)

```swift
extension MenuBarController {
    /// Handle Move Window To > Desktop N submenu selection.
    @objc private func moveWindowToSpace(_ sender: NSMenuItem) -> Void

    /// Show setup guidance dialog for enabling system shortcuts.
    @objc private func showMoveWindowSetup() -> Void
}
```

---

## 7. UX Flow

### 7.1 Normal Move Operation

1. User presses Cmd+J (or clicks menu bar) to open Jumpee menu.
2. Menu shows "Move Window To..." submenu (only when `moveWindow.enabled == true`).
3. User opens submenu, sees all desktops on the active display except the current one.
4. User clicks "Desktop 3" (or presses Shift+Cmd+3 while menu is open).
5. Jumpee calls `moveWindowToSpace(_:)`:
   a. Cancels menu tracking.
   b. Waits 300ms for the previously-focused app to regain focus.
   c. Calls `WindowMover.moveToSpace(index: 3)`.
6. macOS moves the focused window to Desktop 3 and switches view to Desktop 3.
7. `activeSpaceDidChangeNotification` fires.
8. Overlay and menu bar title update to show Desktop 3's name.

### 7.2 First-Run / Setup Flow

1. User adds `"moveWindow": { "enabled": true }` to config (or config is absent).
2. On next menu open, "Set Up Window Moving..." appears if shortcuts are not detected.
3. User clicks it, sees guidance dialog.
4. Clicks "Open System Settings" -- macOS Keyboard Shortcuts pane opens.
5. User enables "Move window to Desktop 1" through "Move window to Desktop 9".
6. Returns to Jumpee; on next menu open, "Set Up Window Moving..." disappears and the "Move Window To..." submenu appears.

### 7.3 Keyboard Shortcut Summary (When Menu Is Open)

| Shortcut | Action |
|---|---|
| Cmd+1 through Cmd+9 | Navigate to Desktop N (existing) |
| Shift+Cmd+1 through Shift+Cmd+9 | Move focused window to Desktop N (new) |
| Cmd+N | Rename current desktop (existing) |
| Cmd+, | Open config file (existing) |
| Cmd+R | Reload config (existing) |
| Cmd+Q | Quit (existing) |

---

## 8. Visual Feedback

No additional visual feedback mechanism is needed. The existing `activeSpaceDidChangeNotification` handler fires when the OS switches to the target desktop (which always happens when a window is moved via system shortcut). This triggers:

- Menu bar title update (shows target desktop's name).
- Overlay update (shows target desktop's watermark).

These provide implicit confirmation that the move succeeded and the user is now on the target desktop.

---

## 9. Edge Cases

| Edge Case | Behavior | Handling |
|---|---|---|
| Fullscreen window | macOS silently ignores the Ctrl+Shift+N shortcut | No special handling needed |
| "Assign to All Desktops" window | macOS silently ignores the shortcut | No special handling needed |
| System windows (Finder desktop, menu bar) | Cannot be focused; shortcut has no effect | No crash risk |
| Jumpee menu steals focus | 300ms delay after `cancelTracking()` restores focus to target app | Same proven pattern as `navigateToSpace(_:)` |
| Target desktop is current desktop | Current desktop omitted from submenu | Cannot trigger a no-op move |
| Fewer desktops than 9 | Submenu only shows existing desktops | No invalid shortcuts generated |
| Shortcuts not enabled in System Settings | Ctrl+Shift+N is silently ignored by macOS | "Set Up Window Moving..." guides user |
| `moveWindow` key absent from config | Feature disabled, no submenu shown | Backward compatible |
| `moveWindow.enabled` is false | Feature disabled, no submenu shown | Explicit disable |
| Multi-display: move to desktop on active display | Works correctly; globalPosition maps to Ctrl+N numbering | Same numbering as navigation |
| Slow machine: 300ms insufficient | Unlikely (same delay works for navigation) | Can be made configurable in Phase 2 |

---

## 10. Lines of Code Estimate

| Component | Estimated Lines |
|---|---|
| `MoveWindowConfig` struct | 5 |
| `JumpeeConfig` modification | 1 |
| `SpaceNavigator.keyCodeForNumber` access change | 1 (word removed) |
| `WindowMover` class | 40 |
| Move submenu in `rebuildSpaceItems()` | 35 |
| `moveWindowToSpace(_:)` handler | 10 |
| `showMoveWindowSetup()` handler | 30 |
| **Total new/modified lines** | **~120** |

The file grows from ~917 lines to ~1037 lines.

---

## 11. Testing Checklist

Before implementation, the plist key numbers must be verified (plan-004 Section 8.2):

```bash
# Step 1: Capture current state
defaults read com.apple.symbolichotkeys AppleSymbolicHotKeys > /tmp/before.plist

# Step 2: In System Settings, enable "Move window to Desktop 1"

# Step 3: Capture new state
defaults read com.apple.symbolichotkeys AppleSymbolicHotKeys > /tmp/after.plist

# Step 4: Diff to find the exact key number
diff /tmp/before.plist /tmp/after.plist
```

### Manual Test Cases

| # | Test | Expected |
|---|---|---|
| 1 | Enable shortcuts; open Safari on Desktop 1; Jumpee > Move Window To > Desktop 2 | Safari moves to Desktop 2; view switches to Desktop 2 |
| 2 | Same test with shortcuts NOT enabled | "Set Up Window Moving..." guidance shown |
| 3 | Move window from Desktop 3 to Desktop 1 | Window appears on Desktop 1; view switches |
| 4 | Attempt to move fullscreen window | Nothing happens (silent no-op) |
| 5 | Multi-display: move window on Display A to Display A Desktop 3 | Window moves to Desktop 3 on Display A |
| 6 | Verify overlay updates after move | Overlay shows target desktop name |
| 7 | Verify menu bar title updates after move | Title shows target desktop name |
| 8 | Config without `moveWindow` key | Feature disabled; no submenu |
| 9 | `"moveWindow": { "enabled": false }` | Feature disabled; no submenu |
| 10 | Use Shift+Cmd+N keyboard equivalent in open menu | Works same as clicking submenu item |

---

## 12. Dependencies

| Dependency | Status | Notes |
|---|---|---|
| v1.1 multi-display support | Implemented | Provides `getSpacesByDisplay()`, `globalPosition`, per-display menu rendering |
| "Move window to Desktop N" system shortcuts | User must enable | One-time setup; same class of requirement as existing "Switch to Desktop N" shortcuts |
| Accessibility permissions | Already granted | Required for CGEvent posting (existing requirement) |
| `keyCodeForNumber(_:)` shared access | Minor refactor | Change `private` to file-scope (remove `private` keyword) |

---

## 13. What Is NOT Included (Phase 2+)

The following are explicitly deferred to future phases:

1. **Global hotkeys (Ctrl+Cmd+1-9)** -- Requires extending `GlobalHotkeyManager` to register multiple `EventHotKeyID` entries and routing by ID in the handler callback. Phase 2.
2. **Move Left/Right One Space** -- Synthesize Ctrl+Shift+Left/Right arrow keys. Phase 2.
3. **Cross-display window movement** -- Move a window to a desktop on a different display. Phase 3.
4. **CGS private API fallback** -- Not implemented. System shortcuts are the sole mechanism. See plan-004 Section 2 for rationale.
5. **Amethyst-style mouse drag simulation** -- Rejected. See plan-004 Section 2.4.
6. **Configurable delay** -- The 300ms delay is hardcoded. Can be made configurable if edge cases arise.
