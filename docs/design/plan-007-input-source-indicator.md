# Plan 007: Input Source Indicator

**Date:** 2026-04-10
**Version target:** v1.5.0
**Estimated new code:** ~265 lines in `Sources/main.swift`
**Related documents:**
- `docs/reference/refined-request-input-source-indicator.md` -- full specification
- `docs/reference/investigation-input-source-indicator.md` -- technical investigation
- `docs/reference/codebase-scan-input-source-indicator.md` -- codebase architecture scan

---

## Overview

Add an input source monitoring feature to Jumpee that detects the current macOS keyboard input source (e.g., "U.S.", "Greek", "British") and displays it as a large, visible HUD-style indicator overlay positioned directly below the menu bar. The indicator updates in real time whenever the user switches input sources. The feature is toggled on/off via the config file and a menu item.

**Key constraints:**
- All code in a single file (`Sources/main.swift`, currently ~2050 lines)
- No parallelization across files -- implementation is strictly sequential
- No new frameworks or macOS permissions required
- `Carbon.HIToolbox` already imported (provides TIS APIs)

---

## Pre-Implementation Requirements

Before any code is written, two administrative tasks must be completed:

### P0: Document Default Value Exception

**Action:** Add an entry to `Issues - Pending Items.md` (pending section) documenting the default value exception for `InputSourceIndicatorConfig` appearance properties.

**Text to add (as item 16):**

> **Jumpee - Config default exception for InputSourceIndicatorConfig appearance properties**: The `InputSourceIndicatorConfig` struct uses documented default values for appearance properties (fontSize: 60, fontName: "Helvetica Neue", fontWeight: "bold", textColor: "#FFFFFF", opacity: 0.8, backgroundColor: "#000000", backgroundOpacity: 0.3, backgroundCornerRadius: 10, verticalOffset: 0) when the corresponding JSON keys are absent. This is a documented exception to the project's "no default fallback for config settings" rule, following the same pattern as `moveWindowHotkey` (item 11) and `pinWindowHotkey` (item 12). The defaults are centralized in static constants on `InputSourceIndicatorConfig` and exposed via `effective*` computed properties.

**Acceptance criteria:**
- [ ] Item 16 is present in the pending section of `Issues - Pending Items.md`
- [ ] The item references the precedent (items 11, 12)

### P1: Update Functional Requirements

**Action:** Add a new section to `docs/design/project-functions.md` for the input source indicator feature (Section 9).

**Acceptance criteria:**
- [ ] Section 9 added with FR-45 through FR-55
- [ ] "Last updated" header updated to reference v1.5.0

---

## Phase 1: InputSourceIndicatorConfig Struct

**Location:** `Sources/main.swift`, after `PinWindowConfig` (line 130), before `struct JumpeeConfig` (line 132).

