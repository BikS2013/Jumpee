# Plan 004: Move Window to Desktop Feature

**Date:** 2026-04-10
**Status:** Proposed (Feasibility Study + Implementation Plan)
**Type:** New Feature
**Priority:** Medium
**Depends on:** v1.1 multi-display support (plan-003)

---

## 1. Executive Summary

### Can Jumpee move windows between desktops?

**YES -- with important constraints.**

Jumpee can add a "move focused window to Desktop N" capability using **synthesized macOS system keyboard shortcuts**. This is the only reliable approach on macOS 15+ (Sequoia) and forward. The CGS private APIs that tools like yabai and Amethyst historically used for this purpose are **broken on macOS 15+** due to Apple adding connection-rights checks to the WindowServer.

### Recommended Approach

**Synthesized system shortcuts (Ctrl+Shift+N)** as the primary and only mechanism. This:
- Works on all macOS versions (13+)
- Uses the same CGEvent synthesis pattern Jumpee already uses for space navigation
- Requires no private APIs beyond what Jumpee already uses
- Is forward-compatible with macOS 26 (Tahoe) and beyond
- Requires ~30 lines of new code for the core move operation

### Key Constraint

The user must enable "Move window to Desktop N" shortcuts in **System Settings > Keyboard > Keyboard Shortcuts > Mission Control**. These are disabled by default. This is the same class of requirement Jumpee already has for "Switch to Desktop N" shortcuts.

### Unavoidable Behavior on macOS 15+

On macOS 15 (Sequoia) and later, **all** approaches to moving a window between spaces force the user to follow the window to the target space. The "move without following" behavior is only possible on macOS 13-14 using CGS private APIs, which are broken on newer versions. This is confirmed by the BetterTouchTool developer (January 2026) and by the behavior of every major window manager (yabai, Amethyst, Hammerspoon).

---

## 2. Why NOT Use CGS Private APIs

The initial investigation (see `docs/reference/investigation-window-move.md`) evaluated a tiered strategy with CGS APIs as the primary mechanism. After deep research (see `docs/reference/research-cgs-apis-macos15.md` and `docs/reference/research-amethyst-aerospace.md`), this plan **inverts the priority** and recommends system shortcuts as the sole mechanism. Here is why:

### 2.1 CGS APIs Are Broken on macOS 15+

| macOS Version | CGS Move Status |
|---------------|----------------|
| 13 Ventura | Works |
| 14.0-14.4 Sonoma | Works |
| 14.5 Sonoma | Works (add-before-remove ordering required) |
| 15.0+ Sequoia | **Broken** -- silent no-op or CGError 717863 |
| 26 Tahoe | **Broken** -- same restriction carried forward |

**Root cause:** Apple added a `connection_holds_rights_on_window` check to the space-assignment functions in the WindowServer. Only the process that owns a window (or Dock.app, which has universal owner rights) can reassign it to a different space. Jumpee's connection has no rights over other apps' windows.

### 2.2 CGS "Move Without Following" Is Dead

Even if CGS APIs worked, macOS 15+ forces a space switch when a window is moved. The "move window silently to another space while staying on the current space" behavior no longer exists on modern macOS. Since the system shortcut approach also switches spaces, there is **no UX advantage** to CGS APIs on macOS 15+.

### 2.3 CGS Adds Complexity for a Shrinking User Base

Supporting CGS APIs only benefits users on macOS 13-14 who want "move without following." This is a shrinking population. Adding ~80 lines of CGS code, failure detection via `CGSCopySpacesForWindows`, and a fallback path increases maintenance burden disproportionately to the benefit.

### 2.4 Amethyst's Workaround Is Too Fragile for Jumpee

