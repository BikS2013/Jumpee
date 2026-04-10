# Research: Amethyst and AeroSpace Window-Movement Architectures

**Date:** 2026-04-10
**Purpose:** Source code review for Jumpee's planned "move window to space" feature.
**Scope:** Amethyst 0.22.0 Sequoia workaround; AeroSpace virtual workspace architecture.

---

## Table of Contents

1. [Overview](#overview)
2. [Amethyst Architecture](#amethyst-architecture)
   - [Library Layering: Silica under Amethyst](#library-layering)
   - [Obtaining the CGWindowID via `_AXUIElementGetWindow`](#obtaining-cgwindowid)
   - [Space Enumeration via CGSCopyManagedDisplaySpaces](#space-enumeration)
   - [The Sequoia Workaround: Mouse-Drag Simulation](#sequoia-workaround)
   - [SISystemWideElement: Space Switch via CGSSymbolicHotKey](#space-switch-hotkey)
   - [The `moveToSpaceWithEvent` Protocol](#movetospace-protocol)
   - [Amethyst 0.22.0 Release Details](#release-details)
   - [The Forced Follow Problem and `follow-space-thrown-windows`](#forced-follow)
3. [Amethyst 0.23.0 and Beyond](#amethyst-0230)
4. [AeroSpace Architecture: Virtual Workspaces](#aerospace-architecture)
   - [Core Concept](#aerospace-core-concept)
   - [The Off-Screen Hiding Mechanism](#off-screen-hiding)
   - [Monitor and Workspace Assignment](#monitor-workspace-assignment)
   - [Pros and Cons for Jumpee](#aerospace-pros-cons)
5. [API Reference Summary](#api-reference)
6. [Version Timeline](#version-timeline)
7. [Implications for Jumpee](#implications-for-jumpee)
8. [Assumptions and Uncertainties](#assumptions-and-uncertainties)
9. [References](#references)

---

## Overview

When Apple locked down the CGS space-assignment APIs in macOS 15 (Sequoia), two major open-source window managers — **Amethyst** and **AeroSpace** — responded differently:

- **Amethyst** kept using CGS space APIs for macOS 13-14 and introduced a **mouse-drag simulation workaround** for Sequoia. This is a "wrap the broken APIs with a different mechanism" approach. It is still tied to private APIs for space enumeration but no longer calls `CGSAddWindowsToSpaces`/`CGSRemoveWindowsFromSpaces` for the actual move on Sequoia.
- **AeroSpace** bypassed macOS Spaces entirely by implementing its **own virtual workspace system** using off-screen window positioning. No CGS space-move APIs are called at all.

The key practical difference: Amethyst's approach preserves native macOS Spaces integration but has OS-version fragility. AeroSpace's approach is maximally robust but incompatible with native Spaces.

---

## Amethyst Architecture

### Library Layering

Amethyst is structured as a two-library system:

```
Amethyst.app
  └── Amethyst (Swift) — high-level window management logic
        └── Silica (Objective-C) — low-level Accessibility + CGS wrapper
              └── CGSInternal headers — private CoreGraphics declarations
```

- **Silica** (`ianyh/Silica`) is a separate Objective-C framework that wraps Accessibility and CGS APIs into higher-level objects (`SIWindow`, `SIApplication`, `SISystemWideElement`).
- **Amethyst** uses Silica types via a Swift bridge. The `AXWindow` Swift class in `Amethyst/Model/Window.swift` extends `SIWindow` (the Silica Objective-C class).

For Jumpee's purposes, the most relevant code is in Silica — specifically `SIWindow.m` and `SISystemWideElement.m`.

---

### Obtaining CGWindowID

**Source:** `Silica/Sources/SIWindow.m`, `- (CGWindowID)windowID` method

Silica uses the private Accessibility function `_AXUIElementGetWindow` to get the `CGWindowID` from an `AXUIElementRef`. The declaration at the top of `SIWindow.m` is:

```objc
// Declared as a C function at the top of SIWindow.m
AXError _AXUIElementGetWindow(AXUIElementRef element, CGWindowID *idOut);
```

The implementation of the `windowID` property in `SIWindow`:

```objc
- (CGWindowID)windowID {
    // Cache the result — only fetch once per window object
    if (self._windowID == kCGNullWindowID) {
        CGWindowID windowID;
        AXError error = _AXUIElementGetWindow(self.axElementRef, &windowID);
        if (error != kAXErrorSuccess) {
            return NO;  // Note: returns NO (= 0) on failure, not kCGNullWindowID
        }
        self._windowID = windowID;
    }
    return self._windowID;
}
```

Key points:
- The result is cached in the `_windowID` ivar. It is only fetched once.
- On failure, the method returns `0` (which is `kCGNullWindowID`). Callers must check for `0`.
- This is the exact same approach used by Rectangle, alt-tab-macos, and Hammerspoon.

In Amethyst Swift code (`Amethyst/Model/Window.swift`), the `cgID()` method delegates directly to Silica's `windowID()`:

```swift
func cgID() -> CGWindowID {
    return windowID()   // Calls SIWindow.windowID() in Silica via ObjC bridge
}
```

---

### Space Enumeration

**Source:** `Amethyst/Model/CGInfo.swift`

Amethyst enumerates spaces via `CGSCopyManagedDisplaySpaces` (accessed through Silica/NSScreen extensions), not through direct `CGSGetActiveSpace`. The `CGSpacesInfo` struct in `CGInfo.swift` handles this:

```swift
struct CGSpacesInfo<Window: WindowType> {
    // Get all spaces across all screens, optionally filtering to user-created spaces only
    static func spacesForAllScreens(includeOnlyUserSpaces: Bool = false) -> [Space]? {
        guard let screenDescriptions = Screen.screenDescriptions() else { return nil }
        // ...
        let spaces = screenDescriptions.map { screenDescription -> [Space] in
            return allSpaces(fromScreenDescription: screenDescription) ?? []
        }.reduce([], { acc, spaces in acc + spaces })
        // ...
    }

    // Parse space ID and type from the CGSCopyManagedDisplaySpaces dictionary
    static func space(fromSpaceDescription spaceDictionary: JSON) -> Space {
        let id: CGSSpaceID = spaceDictionary["ManagedSpaceID"].intValue
        let type = CGSSpaceType(rawValue: spaceDictionary["type"].uInt32Value)
        let uuid = spaceDictionary["uuid"].stringValue
        return Space(id: id, type: type, uuid: uuid)
    }
}
```

To find which space a window is currently on, Amethyst uses `CGSCopySpacesForWindows`:

```swift
// From CGInfo.swift - CGWindowsInfo.windowSpace()
static func windowSpace(_ window: Window) -> Int? {
    let windowIDsArray = CGWindowsInfo.windowIDsArray(window)

    // CGSCopySpacesForWindows returns an array of space IDs for the given window IDs
    guard let cfSpaces = CGSCopySpacesForWindows(
        CGSMainConnectionID(),
        kCGSAllSpacesMask,
        windowIDsArray
    )?.takeRetainedValue() else {
        return nil
    }

    guard let spaces = cfSpaces as NSArray as? [NSNumber] else { return nil }
    guard !spaces.isEmpty else { return nil }

    return spaces.first?.intValue
}
```

---

### The Sequoia Workaround: Mouse-Drag Simulation

**Source:** `Silica/Sources/SIWindow.m`, `- (void)moveToSpaceWithEvent:(NSEvent *)event`

This is the critical Sequoia workaround introduced in Amethyst 0.22.0. Instead of calling `CGSAddWindowsToSpaces`/`CGSRemoveWindowsFromSpaces` (which break on Sequoia), Amethyst simulates the **user grabbing the window's title bar and dragging it to another space using the Mission Control keyboard shortcut**.

The complete implementation in `SIWindow.m`:

```objc
- (void)moveToSpace:(NSUInteger)space {
    // Get the NSEvent for the "Switch to Desktop N" system hotkey
    NSEvent *event = [SISystemWideElement eventForSwitchingToSpace:space];
    if (event == nil) return;

    [self moveToSpaceWithEvent:event];
}

- (void)moveToSpaceWithEvent:(NSEvent *)event {
    // Get the minimize button element for cursor positioning
    SIAccessibilityElement *minimizeButtonElement = [self elementForKey:kAXMinimizeButtonAttribute];
    CGRect minimizeButtonFrame = minimizeButtonElement.frame;
    CGRect windowFrame = self.frame;

    // Position the cursor in the window's title bar area, near the minimize button
    CGPoint mouseCursorPoint = {
        .x = (minimizeButtonElement
              ? CGRectGetMidX(minimizeButtonFrame)
              : windowFrame.origin.x + 5.0),
        .y = windowFrame.origin.y + fabs(windowFrame.origin.y - CGRectGetMinY(minimizeButtonFrame)) / 2.0
    };

    // Create the CGEvents needed for a mouse-down drag sequence
    CGEventRef mouseMoveEvent  = CGEventCreateMouseEvent(NULL, kCGEventMouseMoved,     mouseCursorPoint, kCGMouseButtonLeft);
    CGEventRef mouseDragEvent  = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseDragged, mouseCursorPoint, kCGMouseButtonLeft);
    CGEventRef mouseDownEvent  = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseDown,  mouseCursorPoint, kCGMouseButtonLeft);
    CGEventRef mouseUpEvent    = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseUp,    mouseCursorPoint, kCGMouseButtonLeft);

    CGEventSetFlags(mouseMoveEvent, 0);
    CGEventSetFlags(mouseDownEvent, 0);
    CGEventSetFlags(mouseUpEvent, 0);

    // Step 1: Move the cursor to the title bar
    CGEventPost(kCGHIDEventTap, mouseMoveEvent);

    // Step 2: Mouse-down to initiate the drag
    CGEventPost(kCGHIDEventTap, mouseDownEvent);

    // Step 3: Left mouse drag to grab the window
    CGEventPost(kCGHIDEventTap, mouseDragEvent);

    // Step 4: Wait 50ms for the drag to register, then fire the space-switch hotkey
    double delayInSeconds = 0.05;
    dispatch_time_t popTime = dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delayInSeconds * NSEC_PER_SEC));
    dispatch_after(popTime, dispatch_get_main_queue(), ^(void){

        // Fire the "Switch to Desktop N" shortcut while the window is being dragged
        // macOS follows the window to the new space
        [SISystemWideElement switchToSpaceWithEvent:event];

        // Step 5: Wait 400ms for the space transition animation to complete
        double delayInSeconds = 0.4;
        dispatch_time_t popTime = dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delayInSeconds * NSEC_PER_SEC));
        dispatch_after(popTime, dispatch_get_main_queue(), ^(void){

            // Step 6: Release the mouse — the window is now on the new space
            CGEventPost(kCGHIDEventTap, mouseUpEvent);
            CFRelease(mouseUpEvent);
        });
    });

    CFRelease(mouseMoveEvent);
    CFRelease(mouseDownEvent);
    // Note: mouseDragEvent is NOT released here — this is a minor memory leak in Silica
}
```

**Why this works on Sequoia:** macOS natively supports dragging windows between spaces when Mission Control is active or when a space-switch hotkey fires during a drag. This is a documented/intentional behavior, not a private API. The sequence exploits the fact that macOS transitions the dragged window to the new space as part of the native space switch.

**Critical timing parameters:**
- **50ms** between mouse-down/drag and the space-switch hotkey. This is the minimum time for macOS to recognize the window grab.
- **400ms** for the space transition animation to complete before releasing the mouse.
- Both values are hardcoded in Silica. They may need tuning on slower machines or macOS versions.

---

### SISystemWideElement: Space Switch via CGSSymbolicHotKey

**Source:** `Silica/Sources/SISystemWideElement.m`

Amethyst uses private CGS hotkey APIs to fire the native "Switch to Desktop N" keyboard shortcut programmatically:

```objc
+ (NSEvent *)eventForSwitchingToSpace:(NSUInteger)space {
    if (space < 1 || space > 16) return nil;

    // The CGSSymbolicHotKey values for "Switch to Desktop 1-16" are 119-134
    // (i.e., 118 + space_index, where space_index is 1-based)
    CGSSymbolicHotKey hotKey = (unsigned short)(118 + space - 1);

    CGSModifierFlags flags;
    CGKeyCode keyCode = 0;

    // Look up the key code and modifier flags assigned to this hotkey in System Preferences
    CGError error = CGSGetSymbolicHotKeyValue(hotKey, nil, &keyCode, &flags);
    if (error != kCGErrorSuccess) return nil;

    // Temporarily enable the hotkey if it's disabled
    if (!CGSIsSymbolicHotKeyEnabled(hotKey)) {
        error = CGSSetSymbolicHotKeyEnabled(hotKey, true);
    }

    // Build a CGEvent with the key code and modifier flags
    CGEventRef keyboardEvent = CGEventCreateKeyboardEvent(NULL, keyCode, true);
    CGEventSetFlags(keyboardEvent, (CGEventFlags)flags);

    NSEvent *event = [NSEvent eventWithCGEvent:keyboardEvent];
    CFRelease(keyboardEvent);
    return event;
}

+ (void)switchToSpaceWithEvent:(NSEvent *)event {
    if (event == nil) return;

    CGEventRef keyboardEventUp = CGEventCreateKeyboardEvent(NULL, event.keyCode, false);
    CGEventSetFlags(keyboardEventUp, 0);

    // Post key-down then key-up to fire the space switch
    CGEventPost(kCGHIDEventTap, event.CGEvent);
    CGEventPost(kCGHIDEventTap, keyboardEventUp);

    CFRelease(keyboardEventUp);
}
```

**Key insight:** Amethyst queries `CGSGetSymbolicHotKeyValue` to find whatever key the user has assigned to "Switch to Desktop N" in System Settings, rather than hard-coding a key combination. This means:
- The user must have "Switch to Desktop N" shortcuts **enabled** in System Settings > Keyboard > Keyboard Shortcuts > Mission Control.
- If the hotkeys are disabled, Amethyst temporarily enables them (`CGSSetSymbolicHotKeyEnabled`).
- The symbolic hotkey IDs for desktops 1-16 are `119` through `134` (i.e., `118 + N`).

---

### The `moveToSpaceWithEvent` Protocol

Putting it all together, the complete API call sequence Amethyst uses to move a window to space N on macOS 15 (Sequoia) is:

```
1. Get focused window:
   SIWindow *window = [SIWindow focusedWindow]
   → internally uses AXUIElementCopyAttributeValue(...kAXFocusedWindowAttribute...)

2. Get window's CGWindowID (cached in SIWindow):
   CGWindowID wid = window.windowID
   → internally calls _AXUIElementGetWindow(axElementRef, &wid)

3. Look up space-switch hotkey for desktop N:
   NSEvent *event = [SISystemWideElement eventForSwitchingToSpace:N]
   → calls CGSGetSymbolicHotKeyValue(118+N, nil, &keyCode, &flags)
   → temporarily enables hotkey if needed via CGSSetSymbolicHotKeyEnabled

4. Simulate mouse-down in window title bar:
   CGEventPost(kCGHIDEventTap, mouseMoveEvent)
   CGEventPost(kCGHIDEventTap, mouseDownEvent)
   CGEventPost(kCGHIDEventTap, mouseDragEvent)

5. [wait 50ms]

6. Fire the space-switch hotkey (window is being held):
   CGEventPost(kCGHIDEventTap, keyDownEvent)
   CGEventPost(kCGHIDEventTap, keyUpEvent)

7. [wait 400ms for animation]

8. Release mouse (window lands on new space):
   CGEventPost(kCGHIDEventTap, mouseUpEvent)
```

**Note:** There is NO `CGSAddWindowsToSpaces` or `CGSRemoveWindowsFromSpaces` call in this sequence. The Sequoia workaround entirely bypasses those APIs.

---

### Amethyst 0.22.0 Release Details

- **Release date:** January 2025 (PR #1702 merged 2025-01-02)
- **Branch:** `0.22.0` → merged into `development`
- **What changed:** The Silica library was updated to introduce the mouse-drag simulation approach for window throwing. Prior versions (0.21.x) attempted `CGSAddWindowsToSpaces`/`CGSRemoveWindowsFromSpaces` which produced the "flickering but stays on current space" failure mode on macOS 15.

From the releases page, the 0.22.0 changelog explicitly addressed Sequoia compatibility:

> Fix throwing windows to other spaces on macOS 15 Sequoia.

The fix was entirely in the **Silica library** (not in Amethyst itself), confirming that the `moveToSpaceWithEvent:` implementation in `SIWindow.m` is the Sequoia fix.

Subsequent release 0.23.0 (released with PR #1743 "Update Silica for mouse drag on space throwing") further refined the mouse drag behavior for more applications that failed with the initial implementation.

---

### The Forced Follow Problem and `follow-space-thrown-windows`

**Source:** Amethyst Issue #1713

Since the Sequoia workaround fires the "Switch to Desktop N" hotkey while holding the window, macOS **always follows the window to the new space**. This is unavoidable — the space switch is what carries the window, and the user (and Amethyst process) necessarily switches to that space in the process.

Amethyst acknowledges this with the `follow-space-thrown-windows` configuration key (seen in debug output from issue reports). The default value is `1` (follow). The option is now largely cosmetic on Sequoia because the OS forces the follow regardless.

On macOS 13/14 with the old `CGSAddWindowsToSpaces` approach, `follow-space-thrown-windows: 0` would stay on the current space after throwing. On Sequoia with the drag workaround, staying is not possible.

---

## Amethyst 0.23.0 and Beyond

From the releases page:

**0.23.0** (Feb 2025):
> Fix a major issue in throwing windows between spaces in a variety of applications.
> Update Silica for mouse drag on space throwing.

This release further tuned the mouse-drag parameters and cursor positioning logic to handle more application types (especially those with non-standard title bars or minimized button positions).

**Current state (0.24.x):**
- The mouse-drag simulation is the production approach for Sequoia.
- No CGS space-move APIs are used for the actual throw operation.
- Space enumeration (finding which spaces exist) still uses `CGSCopyManagedDisplaySpaces` via `NSScreen.screenDescriptions()`.

---

## AeroSpace Architecture: Virtual Workspaces

### Core Concept

AeroSpace (by nikitabobko) deliberately ignores macOS Spaces and implements its own virtual workspace system. From the official documentation:

> AeroSpace doesn't acknowledge the existence of macOS Spaces, and it uses emulation of its own workspaces.

AeroSpace workspaces are purely logical constructs maintained in memory. Each named workspace (e.g., "1", "2", "A", "B") has an assigned monitor. The workspace currently visible on a monitor is the "active workspace" for that monitor.

Windows are assigned to workspaces in AeroSpace's internal tree data structure. Switching workspaces triggers:
1. All windows belonging to the newly active workspace are moved to visible screen coordinates.
2. All windows belonging to the previously active workspace are moved off-screen.

### The Off-Screen Hiding Mechanism

AeroSpace moves inactive windows to a corner just outside the visible display area. This exploits the fact that macOS allows windows to be moved very close to the screen edge, but not fully off it.

From AeroSpace documentation and community analysis:
- Windows are sized down and placed in the **bottom-right or bottom-left corner** of the screen just at or slightly past the visible boundary.
- macOS enforces a minimum visible area per window — a small number of pixels (1-2px sliver) will remain on-screen.
- The user must ensure the display arrangement in System Settings has free corner space where this sliver can appear without overlapping other monitors.

Key constraints:
- This approach uses **only standard Accessibility APIs** (`AXUIElementSetAttributeValue` with `kAXPositionAttribute` and `kAXSizeAttribute`) — no CGS private APIs are required.
- AeroSpace bypasses CGS APIs entirely, making it immune to Sequoia and future API lockdowns.
- Windows appear in Mission Control as extremely small thumbnails (1-pixel-wide) because their on-screen footprint is near zero.

### Monitor and Workspace Assignment

From `Sources/AppBundle/model/Monitor.swift` and `Sources/AppBundle/focus.swift`:

```swift
// AeroSpace workspace focus model:
struct LiveFocus {
    let windowOrNil: Window?  // Currently focused window (nil for empty workspace)
    var workspace: Workspace  // Currently active workspace
}

// setFocus activates a workspace on its assigned monitor:
@MainActor func setFocus(to newFocus: LiveFocus) -> Bool {
    // Normalize most-recently-used window on the old workspace
    if oldFocus.workspace != newFocus.workspace {
        oldFocus.windowOrNil?.markAsMostRecentChild()
    }
    _focus = newFocus.frozen
    // This triggers the actual window show/hide via setActiveWorkspace
    let status = newFocus.workspace.workspaceMonitor.setActiveWorkspace(newFocus.workspace)
    newFocus.windowOrNil?.markAsMostRecentChild()
    return status
}
```

When `setActiveWorkspace` is called, AeroSpace:
1. Positions all windows of the new workspace at their last known visible coordinates on the assigned monitor.
2. Moves all windows of the old workspace to the off-screen hiding position.
3. Updates focus to the new workspace's most-recently-used window.

### Pros and Cons for Jumpee

| Criterion | Assessment |
|-----------|------------|
| **Sequoia compatibility** | Excellent — no CGS APIs used |
| **Future macOS compatibility** | Excellent — relies only on public APIs |
| **Integration with native Spaces** | None — AeroSpace workspaces are invisible to Mission Control, Spaces bar, etc. |
| **Complexity for Jumpee** | Very high — requires Jumpee to become a full window manager with workspace state |
| **Side effects** | Windows visible as slivers in screen corners; weird Mission Control appearance |
| **User configuration** | Requires specific monitor arrangement; incompatible with native Spaces usage |
| **Alignment with Jumpee's design** | Incompatible — Jumpee is a lightweight Space-naming overlay, not a window manager |

**Conclusion for Jumpee:** The AeroSpace approach is architecturally incompatible with Jumpee's design philosophy. Jumpee's window-move feature should enhance native macOS Spaces, not replace them.

---

## API Reference Summary

### Private APIs Used by Amethyst

```objc
// --- AXUIElement (Accessibility framework, private) ---
// Get CGWindowID from an AXUIElementRef
// Declared in Silica bridging header; works on macOS 13-15+
AXError _AXUIElementGetWindow(AXUIElementRef element, CGWindowID *idOut);

// --- CGS Connection ---
// Get the main CGS connection ID (process-level)
CGSConnectionID CGSMainConnectionID(void);

// --- CGS Space Enumeration (still works on Sequoia) ---
// Get space IDs for given window IDs
CFArrayRef CGSCopySpacesForWindows(CGSConnectionID cid, int mask, CFArrayRef windowIDs);
// mask = kCGSAllSpacesMask (0x7)

// --- CGS Symbolic Hotkeys (used for space switch in workaround) ---
// Look up the key code and modifier assigned to a system hotkey
CGError CGSGetSymbolicHotKeyValue(CGSSymbolicHotKey hotKey, 
                                   CFStringRef *string,
                                   CGKeyCode *keyOut,
                                   CGSModifierFlags *flagsOut);
// Check if a system hotkey is enabled
bool CGSIsSymbolicHotKeyEnabled(CGSSymbolicHotKey hotKey);
// Enable/disable a system hotkey
CGError CGSSetSymbolicHotKeyEnabled(CGSSymbolicHotKey hotKey, bool enabled);

// Symbolic hotkey IDs for "Switch to Desktop N" (1-indexed):
// Desktop 1 = 119 (0x77)
// Desktop 2 = 120 (0x78)
// ...
// Desktop N = 118 + N
// Desktop 16 = 134 (0x86)

// --- NOT USED in Sequoia workaround (still present in older code paths) ---
// CGSAddWindowsToSpaces / CGSRemoveWindowsFromSpaces:
//   These are the APIs that broke on Sequoia and are NO LONGER used by
//   the 0.22.0+ Sequoia workaround path.
```

### Public APIs Used in the Drag Sequence

```swift
// CGEvent-based mouse simulation (all public API)
CGEventCreateMouseEvent(NULL, kCGEventMouseMoved, point, kCGMouseButtonLeft)
CGEventCreateMouseEvent(NULL, kCGEventLeftMouseDown, point, kCGMouseButtonLeft)
CGEventCreateMouseEvent(NULL, kCGEventLeftMouseDragged, point, kCGMouseButtonLeft)
CGEventCreateMouseEvent(NULL, kCGEventLeftMouseUp, point, kCGMouseButtonLeft)
CGEventPost(kCGHIDEventTap, event)

// Accessibility queries (public API)
AXUIElementCopyAttributeValue(appElement, kAXFocusedWindowAttribute, &windowRef)
AXUIElementCopyAttributeValue(windowElement, kAXMinimizeButtonAttribute, &buttonRef)
```

---

## Version Timeline

| Version | Date | Change | macOS 15 Status |
|---------|------|--------|-----------------|
| 0.21.0 | 2024-Q3 | Used `CGSAddWindowsToSpaces` / `CGSRemoveWindowsFromSpaces` | Broken (window flickers, stays on current space) |
| 0.21.1 | 2024-Q4 | No change to space move | Broken |
| 0.22.0 | 2025-01 | Introduced mouse-drag workaround in Silica | Works (but forced follow) |
| 0.22.1 | 2025-01 | Shortcut config fixes (not space-move related) | Works |
| 0.22.2 | 2025-01 | Shortcut config fixes (not space-move related) | Works |
| 0.23.0 | 2025-02 | "Fix a major issue in throwing windows between spaces in a variety of applications" (Silica PR #1743) | Improved |
| 0.24.x | 2025-Q4 | Various stability improvements | Works |

---

## Implications for Jumpee

### What Jumpee Should NOT Copy

1. **Do not use `CGSAddWindowsToSpaces` / `CGSRemoveWindowsFromSpaces` as the primary path on Sequoia.** These APIs produce the "window flickers and stays" failure on macOS 15. They may still work on macOS 13/14.

2. **Do not attempt the AeroSpace off-screen approach.** It is architecturally incompatible with Jumpee's role as a Space-naming layer.

### What Jumpee Should Consider Copying

#### Option A: The Amethyst Drag Simulation (for Sequoia support)

Replicating Amethyst's `moveToSpaceWithEvent:` sequence in Swift:

```swift
// Swift equivalent of Amethyst's SIWindow.moveToSpaceWithEvent:
func moveWindowToSpace(_ window: AXUIElement, toSpaceIndex spaceIndex: Int) {
    // 1. Get cursor position from minimize button (or fallback to top-left of window)
    var buttonRef: CFTypeRef?
    AXUIElementCopyAttributeValue(window, kAXMinimizeButtonAttribute as CFString, &buttonRef)
    
    var position: CGPoint
    if let button = buttonRef {
        var origin: CFTypeRef?
        AXUIElementCopyAttributeValue(button as! AXUIElement, kAXPositionAttribute as CFString, &origin)
        var pt = CGPoint.zero
        AXValueGetValue(origin as! AXValue, .cgPoint, &pt)
        position = pt
    } else {
        var originRef: CFTypeRef?
        AXUIElementCopyAttributeValue(window, kAXPositionAttribute as CFString, &originRef)
        var pt = CGPoint.zero
        AXValueGetValue(originRef as! AXValue, .cgPoint, &pt)
        position = CGPoint(x: pt.x + 5, y: pt.y + 5)
    }
    
    // 2. Build mouse events
    let moveEvent = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, 
                            mouseCursorPosition: position, mouseButton: .left)!
    let downEvent = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown,
                            mouseCursorPosition: position, mouseButton: .left)!
    let dragEvent = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDragged,
                            mouseCursorPosition: position, mouseButton: .left)!
    let upEvent   = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp,
                            mouseCursorPosition: position, mouseButton: .left)!
    moveEvent.flags = []
    downEvent.flags = []
    upEvent.flags   = []
    
    // 3. Post grab sequence
    moveEvent.post(tap: .cghidEventTap)
    downEvent.post(tap: .cghidEventTap)
    dragEvent.post(tap: .cghidEventTap)
    
    // 4. After 50ms: fire space switch hotkey
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
        self.fireSpaceSwitchHotkey(forSpaceIndex: spaceIndex)
        
        // 5. After 400ms: release mouse
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.40) {
            upEvent.post(tap: .cghidEventTap)
        }
    }
}
```

**Important:** This approach requires Accessibility permissions (already granted to Jumpee) and requires "Switch to Desktop N" shortcuts to be enabled in System Settings (same requirement Jumpee already has for space navigation).

#### Option B: Direct CGEvent Shortcut (Simpler, Sequoia-safe)

Instead of the full drag simulation, Jumpee could use the **existing shortcut synthesis mechanism** it already has for navigation. The difference from navigation is: the window must be grabbed first.

If Jumpee only wants to trigger system-native "Move window to Desktop N" (not "Switch to Desktop N"), this requires different hotkeys. macOS provides `CGSSymbolicHotKey` values in a different range for "Move window" vs. "Switch to":
- "Switch to Desktop N" hotkeys: IDs 119-134
- "Move window to Desktop N" hotkeys: These use the same IDs accessed via the Keyboard shortcuts for "Move & Resize" — the exact IDs need to be confirmed by testing on the target macOS version.

This would be the cleanest approach for Jumpee — minimal implementation, relying entirely on the OS's own behavior.

### Key Architectural Decision

The **Amethyst drag simulation** is the only technique confirmed to work on macOS 15 Sequoia without requiring SIP to be disabled. However, it introduces:
- A ~450ms operation window during which the cursor moves and the user may see visual artifacts.
- Dependency on "Switch to Desktop N" shortcuts being enabled.
- Complexity (timing-sensitive async sequence).

The **synthesized shortcut approach** (Approach 3 from the existing investigation document) is simpler and lower-risk but requires a different setup: the user must enable "Move window to Desktop N" shortcuts, which are a different set of system shortcuts.

**Recommendation for Jumpee:** Implement the Amethyst drag simulation as the primary mechanism for Sequoia compatibility. Use the existing `SpaceNavigator` hotkey synthesis as the fallback for macOS 13/14 where CGS APIs still work. Gate the choice on an OS version check or a configuration flag.

---

## Assumptions and Uncertainties

### Assumptions

| Assumption | Confidence | Impact if Wrong |
|------------|------------|-----------------|
| The `moveToSpaceWithEvent:` in current Silica master IS the 0.22.0 Sequoia fix | HIGH | The specific code shown may have been further refined in 0.23.0; check commit diffs for SIWindow.m |
| CGSGetSymbolicHotKeyValue still works on macOS 26 (Tahoe) | MEDIUM | The space-switch trigger mechanism would fail; a different approach to firing the hotkey would be needed |
| The 50ms and 400ms timing constants are sufficient across all machines | MEDIUM | Slower machines or future macOS animations may require longer delays; these should be configurable |
| `_AXUIElementGetWindow` still works on macOS 15.3+ and Tahoe | HIGH | Very widely used; breakage would affect all window managers simultaneously |
| The mouse drag simulation works for all app window types | MEDIUM | Amethyst 0.23.0 explicitly fixed "a major issue in throwing windows in a variety of applications," suggesting some apps fail with 0.22.0's implementation |

### Uncertainties and Gaps

1. **Cursor position calculation:** The exact `y` coordinate calculation in Silica (`windowFrame.origin.y + fabs(windowFrame.origin.y - CGRectGetMinY(minimizeButtonFrame)) / 2.0`) is somewhat opaque. Understanding exactly where this places the cursor relative to the title bar would require testing.

2. **The 0.23.0 "variety of applications" fix:** PR #1743 ("Update Silica for mouse drag on space throwing") fixed failures for certain apps in 0.23.0. The exact apps and the fix mechanism are not documented in the PR description. The current Silica master may have different cursor positioning logic than what was in 0.22.0.

3. **macOS 26 (Tahoe) behavior:** The Silica drag approach's compatibility with Tahoe is unconfirmed. yabai-tahoe's existence suggests significant changes in Tahoe's CGS layer, but the drag approach avoids CGS space-move APIs entirely, so it may be less affected.

4. **"Move window to Desktop N" CGSSymbolicHotKey IDs:** The exact symbolic hotkey IDs for the "Move window to Desktop N" system shortcuts (as opposed to "Switch to Desktop N") are not documented. They would need to be discovered by inspection or testing.

### Clarifying Questions for Follow-Up

1. Does Amethyst's mouse-drag approach produce visible cursor movement on the user's screen, or does macOS suppress the cursor when CGEvents are posted with `kCGHIDEventTap`?
2. What is the behavior when the target space is on a different display (cross-display window throw)? Does the drag simulation still work?
3. Has anyone tested the Amethyst approach (or a replica) on macOS 26 (Tahoe)?
4. Is there a way to detect programmatically whether "Switch to Desktop N" shortcuts are enabled, before attempting the drag simulation?
5. Does the 400ms delay need to be longer for users who have enabled the slower Mission Control animation speed (via `defaults write com.apple.dock expose-animation-duration`)?

---

## References

| # | Source | URL | What Was Learned |
|---|--------|-----|------------------|
| 1 | Silica SIWindow.m | https://raw.githubusercontent.com/ianyh/Silica/master/Silica/Sources/SIWindow.m | Complete `moveToSpaceWithEvent:` implementation; `_AXUIElementGetWindow` usage; `windowID` caching |
| 2 | Silica SISystemWideElement.m | https://raw.githubusercontent.com/ianyh/Silica/master/Silica/Sources/SISystemWideElement.m | `eventForSwitchingToSpace:` using `CGSGetSymbolicHotKeyValue`; symbolic hotkey IDs 119-134 |
| 3 | Amethyst Window.swift | https://raw.githubusercontent.com/ianyh/Amethyst/development/Amethyst/Model/Window.swift | `AXWindow` class structure; `cgID()` delegation to Silica; focus sequence using `_SLPSSetFrontProcessWithOptions` |
| 4 | Amethyst CGInfo.swift | https://raw.githubusercontent.com/ianyh/Amethyst/development/Amethyst/Model/CGInfo.swift | `CGSpacesInfo` and `CGWindowsInfo` — space enumeration via `CGSCopyManagedDisplaySpaces`; `CGSCopySpacesForWindows` usage |
| 5 | Amethyst Issue #1662 | https://github.com/ianyh/Amethyst/issues/1662 | Original Sequoia bug report (0.21.1); CGError 717863 from failed `CGSAddWindowsToSpaces` |
| 6 | Amethyst Issue #1676 | https://github.com/ianyh/Amethyst/issues/1676 | Window throw failure on macOS 14.6 — confirmed `follow-space-thrown-windows` config key |
| 7 | Amethyst Issue #1713 | https://github.com/ianyh/Amethyst/issues/1713 | Confirms 0.22.0 fix works but forces space follow on Sequoia 15.1.1; `follow-space-thrown-windows: 1` now effectively forced |
| 8 | Amethyst Releases | https://github.com/ianyh/Amethyst/releases | Version timeline: 0.22.0 (Jan 2025) Sequoia fix; 0.23.0 multi-app improvement; 0.24.x current |
| 9 | Amethyst PR #1702 | https://api.github.com/repos/ianyh/Amethyst/pulls/1702 | 0.22.0 merge details (merged 2025-01-02) |
| 10 | AeroSpace Guide | https://nikitabobko.github.io/AeroSpace/guide | Virtual workspace config; off-screen hiding documentation; monitor arrangement requirement |
| 11 | AeroSpace focus.swift | https://raw.githubusercontent.com/nikitabobko/AeroSpace/main/Sources/AppBundle/focus.swift | `setFocus()` implementation; `LiveFocus`/`FrozenFocus` pattern; `setActiveWorkspace` trigger |
| 12 | AeroSpace Issue #66 | https://github.com/nikitabobko/AeroSpace/issues/66 | Community discussion of window hiding limitations; 1px sliver constraint |
| 13 | AeroSpace Discussion #1008 | https://github.com/nikitabobko/AeroSpace/discussions/1008 | "Truly hide windows" — confirms macOS cannot fully hide windows off-screen |