**What to implement:**

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
    // (see Issues - Pending Items.md, item 16)
    static let defaultFontSize: Double = 60
    static let defaultFontName: String = "Helvetica Neue"
    static let defaultFontWeight: String = "bold"
    static let defaultTextColor: String = "#FFFFFF"
    static let defaultOpacity: Double = 0.8
    static let defaultBackgroundColor: String = "#000000"
    static let defaultBackgroundOpacity: Double = 0.3
    static let defaultBackgroundCornerRadius: Double = 10
    static let defaultVerticalOffset: Double = 0

    var effectiveFontSize: Double { fontSize ?? Self.defaultFontSize }
    var effectiveFontName: String { fontName ?? Self.defaultFontName }
    var effectiveFontWeight: String { fontWeight ?? Self.defaultFontWeight }
    var effectiveTextColor: String { textColor ?? Self.defaultTextColor }
    var effectiveOpacity: Double { opacity ?? Self.defaultOpacity }
    var effectiveBackgroundColor: String { backgroundColor ?? Self.defaultBackgroundColor }
    var effectiveBackgroundOpacity: Double { backgroundOpacity ?? Self.defaultBackgroundOpacity }
    var effectiveBackgroundCornerRadius: Double { backgroundCornerRadius ?? Self.defaultBackgroundCornerRadius }
    var effectiveVerticalOffset: Double { verticalOffset ?? Self.defaultVerticalOffset }
}
```

**Estimated lines:** ~45

**Also required in this phase -- add to `JumpeeConfig`:**

Insert after `var pinWindowHotkey: HotkeyConfig?` (line 140):

```swift
var inputSourceIndicator: InputSourceIndicatorConfig?
```

**Acceptance criteria:**
- [ ] `InputSourceIndicatorConfig` struct compiles with all 10 configurable properties
- [ ] All properties except `enabled` are `Optional`
- [ ] All `effective*` computed properties return the documented default when the property is nil
- [ ] `inputSourceIndicator` field added to `JumpeeConfig` as optional
- [ ] Existing configs (without `inputSourceIndicator` key) load without error -- `inputSourceIndicator` is `nil`
- [ ] A config with `"inputSourceIndicator": {"enabled": true}` decodes correctly with all defaults applied
- [ ] A config with full appearance customization decodes correctly with custom values
- [ ] `build.sh` compiles successfully

**Verification command:**
```bash
cd Jumpee && bash build.sh
```

---

## Phase 2: InputSourceIndicatorWindow Class

**Location:** `Sources/main.swift`, after the `OverlayWindow` class (around line 450, after `OverlayManager`), before `SpaceNavigator`.

**What to implement:**

A new `NSWindow` subclass for the input source indicator overlay. Key differences from `OverlayWindow`:

1. **Window size:** Sized to fit text + padding (not full screen). Auto-resizes when text changes.
2. **Window level:** `floatingWindow + 1` (above normal windows, below status/menu bar).
3. **Position:** Horizontally centered on the target screen, vertically immediately below the menu bar.
4. **Background:** Semi-transparent rounded rectangle (pill) behind the text.
5. **Collection behavior:** `.canJoinAllSpaces`, `.stationary` (same as `OverlayWindow`).

**Methods to implement:**

| Method | Description |
|--------|-------------|
| `init(screen:text:config:)` | Create the window, configure appearance, position on screen |
| `updateText(_:config:)` | Update the displayed text, resize window to fit, reposition |
| `reposition(on:config:)` | Move window to a different screen (for display changes) |

**Key implementation details:**

1. **Menu bar height calculation (notch-aware):**
   ```swift
   private func menuBarHeight(for screen: NSScreen) -> CGFloat {
       return screen.frame.maxY - screen.visibleFrame.maxY
   }
   ```

2. **Window positioning (macOS bottom-left origin coordinate system):**
   ```swift
   let mbHeight = menuBarHeight(for: screen)
   let verticalOffset = CGFloat(config.effectiveVerticalOffset)
   let x = screen.frame.origin.x + (screen.frame.width - windowWidth) / 2
   let y = screen.frame.maxY - mbHeight - windowHeight - verticalOffset
   ```

3. **Background pill:**
   - Use an `NSView` with `wantsLayer = true`
   - `layer?.backgroundColor` set from config's `effectiveBackgroundColor` + `effectiveBackgroundOpacity`
   - `layer?.cornerRadius` set from config's `effectiveBackgroundCornerRadius`
   - Horizontal padding: 20pt, vertical padding: 8pt

4. **Text label:**
   - `NSTextField(labelWithString:)` with configured font, color, opacity
   - Font resolved via `NSFont(name:size:)` with fallback to `NSFont.systemFont(ofSize:weight:)`
   - Font weight resolved using existing `fontWeight(from:)` utility (line ~210)
   - Text color via existing `NSColor.fromHex()` extension (line ~182)

5. **Window properties:**
   ```swift
   self.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.floatingWindow)) + 1)
   self.backgroundColor = .clear
   self.isOpaque = false
   self.hasShadow = false
   self.ignoresMouseEvents = true
   self.collectionBehavior = [.canJoinAllSpaces, .stationary]
   ```

**Estimated lines:** ~100

**Acceptance criteria:**
- [ ] Window appears borderless, transparent, and click-through
- [ ] Window level is `floatingWindow + 1`
- [ ] Window has `.canJoinAllSpaces` and `.stationary` collection behavior
- [ ] Text is displayed with correct font, size, weight, and color from config
- [ ] Background pill is visible with correct color, opacity, and corner radius
- [ ] Window is horizontally centered on the provided screen
- [ ] Window is vertically positioned immediately below the menu bar
- [ ] `updateText(_:config:)` resizes the window and repositions it to remain centered
- [ ] `reposition(on:config:)` moves the window to a different screen
- [ ] Menu bar height is calculated dynamically (works on both standard and notched displays)
- [ ] `build.sh` compiles successfully

---

## Phase 3: InputSourceIndicatorManager Class

**Location:** `Sources/main.swift`, immediately after `InputSourceIndicatorWindow`, before `SpaceNavigator`.

**What to implement:**

A manager class that:
1. Subscribes to input source change notifications via `DistributedNotificationCenter`
2. Reads the current input source name via TIS APIs
3. Creates, updates, and destroys the `InputSourceIndicatorWindow`

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `window` | `InputSourceIndicatorWindow?` | The indicator overlay window |
| `currentDisplayedName` | `String` | Last displayed input source name (for dedup) |
| `spaceDetector` | `SpaceDetector` | Reference for active display detection |
| `currentConfig` | `InputSourceIndicatorConfig?` | Current configuration |

**Methods to implement:**

| Method | Signature | Description |
|--------|-----------|-------------|
| `init` | `init(spaceDetector: SpaceDetector)` | Store the space detector reference |
| `start` | `start(config: JumpeeConfig)` | Register notification observer, create window, show current input source |
| `stop` | `stop()` | Remove notification observer, destroy window, reset state |
| `updateConfig` | `updateConfig(_ config: JumpeeConfig)` | Update appearance without stop/start cycle |
| `refresh` | `refresh()` | Reposition window on active display (called on space/screen change) |
| `getCurrentInputSourceName` | `-> String` (private) | Call TIS APIs to get localized name |
| `inputSourceDidChange` | `@objc` (private) | Notification handler |

**Core input source detection code:**

```swift
private func getCurrentInputSourceName() -> String {
    let source = TISCopyCurrentKeyboardInputSource()
    if let namePtr = TISGetInputSourceProperty(source, kTISPropertyLocalizedName) {
        let name = Unmanaged<CFString>.fromOpaque(namePtr).takeUnretainedValue() as String
        return name
    }
    return "Unknown"
}
```

**Notification registration:**

```swift
DistributedNotificationCenter.default().addObserver(
    self,
    selector: #selector(inputSourceDidChange(_:)),
    name: NSNotification.Name("AppleSelectedInputSourcesChangedNotification"),
    object: nil,
    suspensionBehavior: .deliverImmediately
)
```

**Notification handler (with dedup guard):**

```swift
@objc private func inputSourceDidChange(_ notification: Notification) {
    let newName = getCurrentInputSourceName()
    guard newName != currentDisplayedName else { return }
    currentDisplayedName = newName
    guard let config = currentConfig else { return }
    window?.updateText(newName, config: config)
}
```

**`refresh()` implementation:**

```swift
func refresh() {
    guard let config = currentConfig, config.enabled else { return }
    guard let spaceInfo = spaceDetector.getCurrentSpaceInfo() else { return }
    let screen = spaceDetector.displayIDToScreen(spaceInfo.displayID) ?? NSScreen.main
    guard let targetScreen = screen else { return }
    window?.reposition(on: targetScreen, config: config)
}
```

**`start()` implementation notes:**
1. Store `config.inputSourceIndicator` in `currentConfig`
2. Guard `config.inputSourceIndicator?.enabled == true`; if not, return without doing anything
3. Register the `DistributedNotificationCenter` observer
4. Read the current input source name
5. Determine the active screen via `spaceDetector`
6. Create `InputSourceIndicatorWindow` with the current text and config
7. Call `window?.orderFront(nil)` to show it

**`stop()` implementation notes:**
1. Remove observer from `DistributedNotificationCenter`
2. Call `window?.orderOut(nil)` then set `window = nil`
3. Reset `currentDisplayedName` and `currentConfig`

**`updateConfig()` implementation notes:**
1. Store new config
2. If feature was disabled and is now enabled: call `start(config:)`
3. If feature was enabled and is now disabled: call `stop()`
4. If feature remains enabled: update `currentConfig`, re-read current input source, call `window?.updateText()` with new config (to apply style changes)

**Estimated lines:** ~80

**Acceptance criteria:**
- [ ] Manager creates the indicator window when `start()` is called with an enabled config
- [ ] Manager destroys the indicator window when `stop()` is called
- [ ] Manager subscribes to `AppleSelectedInputSourcesChangedNotification` on start
- [ ] Manager removes the notification observer on stop
- [ ] When the input source changes, the displayed text updates within one event loop cycle
- [ ] Duplicate notifications (same input source name) are ignored (dedup guard)
- [ ] `refresh()` repositions the window on the active display
- [ ] `updateConfig()` handles enable/disable/restyle transitions
- [ ] `getCurrentInputSourceName()` returns the localized input source name
- [ ] No timers or polling -- purely event-driven
- [ ] `build.sh` compiles successfully

---

## Phase 4: MenuBarController Integration

This phase wires the `InputSourceIndicatorManager` into the existing `MenuBarController`. There are 8 specific integration points.

### 4.1 Instance Variable

**Location:** After the existing instance variables in `MenuBarController` (near the `overlayManager` and `hotkeyManager` declarations, around line 1142).

**Add:**
```swift
private var inputSourceManager: InputSourceIndicatorManager?
```

**Acceptance criteria:**
- [ ] Property declared as optional, initialized to nil

### 4.2 Initialization

**Location:** Inside `MenuBarController.init()`, after the overlay setup (around line 1158, after `overlayManager.updateOverlay(config: config)`).

**Add:**
```swift
if config.inputSourceIndicator?.enabled == true {
    inputSourceManager = InputSourceIndicatorManager(spaceDetector: spaceDetector)
    inputSourceManager?.start(config: config)
}
```

**Acceptance criteria:**
- [ ] Manager is created and started only when `inputSourceIndicator.enabled` is `true`
- [ ] When `inputSourceIndicator` is absent from config, no manager is created
- [ ] The indicator appears on launch if the feature is enabled

### 4.3 Menu Toggle Item

**Location:** Inside `setupMenu()`, after the overlay toggle item (tag 101, around line 1288).

**Add a new menu item:**
- Title: "Enable Input Source Indicator" or "Disable Input Source Indicator" based on config state
- Tag: `102`
- Action: `@objc toggleInputSourceIndicator(_:)`
- Target: `self`

**Implementation:**
```swift
let isiTitle = config.inputSourceIndicator?.enabled == true
    ? "Disable Input Source Indicator"
    : "Enable Input Source Indicator"
