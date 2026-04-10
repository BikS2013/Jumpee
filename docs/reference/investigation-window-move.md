# Investigation: Moving App Windows Between Desktops/Spaces

**Date:** 2026-04-10  
**Type:** Technical Feasibility Investigation  
**macOS Targets:** macOS 13 (Ventura), 14 (Sonoma), 15 (Sequoia), 26 (Tahoe)  

---

## 1. Executive Summary

**Is this feasible? YES -- with caveats.**

Moving a window from one macOS Space to another is technically achievable using private CGS (CoreGraphics Services) APIs combined with the Accessibility framework. However, Apple has progressively tightened restrictions on these private APIs, particularly in macOS 15 (Sequoia) and macOS 26 (Tahoe), making the reliability of the direct CGS approach uncertain on the latest OS versions.

**Recommended primary approach:** Hybrid strategy combining **Approach 2 (Accessibility + CGS APIs)** as the primary mechanism with **Approach 3 (Synthesized System Shortcuts)** as a configurable fallback. This provides the best balance of reliability, UX quality, and forward compatibility.

**Recommended UX model:** Direct hotkeys (Ctrl+Cmd+1-9) for move-to-space, with configurable "follow window" behavior and menu integration as a secondary access method.

**Key risk:** Apple has been locking down private CGS space APIs since macOS 14.5, with significant breakage in Sequoia (15.0+). The CGS approach may require ongoing maintenance as Apple continues to restrict these APIs. The synthesized-shortcut fallback mitigates this risk at the cost of requiring users to enable Mission Control shortcuts in System Settings.

---

## 2. Approach Analysis

### Approach 1: Private CGS APIs (Direct Window Movement)

#### Description
Use `CGSAddWindowsToSpaces` and `CGSRemoveWindowsFromSpaces` (or `CGSMoveWindowsToManagedSpace`) to directly move a window's space assignment through the WindowServer.

#### API Signatures
```swift
@_silgen_name("CGSAddWindowsToSpaces")
func CGSAddWindowsToSpaces(_ cid: Int32, _ wids: CFArray, _ sids: CFArray)

@_silgen_name("CGSRemoveWindowsFromSpaces")
func CGSRemoveWindowsFromSpaces(_ cid: Int32, _ wids: CFArray, _ sids: CFArray)

// Alternative single-call API (less commonly used)
@_silgen_name("CGSMoveWindowsToManagedSpace")
func CGSMoveWindowsToManagedSpace(_ cid: Int32, _ wids: CFArray, _ sid: Int)
```

#### How yabai and Amethyst Implement This
Both tools follow the same core pattern:
1. Obtain the CGS connection ID via `CGSMainConnectionID()` (Jumpee already does this).
2. Get the current space ID via `CGSGetActiveSpace()` (Jumpee already does this).
3. Get the target window's `CGWindowID` (via Accessibility API -- see Approach 2).
4. Call `CGSAddWindowsToSpaces(cid, [windowID], [targetSpaceID])` to add the window to the target space.
5. Call `CGSRemoveWindowsFromSpaces(cid, [windowID], [currentSpaceID])` to remove it from the current space.

**Critical ordering detail:** On macOS 14.5+, `CGSRemoveWindowsFromSpaces` will NOT remove a window from a space if it would leave the window with no spaces. Therefore, the **add must happen before the remove**. This was discovered by Amethyst contributors and confirmed across multiple projects.

#### Feasibility by macOS Version

| macOS Version | Status | Notes |
|---------------|--------|-------|
| 13 (Ventura) | Works | Full functionality with SIP enabled |
| 14 (Sonoma) | Works (with fix) | Requires add-before-remove ordering since 14.5 |
| 15 (Sequoia) | Partially broken | Move works but forces a space switch (OS follows the window). Some users report complete failure without SIP disabled. |
| 26 (Tahoe) | Unknown/Risky | Apple continued tightening private API restrictions. yabai requires a fork (yabai-tahoe) for Tahoe support. |

#### Permissions Required
- Accessibility permissions (Jumpee already has these)
- No additional entitlements needed for the CGS calls themselves
- SIP does NOT need to be disabled for the move operation on macOS 13-14
- SIP may need to be disabled on Sequoia/Tahoe for reliable operation

