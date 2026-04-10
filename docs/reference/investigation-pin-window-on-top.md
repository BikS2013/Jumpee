# Investigation: Pin Window on Top (Always on Top)

**Date:** 2026-04-10
**Investigator:** Claude Code
**Status:** Complete

---

## 1. Executive Summary

Making another application's window "always on top" on macOS is significantly harder than expected. The macOS WindowServer enforces strict ownership rules: only the process that owns a window (or the Dock, which holds "universal owner" privileges) can modify that window's level. There is **no public API** to change another app's window level.

Three viable approaches exist, each with different trade-offs:

| Approach | Feasibility | SIP Required Off | Complexity | Reliability |
|----------|-------------|------------------|------------|-------------|
| **A: CGSSetWindowLevel (Direct)** | Uncertain -- likely blocked | No (but may silently fail) | Low | Low-Medium |
| **B: ScreenCaptureKit Overlay** | High | No | High | High |
| **C: CGSSetWindowLevel via SIP + Scripting Addition** | High (proven by yabai) | Yes (partial) | Very High | Medium |

**Recommended approach:** **Option B (ScreenCaptureKit Overlay)** -- capture the target window's content and render it in a Jumpee-owned floating NSWindow. This is the technique used by modern commercial tools (TopWindow, Floaty) and works reliably on macOS 13-15+ without requiring SIP to be disabled. If Option B proves too heavyweight, **Option A should be attempted first** as a quick feasibility test -- if `CGSSetWindowLevel` happens to work with Jumpee's own CGS connection (some reports suggest it may work for certain operations), the implementation is trivial.

---

## 2. Approach Options

### Option A: Direct CGSSetWindowLevel / SLSSetWindowLevel

**Description:** Use the private `CGSSetWindowLevel` (or its modern equivalent `SLSSetWindowLevel`) to directly change the target window's level in the WindowServer.

**Function Signatures (from reverse-engineered headers):**

```c
// CGSInternal (NUIKit/CGSInternal/CGSWindow.h)
CG_EXTERN CGError CGSSetWindowLevel(CGSConnectionID cid, CGWindowID wid, CGWindowLevel level);
CG_EXTERN CGError CGSGetWindowLevel(CGSConnectionID cid, CGWindowID wid, CGWindowLevel *outLevel);

// Modern SkyLight equivalents (macOS 10.13+)
extern CGError SLSSetWindowLevel(int cid, uint32_t wid, int level);
extern CGError SLSGetWindowLevel(int cid, uint32_t wid, int *level);
```