let isiToggleItem = NSMenuItem(
    title: isiTitle,
    action: #selector(toggleInputSourceIndicator(_:)),
    keyEquivalent: ""
)
isiToggleItem.target = self
isiToggleItem.tag = 102
menu.addItem(isiToggleItem)
```

**Acceptance criteria:**
- [ ] Menu item appears with tag 102
- [ ] Title reflects current state: "Disable..." when enabled, "Enable..." when disabled
- [ ] Clicking the item toggles the feature

### 4.4 Toggle Action Method

**Location:** New `@objc` method on `MenuBarController`.

**Add:**
```swift
@objc private func toggleInputSourceIndicator(_ sender: NSMenuItem) {
    if config.inputSourceIndicator == nil {
        config.inputSourceIndicator = InputSourceIndicatorConfig(enabled: true)
    } else {
        config.inputSourceIndicator!.enabled.toggle()
    }
    config.save()

    if config.inputSourceIndicator?.enabled == true {
        if inputSourceManager == nil {
            inputSourceManager = InputSourceIndicatorManager(spaceDetector: spaceDetector)
        }
        inputSourceManager?.start(config: config)
    } else {
        inputSourceManager?.stop()
    }
}
```

**Acceptance criteria:**
- [ ] Toggling from disabled creates the config section if absent
- [ ] Toggling saves the config to disk
- [ ] Toggling starts/stops the manager immediately
- [ ] The indicator appears/disappears in real time

### 4.5 Menu Title Update in rebuildSpaceItems()

**Location:** Inside `rebuildSpaceItems()` (around line 1556), after the existing tag 101 (overlay toggle) title update.

**Add:**
```swift
if let item = menu.item(withTag: 102) {
    item.title = config.inputSourceIndicator?.enabled == true
        ? "Disable Input Source Indicator"
        : "Enable Input Source Indicator"
}
```

**Acceptance criteria:**
- [ ] Menu item title updates each time the menu opens
- [ ] Title correctly reflects the current enabled/disabled state

### 4.6 Space Change Handler

**Location:** Inside `spaceDidChange(_:)` (around line 1596), after the existing `overlayManager.updateOverlay(config: config)` call.

**Add:**
```swift
inputSourceManager?.refresh()
```

**Acceptance criteria:**
- [ ] Indicator repositions to the active display when the user switches spaces

### 4.7 Screen Change Handler

**Location:** Inside `screenParametersDidChange(_:)` (around line 1601), after the existing `overlayManager.updateOverlay(config: config)` call.

**Add:**
```swift
inputSourceManager?.refresh()
```

**Acceptance criteria:**
- [ ] Indicator repositions when displays connect/disconnect

### 4.8 Config Reload

**Location:** Inside `reloadConfig(_:)` (around line 2009), after the existing overlay and hotkey reload logic.

**Add:**
```swift
if config.inputSourceIndicator?.enabled == true {
    if inputSourceManager == nil {
        inputSourceManager = InputSourceIndicatorManager(spaceDetector: spaceDetector)
    }
    inputSourceManager?.updateConfig(config)
} else {
    inputSourceManager?.stop()
}
```

**Acceptance criteria:**
- [ ] Reloading config (Cmd+R) enables the indicator if newly enabled
- [ ] Reloading config disables the indicator if newly disabled
- [ ] Reloading config applies style changes (font, color, size, etc.) without restart
- [ ] Reloading config when the feature was previously absent and is now present works correctly

### 4.9 Quit Handler

**Location:** Inside `quit(_:)` (around line 2016), before `hotkeyManager?.unregister()`.

**Add:**
```swift
inputSourceManager?.stop()
```

**Acceptance criteria:**
- [ ] Indicator window is destroyed on quit
- [ ] Notification observer is removed on quit

---

## Phase 5: Documentation Updates

### 5.1 Configuration Guide

**Location:** `docs/design/configuration-guide.md`

**Add a new section** for `inputSourceIndicator` documenting all 10 configuration properties with their types, descriptions, and default values. Include a complete example JSON snippet.

**Acceptance criteria:**
- [ ] All 10 properties documented (enabled, fontSize, fontName, fontWeight, textColor, opacity, backgroundColor, backgroundOpacity, backgroundCornerRadius, verticalOffset)
- [ ] Default values listed for each property
- [ ] Complete example JSON included
- [ ] Section follows the same format as existing config documentation

### 5.2 Project Design

**Location:** `docs/design/project-design.md`

**Add a new section** (Section 10 or similar) titled "Input Source Indicator (v1.5.0)" describing:
- Feature summary
- New components (config, window, manager)
- MenuBarController integration points
- Configuration schema
- Menu layout after v1.5.0

**Acceptance criteria:**
- [ ] Section added with architectural description
- [ ] Component list and integration points documented
- [ ] Config schema documented
- [ ] Menu layout diagram updated to show the new toggle item

### 5.3 About Dialog

**Location:** `Sources/main.swift`, inside `showAboutDialog()`, after the existing pin-window section.

**Add text:**
```
5. Input Source Indicator (optional)
   Shows the active keyboard input source below
   the menu bar. Set "inputSourceIndicator":
   {"enabled": true} in your config file.