#### Pros
- Fastest execution (sub-100ms)
- No visual artifacts (when working correctly)
- No user configuration required
- Jumpee already has the connection ID and space enumeration

#### Cons
- Private/undocumented API -- can break with any macOS update
- Broken or degraded behavior on macOS 15+ (Sequoia)
- On Sequoia, the move forces a space switch (the user follows the window), eliminating the "move without following" option
- The `CGSMoveWindowsToManagedSpace` variant is less tested than the add/remove pair
- Requires obtaining the window's `CGWindowID` via another private API

#### Verdict: PARTIALLY FEASIBLE
Works well on macOS 13-14. Degraded on Sequoia. Unknown on Tahoe. Cannot be the sole implementation strategy.

---

### Approach 2: Accessibility API + CGS Hybrid

#### Description
Use the Accessibility framework (`AXUIElement`) to identify the focused window and obtain its `CGWindowID` via the private `_AXUIElementGetWindow` function, then use CGS APIs (from Approach 1) to perform the move.

#### Implementation Pattern
```swift
// 1. Get frontmost application
let frontApp = NSWorkspace.shared.frontmostApplication
let pid = frontApp.processIdentifier

// 2. Create AXUIElement for the application
let appElement = AXUIElementCreateApplication(pid)

// 3. Get the focused window
var focusedWindow: AnyObject?
AXUIElementCopyAttributeValue(appElement, kAXFocusedWindowAttribute as CFString, &focusedWindow)

// 4. Get the CGWindowID via private API
@_silgen_name("_AXUIElementGetWindow")
func _AXUIElementGetWindow(_ element: AXUIElement, _ wid: UnsafeMutablePointer<CGWindowID>) -> AXError

var windowID = CGWindowID(0)
let result = _AXUIElementGetWindow(focusedWindow as! AXUIElement, &windowID)
// result == .success means windowID is valid
```

**Note on `@_silgen_name` for C functions:** Since `_AXUIElementGetWindow` is a C function, using `@_silgen_name` technically applies the Swift calling convention rather than the C ABI. This happens to work in practice for simple function signatures like this one on ARM64 and x86_64, but a bridging header approach is more correct. However, since Jumpee already uses `@_silgen_name` for CGS functions (and has no bridging header in its single-file build), maintaining consistency with the existing pattern is pragmatic.

#### Alternative: CGWindowListCopyWindowInfo Matching
If `_AXUIElementGetWindow` fails, a fallback approach is:
1. Get the frontmost app's PID.
2. Call `CGWindowListCopyWindowInfo(.optionOnScreenOnly, kCGNullWindowID)`.
3. Filter windows by PID and `kCGWindowIsOnscreen`.
4. Match by window bounds/title to identify the focused window.
5. Extract `kCGWindowNumber` as the `CGWindowID`.

This is more fragile (title/bounds matching can be ambiguous with multiple windows) but uses only public APIs for the window enumeration step.

#### Permissions Required
- Accessibility permissions (already granted to Jumpee)
- No additional entitlements

#### Pros
- Leverages Jumpee's existing Accessibility permission
- `_AXUIElementGetWindow` is widely used (alt-tab-macos, Amethyst, Rectangle, Hammerspoon)
- Provides a clean way to get the focused window's ID
- Combined with CGS move APIs, this is the approach used by all major window managers