Amethyst 0.22.0 introduced a mouse-drag simulation workaround for Sequoia (simulate grabbing the window's title bar, then fire a space-switch shortcut while dragging). This works but:
- Moves the user's mouse cursor to the window's title bar
- Has hardcoded timing delays (50ms + 400ms) that may fail on slow machines
- Requires finding the minimize button position via Accessibility API
- Produces visible cursor movement
- Is fragile across different app window styles (Amethyst 0.23.0 was a fix release for apps that failed with 0.22.0)

This level of fragility is inappropriate for Jumpee's lightweight design philosophy.

### 2.5 Decision

**Use system shortcut synthesis exclusively.** No CGS fallback. No drag simulation.

The optional Tier 2 (CGS for legacy macOS) from the initial investigation is **dropped**. Users on macOS 13-14 get the same system-shortcut approach, which works perfectly on those versions too. The only feature lost is "move without following" on macOS 13-14, which is a niche preference.

---

## 3. Technical Approach: Synthesized System Shortcuts

### 3.1 How It Works

macOS provides built-in "Move window to Desktop N" keyboard shortcuts. When enabled, pressing Ctrl+Shift+1 moves the frontmost window to Desktop 1 (and switches to that desktop). Jumpee synthesizes this keystroke via `CGEvent`, exactly as it already does for space navigation.

### 3.2 Core Implementation

The implementation mirrors the existing `SpaceNavigator.navigateToSpace(index:)` with an added `.maskShift` modifier:

```swift
// In SpaceNavigator (or new WindowMover class)
static func moveWindowToSpace(index: Int) {
    let keyCode = keyCodeForNumber(index)
    let source = CGEventSource(stateID: .hidSystemState)
    
    if let keyDown = CGEvent(keyboardEventSource: source, virtualKey: CGKeyCode(keyCode), keyDown: true) {
        keyDown.flags = [.maskControl, .maskShift]
        keyDown.post(tap: .cghidEventTap)
    }
    if let keyUp = CGEvent(keyboardEventSource: source, virtualKey: CGKeyCode(keyCode), keyDown: false) {
        keyUp.flags = [.maskControl, .maskShift]
        keyUp.post(tap: .cghidEventTap)
    }
}
```

This reuses the existing `keyCodeForNumber(_:)` mapping (which handles the non-sequential key codes for digits 5-9).

### 3.3 Shortcut Detection

Jumpee should detect whether the "Move window to Desktop N" shortcuts are enabled by reading `com.apple.symbolichotkeys.plist`:

```swift
func areMoveWindowShortcutsEnabled() -> Bool {
    let prefsURL = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Preferences/com.apple.symbolichotkeys.plist")
    
    guard let data = try? Data(contentsOf: prefsURL),
          let plist = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any],
          let hotkeys = plist["AppleSymbolicHotKeys"] as? [String: Any] else {
        return false
    }
    
    // Check representative shortcut: key 52 = Move window to Desktop 1
    // NOTE: The exact plist key number (52) needs verification on the target
    // macOS version by inspecting the plist after enabling the shortcut.
    guard let entry = hotkeys["52"] as? [String: Any] else {
        return false
    }
    return (entry["enabled"] as? Bool) == true
}
```

**Important uncertainty:** The plist key numbers for "Move window to Desktop N" (believed to be 52, 54, 56, 58, 60, 62, 64, 66, 68) have conflicting community documentation. The first implementation task must **verify these key numbers** by manually enabling the shortcut in System Settings and inspecting the plist diff.

### 3.4 Focus Handling

When the user triggers a move from the Jumpee menu, Jumpee's menu has focus -- not the target window. The sequence must:

1. Record the target desktop index from the menu selection
2. Cancel menu tracking (`statusItem.menu?.cancelTracking()`)
3. Wait ~300ms for the menu to close and the previously-focused app to regain focus
4. Synthesize the Ctrl+Shift+N keystroke

This mirrors the existing `navigateToSpace(_:)` pattern in `MenuBarController`.

### 3.5 Move+Follow Is the Only Behavior

Since macOS 15+ forces following the window, and system shortcuts always switch spaces, **there is no "stay on current desktop" option**. The config should not offer a `followWindow` toggle -- it would be misleading. Instead, the behavior is documented as: "moves the window and switches to the target desktop."

---

## 4. Integration Points with Existing Code

### 4.1 New Class: WindowMover

Create a new `WindowMover` class following the `SpaceNavigator` pattern (static methods, no state):

```swift
// MARK: - Window Mover

class WindowMover {
    /// Move the focused window to the given desktop via system shortcut synthesis.
    /// Requires "Move window to Desktop N" shortcuts enabled in System Settings.
    /// - Parameter index: 1-based global desktop position (matches Ctrl+N numbering)
    static func moveToSpace(index: Int) {
        let keyCode = SpaceNavigator.keyCodeForNumber(index)
        let source = CGEventSource(stateID: .hidSystemState)
        
        if let keyDown = CGEvent(keyboardEventSource: source, virtualKey: CGKeyCode(keyCode), keyDown: true) {
            keyDown.flags = [.maskControl, .maskShift]
            keyDown.post(tap: .cghidEventTap)
        }
        if let keyUp = CGEvent(keyboardEventSource: source, virtualKey: CGKeyCode(keyCode), keyDown: false) {
            keyUp.flags = [.maskControl, .maskShift]
            keyUp.post(tap: .cghidEventTap)
        }
    }
    
    /// Check if the system "Move window to Desktop N" shortcuts appear to be enabled.
    static func areSystemShortcutsEnabled() -> Bool {
        // Implementation per section 3.3
    }
}
```

**Note:** `SpaceNavigator.keyCodeForNumber(_:)` is currently `private`. It must be changed to `static func` (package-level access within the single file) or the mapping must be shared via a utility.

**Location:** Insert after the `SpaceNavigator` class (after the current `// MARK: - Space Navigator` section, around line 484).

### 4.2 Configuration Extension

Add to `JumpeeConfig`:

```swift
struct MoveWindowConfig: Codable {
    var enabled: Bool
    var hotkeyModifiers: [String]  // Modifiers for the global move hotkeys
    var hotkeyKey: String          // Base key for global hotkey (not used in v1.0 -- reserved)
    
    // No followWindow toggle -- macOS 15+ always follows.
    // No useSystemShortcuts toggle -- system shortcuts are the only mechanism.
}
```

And in `JumpeeConfig`:

```swift
var moveWindow: MoveWindowConfig?  // Optional for backward compat with existing configs
```

**Default when absent:** Feature disabled. User must explicitly add `"moveWindow": { "enabled": true }` to config or use a setup flow.

### 4.3 Menu Integration

In `MenuBarController.rebuildSpaceItems()`, add "Move Window to..." items. Two options:

**Option A: Submenu (recommended)**

Add a "Move Window To..." submenu that lists all desktops on the active display:

```
Jumpee
---
Desktops:
  * Desktop 1 - Development     Cmd+1
    Desktop 2 - Terminal         Cmd+2
    Desktop 3                    Cmd+3
  Rename Current Desktop...      Cmd+N
  Move Window To...            >
    Desktop 1 - Development     Shift+Cmd+1
    Desktop 2 - Terminal         Shift+Cmd+2
    Desktop 3                    Shift+Cmd+3
---
```

The submenu items use `Shift+Cmd+N` as keyboard equivalents (active only when the menu is open). The current desktop is omitted or disabled in the submenu (cannot move to where you already are).

**Option B: Inline items with different shortcut**

Add `Shift+Cmd+N` equivalents directly to the existing desktop items. Clicking uses navigation; `Shift+Cmd+N` triggers the move. This is more compact but less discoverable.

**Recommendation:** Option A (submenu) for clarity and discoverability.

### 4.4 Global Hotkeys (Future Enhancement)

The initial version uses menu-based invocation only. Global hotkeys (e.g., Ctrl+Cmd+1-9 to move window directly without opening the menu) are a Phase 2 enhancement because:

1. Registering 9 additional Carbon hotkeys increases complexity
2. The `GlobalHotkeyManager` currently supports only 1 hotkey -- extending it requires handler routing by ID
3. The modifier combination must be carefully chosen to avoid conflicts
4. Menu-based invocation is sufficient to validate the feature

If implemented later, the approach is:
- Extend `GlobalHotkeyManager` to register `EventHotKeyID` entries with id: 2-10
- Modify `hotkeyEventHandler` to read the hotkey ID from `kEventParamDirectObject` and dispatch accordingly
- Add `moveWindow.hotkeyModifiers` to config (default: `["control", "command"]`)

### 4.5 Visual Feedback

After a successful move, the overlay and menu bar title update automatically via the existing `activeSpaceDidChangeNotification` handler -- since the move always switches spaces, the standard space-change flow provides implicit feedback.

No additional visual feedback mechanism is needed for v1.0.

### 4.6 User Guidance / Setup Flow

Add a "Set Up Window Moving..." menu item that:

1. Calls `WindowMover.areSystemShortcutsEnabled()` to check status
2. If shortcuts are not enabled, shows an `NSAlert` with instructions:
   ```
   To move windows between desktops, you need to enable the
   "Move window to Desktop N" keyboard shortcuts in macOS:

   1. Open System Settings > Keyboard > Keyboard Shortcuts
   2. Select "Mission Control" in the left panel
   3. Enable checkboxes for "Move window to Desktop 1" through
      "Move window to Desktop 9"
   4. Ensure the key combinations are Ctrl+Shift+1 through Ctrl+Shift+9
   ```
3. Offers an "Open System Settings" button that calls:
   ```swift
   NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.preference.keyboard?Shortcuts")!)
   ```
4. After returning, re-checks and updates state

If shortcuts are already enabled, shows a confirmation message.

### 4.7 Multi-Display Awareness

The move operation targets the **global desktop position** (same as space navigation). When using menu items, the `item.tag` stores the `globalPosition` from `SpaceInfo`. The move call uses this global position directly:

```swift
@objc private func moveWindowToSpace(_ sender: NSMenuItem) {
    let targetGlobalPosition = sender.tag
    statusItem.menu?.cancelTracking()
    
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
        WindowMover.moveToSpace(index: targetGlobalPosition)
    }
}
```

This correctly handles multi-display setups because the system shortcut Ctrl+Shift+N uses global desktop numbering, matching the `globalPosition` values from `SpaceDetector.getSpacesByDisplay()`.

---

## 5. Implementation Phases

### Phase 1: Core Move (Minimum Viable Feature)

**Estimated effort:** 2-3 hours
**Lines of code:** ~80-100 new lines

1. **Verify plist key numbers** -- Enable "Move window to Desktop 1" in System Settings, inspect plist, confirm key number (expected: 52)
2. **Add `WindowMover` class** -- Static method `moveToSpace(index:)` using CGEvent synthesis with `[.maskControl, .maskShift]`
3. **Refactor `keyCodeForNumber`** -- Make it accessible from both `SpaceNavigator` and `WindowMover` (shared utility or change access level)
4. **Add "Move Window To..." submenu** in `rebuildSpaceItems()` -- Lists all desktops on active display except current; uses `Shift+Cmd+N` equivalents
5. **Add move action handler** -- `moveWindowToSpace(_:)` method on `MenuBarController` following the `navigateToSpace(_:)` pattern
6. **Add `MoveWindowConfig`** to `JumpeeConfig` -- `enabled` flag only for Phase 1
7. **Add shortcut detection** -- `WindowMover.areSystemShortcutsEnabled()` reading from plist
8. **Add setup guidance** -- "Set Up Window Moving..." menu item with alert dialog and System Settings link
9. **Build and test** on macOS 15

### Phase 2: Polish and Configuration (Optional)

**Estimated effort:** 2-3 hours

1. **Add "Move Window Left/Right One Space"** -- Synthesize Ctrl+Shift+Left/Right arrow keys; add as menu items
2. **Global hotkeys for move** -- Extend `GlobalHotkeyManager` to register Ctrl+Cmd+1-9 for direct move-without-menu
3. **Config: `moveWindow.hotkeyModifiers`** -- Configurable modifier combination for global hotkeys
4. **Conditional menu rendering** -- Hide "Move Window To..." submenu when `moveWindow.enabled` is false or shortcuts are not detected
5. **Update configuration-guide.md** with new `moveWindow` config section

### Phase 3: Advanced Features (Future)

1. **Cross-display window movement** -- Move a window to a desktop on a different display (requires understanding of cross-display space numbering)
2. **Move all windows from current desktop** -- Batch move operation
3. **History / undo** -- Remember last move, offer Cmd+Z to reverse

---

## 6. Configuration Additions

### 6.1 New Config Section

```json
{
    "spaces": { ... },
    "showSpaceNumber": true,
    "overlay": { ... },
    "hotkey": { ... },
    "moveWindow": {
        "enabled": true
    }
}
```

Phase 1 only needs `enabled`. Phase 2 adds:

```json
{
    "moveWindow": {
        "enabled": true,
        "hotkeyModifiers": ["control", "command"]
    }
}
```

### 6.2 Backward Compatibility

The `moveWindow` key is optional in `JumpeeConfig`. If absent, the feature is disabled and no "Move Window To..." submenu appears. Existing configs work without modification.

---

## 7. Edge Cases and Limitations

### 7.1 Fullscreen Windows

macOS does not allow moving fullscreen windows via the "Move window to Desktop N" shortcut -- the shortcut is silently ignored when the frontmost window is in fullscreen. No special handling needed; the OS handles this gracefully.

### 7.2 "Assign to All Desktops" Windows

Windows set to appear on all desktops (via right-click on Dock icon > Options > All Desktops) cannot be moved to a specific space. The system shortcut is silently ignored. No special handling needed.

### 7.3 System Windows

Windows that cannot be focused via Accessibility (e.g., the Desktop, Finder background, menu bar) cannot be moved. The shortcut has no effect. No crash risk.

### 7.4 Jumpee's Own Menu Stealing Focus

When the user opens Jumpee's menu and selects "Move to Desktop 3", Jumpee's menu has focus. The sequence is:
1. Cancel menu tracking
2. Wait 300ms for the previously-focused app to regain focus
3. Synthesize the keystroke

The 300ms delay is the same value used for `navigateToSpace()` and is proven to work. If edge cases arise (slow machines), this could be made configurable.

### 7.5 Fewer Desktops Than Expected

If the user tries to move to Desktop 5 but only has 3 desktops, the system shortcut is silently ignored. The menu only shows existing desktops, so this should not happen in practice.

### 7.6 Target Desktop Is Current Desktop

The "Move Window To..." submenu should disable or omit the current desktop entry. Moving a window to the desktop it is already on is a no-op.

---

## 8. Testing Strategy

### 8.1 Manual Test Cases

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 1 | Enable "Move window to Desktop 1-3" shortcuts in System Settings; open a Safari window on Desktop 1; Jumpee menu > Move Window To > Desktop 2 | Safari moves to Desktop 2, view switches to Desktop 2 |
| 2 | Same as #1 but with shortcuts NOT enabled | "Set Up Window Moving..." guidance appears or move silently fails |
| 3 | Move window while on Desktop 3 (last desktop) to Desktop 1 | Window appears on Desktop 1, view switches |
| 4 | Attempt to move a fullscreen window | Nothing happens (silent no-op) |
| 5 | Move window on multi-display setup: window on Display A, move to Display A Desktop 3 | Window moves to Desktop 3 on Display A |
| 6 | Verify overlay updates after move | Overlay shows new desktop name on target space |
| 7 | Verify menu bar title updates after move | Title reflects new desktop name |
| 8 | Open config without `moveWindow` key | Feature disabled, no submenu shown |
| 9 | Set `"moveWindow": { "enabled": false }` | Feature disabled, no submenu shown |
| 10 | Move using Shift+Cmd+N keyboard equivalent in the open menu | Works same as clicking the submenu item |

### 8.2 Verification of Plist Key Numbers

Before implementing shortcut detection, run this verification:

```bash
# Step 1: Dump current state
defaults read com.apple.symbolichotkeys AppleSymbolicHotKeys > /tmp/before.plist

# Step 2: Enable "Move window to Desktop 1" in System Settings

# Step 3: Dump new state
defaults read com.apple.symbolichotkeys AppleSymbolicHotKeys > /tmp/after.plist

# Step 4: Diff
diff /tmp/before.plist /tmp/after.plist
```

This will reveal the exact plist key number for "Move window to Desktop 1" on the current macOS version.

---

## 9. Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Plist key numbers for "Move window" shortcuts are different than expected (52, 54, ...) | Medium | Medium | Verify by inspection before coding (Section 8.2) |
| System shortcut synthesis does not trigger the move on some macOS version | Medium | Low | This uses the same `CGEvent` mechanism already proven for space navigation. If it breaks, space navigation also breaks. |
| 300ms delay insufficient for focus restoration on slow machines | Low | Low | Make delay configurable in `MoveWindowConfig` if issues arise |
| Users confused by "must enable shortcuts" requirement | Medium | Medium | Clear setup guidance with "Open System Settings" button; same requirement Jumpee already has for navigation |
| `x-apple.systempreferences:` URL scheme changes | Low | Low | URL scheme has been stable since macOS 13; if it breaks, remove the button and keep text instructions |
| CGEvent synthesis blocked by future macOS security changes | Medium | Low | Would affect all CGEvent-based tools including Jumpee's existing navigation. Monitor macOS release notes. |

---

## 10. Alternatives Considered and Rejected

### 10.1 CGS Private APIs (Direct Window Movement)

- **Rejected because:** Broken on macOS 15+ due to connection-rights checks. Would only benefit macOS 13-14 users wanting "move without following" -- a shrinking audience. Adds ~80 lines of complex code with ongoing maintenance risk.

### 10.2 Amethyst-Style Mouse Drag Simulation

- **Rejected because:** Moves the user's cursor, has timing-sensitive async sequences, fragile across different app window styles, visible visual artifacts. Too invasive for Jumpee's lightweight design.

### 10.3 AeroSpace-Style Virtual Workspaces

- **Rejected because:** Requires Jumpee to become a full window manager with workspace state. Incompatible with Jumpee's role as a Space-naming overlay that works with native macOS Spaces.

### 10.4 Programmatic Shortcut Enabling (defaults write)

- **Rejected because:** Modifying system preferences without user consent is invasive. The `activateSettings` utility to apply changes immediately is a private framework binary. Better to guide the user through the standard System Settings UI.

---

## 11. Dependencies

| Dependency | Status | Impact |
|------------|--------|--------|
| v1.1 multi-display support (plan-003) | Implemented (v1.1.0) | Provides `getSpacesByDisplay()`, `globalPosition`, and per-display menu rendering that the move feature builds on |
| "Move window to Desktop N" system shortcuts | User must enable | Core functionality depends on this |
| Accessibility permissions | Already granted | Needed for CGEvent posting (already required for space navigation) |
| `keyCodeForNumber(_:)` access | Minor refactor needed | Currently private in `SpaceNavigator`; needs to be shared |

---

## 12. Summary: Go / No-Go Decision Points

For the user to decide whether to proceed:

### GO if:

- You want to move windows between desktops via keyboard (Jumpee menu + Shift+Cmd+N)
- You accept the requirement to enable "Move window to Desktop N" shortcuts in System Settings (one-time setup, same as the existing navigation requirement)
- You accept that the window move always switches to the target desktop (no "stay behind" on macOS 15+)
- You want a lightweight, maintainable implementation (~80-100 lines) that does not rely on fragile private APIs

### NO-GO if:

- You require "move without following" (window goes to another desktop while you stay) -- this is impossible on macOS 15+
- You want zero-configuration operation (no System Settings changes required)
- You need cross-display window movement in the initial version (Phase 3 future work)

---

## 13. Files to Modify

| File | Change |
|------|--------|
| `Sources/main.swift` | Add `WindowMover` class (~30 lines), add `MoveWindowConfig` struct (~10 lines), extend `JumpeeConfig`, extend `MenuBarController.rebuildSpaceItems()` for "Move Window To..." submenu (~40 lines), add `moveWindowToSpace(_:)` handler (~15 lines), add setup guidance menu item and handler (~30 lines), refactor `keyCodeForNumber` access |
| `build.sh` | No changes needed |
| `docs/design/configuration-guide.md` | Add `moveWindow` configuration section |
| `docs/design/project-design.md` | Add Window Mover component description |
| `CLAUDE.md` | Update Jumpee tool documentation with move feature |