**Swift declaration (using @_silgen_name, matching Jumpee's existing pattern):**

```swift
@_silgen_name("CGSSetWindowLevel")
func CGSSetWindowLevel(_ connection: Int32, _ windowID: CGWindowID, _ level: Int32) -> CGError

@_silgen_name("CGSGetWindowLevel")
func CGSGetWindowLevel(_ connection: Int32, _ windowID: CGWindowID, _ level: UnsafeMutablePointer<Int32>) -> CGError
```

**How it would work:**
1. Get focused window via AXUIElement (existing pattern in WindowMover)
2. Get CGWindowID via `_AXUIElementGetWindow` (existing declaration in Jumpee)
3. Call `CGSSetWindowLevel(CGSMainConnectionID(), windowID, 3)` to pin (level 3 = kCGFloatingWindowLevel)
4. Call `CGSSetWindowLevel(CGSMainConnectionID(), windowID, 0)` to unpin (level 0 = kCGNormalWindowLevel)

**Pros:**
- Trivial to implement (~30 lines of code)
- Fits perfectly into Jumpee's existing architecture (same pattern as other CGS calls)
- No additional permissions required beyond Accessibility
- No additional frameworks needed
- Lowest resource overhead

**Cons:**
- **Critical uncertainty:** The WindowServer enforces connection ownership. Only the owner of a window (or the Dock's universal connection) can modify its properties. Calling `CGSSetWindowLevel` with Jumpee's own `CGSMainConnectionID()` on another app's window will likely return an error or silently no-op.
- The CGSInternal project explicitly states: "you can get a list of all windows, but if you ask CGS to do something with them, you'll get a persistent no."
- Private API -- no stability guarantee across macOS versions
- The `CGS` prefix functions may be deprecated in favor of `SLS` prefix on newer macOS versions (though both appear to still be available as of macOS 15)

**Risk assessment:** HIGH. This approach may simply not work. However, it is worth a 30-minute feasibility test before committing to Option B.

---

### Option B: ScreenCaptureKit Overlay (Recommended)

**Description:** Instead of changing the target window's actual level, capture its content using ScreenCaptureKit and render it in a Jumpee-owned NSWindow set to `.floating` level. This is how modern commercial tools (TopWindow, Floaty) implement "always on top" for other apps' windows.

**How it would work:**
1. Get focused window via AXUIElement + `_AXUIElementGetWindow` to get CGWindowID
2. Use `SCShareableContent.current` to find the matching `SCWindow` by window ID
3. Create an `SCContentFilter` targeting that specific window
4. Start an `SCStream` that captures the window's content as `CMSampleBuffer` frames
5. Create a borderless, transparent `NSWindow` owned by Jumpee with `level = .floating`
6. Render captured frames into the overlay window (via CALayer, Metal, or IOSurface)
7. Match the overlay window's position/size to the original window (track via AX notifications)
8. Exclude Jumpee's overlay window from the capture stream to avoid mirror-hall effect
9. To unpin: stop the stream, close the overlay window

**Pros:**
- Uses official Apple APIs (ScreenCaptureKit is public, documented, supported)
- Works reliably on macOS 12.3+ (Ventura requirement aligns with Jumpee's macOS 13+ target)
- No SIP restrictions
- Proven approach used by shipping commercial apps (TopWindow, Floaty)
- GPU-backed capture buffers for efficient rendering
- Real-time window monitoring via ScreenCaptureKit
- Can be notarized and distributed via Mac App Store

**Cons:**
- **High implementation complexity** -- requires ScreenCaptureKit integration, frame rendering pipeline, window position tracking
- **Requires Screen Recording permission** in addition to Accessibility permission (new permission dialog for users)
- **Resource overhead** -- continuous screen capture uses GPU and some CPU even when idle
- **Not a true pin** -- the original window is hidden behind the overlay; user interactions (clicks, scrolls) must be forwarded to the original window or the overlay must be click-through
- **Click-through challenge** -- if the overlay is click-through, the user interacts with the original window directly but the overlay may flash/flicker; if not click-through, all input must be proxied
- **Window movement tracking** -- if the user moves the original window, the overlay must follow (requires AX observer notifications)
- Electron apps and apps that frequently recreate windows need special re-identification logic
- Significant increase in code size for single-file architecture

**Risk assessment:** MEDIUM. The approach is proven but complex. The main risks are implementation complexity and the additional Screen Recording permission requirement.

---

### Option C: CGSSetWindowLevel via Dock Injection (yabai approach)

**Description:** Inject a scripting addition into Dock.app to gain "universal owner" privileges, then use the Dock's CGS connection to call `CGSSetWindowLevel` on any window.

**How it works (from yabai source):**
1. Partially disable SIP (`csrutil enable --without fs --without debug`)
2. Install a scripting addition (dylib) that gets injected into Dock.app
3. The injected code uses the Dock's CGS connection (which has universal owner privileges) to call `SLSSetWindowLevel(g_connection, windowID, level)`
4. Communication between the main app and the Dock injection happens via Mach IPC

**Pros:**
- Proven approach (yabai has used this for years)
- True window level change -- no overlay, no capture, no input forwarding needed
- Minimal resource overhead
- Works for all windows

**Cons:**
- **Requires partially disabling SIP** -- dealbreaker for most users
- Extremely complex implementation (Mach IPC, code injection, scripting addition lifecycle)
- Security implications of running injected code in Dock.app
- Apple actively patches SIP bypass vulnerabilities (CVE-2024-44243 etc.)
- Cannot be notarized or distributed via Mac App Store
- Fragile across macOS updates (injection mechanism may break)
- Completely against Jumpee's philosophy (lightweight, simple, no-SIP)

**Risk assessment:** LOW feasibility for Jumpee. While technically proven, requiring SIP to be disabled makes this inappropriate for Jumpee's target users.

---

### Option D: AppleScript / osascript (Limited)

**Description:** Use AppleScript to set window properties via the Scripting Bridge.

**How it would work:**
```applescript
tell application "System Events"
    set frontmost of process "Safari" to true
end tell
```

**Pros:**
- No private APIs
- Simple implementation

**Cons:**
- **AppleScript does not expose window level properties.** There is no `set level of window 1 to floating` command.
- Can only bring a window to front temporarily (not keep it on top)
- Not a viable approach for always-on-top

**Risk assessment:** NOT VIABLE. AppleScript cannot set window levels.

---

## 3. Recommended Implementation

### Primary Recommendation: Attempt Option A First, Fall Back to Option B

**Phase 1: Quick Feasibility Test (Option A) -- 1-2 hours**

Test whether `CGSSetWindowLevel` works on another app's window using Jumpee's own CGS connection. While research strongly suggests this will fail due to WindowServer ownership rules, there are some reasons to test:

1. Jumpee already has Accessibility permissions, which may grant additional CGS privileges
2. Some private API behaviors are not fully documented and may work differently than expected
3. The `CGSMainConnectionID()` connection is already used successfully for space detection and symbolic hotkey manipulation in Jumpee
4. The test requires minimal code and can be done in under an hour

**Test code:**

```swift
// Add to top of main.swift (private API declarations)
@_silgen_name("CGSSetWindowLevel")
func CGSSetWindowLevel(_ connection: Int32, _ windowID: CGWindowID, _ level: Int32) -> CGError

@_silgen_name("CGSGetWindowLevel")
func CGSGetWindowLevel(_ connection: Int32, _ windowID: CGWindowID, _ level: UnsafeMutablePointer<Int32>) -> CGError

// Test function
static func testPinWindow() {
    let systemWide = AXUIElementCreateSystemWide()
    var focusedApp: CFTypeRef?
    guard AXUIElementCopyAttributeValue(systemWide, kAXFocusedApplicationAttribute as CFString, &focusedApp) == .success else {
        NSLog("PIN TEST: Failed to get focused app")
        return
    }
    var focusedWindow: CFTypeRef?
    guard AXUIElementCopyAttributeValue(focusedApp as! AXUIElement, kAXFocusedWindowAttribute as CFString, &focusedWindow) == .success else {
        NSLog("PIN TEST: Failed to get focused window")
        return
    }
    var windowID: CGWindowID = 0
    guard _AXUIElementGetWindow(focusedWindow as! AXUIElement, &windowID) == .success else {
        NSLog("PIN TEST: Failed to get window ID")
        return
    }
    
    // Read current level
    var currentLevel: Int32 = 0
    let getErr = CGSGetWindowLevel(CGSMainConnectionID(), windowID, &currentLevel)
    NSLog("PIN TEST: CGSGetWindowLevel returned \(getErr.rawValue), level=\(currentLevel)")
    
    // Attempt to set floating level (3)
    let setErr = CGSSetWindowLevel(CGSMainConnectionID(), windowID, 3)
    NSLog("PIN TEST: CGSSetWindowLevel returned \(setErr.rawValue)")
    
    // Verify level changed
    var newLevel: Int32 = 0
    let verifyErr = CGSGetWindowLevel(CGSMainConnectionID(), windowID, &newLevel)
    NSLog("PIN TEST: After set, level=\(newLevel) (error=\(verifyErr.rawValue))")
}
```

**Success criteria:** If `CGSSetWindowLevel` returns `.success` (0) AND the window visually stays on top when clicking other windows, Option A is viable and implementation can proceed immediately with minimal code.

**Failure criteria:** If the function returns an error, or returns success but the window does not actually stay on top, proceed to Option B.

---

**Phase 2: Full Implementation (Option B if A fails)**

If Option A fails, implement the ScreenCaptureKit overlay approach. This is a substantially larger effort but is the proven approach used by commercial tools.

**Key components:**

1. **WindowPinManager** -- orchestrates pinning/unpinning
2. **WindowCaptureStream** -- manages SCStream for a single pinned window
3. **FloatingOverlayWindow** -- NSWindow subclass at `.floating` level
4. **WindowPositionTracker** -- AX observer that tracks the original window's position/size changes

**Required permissions:**
- Accessibility (already required by Jumpee)
- Screen Recording (new -- required by ScreenCaptureKit)

**Framework additions:**
```swift
// build.sh: add -framework ScreenCaptureKit
swiftc -O -framework Cocoa -framework ScreenCaptureKit Sources/main.swift ...
```

---

## 4. Risk Assessment

### API Stability Risks

| API | Risk Level | Notes |
|-----|-----------|-------|
| `CGSSetWindowLevel` | HIGH | Private API, may be removed or restricted. As of macOS 10.13+, CGS symbols have SLS equivalents. Both appear available on macOS 15 but no guarantee. |
| `CGSGetWindowLevel` | HIGH | Same as above. |
| `CGSMainConnectionID()` | LOW | Already used by Jumpee for space detection. Stable across macOS 10.x through 15. |
| `_AXUIElementGetWindow` | MEDIUM | Private but widely used (alt-tab-macos, yabai, etc). Stable for many years. |
| `ScreenCaptureKit` | LOW | Public Apple framework, documented, supported. Available macOS 12.3+. |
| `AXUIElement` (public) | LOW | Public Accessibility API. Stable. |

### macOS Version Compatibility

| macOS Version | CGSSetWindowLevel | ScreenCaptureKit | Notes |
|--------------|-------------------|------------------|-------|
| 13 (Ventura) | Present (unverified for cross-app) | Yes (12.3+) | Jumpee's minimum target |
| 14 (Sonoma) | Present (unverified for cross-app) | Yes + SCScreenshotManager | |
| 15 (Sequoia) | Present (unverified for cross-app) | Yes | New privacy restrictions on window capture |

### Permission & Security Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Screen Recording permission (Option B) | Users must grant additional permission | Clear onboarding flow explaining why needed |
| Private API changes | Feature may break on future macOS | Feature-gate with `pinWindow.enabled`, graceful failure |
| SIP restrictions tightening | Option C becomes impossible | Already recommending against Option C |
| App Store rejection | Cannot distribute via Mac App Store | Jumpee is already distributed outside MAS; private APIs are already used |

### Behavioral Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Window level resets on focus change | Pinned window may drop back to normal | If Option A: periodic level re-assertion via timer. If Option B: N/A (overlay is Jumpee's own window) |
| Fullscreen windows | Cannot be meaningfully pinned | Detect and gracefully reject (no crash) |
| Electron app window recreation | Pinned window identity lost | Track by PID + title, re-identify on change |
| Click-through behavior (Option B) | User cannot interact with pinned window | Overlay must be click-through with `ignoresMouseEvents = true` |
| Resource usage (Option B) | Continuous capture uses GPU | Only capture when window is pinned; stop stream on unpin |

---

## 5. Window Level Constants Reference

For implementation, these are the relevant numeric values:

| Constant | Value | Use |
|----------|-------|-----|
| `kCGNormalWindowLevel` | 0 | Default window level (unpin target) |
| `kCGFloatingWindowLevel` | 3 | Floating palette level (pin target for Option A) |
| `kCGModalPanelWindowLevel` | 8 | Modal dialog level |
| `kCGUtilityWindowLevel` | 19 | Utility window |
| `kCGStatusWindowLevel` | 25 | Status bar / menu bar level |
| `kCGPopUpMenuWindowLevel` | 101 | Popup menu level |
| `kCGScreenSaverWindowLevel` | 1000 | Screen saver level |

**Recommended pin level:** `kCGFloatingWindowLevel` (3) for Option A, `NSWindow.Level.floating` for Option B's overlay window. Using a higher level (e.g., `kCGStatusWindowLevel` = 25) would place the pinned window above system UI elements, which is undesirable.

---

## 6. How Existing Tools Implement Always-on-Top

### yabai (Tiling Window Manager)
- **Approach:** Option C (Dock injection)
- **API:** `SLSSetWindowLevel` called via Dock.app's universal connection
- **Requires:** Partial SIP disable + scripting addition injection
- **Source:** `src/window_manager.c`, `src/view.c`, `src/misc/extern.h`
- **Status:** Active development, works on macOS 13-15

### Afloat (Legacy)
- **Approach:** SIMBL code injection into target apps
- **API:** `CGSSetWindowLevel` called from within the target app (using app's own connection)
- **Requires:** SIMBL loader, no SIP
- **Status:** Abandoned. Incompatible with modern macOS (SIP, hardened runtime, Apple Silicon)

### Floaty (Commercial)
- **Approach:** Option B (overlay with Accessibility + Screen Recording)
- **API:** Accessibility APIs + ScreenCaptureKit (or similar capture mechanism)
- **Requires:** Accessibility + Screen Recording permissions
- **Status:** Active commercial product, works on macOS 13-15

### TopWindow (Commercial)
- **Approach:** Option B (ScreenCaptureKit overlay)
- **API:** ScreenCaptureKit for window enumeration and real-time monitoring + Accessibility
- **Requires:** Accessibility + Screen Recording permissions
- **Status:** Active commercial product, macOS 13+

### BetterTouchTool / Rectangle Pro
- **Approach:** Unknown (likely Option B variant or private APIs)
- **Status:** Commercial products with always-on-top as a secondary feature

---

## 7. Technical Research Guidance

**Research needed:** Yes

### Topic 1: CGSSetWindowLevel Cross-App Feasibility Test

- **Why needed:** The critical uncertainty is whether `CGSSetWindowLevel` works on another app's window when called with Jumpee's own `CGSMainConnectionID()`. Research is contradictory -- some sources say it is categorically blocked, while Jumpee already uses `CGSMainConnectionID()` for other cross-app operations (space detection).
- **Focus areas:**
  - Build and run the test code from Section 3 against a standard window (e.g., Terminal, Safari)
  - Test on macOS 13, 14, and 15 if possible
  - Check return value AND verify visual behavior (window stays on top after clicking elsewhere)
  - Test whether `CGSGetWindowLevel` can read other apps' window levels (if reading fails, writing certainly will)
- **Depth level:** Quick (1-2 hours max -- this is a build-and-test exercise)

### Topic 2: ScreenCaptureKit Single-Window Capture Performance

- **Why needed:** If Option A fails, we need to understand the performance profile of continuously capturing a single window via ScreenCaptureKit. This determines whether Option B is viable for Jumpee's "lightweight" philosophy.
- **Focus areas:**
  - CPU/GPU usage of `SCStream` capturing a single window at native resolution
  - Frame rate requirements (do we need 60fps or can we use 10-15fps for acceptable visual quality?)
  - Memory footprint of the capture pipeline
  - Latency between original window update and overlay update
  - Battery impact on laptops
- **Depth level:** Medium (4-8 hours -- requires building a prototype and measuring)

### Topic 3: Click-Through Overlay Interaction Model

- **Why needed:** If using Option B, the overlay window blocks mouse events from reaching the original window. We need to determine the correct interaction model.
- **Focus areas:**
  - Does `NSWindow.ignoresMouseEvents = true` correctly pass all events through to the original window behind?
  - How do Floaty and TopWindow handle mouse interaction with pinned windows?
  - Can we avoid capturing entirely and just use a transparent NSWindow that covers the original window's frame and somehow prevents it from being obscured? (This would be much simpler but may not work)
- **Depth level:** Quick (2-3 hours -- mostly experimentation)

### Topic 4: SLSSetWindowLevel vs CGSSetWindowLevel Availability

- **Why needed:** If Option A is worth pursuing, we should verify whether to use the CGS or SLS prefix. As of macOS 10.13, SLS equivalents exist. We need to confirm both are still available on macOS 15.
- **Focus areas:**
  - Use `dlsym` to check for presence of both `CGSSetWindowLevel` and `SLSSetWindowLevel` on macOS 15
  - Determine if one is more reliable than the other
  - Check `w0lfschild/macOS_headers` repo for macOS 15 header dumps
- **Depth level:** Quick (30 minutes -- part of Topic 1 testing)

---

## 8. Sources

- [CGSInternal -- Private CoreGraphics/SkyLight Headers](https://github.com/NUIKit/CGSInternal)
- [CGSWindow.h -- Window Level Function Signatures](https://github.com/NUIKit/CGSInternal/blob/master/CGSWindow.h)
- [CGSConnection.h -- Connection Management](https://github.com/NUIKit/CGSInternal/blob/master/CGSConnection.h)
- [yabai -- Source Code (window_manager.c)](https://github.com/koekeishiya/yabai/blob/master/src/window_manager.c)
- [yabai -- External API Declarations (extern.h)](https://github.com/asmvik/yabai/blob/master/src/misc/extern.h)
- [yabai -- view.c with SLSSetWindowLevel calls](https://github.com/asmvik/yabai/blob/master/src/view.c)
- [yabai -- Issue #2554: Alternative for toggle topmost](https://github.com/asmvik/yabai/issues/2554)
- [alt-tab-macos -- Source Code](https://github.com/lwouis/alt-tab-macos)
- [Floaty -- How I Built It (Technical Blog Post)](https://medium.com/@ayincat/how-i-built-a-small-macos-tool-to-keep-windows-always-on-top-floaty-for-macos-38ade0a4590f)
- [Floaty -- macOS Always-on-Top Landscape 2025](https://www.floatytool.com/posts/macos-always-on-top-landscape/)
- [TopWindow -- ScreenCaptureKit Feature Page](https://topwindow.app/features/screencapturekit/)
- [TopWindow -- Always-on-Top Feature Page](https://topwindow.app/features/always-on-top/)
- [Show HN: Floaty (Hacker News Discussion)](https://news.ycombinator.com/item?id=46065780)
- [macOS Window Level Order (Jim Fisher)](https://jameshfisher.com/2020/08/03/what-is-the-order-of-nswindow-levels/)
- [CGWindowLevelForKey -- Apple Documentation](https://developer.apple.com/documentation/coregraphics/cgwindowlevelforkey(_:))
- [CGWindowLevel.h -- macOS SDK Headers](https://github.com/phracker/MacOSX-SDKs/blob/master/MacOSX10.8.sdk/System/Library/Frameworks/CoreGraphics.framework/Versions/A/Headers/CGWindowLevel.h)
- [NSWindow.level -- Apple Documentation](https://developer.apple.com/documentation/appkit/nswindow/1419511-level)
- [ScreenCaptureKit -- Apple Documentation](https://developer.apple.com/documentation/screencapturekit/)
- [Capturing Screen Content in macOS -- Apple Documentation](https://developer.apple.com/documentation/ScreenCaptureKit/capturing-screen-content-in-macos)
- [Meet ScreenCaptureKit -- WWDC22](https://developer.apple.com/videos/play/wwdc2022/10156/)
- [HowtoControlOtherAppsWindows -- CocoaDev](https://cocoadev.github.io/HowtoControlOtherAppsWindows/)
- [CoreGraphicsPrivate -- CocoaDev](https://cocoadev.github.io/CoreGraphicsPrivate/)
- [w0lfschild/macOS_headers -- macOS Private Framework Headers](https://github.com/w0lfschild/macOS_headers)
- [Reverse Engineering Undocumented macOS API (Apriorit)](https://www.apriorit.com/dev-blog/778-reverse-engineering-undocumented-macos-api)
- [Calling Hidden/Private API from Swift (Medium)](https://medium.com/swlh/calling-ios-and-macos-hidden-api-in-style-1a924f244ad1)
- [Getting Started with macOS Utility App Using Private APIs (Speaker Deck)](https://speakerdeck.com/niw/getting-started-with-making-macos-utility-app-using-private-apis)