```

**Acceptance criteria:**
- [ ] About dialog mentions the input source indicator feature
- [ ] Instructions for enabling are included

### 5.4 CLAUDE.md Updates

**Location:** `/Users/giorgosmarinos/aiwork/coding-platform/macbook-desktop/CLAUDE.md` (the `<Jumpee>` tool documentation)

**Update the `<info>` section** to include:
- Input source indicator in the features list
- Configuration description
- Note that no additional permissions are needed

**Acceptance criteria:**
- [ ] Feature listed in the Jumpee tool documentation
- [ ] Config key mentioned

---

## Phase 6: Build and Version

### 6.1 Version Bump

**Location:** `build.sh`

**Action:** Bump version from 1.4.0 to 1.5.0.

**Acceptance criteria:**
- [ ] `build.sh` references version 1.5.0
- [ ] `build.sh` completes without errors
- [ ] Built app runs correctly

---

## Implementation Order Summary

Since all code goes into a single file, phases must be implemented sequentially:

| Order | Phase | Description | Dependencies |
|-------|-------|-------------|--------------|
| 1 | P0 | Document default exception in Issues file | None |
| 2 | P1 | Update project-functions.md | None |
| 3 | Phase 1 | `InputSourceIndicatorConfig` struct + `JumpeeConfig` field | P0 |
| 4 | Phase 2 | `InputSourceIndicatorWindow` class | Phase 1 |
| 5 | Phase 3 | `InputSourceIndicatorManager` class | Phase 2 |
| 6 | Phase 4 | `MenuBarController` integration (all 9 sub-steps) | Phase 3 |
| 7 | Phase 5 | Documentation updates | Phase 4 |
| 8 | Phase 6 | Build and version bump | Phase 5 |

**Total estimated new lines:** ~265 (bringing `main.swift` from ~2050 to ~2315)

---

## Verification Checklist

After all phases are complete, verify the following end-to-end:

### Must Have (from refined request AC-1 through AC-13)

- [ ] **AC-1:** Indicator visible below menu bar when `inputSourceIndicator.enabled` is `true`
- [ ] **AC-2:** Indicator text updates within 100ms of input source switch
- [ ] **AC-3:** No indicator and no monitoring when feature is absent or disabled
- [ ] **AC-4:** Indicator is click-through (does not interfere with mouse interaction)
- [ ] **AC-5:** Indicator is horizontally centered on the active display
- [ ] **AC-6:** Indicator is positioned directly below menu bar (accounting for notch)
- [ ] **AC-7:** Default font is 60pt bold
- [ ] **AC-8:** All appearance properties are configurable via config.json
- [ ] **AC-9:** Config reload (Cmd+R) enables/disables/restyles the indicator
- [ ] **AC-10:** Menu includes "Enable/Disable Input Source Indicator" toggle
- [ ] **AC-11:** Indicator coexists with desktop watermark overlay
- [ ] **AC-12:** On multi-display, indicator appears on the active display
- [ ] **AC-13:** Indicator appears on all spaces (`.canJoinAllSpaces`)

### Should Have

- [ ] **AC-14:** Semi-transparent background pill for readability
- [ ] **AC-15:** No additional macOS permissions required

### Nice to Have

- [ ] **AC-16:** Single input source shows correctly
- [ ] **AC-17:** Background pill auto-sizes to fit text

---

## Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Input source changes during full-screen apps -- indicator may cover content | Low | User can disable via config; future enhancement can detect full-screen mode |
| Auto-hide menu bar -- indicator sits at screen top when menu bar hidden | Low | Acceptable for v1; future enhancement can track menu bar visibility |
| Duplicate notifications from DistributedNotificationCenter | Very Low | Dedup guard: skip update if name unchanged |
| Long input source names (e.g., "Pinyin - Simplified") widen indicator | Low | Window auto-sizes; user can reduce fontSize if needed |
| `TISCopyCurrentKeyboardInputSource` returns nil | Very Low | Fallback to "Unknown" string |
| File grows to ~2315 lines | Low | Acceptable per single-file architecture; no refactoring planned |

---

## Out of Scope

- Changing the active input source from Jumpee (monitoring only)
- Input source flag/icon display (text only)
- Animation on input source change
- Per-application input source tracking
- Global hotkey to toggle the indicator
- Hiding indicator in full-screen mode
