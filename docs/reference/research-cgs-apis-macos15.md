# CGS Private API Behavior: macOS 15.x (Sequoia) and macOS 26 (Tahoe)

**Research Date:** 2026-04-10  
**Researcher:** Claude (Sonnet 4.6) — Commissioned by Jumpee project  
**Purpose:** Deep-dive reference for implementing the "move window to space" feature in Jumpee  
**Scope:** CGS space management APIs, `_AXUIElementGetWindow`, SIP requirements, yabai/Amethyst compatibility, community workarounds, macOS 26 Tahoe status  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [CGS API Reference: Function Signatures](#2-cgs-api-reference-function-signatures)
3. [CGS API Behavior by macOS Version](#3-cgs-api-behavior-by-macos-version)
4. [Root Cause: Why the APIs Were Broken](#4-root-cause-why-the-apis-were-broken)
5. [SIP Requirements and Their Implications](#5-sip-requirements-and-their-implications)
6. [Error Codes and Failure Modes](#6-error-codes-and-failure-modes)
7. [_AXUIElementGetWindow: Status and Alternatives](#7-_axuielementgetwindow-status-and-alternatives)
8. [yabai: Sequoia and Tahoe Issues](#8-yabai-sequoia-and-tahoe-issues)
9. [Amethyst: The "compat aside" Failure](#9-amethyst-the-compat-aside-failure)
10. [Hammerspoon: hs.spaces Broken on Sequoia](#10-hammerspoon-hsspaces-broken-on-sequoia)
11. [Community Workarounds](#11-community-workarounds)
12. [Alternative Architectures: AeroSpace and FlashSpace](#12-alternative-architectures-aerospace-and-flashspace)
13. [Swift Code Examples](#13-swift-code-examples)
14. [macOS 26 Tahoe: Current Status](#14-macos-26-tahoe-current-status)
15. [Recommendations for Jumpee](#15-recommendations-for-jumpee)
16. [Assumptions and Scope](#16-assumptions-and-scope)
17. [References](#17-references)

---

## 1. Executive Summary

The private CGS (CoreGraphics Services) APIs used for moving windows between spaces — `CGSAddWindowsToSpaces`, `CGSRemoveWindowsFromSpaces`, and `CGSMoveWindowsToManagedSpace` — have been progressively restricted by Apple since macOS 14.5. On macOS 15 (Sequoia), these APIs are broken for regular apps without SIP disabled, and the breakage has continued and deepened through the Sequoia point releases (15.1, 15.2, 15.3, 15.4) and into macOS 26 (Tahoe).

**Key findings:**

- `CGSAddWindowsToSpaces` / `CGSRemoveWindowsFromSpaces` require the calling process to hold "connection rights" over the target window. Regular app connections (including Jumpee's) do not have these rights for windows owned by other processes.
- The specific error observed is `CGError(rawValue: 717863)` when attempting to set a "compat aside ID" — the internal mechanism used to assign a window to a space.
- On macOS 15.0, the move either silently fails (window stays on original space) or flickering occurs with no state change.
- On macOS 15.4+, the scripting addition injection into `Dock.app` (which yabai uses to get elevated CGS rights) also broke, adding another layer of failure.
- On macOS 26 Tahoe, the yabai scripting addition does not work at all as of the initial release, though patches have been released.
- `_AXUIElementGetWindow` continues to work on macOS 15 and 26 for identifying window IDs. It is unaffected by the space-move restriction — but does require non-sandboxed apps with Accessibility permission.
- The synthesized-system-shortcuts approach (Approach 3 in the prior investigation) remains the most reliable workaround that does not require SIP to be disabled.

---

## 2. CGS API Reference: Function Signatures

These are private, undocumented C functions in the SkyLight framework (previously referenced as CoreGraphics Services). They are not exported in any public header. The authoritative community header reference is [NUIKit/CGSInternal](https://github.com/NUIKit/CGSInternal/blob/master/CGSSpace.h).

### 2.1 Core Types

```c
// Connection ID — obtained via CGSMainConnectionID()
typedef int CGSConnectionID;

// Space ID — the internal integer ID for a desktop/space
typedef size_t CGSSpaceID;

// Window ID — CGWindowID is already defined in public CoreGraphics
typedef uint32_t CGWindowID;
```

### 2.2 Space Management Functions

```c
// Returns the ID of the currently active/visible space
CG_EXTERN CGSSpaceID CGSGetActiveSpace(CGSConnectionID cid);

// Returns an array of all space IDs matching the given mask
// Common masks: kCGSCurrentSpaceMask, kCGSAllSpacesMask
CG_EXTERN CFArrayRef CGSCopySpaces(CGSConnectionID cid, CGSSpaceMask mask);

// Given an array of window numbers, returns the IDs of spaces those windows occupy
CG_EXTERN CFArrayRef CGSCopySpacesForWindows(
    CGSConnectionID cid,
    CGSSpaceMask mask,
    CFArrayRef windowIDs
);

// Add windows to one or more spaces
// windows: CFArray of CGWindowID (as CFNumbers)
// spaces:  CFArray of CGSSpaceID (as CFNumbers)
CG_EXTERN void CGSAddWindowsToSpaces(
    CGSConnectionID cid,
    CFArrayRef windows,
    CFArrayRef spaces
);

// Remove windows from one or more spaces
// windows: CFArray of CGWindowID
// spaces:  CFArray of CGSSpaceID
CG_EXTERN void CGSRemoveWindowsFromSpaces(
    CGSConnectionID cid,
    CFArrayRef windows,
    CFArrayRef spaces
);

// Show/hide specific spaces (used for space switching animation)
CG_EXTERN void CGSShowSpaces(CGSConnectionID cid, CFArrayRef spaces);
CG_EXTERN void CGSHideSpaces(CGSConnectionID cid, CFArrayRef spaces);

// Change the active space for a given display (display identified by UUID string)
CG_EXTERN void CGSManagedDisplaySetCurrentSpace(
    CGSConnectionID cid,
    CFStringRef display,
    CGSSpaceID space
);

// Get and set display spaces info (returns array of display dictionaries)
// Each dictionary contains "Spaces" array with "ManagedSpaceID", "type", "uuid" keys
// This is what Jumpee already uses via CGSCopyManagedDisplaySpaces
CG_EXTERN CFArrayRef CGSCopyManagedDisplaySpaces(CGSConnectionID cid);
```

### 2.3 CGSMoveWindowsToManagedSpace

```c
// Less commonly used single-call variant
// Intended to combine the add+remove into one operation
// Behavior and availability on macOS 15+ is uncertain
CG_EXTERN void CGSMoveWindowsToManagedSpace(
    CGSConnectionID cid,
    CFArrayRef windows,
    CGSSpaceID space
);
```

**Note on `CGSMoveWindowsToManagedSpace`:** This function is referenced less frequently in open-source window managers. Amethyst and yabai both prefer the `CGSAddWindowsToSpaces` + `CGSRemoveWindowsFromSpaces` pair. The behavior of `CGSMoveWindowsToManagedSpace` on macOS 15+ has not been independently confirmed in community reports — it may have the same restrictions as the add/remove pair.

### 2.4 Swift Declaration Pattern

```swift
// Option A: @_silgen_name (pragmatic, works for simple C function signatures)
// NOTE: This applies Swift ABI. It works for these specific signatures on ARM64/x86_64
// but is technically incorrect. Jumpee already uses this pattern.

@_silgen_name("CGSMainConnectionID")
func CGSMainConnectionID() -> Int32

@_silgen_name("CGSGetActiveSpace")
func CGSGetActiveSpace(_ cid: Int32) -> Int

@_silgen_name("CGSAddWindowsToSpaces")
func CGSAddWindowsToSpaces(_ cid: Int32, _ windows: CFArray, _ spaces: CFArray)

@_silgen_name("CGSRemoveWindowsFromSpaces")
func CGSRemoveWindowsFromSpaces(_ cid: Int32, _ windows: CFArray, _ spaces: CFArray)

@_silgen_name("CGSMoveWindowsToManagedSpace")
func CGSMoveWindowsToManagedSpace(_ cid: Int32, _ windows: CFArray, _ space: Int)

@_silgen_name("CGSCopySpacesForWindows")
func CGSCopySpacesForWindows(_ cid: Int32, _ mask: Int, _ wids: CFArray) -> CFArray
```

```swift
// Option B: Bridging header (more correct for C functions, but requires .h file)
// In a bridging header (.h):
//   extern int CGSMainConnectionID(void);
//   extern size_t CGSGetActiveSpace(int cid);
//   extern void CGSAddWindowsToSpaces(int cid, CFArrayRef windows, CFArrayRef spaces);
//   extern void CGSRemoveWindowsFromSpaces(int cid, CFArrayRef windows, CFArrayRef spaces);
//   extern CFArrayRef CGSCopySpacesForWindows(int cid, int mask, CFArrayRef wids);
```

### 2.5 Critical Ordering Constraint (macOS 14.5+)

**The add must happen BEFORE the remove.** This was discovered by Amethyst contributors and is documented in multiple community issues:

> On macOS 14.5+, `CGSRemoveWindowsFromSpaces` will NOT remove a window from a space if it would leave the window with no space assignment. If you call remove before add, the remove is a no-op (the window stays on the original space). The correct sequence is: (1) add to target space, (2) remove from original space.

This ordering requirement applies when the APIs are functional at all. On macOS 15+, the APIs may fail entirely regardless of ordering.

---

## 3. CGS API Behavior by macOS Version

| macOS Version | CGS Move Works? | Requires SIP Off? | Notes |
|---------------|-----------------|-------------------|-------|
| 13 Ventura | Yes | No | Full functionality |
| 14.0 – 14.4 Sonoma | Yes | No | Full functionality |
| 14.5 Sonoma | Yes (with fix) | No | Add-before-remove ordering required |
| 15.0 Sequoia | Broken | SIP off: unclear; SIP on: broken | Window flickers but stays on original space. CGError 717863. |
| 15.1 Sequoia | Broken | SIP off required | `yabai -m window --space N` moves window down rather than to new space |
| 15.1.1 – 15.3 | Broken | SIP off required | Consistent with 15.0/15.1 behavior |
| 15.3.2 | Broken | SIP off required | Reported: window disappears from current space but does not appear on target space |
| 15.4 | Broken + injection failure | SIP off required | Scripting addition injection into Dock.app also broke in 15.4 |
| 26 Tahoe (initial) | Broken | SIP off required; SA broken | yabai scripting addition completely non-functional at initial release |
| 26.1 – 26.2 Beta | Partially fixed | SIP off required | Community patches partially restoring functionality |

**Important nuance for Sequoia:** Multiple community reports distinguish between two failure modes:

1. **Silent no-op:** The CGS calls return without error but the window does not move. This is the most common reported behavior.
2. **Forced space switch:** The OS follows the window to the target space even when the intent is to move-without-following. This was specifically observed on macOS 15.0 in early reports.

The "forced space switch" behavior may have been a temporary anomaly in 15.0 beta, as later reports describe pure no-op behavior rather than forced following.

---

## 4. Root Cause: Why the APIs Were Broken

The architectural explanation comes from the yabai developer's response in the community forum discussion [Questions regarding SIP and requesting a real Spaces API](https://github.com/asmvik/yabai/discussions/2274):

### 4.1 The Connection Rights Model

The **SkyLight framework** is a client-side IPC interface that communicates with the macOS **WindowServer** process using Mach messages. Every application has a connection to the WindowServer, and this connection is used as an **authorization mechanism**.

The connection determines which windows you are allowed to modify. Critically:
- Each application's connection only has rights over its **own windows**.
- Other processes' windows are protected — calling CGS functions on them results in a no-op or error.

### 4.2 Why It Worked Before

Prior to macOS 14.5, the `CGSAddWindowsToSpaces` / `CGSRemoveWindowsFromSpaces` functions **did not check connection rights** for the window argument. They were unprotected in this regard. This allowed any process with Accessibility permission to move any window between spaces.

**Starting with macOS 14.5, Apple added a "connection_holds_rights_on_window" check** to the space assignment functions. Now, only the application that owns the window (or a process with universal owner rights, like Dock.app) can reassign the window to a different space.

From the yabai developer:
> The function itself is not protected, but the target of the function (i.e., the window to modify) is protected. So the function results in a no-op because you are not authorized to modify that window.

### 4.3 Why Dock.app Injection Is the Only Solution

The **entire spaces system** in macOS is implemented in `Dock.app`, but uses underlying API calls implemented in **SkyLight.framework**. The Dock process's connection to the WindowServer is flagged as a **"universal owner"** — it has elevated privileges and can modify window properties for any window, bypassing the connection rights check.

The `yabai` scripting addition works by injecting code into the Dock process to use the Dock's elevated connection for CGS space management calls. This is why:
- Features requiring space management in yabai require SIP to be partially disabled (to allow injection into Dock).
- SIP-enabled yabai installations cannot move windows between spaces.

### 4.4 The 15.4 Injection Failure

Separately from the CGS rights tightening, macOS 15.4 added a further restriction on the remote thread injection mechanism used by yabai's scripting addition:

```
could not spawn remote thread: (os/kern) invalid argument
yabai: scripting-addition failed to inject payload into Dock.app!
```

This is a Mach port security change that prevents the spawning of remote threads in system processes like Dock. Each new macOS version has historically required yabai to find new injection techniques. The 15.4 regression was specific enough that rolling back to yabai v7.1.16 (before the breakage was introduced) temporarily resolved it for some users.

---

## 5. SIP Requirements and Their Implications

### 5.1 What SIP Disablement Enables

From the yabai documentation, the following features require partially disabling SIP:
- Moving windows between spaces
- Creating and destroying spaces
- Removing window shadows
- Enabling window transparency
- Enabling window animations for switching spaces
- Scratchpad windows

Without SIP disabled (and scripting addition loaded), yabai can still:
- Read the current space
- Focus windows
- Resize/reposition windows within the current space
- React to space change notifications

### 5.2 Implications for Jumpee

Jumpee is a regular macOS app — it is not a scripting addition and has no mechanism to inject into Dock.app. Therefore:

- **CGS space move APIs will not work on macOS 15+ for windows owned by other processes**, regardless of Jumpee's entitlements or code signing configuration.
- This is not a permissions issue solvable with entitlements or provisioning profiles. It is a fundamental WindowServer connection rights restriction.
- Jumpee cannot replicate yabai's approach without becoming a far more invasive system tool (requiring SIP disabled and a privileged injection mechanism).

### 5.3 Partial Exception: Multi-Monitor Visible Spaces

One community report noted a partial exception: on multi-monitor setups, moving windows **between two spaces that are both currently visible** (one on each display) works without SIP disabled, even on Sequoia. This is because the window server may treat currently-visible spaces differently.

This exception is narrow and not practically useful for a general "move to any space" feature.

---

## 6. Error Codes and Failure Modes

### 6.1 CGError 717863

This is the primary error reported by Amethyst on macOS 15 when attempting to move a window to another space:

```
❤️ ERROR Window.move():388 - failed to set compat aside id: CGError(rawValue: 717863)
```

The "compat aside ID" is an internal Window Server concept used during space transitions. The error indicates the WindowServer rejected the request to associate the window with a different space, because the calling connection does not have rights over that window.

**CGError 717863 in hex:** `0xAF447` — this is not a documented error code in Apple's public CGError enum. It is a private WindowServer error originating from the space assignment code path in SkyLight.

### 6.2 Silent No-Op (Most Common)

On macOS 15.0+, the most commonly reported behavior for `CGSAddWindowsToSpaces` is a **silent no-op**: the call returns without error, but `CGSCopySpacesForWindows` queried immediately after still returns the original space. The window does not move.

This makes the failure particularly insidious — there is no error to catch. Code that assumes successful return = success will behave incorrectly.

**Detection:** Query `CGSCopySpacesForWindows` after the move to verify the window is now on the target space. If not, the move silently failed.

```swift
// Detection pattern for verifying a move succeeded
func didWindowMove(windowID: CGWindowID, toSpace targetSpaceID: Int) -> Bool {
    let cid = CGSMainConnectionID()
    let windowIDs = [windowID] as CFArray
    guard let spaces = CGSCopySpacesForWindows(cid, kCGSAllSpacesMask, windowIDs) as? [Int] else {
        return false
    }
    return spaces.contains(targetSpaceID)
}
```

### 6.3 Window Disappears on Move (15.3.2 regression)

A specific regression reported on macOS 15.3.2: when `CGSAddWindowsToSpaces` is called, the window disappears from the current space but does not appear on the target space. The window is effectively lost until Mission Control is opened, at which point it reappears.

This may indicate that the add call partially succeeds (adding to target) but then the remove call also silently fails in a different way, leaving the window in an inconsistent state.

---

## 7. _AXUIElementGetWindow: Status and Alternatives

### 7.1 Current Status on macOS 15 and 26

`_AXUIElementGetWindow` **continues to function on macOS 15 and macOS 26** as of the research date. It is the standard way to obtain a `CGWindowID` from an `AXUIElementRef`, and it is used by every major window manager (AeroSpace, Amethyst, Rectangle, alt-tab-macos, Hammerspoon).

However, there are important caveats:

| Condition | _AXUIElementGetWindow Behavior |
|-----------|-------------------------------|
| Normal app window | Works, returns valid CGWindowID |
| Sandboxed app | Unavailable (requires non-sandboxed environment) |
| Screen locked | Returns kAXErrorIllegalArgument or AXError; all elements fail |
| System UI elements (menu bar, Dock) | Returns invalid/zero window ID |
| Notification Center items | Unreliable |
| Apps interfering with notifications (Contexts, Amazon Q) | macOS Sequoia stops sending kAXUIElementDestroyedNotification for all apps — does not affect get, but affects window tracking |

### 7.2 Declaration Pattern

```swift
// In Swift, using @_silgen_name (Jumpee's existing pattern):
@_silgen_name("_AXUIElementGetWindow")
func _AXUIElementGetWindow(
    _ element: AXUIElement,
    _ wid: UnsafeMutablePointer<CGWindowID>
) -> AXError

// Usage:
var windowID = CGWindowID(0)
let axError = _AXUIElementGetWindow(axWindowElement, &windowID)
if axError == .success && windowID != 0 {
    // windowID is valid
}
```

```c
// C declaration (for bridging header):
extern AXError _AXUIElementGetWindow(AXUIElementRef element, CGWindowID *windowID);
```

### 7.3 Getting the Focused Window's AXUIElement

```swift
func getFocusedWindowElement() -> AXUIElement? {
    // Get frontmost application
    guard let frontApp = NSWorkspace.shared.frontmostApplication else { return nil }
    let pid = frontApp.processIdentifier
    
    // Create AX element for the application
    let appElement = AXUIElementCreateApplication(pid)
    
    // Get the focused window
    var focusedWindow: CFTypeRef?
    let result = AXUIElementCopyAttributeValue(
        appElement,
        kAXFocusedWindowAttribute as CFString,
        &focusedWindow
    )
    
    guard result == .success, let windowElement = focusedWindow else { return nil }
    return (windowElement as! AXUIElement)
}
```

### 7.4 Fallback: CGWindowListCopyWindowInfo Matching

When `_AXUIElementGetWindow` returns `kAXErrorIllegalArgument` or a zero window ID, a fallback approach using public APIs is:

```swift
func getFocusedWindowIDFallback(pid: pid_t) -> CGWindowID? {
    // Get all on-screen windows
    let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
    guard let windowList = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
        return nil
    }
    
    // Filter by PID to get this app's windows
    let appWindows = windowList.filter { 
        ($0[kCGWindowOwnerPID as String] as? pid_t) == pid
    }
    
    // Filter to non-zero layer, non-menu-bar windows
    let userWindows = appWindows.filter {
        let layer = $0[kCGWindowLayer as String] as? Int ?? 0
        let isOnScreen = $0[kCGWindowIsOnscreen as String] as? Bool ?? false
        return layer == 0 && isOnScreen
    }
    
    // If only one candidate, use it; otherwise need bounds matching
    if userWindows.count == 1 {
        return userWindows[0][kCGWindowNumber as String] as? CGWindowID
    }
    
    // With multiple windows: try to match frontmost via AX bounds
    // (get bounds from AXUIElement, match to kCGWindowBounds)
    return nil  // Multi-window case requires additional matching logic
}
```

**Limitation:** `CGWindowListCopyWindowInfo` only returns on-screen windows. Windows on other spaces are not included unless using `CGWindowListOption.optionAll`, which requires Screen Recording permission on macOS 12+.

### 7.5 macOS 26 Regression: CGWindowListCopyWindowInfo Menu Bar Items

A new regression in macOS 26 has been filed as `FB18327911`: `CGWindowListCopyWindowInfo` returns all status items as belonging to Apple's Control Center rather than their respective apps. This affects window enumeration logic that filters by `kCGWindowOwnerPID`.

This does not affect `_AXUIElementGetWindow` directly, but it means the fallback approach (matching via `CGWindowListCopyWindowInfo`) becomes less reliable on macOS 26.

---

## 8. yabai: Sequoia and Tahoe Issues

### 8.1 Timeline of Breakage

**macOS 15.0 (September 2024)**
- Window-to-space movement broken for users with SIP enabled
- `yabai -m window --space N` either does nothing or moves window position without changing space
- Source: [yabai issue #2380](https://github.com/koekeishiya/yabai/issues/2380)

**macOS 15.1 (October 2024)**
- Confirmed breakage: window stays in current space or moves vertically instead of to target space
- `sudo yabai --load-sa` failing for some users
- Source: [yabai issue #2441](https://github.com/asmvik/yabai/issues/2441)

**macOS 15.1.1 (December 2024)**
- Complete yabai failure reported on fresh Sequoia installs even with SIP disabled
- `yabai -m space --focus next` returning "failed to connect to socket"
- Source: [yabai issue #2487](https://github.com/asmvik/yabai/issues/2487)

**macOS 15.3.2 (early 2025)**
- Window disappears from current space but does not appear on target space when moved
- Source: [yabai issue #2591](https://github.com/asmvik/yabai/issues/2591)

**macOS 15.4 (2025)**
- Scripting addition injection into Dock.app fails with new error:
  ```
  could not spawn remote thread: (os/kern) invalid argument
  yabai: scripting-addition failed to inject payload into Dock.app!
  ```
- All space-related commands stop working
- Workaround found: roll back to yabai v7.1.16
- Source: [yabai issue #2589](https://github.com/koekeishiya/yabai/issues/2589)

### 8.2 Architecture of yabai's Scripting Addition

The scripting addition is installed as `/Library/ScriptingAdditions/yabai.osax` and uses a loader + payload bundle architecture:
- `loader` process runs under `com.koekeishiya.yabai-osax`
- The loader spawns a remote thread in Dock.app
- The payload (injected code) uses the Dock's WindowServer connection (which has universal owner rights) to call CGS functions on behalf of yabai
- When injection fails: `EXC_GUARD (SIGKILL)` / `GUARD_TYPE_MACH_PORT`

Each macOS release changes the hex patterns and offsets yabai uses to locate injection targets. The scripting addition requires a new release for every major and many point macOS releases.

### 8.3 yabai-tahoe Fork

The [yabai-tahoe fork](https://github.com/tbiehn/yabai-tahoe) was created to track macOS 26 Tahoe compatibility for the original yabai. Key status:
- yabai-sa (scripting addition) does not work on macOS 26 at initial release
- PR #2644 in the main yabai repo tracks macOS 26 support
- As of late 2025, patches have been released and things are "mostly working again" per community reports
- Some users on macOS 26.2 Beta report that `yabai -m space --focus 1` and `yabai -m window --space 1` still fail silently

The pattern is consistent: every major macOS release requires a new yabai release. Minor point releases (e.g., 15.3 → 15.4) can also break the scripting addition.

---

## 9. Amethyst: The "compat aside" Failure

### 9.1 The Error

From [Amethyst issue #1662](https://github.com/ianyh/Amethyst/issues/1662), filed June 2024 against macOS 15.0 Beta:

```
14:49:28.723 ❤️ ERROR Window.move():388 - failed to set compat aside id: CGError(rawValue: 717863)
```

The "compat aside ID" is set in `Window.move()` in Amethyst's Silica framework. This is the call that associates a window with a specific space in the WindowServer's internal state.

### 9.2 Amethyst's Behavior

After this error:
- The window flickers briefly (indicating the OS began a space transition)
- The window returns to its original space
- A `remove(window:)` event fires, followed by an `add(window:)` event for the same window on the same screen
- The `applicationActivate` event fires after the failed move

This confirms the failure is at the WindowServer level, not in Amethyst's code. The CGS call is accepted (no exception), begins executing, then is rejected by the connection rights check, and the WindowServer rolls back the state.

### 9.3 Amethyst's Documented Workaround

The Amethyst team documented that on Sequoia, `CGSRemoveWindowsFromSpaces` + `CGSAddWindowsToSpaces` no longer work reliably. Their approach is:
1. Attempt the CGS move
2. Detect if the move succeeded by checking `CGSCopySpacesForWindows`
3. If not, consider the feature partially broken and note it in release notes

Amethyst does not use Dock.app injection (unlike yabai), so it cannot access the elevated connection rights. As a consequence, Amethyst's "throw window to space" feature became effectively non-functional on Sequoia for most users.

---

## 10. Hammerspoon: hs.spaces Broken on Sequoia

From [Hammerspoon issue #3698](https://github.com/Hammerspoon/hammerspoon/issues/3698):

`hs.spaces.moveWindowToSpace` returns `true` (success) on macOS 15.0 without actually moving the window. This is consistent with the CGS silent no-op behavior.

Hammerspoon's `hs.spaces` module is documented as "experimental" and uses "a combination of private APIs and Accessibility hacks." The module is backed by the same CGS private APIs, so it suffers from the same restrictions.

**EnhancedSpaces.spoon** was created as a Hammerspoon workaround that implements virtual spaces at the Hammerspoon level rather than relying on macOS's native space assignment API.

---

## 11. Community Workarounds

### 11.1 Workaround 1: Synthesized System Shortcuts (Recommended for Jumpee)

macOS provides built-in "Move window to Desktop N" shortcuts that can be enabled in:
**System Settings > Keyboard > Keyboard Shortcuts > Mission Control**

These are disabled by default. When enabled, they use macOS's own internal mechanism to move windows, which:
- Does not use CGS connection rights
- Works with SIP enabled
- Works on all macOS versions including 15+ and 26
- Produces a smooth animation

This is the approach recommended for Jumpee (Approach 3 in `investigation-window-move.md`).

**Key caveat:** The user must enable these shortcuts manually. The default bindings are typically `Ctrl+Shift+1`, `Ctrl+Shift+2`, etc., but they may be unset (blank) and require the user to assign them.

**Jumpee implementation:** Synthesize the keyboard shortcut via `CGEvent` (same mechanism as the existing `SpaceNavigator`). The challenge is knowing which key combination the user has assigned — Jumpee would need to either:
- Require the user to configure the shortcut in both macOS System Settings and in Jumpee's config.json, or
- Read the shortcut from `com.apple.symbolichotkeys` user defaults (the plist that stores Mission Control shortcut configuration)

### 11.2 Workaround 2: yabai with SIP Disabled

For power users willing to disable SIP, yabai's scripting addition approach remains functional (with the caveat that each macOS update may require a yabai update). This is not applicable to Jumpee, which is a regular app.

### 11.3 Workaround 3: EnhancedSpaces.spoon (Hammerspoon)

A Hammerspoon Spoon that implements virtual spaces using show/hide at the Hammerspoon level, bypassing macOS Spaces entirely. Requires Hammerspoon.

Source: [franzbu/EnhancedSpaces.spoon](https://github.com/franzbu/EnhancedSpaces.spoon)

### 11.4 Workaround 4: AeroSpace / FlashSpace Architecture

Tools that implement their own virtual workspaces without using macOS Spaces:
- **AeroSpace**: Moves windows off-screen (far negative coordinates) to simulate invisible workspaces
- **FlashSpace**: Uses macOS app hide/unhide to switch between workspaces

These are architectural alternatives that require becoming a full workspace manager, not applicable to Jumpee's lightweight design.

---

## 12. Alternative Architectures: AeroSpace and FlashSpace

### 12.1 AeroSpace

[AeroSpace](https://github.com/nikitabobko/AeroSpace) implements i3-like tiling window management on macOS with a critical design principle:

> AeroSpace employs its own emulation of virtual workspaces instead of relying on native macOS Spaces due to their considerable limitations.

**How it works:**
- All windows exist on a single macOS Space
- "Invisible" workspace windows are moved far off-screen (e.g., x = -10000) via the public Accessibility API
- "Active" workspace windows are moved to the visible screen area
- When you switch workspaces, AeroSpace repositions windows, not macOS Spaces

**CGS API usage:**
- AeroSpace uses exactly ONE private API: `_AXUIElementGetWindow` (to get a CGWindowID from an AXUIElement)
- Everything else uses the public macOS Accessibility API
- No SIP required, no Dock.app injection

**Tradeoffs:**
- No native macOS Spaces integration (no swipe gestures, no Mission Control view)
- Windows from "other workspaces" are literally off-screen, not in different Spaces
- Requires all windows to be on a single macOS Space
- Disabling AeroSpace temporarily causes all "invisible" workspace windows to pile onto the screen

**Relevance to Jumpee:** Jumping to a space works the same way in AeroSpace (just repositioning visible windows). However, Jumpee's design is to display real macOS Space names, not virtual workspaces.

### 12.2 FlashSpace

[FlashSpace](https://github.com/wojciech-kulik/FlashSpace) takes a different approach:

**How it works:**
- Assigns apps (not individual windows) to workspaces
- When switching to a workspace: show assigned apps, hide all others
- Uses macOS's native `NSRunningApplication.hide()` / `NSRunningApplication.unhide()` functionality
- Does not use any CGS private APIs for space management

**Key limitations:**
- Cannot assign individual windows to workspaces — entire apps are assigned
- `NSHide`/`NSUnhide` is app-level, not window-level (due to lack of a public per-window hide API)
- Special handling for Picture-in-Picture (moves PiP window to screen corner rather than hiding it)

**Relevance to Jumpee:** FlashSpace's approach is not applicable for a feature that targets specific windows, since it operates at the application level.

---

## 13. Swift Code Examples

### 13.1 Complete Window Move Implementation (with failure detection)

```swift
import AppKit
import ApplicationServices

// MARK: - Private API Declarations

@_silgen_name("CGSMainConnectionID")
func CGSMainConnectionID() -> Int32

@_silgen_name("CGSGetActiveSpace")
func CGSGetActiveSpace(_ cid: Int32) -> Int

@_silgen_name("CGSAddWindowsToSpaces")
func CGSAddWindowsToSpaces(_ cid: Int32, _ windows: CFArray, _ spaces: CFArray)

@_silgen_name("CGSRemoveWindowsFromSpaces")
func CGSRemoveWindowsFromSpaces(_ cid: Int32, _ windows: CFArray, _ spaces: CFArray)

@_silgen_name("CGSCopySpacesForWindows")
func CGSCopySpacesForWindows(_ cid: Int32, _ mask: Int, _ wids: CFArray) -> CFArray

@_silgen_name("_AXUIElementGetWindow")
func _AXUIElementGetWindow(_ element: AXUIElement, _ wid: UnsafeMutablePointer<CGWindowID>) -> AXError

// MARK: - Constants

let kCGSAllSpacesMask: Int = 0x7  // CGSSpaceIncludesUser | CGSSpaceIncludesOthers | CGSSpaceIncludesCurrent

// MARK: - Window Identification

/// Get the CGWindowID of the currently focused window via Accessibility API.
/// Returns nil if the window ID cannot be determined.
func getFocusedWindowID() -> CGWindowID? {
    guard let frontApp = NSWorkspace.shared.frontmostApplication else {
        return nil
    }
    let pid = frontApp.processIdentifier
    let appElement = AXUIElementCreateApplication(pid)
    
    // Get the focused window element
    var focusedWindowRef: CFTypeRef?
    let axResult = AXUIElementCopyAttributeValue(
        appElement,
        kAXFocusedWindowAttribute as CFString,
        &focusedWindowRef
    )
    
    guard axResult == .success, let ref = focusedWindowRef else {
        return nil
    }
    
    // Get the CGWindowID from the AX element
    let windowElement = ref as! AXUIElement
    var windowID = CGWindowID(0)
    let windowResult = _AXUIElementGetWindow(windowElement, &windowID)
    
    guard windowResult == .success && windowID != 0 else {
        return nil
    }
    
    return windowID
}

// MARK: - Space Query

/// Returns the space IDs the given window is currently on.
func spacesForWindow(_ windowID: CGWindowID) -> [Int] {
    let cid = CGSMainConnectionID()
    let windowIDs = [Int(windowID)] as CFArray
    guard let result = CGSCopySpacesForWindows(cid, kCGSAllSpacesMask, windowIDs) as? [Int] else {
        return []
    }
    return result
}

// MARK: - Move Operation

enum WindowMoveResult {
    case success
    case noWindowFocused
    case cgsMoveAttemptedButFailed   // Silent no-op from macOS 15+ restriction
    case unknownError(String)
}

/// Attempt to move the focused window to the given space using CGS private APIs.
/// On macOS 15+, this will likely return .cgsMoveAttemptedButFailed due to connection rights restrictions.
/// Returns whether the move actually succeeded (verified via post-move space query).
func moveWindowToSpace(windowID: CGWindowID, targetSpaceID: Int) -> WindowMoveResult {
    let cid = CGSMainConnectionID()
    let currentSpaces = spacesForWindow(windowID)
    
    guard !currentSpaces.isEmpty else {
        return .unknownError("Could not determine current space for window \(windowID)")
    }
    
    // Add-before-remove is required on macOS 14.5+ to avoid the window losing all space assignments
    let windowIDs = [Int(windowID)] as CFArray
    let targetSpaces = [targetSpaceID] as CFArray
    
    // Step 1: Add to target space
    CGSAddWindowsToSpaces(cid, windowIDs, targetSpaces)
    
    // Step 2: Remove from all original spaces
    let originalSpaces = currentSpaces as CFArray
    CGSRemoveWindowsFromSpaces(cid, windowIDs, originalSpaces)
    
    // Step 3: Verify the move actually happened
    let newSpaces = spacesForWindow(windowID)
    if newSpaces.contains(targetSpaceID) && !newSpaces.contains(where: { currentSpaces.contains($0) }) {
        return .success
    } else {
        // The move was silently rejected by the WindowServer (macOS 15+ behavior)
        return .cgsMoveAttemptedButFailed
    }
}

// MARK: - Synthesized Shortcut Fallback

/// Read the user's configured "Move window to Desktop N" shortcut from Mission Control preferences.
/// Returns the key code and modifiers if configured, nil if not set.
/// This reads from com.apple.symbolichotkeys, which stores Mission Control shortcut configuration.
///
/// Symbolic hotkey IDs for "Move window to Desktop N":
///   Desktop 1: ID 36, Desktop 2: ID 37, ... Desktop 9: ID 44
func getMoveWindowShortcut(desktopIndex: Int) -> (keyCode: Int, modifiers: Int)? {
    // Hotkey IDs: Move to Desktop 1 = 36, Desktop 2 = 37, ..., Desktop 9 = 44
    guard desktopIndex >= 1 && desktopIndex <= 9 else { return nil }
    let hotkeyID = 35 + desktopIndex  // ID 36 for Desktop 1
    
    guard let prefs = UserDefaults(suiteName: "com.apple.symbolichotkeys")?.dictionaryRepresentation(),
          let hotkeys = prefs["AppleSymbolicHotKeys"] as? [String: Any],
          let entry = hotkeys["\(hotkeyID)"] as? [String: Any],
          let enabled = entry["enabled"] as? Bool, enabled,
          let value = entry["value"] as? [String: Any],
          let parameters = value["parameters"] as? [Int],
          parameters.count >= 3 else {
        return nil
    }
    
    // parameters[1] = key code, parameters[2] = modifier flags
    return (keyCode: parameters[1], modifiers: parameters[2])
}

/// Synthesize the "Move window to Desktop N" system keyboard shortcut via CGEvent.
/// Requires the "Move window to Desktop N" shortcuts to be enabled in System Settings.
/// Returns true if the shortcut was found and synthesized, false if not configured.
func synthesizeMoveWindowShortcut(desktopIndex: Int) -> Bool {
    guard let shortcut = getMoveWindowShortcut(desktopIndex: desktopIndex) else {
        return false
    }
    
    let source = CGEventSource(stateID: .hidSystemState)
    let keyDown = CGEvent(keyboardEventSource: source, virtualKey: CGKeyCode(shortcut.keyCode), keyDown: true)
    let keyUp = CGEvent(keyboardEventSource: source, virtualKey: CGKeyCode(shortcut.keyCode), keyDown: false)
    
    // CGEvent modifier flags use different bits than NSEvent modifierFlags
    let cgModifiers = CGEventFlags(rawValue: UInt64(shortcut.modifiers))
    keyDown?.flags = cgModifiers
    keyUp?.flags = cgModifiers
    
    keyDown?.post(tap: .cgSessionEventTap)
    keyUp?.post(tap: .cgSessionEventTap)
    
    return true
}

// MARK: - Combined Move (CGS + Fallback)

/// Move the focused window to the target desktop.
/// Tries CGS APIs first; falls back to synthesized system shortcut if CGS fails.
func moveFocusedWindowToDesktop(index: Int, targetSpaceID: Int) {
    guard let windowID = getFocusedWindowID() else {
        // No focused window or couldn't determine window ID
        return
    }
    
    let result = moveWindowToSpace(windowID: windowID, targetSpaceID: targetSpaceID)
    
    switch result {
    case .success:
        // CGS move succeeded (macOS 13-14)
        break
        
    case .cgsMoveAttemptedButFailed:
        // macOS 15+ restriction: fall back to system shortcut
        let synthesized = synthesizeMoveWindowShortcut(desktopIndex: index)
        if !synthesized {
            // System shortcut not configured — inform user
            // (e.g., via Jumpee's overlay system)
            NSLog("Jumpee: Move window requires 'Move window to Desktop N' shortcuts enabled in System Settings")
        }
        
    case .noWindowFocused, .unknownError:
        break
    }
}
```

### 13.2 Checking CGWindowListCopyWindowInfo Requires Screen Recording on macOS 12+

```swift
/// Check if the app has Screen Recording permission (needed for off-screen window enumeration).
func hasScreenRecordingPermission() -> Bool {
    if #available(macOS 12.3, *) {
        return CGPreflightScreenCaptureAccess()
    }
    // On older versions, attempt to access and check if we got data
    let options: CGWindowListOption = [.optionAll]
    let windowList = CGWindowListCopyWindowInfo(options, kCGNullWindowID)
    return windowList != nil
}
```

### 13.3 Verifying Accessibility Permission (Jumpee Already Does This)

```swift
/// Check and request Accessibility permission.
/// _AXUIElementGetWindow requires this permission.
func checkAccessibilityPermission() -> Bool {
    let options: NSDictionary = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true]
    return AXIsProcessTrustedWithOptions(options)
}
```

---

## 14. macOS 26 Tahoe: Current Status

### 14.1 CGS API Status

As of the yabai community's reports:
- The CGS space assignment restriction introduced in macOS 15 carries forward to macOS 26
- yabai's scripting addition did not work at the initial macOS 26 release
- PR #2644 in yabai tracked macOS 26 support
- As of late 2025, community patches have been released and functionality is partially restored
- macOS 26.2 Beta introduced new breakage: `yabai -m space --focus 1` and `yabai -m window --space 1` fail silently again

### 14.2 New Regression: CGWindowListCopyWindowInfo

As noted in Section 7.5, macOS 26 introduced `FB18327911`: status bar items are all reported as belonging to Control Center rather than their actual owning apps. This is a regression in `CGWindowListCopyWindowInfo` that affects window enumeration logic.

For Jumpee, this means the fallback window identification approach (via `kCGWindowOwnerPID` matching) becomes less reliable on macOS 26 when the frontmost app happens to be a status bar item.

### 14.3 AeroSpace on Tahoe

AeroSpace continued to work on macOS 26 because it does not rely on CGS space assignment — it only uses `_AXUIElementGetWindow` and the public Accessibility API. This is strong evidence that `_AXUIElementGetWindow` itself remained functional on Tahoe.

### 14.4 FlashSpace on Tahoe

FlashSpace continued to work on macOS 26 (minimum requirement remains macOS 14.0). Since FlashSpace uses only `NSRunningApplication.hide()` / `NSRunningApplication.unhide()`, it is unaffected by CGS restrictions.

---

## 15. Recommendations for Jumpee

Based on this research, the following implementation strategy is recommended:

### 15.1 Implementation Priority

**Primary mechanism:** Synthesized system shortcuts (Approach 3 from `investigation-window-move.md`)
- This is the only reliable approach on macOS 15+
- Does not require SIP disabled
- Does not depend on CGS connection rights
- Will continue working on macOS 26 and beyond

**Secondary mechanism:** CGS APIs as opportunistic attempt on older macOS
- Attempt `CGSAddWindowsToSpaces` first
- Detect failure via `CGSCopySpacesForWindows` post-check
- Fall back to synthesized shortcuts automatically on failure
- This provides instant operation on macOS 13-14 with graceful degradation on 15+

### 15.2 User Setup Requirement

For the synthesized shortcut approach, users must enable "Move window to Desktop N" shortcuts in System Settings. Jumpee should:
1. Detect whether these shortcuts are configured (via `com.apple.symbolichotkeys` plist)
2. Show a clear message in the menu or overlay if they are not configured
3. Provide a menu item "Open Mission Control Shortcuts..." that opens the relevant System Settings pane

Reading the shortcuts from `com.apple.symbolichotkeys` allows Jumpee to synthesize the exact shortcut the user has configured, rather than assuming a default.

### 15.3 _AXUIElementGetWindow Remains Safe

`_AXUIElementGetWindow` is confirmed working on macOS 15 and 26 and should be used as the primary method for obtaining window IDs. It remains the standard approach across all major window managers.

The fallback via `CGWindowListCopyWindowInfo` is appropriate for error handling but should not be the primary path due to the macOS 26 regression and the Screen Recording permission requirement for off-screen windows.

### 15.4 Documentation for Users

Jumpee should clearly document:
- On macOS 13-14: CGS direct move works with no additional configuration
- On macOS 15+: Requires "Move window to Desktop N" shortcuts enabled in System Settings
- SIP does not need to be disabled (Jumpee cannot and does not require this)
- The macOS 26 status is "best effort" pending Apple's ongoing API changes

---

## 16. Assumptions and Scope

| Assumption | Confidence | Impact if Wrong |
|------------|------------|-----------------|
| `_AXUIElementGetWindow` works on macOS 15 and 26 | HIGH — confirmed by AeroSpace and alt-tab-macos being functional | Low: would need to rely solely on CGWindowListCopyWindowInfo fallback |
| CGS move APIs require Dock.app injection (yabai approach) to work on Sequoia | HIGH — confirmed by multiple independent sources and yabai architecture docs | Low: if wrong, Jumpee's Accessibility permission would be sufficient |
| Synthesized system shortcuts work on macOS 15 and 26 | MEDIUM — inferred from the shortcuts being a native macOS mechanism, not directly tested | High: if broken, no reliable window move path exists without SIP |
| The "add before remove" ordering is required starting from 14.5 (not 15.0) | MEDIUM — sourced from community reports; exact version is uncertain | Low: the ordering is correct regardless, it's just a caveat |
| CGSMoveWindowsToManagedSpace has the same restrictions as add+remove | MEDIUM — inferred from same connection rights model; not directly confirmed | Low: behavior likely identical |

### Out of Scope

This research does not cover:
- Moving windows across displays (only within-display space moves)
- Specific implementation of the Jumpee `WindowMover` class
- Automated testing approaches for these APIs
- Rectangle Pro or other commercial tools' implementation details

### Uncertainties

- The exact CGError value 717863 is not documented in Apple's public headers. Its exact semantic meaning beyond "connection rights failure" is unknown.
- Whether `CGSMoveWindowsToManagedSpace` behaves differently from the add/remove pair on macOS 15+ is unknown from publicly available information.
- The "forced space switch" behavior reported on early macOS 15.0 betas may have been fixed in subsequent point releases — later reports describe pure no-op behavior.
- The macOS 26 synthesized shortcut behavior has not been directly tested.

---

## 17. References

### CGS API Headers and Documentation

| Source | URL | Information Gathered |
|--------|-----|---------------------|
| NUIKit/CGSInternal — CGSSpace.h | https://github.com/NUIKit/CGSInternal/blob/master/CGSSpace.h | Complete CGS space function signatures, type definitions, space masks |
| Raw CGSSpace.h content | https://raw.githubusercontent.com/NUIKit/CGSInternal/master/CGSSpace.h | Actual C header with all CGS space functions |

### yabai Issues — Sequoia Breakage

| Source | URL | Information Gathered |
|--------|-----|---------------------|
| yabai #2380: Moving Windows No Longer Works (macOS 15.0) | https://github.com/koekeishiya/yabai/issues/2380 | First confirmed macOS 15.0 breakage report |
| yabai #2441: Cannot move window to space (macOS 15.1) | https://github.com/asmvik/yabai/issues/2441 | 15.1 breakage; scripting addition failure details |
| yabai #2487: yabai not working (macOS 15.1.1) | https://github.com/asmvik/yabai/issues/2487 | 15.1.1 complete yabai failure |
| yabai #2500: Moving windows without SIP disabled stopped working | https://github.com/asmvik/yabai/issues/2500 | SIP-on breakage on Sequoia; historical comparison to Sonoma |
| yabai #2589: Space commands not working (macOS 15.4) | https://github.com/koekeishiya/yabai/issues/2589 | 15.4 scripting addition injection failure; os/kern invalid argument |
| yabai #2591: Trouble Moving Windows (macOS 15.3.2) | https://github.com/asmvik/yabai/issues/2591 | Window disappears on move regression |
| yabai #2634: macOS 26 scripting addition support | https://github.com/asmvik/yabai/issues/2634 | macOS 26 Tahoe; yabai-sa completely broken at initial release |
| yabai #2656: macOS 26 Tahoe switching spaces not working | https://github.com/asmvik/yabai/issues/2656 | macOS 26 permission issues |
| yabai #2667: yabai on macOS 26 (discussion) | https://github.com/asmvik/yabai/discussions/2667 | Community tracking of Tahoe support |
| yabai #2707: Not working after Tahoe 26.2 update | https://github.com/asmvik/yabai/issues/2707 | 26.2 breakage |
| yabai SIP discussion #2274 | https://github.com/asmvik/yabai/discussions/2274 | Technical explanation of connection rights model and Dock injection |

### yabai Issues — Injection Failures

| Source | URL | Information Gathered |
|--------|-----|---------------------|
| yabai #2155: EXC_GUARD (SIGKILL) / GUARD_TYPE_MACH_PORT | https://github.com/asmvik/yabai/issues/2155 | Architecture of scripting addition loader |
| yabai #2596: scripting-addition failed (macOS 15) | https://github.com/koekeishiya/yabai/issues/2596 | Injection failure details on Sequoia |

### yabai-tahoe Fork

| Source | URL | Information Gathered |
|--------|-----|---------------------|
| tbiehn/yabai-tahoe | https://github.com/tbiehn/yabai-tahoe | macOS Tahoe compatibility fork |
| asmvik/yabai (Tahoe support) | https://github.com/asmvik/yabai | Updated yabai with Tahoe compatibility |

### Amethyst Issues

| Source | URL | Information Gathered |
|--------|-----|---------------------|
| Amethyst #1662: Window throw fails on macOS 15 beta | https://github.com/ianyh/Amethyst/issues/1662 | CGError 717863; "compat aside" failure; window flicker behavior |

### Hammerspoon

| Source | URL | Information Gathered |
|--------|-----|---------------------|
| Hammerspoon #3698: moveWindowToSpace broken on macOS 15 | https://github.com/Hammerspoon/hammerspoon/issues/3698 | hs.spaces silent no-op on macOS 15 |

### _AXUIElementGetWindow

| Source | URL | Information Gathered |
|--------|-----|---------------------|
| AeroSpace issue #445 — Ghost windows | https://github.com/nikitabobko/AeroSpace/issues/445 | _AXUIElementGetWindow returns nil when screen locked; Sequoia notification regression |
| AeroSpace guide (emulation of workspaces) | https://nikitabobko.github.io/AeroSpace/guide | AeroSpace architecture; only uses _AXUIElementGetWindow as private API |
| CGWindowListCopyWindowInfo sandbox failure | https://openradar.appspot.com/10905456 | CGWindowListCopyWindowInfo fails in sandboxed apps launched via SMLoginItemSetEnabled |
| Fullscreen detection — Apple Developer Forums | https://developer.apple.com/forums/thread/792917 | _AXUIElementGetWindow requires non-sandboxed environment |
| FB18327911: CGWindowListCopyWindowInfo regression macOS 26 | https://github.com/feedback-assistant/reports/issues/679 | Status items attributed to Control Center in macOS 26 |

### Alternative Architectures

| Source | URL | Information Gathered |
|--------|-----|---------------------|
| AeroSpace GitHub | https://github.com/nikitabobko/AeroSpace | Virtual workspace architecture; does not use CGS space APIs |
| FlashSpace GitHub | https://github.com/wojciech-kulik/FlashSpace | App hide/unhide architecture; no CGS APIs; macOS 14+ |
| FlashSpace HN discussion | https://news.ycombinator.com/item?id=42984420 | FlashSpace approach details; no SIP required; no per-window hide API in macOS |
| EnhancedSpaces.spoon | https://github.com/franzbu/EnhancedSpaces.spoon | Hammerspoon workaround implementing virtual spaces |

### macOS 26 Tahoe

| Source | URL | Information Gathered |
|--------|-----|---------------------|
| Yabai on macOS 26.2 update broken | https://github.com/asmvik/yabai/issues/2706 | 26.1 breakage; "unknown or unsupported macOS version" errors |
| Scripting addition broken after macOS 26 update | https://github.com/koekeishiya/yabai/issues/2675 | Scripting addition and layout broken on Tahoe |
| macOS Tahoe Window Management Guide | https://macos-tahoe.com/blog/macos-tahoe-window-management-complete-guide-2025/ | Overview of Tahoe window management landscape |

---

### Recommended for Deep Reading

- **NUIKit/CGSInternal — CGSSpace.h**: The most complete community-sourced header for all CGS space functions. Required reading for understanding what functions exist and their signatures.
- **yabai discussion #2274 (SIP and Spaces API)**: The yabai developer's technical explanation of why Dock.app injection is necessary and why connection rights prevent regular apps from using CGS space functions. This is the authoritative explanation of the root cause.
- **Amethyst issue #1662**: Contains the exact error log output (CGError 717863) from the first confirmed macOS 15 breakage, along with the flicker-and-revert behavior description.
- **AeroSpace guide (emulation of workspaces)**: Explains the architectural decision to emulate workspaces rather than using macOS Spaces, which represents the only fully reliable long-term approach.