#### Cons
- `_AXUIElementGetWindow` is private API (same risk as CGS APIs)
- Returns `CGWindowID(0)` for some non-standard windows (system UI elements, menu bar items)
- Does not work when screen is locked
- Still depends on CGS APIs for the actual move (inherits Approach 1's Sequoia issues)

#### Verdict: FEASIBLE -- RECOMMENDED (as primary mechanism)
This is the standard approach used by every macOS window manager. The Accessibility + CGS combination is well-proven on macOS 13-14. The Sequoia regression affects the CGS move step, not the window identification step.

---

### Approach 3: Synthesized System Shortcuts (CGEvent)

#### Description
macOS provides built-in "Move window to Desktop N" keyboard shortcuts that can be enabled in System Settings > Keyboard > Keyboard Shortcuts > Mission Control. If enabled, Jumpee could synthesize these keystrokes using `CGEvent`, exactly as it already does for space navigation (synthesizing Ctrl+N for "Switch to Desktop N").

#### How It Works
1. User enables "Move window to Desktop N" shortcuts in System Settings (disabled by default).
2. Jumpee synthesizes the corresponding key events (typically Ctrl+Shift+N or a custom modifier+N).
3. macOS handles the actual window move natively.

The implementation would closely mirror the existing `SpaceNavigator.navigateToSpace(index:)` method, which already synthesizes `CGEvent` key presses with `.maskControl` modifier.

#### Feasibility
This approach relies on **public macOS behavior** (system keyboard shortcuts) and **documented CGEvent APIs**, making it the most forward-compatible option. It uses the same mechanism Jumpee already uses for space switching.

#### Permissions Required
- Accessibility permissions (already granted -- needed for CGEvent posting)
- No additional permissions
- Requires user to manually enable "Move window to Desktop N" shortcuts in System Settings

#### Pros
- Uses the OS's own mechanism -- most reliable and forward-compatible
- Minimal code needed (mirrors existing `SpaceNavigator` pattern)
- Works regardless of CGS API changes
- No private APIs involved (CGEvent posting is documented)
- Handles all edge cases (fullscreen, multi-display) as the OS does natively
- Will continue working across macOS updates

#### Cons
- **Not zero-configuration**: User must manually enable the shortcuts in System Settings
- User must have the correct number of desktops already created
- The shortcut key assignment varies by user configuration
- The default shortcuts may conflict with other apps
- Cannot determine programmatically whether the shortcuts are enabled
- Jumpee would need to know (or guess) which key combination the user has assigned
- Slight delay (~200-300ms) due to the animation macOS performs during the move

#### Verdict: FEASIBLE -- RECOMMENDED (as fallback/alternative mode)
This is the safest and most maintainable approach. The requirement for user configuration is the main drawback, but Jumpee already requires users to enable "Switch to Desktop N" shortcuts for navigation. Adding "Move window to Desktop N" shortcuts is a natural extension of that setup.

---

### Approach 4: AppleScript / NSWorkspace

#### Description
Use AppleScript (`tell application "System Events"`) or NSWorkspace APIs to move windows between spaces.

#### Why This Does Not Work
- **NSWorkspace** provides no API for space management. The `NSWorkspace.shared` object can detect space changes (`activeSpaceDidChangeNotification`) but cannot trigger them or move windows between spaces.
- **AppleScript / System Events** can manipulate window properties (position, size, minimize) but has no concept of Spaces. There is no AppleScript dictionary entry for moving a window to a specific desktop.
- Some individual apps may support space-related AppleScript commands, but this is app-specific and extremely rare.
- The `tell application "System Events" to keystroke` approach could theoretically synthesize keyboard shortcuts, but this is strictly inferior to the CGEvent approach (Approach 3) and adds AppleScript overhead.

#### Verdict: NOT FEASIBLE
No viable path exists through AppleScript or NSWorkspace for moving windows between spaces.

---

### Approach 5: Mission Control Drag Simulation

#### Description
Programmatically trigger Mission Control (by synthesizing the Ctrl+Up or F3 keystroke), wait for the animation, then simulate a mouse drag of the target window to the target desktop thumbnail.

#### Why This Is Not Viable
1. **Timing-dependent**: Mission Control's animation takes ~500ms, and the exact timing varies. The code would need to poll for completion or use arbitrary delays.
2. **Resolution-dependent**: The position of desktop thumbnails in Mission Control varies by number of desktops, screen resolution, and display arrangement. Calculating correct drop targets requires reverse-engineering the Mission Control layout.
3. **Visually disruptive**: The user sees Mission Control open, a window drag, and Mission Control close -- a jarring experience for what should be an instant operation.
4. **Fragile across macOS versions**: Mission Control's layout and animation behavior changes between macOS versions.
5. **Race conditions**: If the user interacts during the simulated drag, the operation fails unpredictably.
6. **Multi-display complexity**: On multi-display setups, Mission Control shows different desktop arrangements that further complicate coordinate calculations.

#### Verdict: NOT FEASIBLE
This approach is too fragile, too slow, and too visually disruptive for a keyboard-driven workflow tool.

---

### Approach 6: AeroSpace-Style Virtual Workspaces (Bonus)

#### Description
Instead of using macOS Spaces at all, implement virtual workspaces by moving "inactive" windows off-screen (e.g., to coordinates like x=-10000) and bringing "active" windows back to visible positions. This is the approach used by AeroSpace, which completely bypasses macOS Spaces.

#### Why This Is Interesting but Out of Scope
- AeroSpace proves this approach works reliably, even on Sequoia and Tahoe, because it never touches private CGS space APIs.
- However, it requires Jumpee to become a full window manager, tracking all window positions and managing workspace state.
- This contradicts Jumpee's design philosophy as a lightweight menu bar tool.
- It would require disabling "Displays have separate Spaces" in macOS settings for multi-display setups.

#### Verdict: NOT RECOMMENDED for Jumpee
Technically sound but architecturally incompatible with Jumpee's lightweight design.

---

## 3. Approach Comparison Matrix

| Criterion | Approach 1: CGS Direct | Approach 2: AX+CGS Hybrid | Approach 3: Synth Shortcuts | Approach 4: AppleScript | Approach 5: MC Drag |
|-----------|----------------------|--------------------------|---------------------------|----------------------|-------------------|
| **Feasibility** | Partial (macOS 13-14 yes, 15+ degraded) | Partial (same CGS dependency) | Yes (all versions) | No | No |
| **Reliability** | Medium-Low (breaks across versions) | Medium (best available) | High (uses OS mechanism) | N/A | Very Low |
| **Permissions** | Accessibility | Accessibility | Accessibility | Accessibility | Accessibility |
| **UX Impact** | Silent/instant (when working) | Silent/instant (when working) | Slight animation (~200ms) | N/A | Very disruptive |
| **Complexity** | Low (~50 lines) | Medium (~80 lines) | Low (~30 lines) | N/A | Very High |
| **User Config** | None | None | Must enable shortcuts | N/A | None |
| **Move-only (no follow)** | Yes (macOS 13-14), No (Sequoia) | Yes (macOS 13-14), No (Sequoia) | Depends on OS behavior | N/A | N/A |
| **Forward Compat** | Poor | Poor-Medium | Good | N/A | Poor |

---

## 4. UX Recommendation

### Primary UX: Direct Hotkeys (Ctrl+Cmd+1-9)

**Recommended as the default interaction model.**

Rationale:
- Mirrors the existing Cmd+1-9 navigation pattern (when Jumpee menu is open) and the system Ctrl+1-9 pattern for switching spaces.
- Single keystroke -- fastest possible interaction.
- Natural mental model: Ctrl+N = go to desktop N, Ctrl+Cmd+N = move window to desktop N.
- Users of tiling window managers (yabai, Amethyst) are accustomed to this pattern.

Implementation: Register 9 additional Carbon hotkeys (extending the existing `GlobalHotkeyManager`) with unique `EventHotKeyID` values (id: 2-10). The modifier combination should be configurable in `config.json`.

### Secondary UX: Menu Integration

**Recommended as an additional access method.**

Add a "Move to..." submenu in the Jumpee dropdown menu, listing all desktops. This provides discoverability and works for users who prefer mouse/menu interaction.

Implementation: In `MenuBarController.rebuildSpaceItems()`, add a submenu item under each space entry or a separate "Move Window" section with Shift+Cmd+1-9 keyboard equivalents (active only when the menu is open).

### Optional UX: Next/Previous Desktop

**Recommended as a secondary hotkey option.**

Ctrl+Cmd+Left/Right to move the window one desktop forward/backward. Useful for quick adjacent-space moves without thinking about desktop numbers.

### Configurable Behavior: Follow or Stay

The `config.json` should include a `moveWindow.followWindow` boolean:
- `true` (recommended default): After moving the window, switch to the target desktop. This is the most intuitive behavior and matches what Sequoia forces anyway.
- `false`: Stay on the current desktop after moving (only reliable on macOS 13-14).

### Not Recommended: Two-Step Mode

The "press Ctrl+Cmd+M then press 1-9" two-step approach adds complexity (timeout handling, mode state, visual indicator) without significant benefit over direct hotkeys. The mental model is less clear, and the implementation is more complex.

---

## 5. Recommended Architecture

### Integration with Existing Codebase

The implementation should follow Jumpee's existing patterns and integrate at these points:

#### 5.1 New CGS API Declarations (after line 13 in main.swift)

```swift
// Window-to-space movement APIs
@_silgen_name("CGSAddWindowsToSpaces")
func CGSAddWindowsToSpaces(_ cid: Int32, _ wids: CFArray, _ sids: CFArray)

@_silgen_name("CGSRemoveWindowsFromSpaces")
func CGSRemoveWindowsFromSpaces(_ cid: Int32, _ wids: CFArray, _ sids: CFArray)

// Window ID from Accessibility element
@_silgen_name("_AXUIElementGetWindow")
func _AXUIElementGetWindow(_ element: AXUIElement, _ wid: UnsafeMutablePointer<CGWindowID>) -> AXError
```

#### 5.2 New Configuration (extend JumpeeConfig)

```swift
struct MoveWindowConfig: Codable {
    var enabled: Bool
    var followWindow: Bool
    var hotkeyModifiers: [String]  // e.g., ["control", "command"]
    var useSystemShortcuts: Bool   // true = synthesize system shortcuts (Approach 3)
    
    static let defaultConfig = MoveWindowConfig(
        enabled: true,
        followWindow: true,
        hotkeyModifiers: ["control", "command"],
        useSystemShortcuts: false
    )
}
```

#### 5.3 New WindowMover Class

A new `WindowMover` class (following the `SpaceNavigator` pattern with static methods) responsible for:
1. Getting the focused window's `CGWindowID` via Accessibility API.
2. Moving the window via CGS APIs (primary) or synthesized shortcuts (fallback).
3. Optionally following the window via `SpaceNavigator.navigateToSpace()`.

#### 5.4 Extended GlobalHotkeyManager

Extend the Carbon hotkey registration to support multiple hotkeys:
- Current: id=1 for Cmd+J (open menu)
- New: id=2 through id=10 for Ctrl+Cmd+1 through Ctrl+Cmd+9 (move to desktop)
- The `hotkeyEventHandler` callback must extract the hotkey ID from the event and dispatch accordingly.

#### 5.5 Menu Integration

In `MenuBarController.rebuildSpaceItems()`, add "Move to Desktop N" items either as a submenu or as additional items with Shift+Cmd+N keyboard equivalents.

---

## 6. Risks and Mitigations

### Risk 1: CGS API Breakage on Future macOS Versions
- **Severity:** High
- **Likelihood:** High (already happening on Sequoia)
- **Mitigation:** Implement Approach 3 (synthesized shortcuts) as a configurable fallback. When `useSystemShortcuts: true` is set in config, Jumpee uses the OS's own "Move window to Desktop N" mechanism instead of CGS APIs.
- **Mitigation:** Add runtime detection -- if the CGS move fails (window still on original space after the call), automatically fall back to the synthesized shortcut approach and log a warning.

### Risk 2: Sequoia Forces Space Switch on Move
- **Severity:** Medium
- **Likelihood:** Confirmed on macOS 15.0+
- **Mitigation:** Default `followWindow: true` so the behavior is consistent. On Sequoia, the OS forces a follow anyway, so the config option is effectively ignored. On older macOS versions, the option works as expected. Document this behavior clearly.

### Risk 3: `_AXUIElementGetWindow` Returns Invalid Window ID
- **Severity:** Low-Medium
- **Likelihood:** Low (some system UI elements return 0)
- **Mitigation:** Check for `windowID == 0` and fall back to `CGWindowListCopyWindowInfo` matching by PID + bounds + on-screen status. If no match is found, show a brief message ("Cannot move this window") via the overlay system.

### Risk 4: Fullscreen Windows
- **Severity:** Low
- **Likelihood:** Medium (users may try to move fullscreen windows)
- **Mitigation:** Detect fullscreen state via `AXUIElementCopyAttributeValue` with `kAXFullscreenAttribute`. If fullscreen, either refuse the move or exit fullscreen first. The existing `type == 0` filter in `SpaceDetector.getAllSpaceIDs()` already excludes fullscreen spaces from the target list.

### Risk 5: "Assign to All Desktops" Windows
- **Severity:** Low
- **Likelihood:** Low
- **Mitigation:** These windows exist on all spaces simultaneously. Attempting to move them is a no-op. Detect via `CGSCopyWindowsForSpaces` (if available) or check if the window appears in multiple space IDs. Silently ignore the move request.

### Risk 6: Multi-Display Edge Cases
- **Severity:** Medium
- **Likelihood:** Medium (Jumpee supports multi-display)
- **Mitigation:** The move operation should target spaces on the **active display** by default, using `SpaceDetector.getActiveDisplayID()` and filtering `getSpacesByDisplay()` to the current display's spaces. Moving windows across displays (e.g., from Display 1 Space 2 to Display 2 Space 1) should be a future enhancement, not part of the initial implementation.

### Risk 7: Carbon Hotkey Conflicts
- **Severity:** Low-Medium
- **Likelihood:** Medium (Ctrl+Cmd+N may conflict with other apps)
- **Mitigation:** Make the modifier combination configurable via `moveWindow.hotkeyModifiers` in config.json. Document common conflicts (e.g., Ctrl+Cmd+Q is macOS "Lock Screen" on some setups).

---

## 7. Implementation Priority

### Phase 1: Core Move (CGS + Accessibility)
1. Add CGS API declarations and `_AXUIElementGetWindow`.
2. Implement `WindowMover` class with `getFocusedWindowID()` and `moveWindowToSpace(windowID:, targetSpaceID:)`.
3. Add `MoveWindowConfig` to configuration.
4. Extend `GlobalHotkeyManager` for multiple hotkeys.
5. Register Ctrl+Cmd+1-9 hotkeys.
6. Implement follow/stay behavior.
7. Test on macOS 13, 14, 15.

### Phase 2: Fallback and Polish
1. Implement synthesized shortcut fallback (Approach 3).
2. Add runtime detection of CGS move failure with automatic fallback.
3. Add "Move to Desktop N" menu items.
4. Add visual feedback via overlay system.
5. Handle edge cases (fullscreen, assign-to-all, system windows).

### Phase 3: Advanced Features
1. Next/Previous desktop move hotkeys.
2. Cross-display window movement.
3. Move-and-follow with configurable delay.

---

## 8. Technical Research Guidance

Research needed: Yes

### Topic 1: CGS API Behavior on macOS 15.3+ and macOS 26 (Tahoe)
- **Why**: The CGS space APIs have been progressively locked down since macOS 14.5. Confirmed breakage on Sequoia 15.0. Unknown status on Tahoe 26.x. A yabai-tahoe fork exists, suggesting further changes.
- **Focus**: Test `CGSAddWindowsToSpaces` + `CGSRemoveWindowsFromSpaces` (add-before-remove order) on the target macOS version. Verify whether the move works, whether it forces a space switch, and whether any error codes are returned.
- **Depth**: Deep -- requires building and running test code on the target macOS version.

### Topic 2: _AXUIElementGetWindow Reliability on Current macOS
- **Why**: This is the only practical way to obtain a CGWindowID from the focused AXUIElement. If it breaks, the entire CGS-based approach becomes non-viable.
- **Focus**: Test on macOS 15/26. Verify it works for windows from common apps (Safari, Chrome, Terminal, VS Code, Finder). Check behavior with system windows, menu extras, and notification center.
- **Depth**: Moderate -- a small test harness that logs window IDs for various apps.

### Topic 3: System "Move Window to Desktop N" Shortcut Behavior
- **Why**: If used as the fallback approach, Jumpee needs to know the exact key codes and modifiers the OS expects. The defaults may vary by macOS version or locale.
- **Focus**: Determine the default key assignments when these shortcuts are enabled. Test whether CGEvent synthesis with those modifiers reliably triggers the move. Test on macOS 15/26.
- **Depth**: Moderate -- enable the shortcuts in System Settings and test CGEvent synthesis.

### Topic 4: Amethyst 0.22.0 Source Code Review
- **Why**: Amethyst is the most relevant open-source project that has partially solved the Sequoia regression. Their code changes between 0.21.x and 0.22.0 contain the specific workarounds.
- **Focus**: Review `Amethyst/Model/Window.swift` for the exact API call sequence, error handling, and any Sequoia-specific workarounds. Pay attention to how they handle the forced space-switch side effect.
- **Depth**: Surface -- read the relevant source files and changelog.

### Topic 5: AeroSpace Virtual Workspace Architecture
- **Why**: If CGS APIs become completely non-functional in future macOS versions, understanding AeroSpace's approach provides a "nuclear option" fallback design.
- **Focus**: How AeroSpace moves windows off-screen, how it tracks window positions per workspace, and how it handles Mission Control integration.
- **Depth**: Surface -- architectural understanding only, not implementation detail.

---

## 9. Sources

### CGS API and Window Management
- [NUIKit/CGSInternal - CGSSpace.h](https://github.com/NUIKit/CGSInternal/blob/master/CGSSpace.h) -- Private CGS API header definitions
- [NUIKit/CGSInternal - CGSWindow.h](https://github.com/NUIKit/CGSInternal/blob/master/CGSWindow.h) -- Window-related CGS functions
- [Windows on a space (using private CGS) -- GitHub Gist](https://gist.github.com/sdsykes/5c2c0c2a41396aead3b7)

### yabai Issues and Sequoia Breakage
- [yabai #2500: Moving windows without SIP disabled stopped working since Sequoia](https://github.com/asmvik/yabai/issues/2500)
- [yabai #2380: Moving Windows Across Spaces No Longer Works in MacOS 15.0](https://github.com/koekeishiya/yabai/issues/2380)
- [yabai #2441: Cannot move window to space on macOS Sequoia (15.1)](https://github.com/koekeishiya/yabai/issues/2441)
- [yabai #2591: Sequoia 15.3.2: Trouble Moving Windows](https://github.com/asmvik/yabai/issues/2591)
- [yabai #795: Move window to space without disabling SIP](https://github.com/koekeishiya/yabai/issues/795)
- [yabai #2658: Does moving window from display A to display B require disabling SIP?](https://github.com/koekeishiya/yabai/issues/2658)
- [yabai-tahoe fork for macOS Tahoe](https://github.com/tbiehn/yabai-tahoe)

### Amethyst Issues and Fix
- [Amethyst #1662: Throwing windows to other spaces fails on macOS 15 beta 1](https://github.com/ianyh/Amethyst/issues/1662)
- [Amethyst #1676: Throwing window to a space is broken](https://github.com/ianyh/Amethyst/issues/1676)
- [Amethyst #1713: Throw focused window to another space also switches to that space](https://github.com/ianyh/Amethyst/issues/1713)
- [Amethyst #1174: "Move to window to space" leaves a copy on the old space](https://github.com/ianyh/Amethyst/issues/1174)

### Hammerspoon
- [Hammerspoon #3698: hs.spaces.moveWindowToSpace does not work on macOS 15.0 Sequoia](https://github.com/Hammerspoon/hammerspoon/issues/3698)

### Accessibility API / _AXUIElementGetWindow
- [alt-tab-macos AXUIElement.swift](https://github.com/lwouis/alt-tab-macos/blob/master/src/api-wrappers/AXUIElement.swift) -- Real-world usage of _AXUIElementGetWindow
- [Rectangle AccessibilityElement.swift](https://github.com/rxhanson/Rectangle/blob/main/Rectangle/AccessibilityElement.swift)
- [Obtaining Window ID on macOS](https://www.symdon.info/posts/1729078231/)
- [DFAXUIElement -- Swift Accessibility API wrapper](https://github.com/DevilFinger/DFAXUIElement)

### AeroSpace (Alternative Architecture)
- [AeroSpace GitHub](https://github.com/nikitabobko/AeroSpace) -- i3-like tiling window manager using virtual workspaces
- [AeroSpace vs. Yabai comparison](https://www.oreateai.com/blog/aerospace-vs-yabai-navigating-the-future-of-macos-window-management/747b358f5efb3125b2ad53db851a3981)

### macOS Tahoe
- [macOS Tahoe Window Management Guide](https://macos-tahoe.com/blog/macos-tahoe-window-management-complete-guide-2025/)
- [macOS Tahoe Wikipedia](https://en.wikipedia.org/wiki/MacOS_Tahoe)
