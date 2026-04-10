# Investigation: Input Source (Keyboard Language) Indicator

**Date:** 2026-04-10
**Investigator:** Claude Code
**Feature:** Input Source Indicator overlay for Jumpee
**Related docs:**
- `docs/reference/refined-request-input-source-indicator.md` -- full specification
- `docs/reference/codebase-scan-input-source-indicator.md` -- codebase analysis

---

## 1. Input Source Detection APIs on macOS

### 1.1 TISCopyCurrentKeyboardInputSource

The primary API for detecting the active keyboard input source is part of the Text Input Source Services framework, available via `Carbon.HIToolbox` (already imported by Jumpee).

**Function signature:**
```swift
func TISCopyCurrentKeyboardInputSource() -> TISInputSource
```

This returns an opaque `TISInputSource` reference representing the currently active keyboard layout. The function is synchronous and returns immediately. It follows the Core Foundation "Copy" naming convention, meaning the caller owns the returned reference. In Swift with ARC bridging, this is handled automatically.

**Availability:** Available since macOS 10.5. Fully supported on macOS 13+ (Jumpee's minimum target). Not deprecated as of macOS 15.

**No permissions required.** This API reads the current keyboard input source without any entitlements, Accessibility permissions, or Screen Recording permissions.

### 1.2 Getting the Localized Name

```swift
func TISGetInputSourceProperty(_ inputSource: TISInputSource, _ propertyKey: CFString) -> UnsafeMutableRawPointer?
```

With `kTISPropertyLocalizedName` as the property key, this returns a `CFString` (bridgeable to Swift `String`) containing the human-readable name of the input source. Examples:
- "U.S." for the standard US English keyboard
- "Greek" for the Greek keyboard layout
- "British" for the UK English keyboard
- "ABC" for the generic ABC layout
- "Pinyin - Simplified" for Chinese Pinyin input

**Complete detection code:**
```swift
func getCurrentInputSourceName() -> String {
    let source = TISCopyCurrentKeyboardInputSource()
    if let namePtr = TISGetInputSourceProperty(source, kTISPropertyLocalizedName) {
        let name = Unmanaged<CFString>.fromOpaque(namePtr).takeUnretainedValue() as String
        return name
    }
    return "Unknown"
}
```

**Key detail:** `TISGetInputSourceProperty` returns an unretained pointer (`Get` rule), so `takeUnretainedValue()` is correct. Using `takeRetainedValue()` would cause a double-free crash.

### 1.3 Input Source Change Notification

The system posts a notification when the active keyboard input source changes. There are two mechanisms:

**Mechanism 1: DistributedNotificationCenter (Recommended)**
```swift
DistributedNotificationCenter.default().addObserver(
    self,
    selector: #selector(inputSourceDidChange(_:)),
    name: NSNotification.Name("AppleSelectedInputSourcesChangedNotification"),
    object: nil,
    suspensionBehavior: .deliverImmediately
)
```

This is the most commonly used approach in macOS apps. The notification name `"AppleSelectedInputSourcesChangedNotification"` is posted by the Input Source subsystem whenever the user switches keyboard layouts via any method (menu bar, keyboard shortcut, Touch Bar, programmatic switch).

**Mechanism 2: CFNotificationCenter with kTISNotifySelectedKeyboardInputSourceChanged**
```swift
let center = CFNotificationCenterGetDistributedCenter()
let callback: CFNotificationCallback = { center, observer, name, object, userInfo in
    // Handle input source change
}
CFNotificationCenterAddObserver(
    center,
    nil,  // observer
    callback,
    kTISNotifySelectedKeyboardInputSourceChanged,
    nil,  // object
    .deliverImmediately
)
```

This is the lower-level C-based approach. Functionally equivalent to Mechanism 1, but requires a C function pointer callback, making it less ergonomic in Swift.

**Recommendation:** Use Mechanism 1 (`DistributedNotificationCenter`). It integrates cleanly with Swift/Objective-C patterns, uses the familiar `addObserver`/`@objc` selector pattern already used throughout Jumpee (e.g., `spaceDidChange`, `screenParametersDidChange`), and avoids the complexity of C callback bridging.

**Notification delivery characteristics:**
- Delivered on the main thread (when registered on main thread)
- Delivered within one event loop cycle (~1-5ms typical)
- Fires for all input source change methods: keyboard shortcut (Ctrl+Space, Fn, Globe key), menu bar click, programmatic switch
- `.deliverImmediately` ensures delivery even if the app is in a modal state

### 1.4 macOS Version Considerations

| API | macOS 13+ Status | Notes |
|-----|-----------------|-------|
| `TISCopyCurrentKeyboardInputSource()` | Fully available | Part of Carbon.HIToolbox, stable since 10.5 |
| `TISGetInputSourceProperty()` | Fully available | Same as above |
| `kTISPropertyLocalizedName` | Fully available | Standard property key |
| `AppleSelectedInputSourcesChangedNotification` | Fully available | Distributed notification, used widely |
| `DistributedNotificationCenter` | Fully available | Foundation class, stable API |

**No deprecation risk.** While some Carbon APIs are deprecated (e.g., Carbon Event Manager for hotkeys), the TIS (Text Input Source) APIs remain the standard way to detect input sources on macOS. There is no replacement API in modern frameworks. Even Apple's own Input Source preferences use these APIs internally.

### 1.5 Alternative Approaches (Considered and Rejected)

1. **`NSTextInputContext.currentInputContext`** -- Only available when the app has an active text input context (key window with a text field focused). Jumpee is a menu bar app with no key window most of the time. Not suitable.

2. **`CGEventTapCreate` to detect input source changes** -- Overly complex, requires Accessibility permission, and is designed for event monitoring rather than input source detection. Overkill for this use case.

3. **Polling `TISCopyCurrentKeyboardInputSource()` on a timer** -- Works but violates NFR-ISI-1 (must be event-driven, not polling). Wastes CPU and battery. The notification approach is strictly superior.

---

## 2. Overlay Window Approach

### 2.1 Window Creation and Configuration

The input source indicator window follows the same `NSWindow` subclass pattern as the existing `OverlayWindow`, with these key differences:

```swift
class InputSourceIndicatorWindow: NSWindow {
    init(screen: NSScreen, text: String, config: InputSourceIndicatorConfig) {
        // ...
        super.init(
            contentRect: windowRect,  // Sized to fit text + padding, not full screen
            styleMask: .borderless,
            backing: .buffered,
            defer: false
        )
        
        self.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.floatingWindow)) + 1)
        self.backgroundColor = .clear
        self.isOpaque = false
        self.hasShadow = false
        self.ignoresMouseEvents = true
        self.collectionBehavior = [.canJoinAllSpaces, .stationary]
    }
}
```

**Key design decisions:**

1. **Window size:** Unlike `OverlayWindow` which fills the entire screen frame, the indicator window should be sized to fit the text plus padding for the background pill. This is more efficient (smaller window = less compositing) and avoids unnecessary screen coverage.

2. **Window level:** `floatingWindow + 1` puts the indicator above normal application windows and floating panels, but below status windows, modal panels, and the menu bar itself. This matches UX-ISI-3 from the spec.

3. **`ignoresMouseEvents = true`:** Makes the window fully click-through. All mouse events pass through to windows beneath it. This is the same approach used by `OverlayWindow` and `PinOverlayWindow`.

4. **`.canJoinAllSpaces` + `.stationary`:** The window appears on all spaces and does not animate during space transitions. Same behavior as the existing desktop watermark overlay.

### 2.2 Positioning Below the Menu Bar

**Menu bar height calculation (notch-aware):**

```swift
func menuBarHeight(for screen: NSScreen) -> CGFloat {
    // screen.frame = full screen rectangle (includes menu bar area)
    // screen.visibleFrame = usable area (excludes menu bar and Dock)
    // The menu bar height is the gap between the top of visibleFrame and the top of frame
    return screen.frame.maxY - screen.visibleFrame.maxY
}
```

This formula works correctly for:
- **Standard displays:** Returns ~25px (standard menu bar height)
- **Notched MacBook Pro displays:** Returns ~37px (taller menu bar accommodating the notch)
- **Displays with auto-hide menu bar:** Returns 0 when hidden; the indicator would sit at the top of the screen

**Window positioning:**

```swift
let screen = targetScreen
let mbHeight = menuBarHeight(for: screen)
let verticalOffset = CGFloat(config.verticalOffset)

// Text size + padding
let textSize = label.fittingSize
let padding: CGFloat = 20  // horizontal padding inside the pill
let verticalPadding: CGFloat = 8  // vertical padding inside the pill

let windowWidth = textSize.width + padding * 2
let windowHeight = textSize.height + verticalPadding * 2

// Position: horizontally centered, top edge touching bottom of menu bar
let x = screen.frame.origin.x + (screen.frame.width - windowWidth) / 2
let y = screen.frame.maxY - mbHeight - windowHeight - verticalOffset

let windowFrame = NSRect(x: x, y: y, width: windowWidth, height: windowHeight)
```

**Note on coordinate system:** macOS uses a bottom-left origin coordinate system for screen coordinates. `screen.frame.maxY` is the top of the screen, and we subtract downward to position below the menu bar.

### 2.3 Semi-Transparent Background Pill

The background pill is a visual container behind the text that provides contrast against any wallpaper or window content:

```swift
// Background view (rounded rectangle)
let bgView = NSView(frame: bounds)
bgView.wantsLayer = true
bgView.layer?.backgroundColor = NSColor.fromHex(config.backgroundColor)
    .withAlphaComponent(CGFloat(config.backgroundOpacity)).cgColor
bgView.layer?.cornerRadius = CGFloat(config.backgroundCornerRadius)

// Text label centered in the background
let label = NSTextField(labelWithString: text)
// ... configure font, color, etc.
```

The background auto-sizes to fit the text because the window itself is sized to the text + padding. When the input source name changes (e.g., from "U.S." to "Greek"), both the text and the window/background resize to fit.

### 2.4 Multi-Monitor Considerations

The indicator must appear on the display containing the active space. Jumpee already has the infrastructure for this:

- `SpaceDetector.getActiveDisplayID()` returns the display UUID of the active space
- `SpaceDetector.displayIDToScreen(_:)` maps the UUID to an `NSScreen` instance

The `InputSourceIndicatorManager` uses these to determine which screen to place the indicator on. When the user switches spaces (and potentially displays), the manager repositions the window:

```swift
func refresh() {
    guard let config = currentConfig, config.enabled else { return }
    guard let spaceInfo = spaceDetector.getCurrentSpaceInfo() else { return }
    let screen = spaceDetector.displayIDToScreen(spaceInfo.displayID) ?? NSScreen.main
    guard let targetScreen = screen else { return }
    
    // Reposition/resize window on the correct screen
    repositionWindow(on: targetScreen)
}
```

**Edge case: different menu bar heights across displays.** On a setup with a notched MacBook display (37px menu bar) and an external display (25px menu bar), the indicator correctly adjusts because `menuBarHeight(for:)` is computed per-screen using that screen's `frame` and `visibleFrame`.

### 2.5 `.canJoinAllSpaces` + `.stationary` Behavior

With `.canJoinAllSpaces`, the window is visible on every space without needing to create separate windows per space. With `.stationary`, the window does not participate in space transition animations (it stays in place while the desktop slides).

This is the same behavior as the existing desktop watermark overlay. The indicator simply appears on all spaces at the same screen position.

**Caveat:** With `.canJoinAllSpaces`, the window always appears on all screens in a multi-monitor setup. However, we only want it on the active screen. The solution is to reposition the window to the active screen whenever the space changes, and since `.stationary` prevents animation artifacts, this works cleanly.

---

## 3. Architecture Approach

### 3.1 New Types to Add

Following the existing codebase conventions (Config struct + Manager class + Window class):

**1. `InputSourceIndicatorConfig: Codable`** (after `PinWindowConfig`, ~line 131)
```swift
struct InputSourceIndicatorConfig: Codable {
    var enabled: Bool
    var fontSize: Double?
    var fontName: String?
    var fontWeight: String?
    var textColor: String?
    var opacity: Double?
    var backgroundColor: String?
    var backgroundOpacity: Double?
    var backgroundCornerRadius: Double?
    var verticalOffset: Double?
    
    // Documented exception to no-default-fallback rule
    // (see Issues - Pending Items.md, items 11-12 for precedent)
    static let defaultFontSize: Double = 60
    static let defaultFontName: String = "Helvetica Neue"
    static let defaultFontWeight: String = "bold"
    static let defaultTextColor: String = "#FFFFFF"
    static let defaultOpacity: Double = 0.8
    static let defaultBackgroundColor: String = "#000000"
    static let defaultBackgroundOpacity: Double = 0.3
    static let defaultBackgroundCornerRadius: Double = 10
    static let defaultVerticalOffset: Double = 0
    
    // Resolved properties (apply defaults)
    var effectiveFontSize: Double { fontSize ?? Self.defaultFontSize }
    var effectiveFontName: String { fontName ?? Self.defaultFontName }
    // ... etc for all properties
}
```

**Design note on optional properties with defaults:** The config properties are `Optional` so that absent values in JSON decode to `nil` rather than failing. The `effective*` computed properties provide the documented default values. This follows the same pattern as `effectiveMoveWindowHotkey` and `effectivePinWindowHotkey` in `JumpeeConfig`.

**2. Add to `JumpeeConfig`:**
```swift
var inputSourceIndicator: InputSourceIndicatorConfig?
```

**3. `InputSourceIndicatorWindow: NSWindow`** (after `OverlayWindow`, ~line 450)
- Sized to fit text + padding (not full screen)
- Background pill layer with configurable color/opacity/corner radius
- `updateText(_:config:)` method that resizes window and repositions
- `reposition(on:config:)` method for display changes

**4. `InputSourceIndicatorManager`** (after `OverlayManager`, ~line 500)
- Owns `InputSourceIndicatorWindow?` instance
- Subscribes to `AppleSelectedInputSourcesChangedNotification` via `DistributedNotificationCenter`
- Calls `TISCopyCurrentKeyboardInputSource()` + `TISGetInputSourceProperty()` on notification
- Methods: `start(config:)`, `stop()`, `updateConfig(_:)`, `refresh()`

### 3.2 MenuBarController Integration Points

| Integration Point | Location | Change |
|------------------|----------|--------|
| Instance variable | ~line 1142 | Add `private var inputSourceManager: InputSourceIndicatorManager?` |
| Initialization | ~line 1158 (after overlay setup) | Create and start manager if `config.inputSourceIndicator?.enabled == true` |
| Menu toggle item | ~line 1288 (after overlay toggle) | Add "Enable/Disable Input Source Indicator" with tag 102 |
| Menu title update | `rebuildSpaceItems()` (~line 1556) | Update toggle item title based on current state |
| Space change | `spaceDidChange(_:)` (line 1596) | Add `inputSourceManager?.refresh()` |
| Screen change | `screenParametersDidChange(_:)` (line 1601) | Add `inputSourceManager?.refresh()` |
| Toggle action | New `@objc` method | Toggle `config.inputSourceIndicator?.enabled`, save, start/stop manager |
| Config reload | `reloadConfig(_:)` (line 2009) | Start/stop/reconfigure manager based on new config |
| Quit | `quit(_:)` (line 2016) | Add `inputSourceManager?.stop()` |

### 3.3 Estimated Code Size

| Component | Estimated Lines |
|-----------|----------------|
| `InputSourceIndicatorConfig` | ~45 |
| `InputSourceIndicatorWindow` | ~100 |
| `InputSourceIndicatorManager` | ~80 |
| `MenuBarController` integration | ~40 |
| **Total** | **~265** |

This brings `main.swift` from ~2050 to ~2315 lines. Acceptable for a single-file architecture.

### 3.4 Build System Impact

None. The single-file `Sources/main.swift` compilation in `build.sh` already links `Cocoa` and `Carbon.HIToolbox`. No new frameworks or build flags are needed.

---

## 4. Risks and Edge Cases

### 4.1 Input Source Changes During Full-Screen Apps

**Risk level: Low**

When a full-screen app is active, the menu bar is typically hidden. The input source indicator window, being at `floatingWindow + 1` level with `.canJoinAllSpaces`, will still be visible in front of the full-screen app. This could be either desirable (user always sees the indicator) or undesirable (covers full-screen content).

**Mitigation:** The current spec does not require hiding the indicator in full-screen mode. This is acceptable for v1 since:
1. The indicator is relatively small (just text width + padding)
2. The user can disable it via config if it interferes
3. A future enhancement could observe `NSApplication.didChangeOcclusionState` or check `NSScreen.visibleFrame` changes to detect full-screen transitions

### 4.2 Multiple Displays with Different Menu Bar Heights

**Risk level: Low (already addressed)**

The `menuBarHeight(for:)` function computes the height per-screen using that screen's own `frame` and `visibleFrame`. A notched MacBook display returns ~37px while an external monitor returns ~25px. The indicator positions correctly on each.

**Edge case: Menu bar on non-primary display.** In macOS 13+, the menu bar can appear on all displays or just the primary display (depending on System Settings > Desktop & Dock > "Displays have separate Spaces"). If "separate Spaces" is off, only the primary display has a menu bar, and `visibleFrame` on secondary displays extends to the top of the screen (menuBarHeight = 0). The indicator would sit at the very top of the secondary display, which is correct behavior since there is no menu bar to position below.

### 4.3 Performance Impact of Event-Driven Monitoring

**Risk level: Negligible**

The `DistributedNotificationCenter` observer uses zero CPU when no input source changes occur. It is a passive event listener managed by the system's notification infrastructure. When a notification fires (typically a few times per hour for most users), the handler:
1. Calls `TISCopyCurrentKeyboardInputSource()` -- one function call, microseconds
2. Calls `TISGetInputSourceProperty()` -- one function call, microseconds
3. Updates an `NSTextField` string and resizes a small window -- submillisecond

Total per-event cost: well under 1ms. No timers, no polling, no background threads.

**Memory impact:** One additional `NSWindow` instance (small, not full-screen) plus one `DistributedNotificationCenter` observer. Negligible.

### 4.4 Interaction with Existing Overlay/Watermark

**Risk level: None**

The two overlays are completely independent:
- **Desktop watermark (`OverlayWindow`):** Full-screen window at `desktopWindow + 1` level (below everything). Shows space name on the desktop.
- **Input source indicator (`InputSourceIndicatorWindow`):** Small window at `floatingWindow + 1` level (above normal windows). Shows input source name below menu bar.

Different window levels, different positions, different sizes, different triggers. They cannot interfere visually or functionally.

### 4.5 Input Source Name Length Variation

**Risk level: Low**

Input source names vary in length: "U.S." (4 chars) vs "Pinyin - Simplified" (19 chars). The window auto-sizes to fit the text, so long names result in wider indicators. At 60pt font, "Pinyin - Simplified" would be approximately 800px wide -- still well within a typical screen width (1440px+).

**Mitigation:** No truncation needed. The window simply grows/shrinks with the text. If a user has an unusually long input source name, they can reduce `fontSize` in config.

### 4.6 `AppleSelectedInputSourcesChangedNotification` Reliability

**Risk level: Very Low**

This notification has been the standard mechanism for detecting input source changes since macOS 10.5+. It is used by major applications (TextExpander, Karabiner-Elements, various input method editors). It fires reliably for all input source change methods: keyboard shortcuts, menu bar clicks, programmatic switches, and Touch Bar selections.

**Known quirk:** The notification may fire multiple times for a single input source switch in some edge cases (e.g., intermediate input sources during complex IME transitions). The handler should be idempotent -- if the detected input source name is the same as the currently displayed name, skip the update. This is a trivial guard:
```swift
@objc private func inputSourceDidChange(_ notification: Notification) {
    let newName = getCurrentInputSourceName()
    guard newName != currentDisplayedName else { return }
    currentDisplayedName = newName
    updateIndicator(text: newName)
}
```

### 4.7 Auto-Hide Menu Bar

**Risk level: Low**

If the user has auto-hide menu bar enabled, `screen.visibleFrame.maxY` equals `screen.frame.maxY` when the menu bar is hidden, making `menuBarHeight = 0`. The indicator would sit at the very top of the screen. When the menu bar slides down (on mouse hover), it would cover the indicator.

**Acceptable behavior for v1.** The indicator is still functional and visible most of the time. A future enhancement could listen for menu bar visibility changes and adjust position dynamically, but this is not required by the spec.

### 4.8 Thread Safety

**Risk level: None**

`DistributedNotificationCenter` delivers notifications on the same thread that registered the observer. Since Jumpee registers on the main thread (in `MenuBarController.init()`), all notifications arrive on the main thread. All UI updates (`NSWindow`, `NSTextField`) happen on the main thread. No thread safety concerns.

---

## 5. Recommended Approach

### Summary

Implement the input source indicator using:

1. **Detection:** `TISCopyCurrentKeyboardInputSource()` + `TISGetInputSourceProperty(_, kTISPropertyLocalizedName)` for reading the current input source name.

2. **Event-driven updates:** `DistributedNotificationCenter` observing `"AppleSelectedInputSourcesChangedNotification"` with `.deliverImmediately` suspension behavior.

3. **Overlay window:** A small, auto-sized `NSWindow` subclass at `floatingWindow + 1` level, positioned horizontally centered and vertically just below the menu bar. Background pill via `CALayer` with configurable color, opacity, and corner radius.

4. **Architecture:** `InputSourceIndicatorConfig` (Codable struct with optional properties and documented default exceptions) + `InputSourceIndicatorWindow` (NSWindow subclass) + `InputSourceIndicatorManager` (owns window and notification observer) + `MenuBarController` integration.

5. **Multi-display:** Reposition to active display on space change, using existing `SpaceDetector` infrastructure.

### Justification

- **TIS APIs** are the only correct way to detect input sources on macOS. They are stable, well-documented (even if not in Apple's modern documentation), and used universally by macOS apps that need this functionality.
- **DistributedNotificationCenter** is the cleanest Swift integration for the notification, and it matches Jumpee's existing observer patterns.
- **Small auto-sized window** is more efficient than a full-screen transparent window (less compositing work for the window server).
- **The architecture** follows every established pattern in the codebase: config struct, optional field on JumpeeConfig, window subclass, manager class, MenuBarController wiring.
- **No new frameworks, permissions, or build changes** are required.

### Pre-Implementation Requirements

1. **Document default value exceptions** in "Issues - Pending Items.md" before implementation begins. Add an entry for `InputSourceIndicatorConfig` default values, referencing the existing precedent (items 11-12 for hotkey defaults).

2. **Update `docs/design/project-functions.MD`** with the functional requirements from the refined request.

3. **Update `docs/design/project-design.md`** with the input source indicator feature design.

---

## 6. Technical Research Guidance

**Research needed: No**

**Justification:**

All APIs required for this feature are well-established macOS technologies with extensive usage history:

- **TIS (Text Input Source Services):** Part of Carbon.HIToolbox since macOS 10.5 (2007). Widely used by input method editors, text editors, and keyboard utilities. The API surface needed (3 functions + 1 constant + 1 notification) is small and well-understood.

- **NSWindow with borderless/click-through/float-on-top:** Jumpee already implements this exact pattern twice (OverlayWindow and PinOverlayWindow). No new window management techniques are needed.

- **DistributedNotificationCenter:** Standard Foundation class used throughout macOS for inter-process notifications. Jumpee does not currently use it, but it follows the exact same `addObserver`/`@objc selector` pattern as the `NSWorkspace.notificationCenter` and `NotificationCenter.default` observers already in the codebase.

- **Menu bar height calculation from screen.frame/visibleFrame:** Straightforward arithmetic using standard NSScreen properties. The formula is well-known and documented in Apple developer forums and StackOverflow.

- **CALayer for rounded rectangle background:** Standard AppKit/Core Animation technique. Jumpee already uses `wantsLayer` on NSView in OverlayWindow.

No technology in the implementation plan is novel, undocumented, or risky enough to warrant a dedicated deep-research phase. The investigation above covers all the specifics needed for direct implementation.
