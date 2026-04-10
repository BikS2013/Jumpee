# Refined Request: Input Source (Keyboard Language) Indicator

**Date:** 2026-04-10
**Requested by:** User
**Raw request:** "I want you to add a feature to monitor the input source and draw an indicator exactly under the toolbar menu displaying the input source in 60pt fonts. I want you to allow the activation and deactivation of the feature through the configuration file."

---

## 1. Feature Summary

Add an input source monitoring feature to Jumpee that detects the current macOS keyboard input source (e.g., "English", "Greek", "French") and displays it as a large, visible indicator overlay positioned directly below the menu bar. The indicator updates in real time whenever the user switches keyboard input sources. The feature is toggled on/off via the `~/.Jumpee/config.json` configuration file.

### Clarifications & Assumptions

- **"Input source"** means the macOS keyboard input source (also called "input method" or "keyboard layout"), which represents the active language/keyboard layout (e.g., "U.S.", "Greek", "British", "Pinyin"). This is the same entity shown in the macOS menu bar input source icon (flag/language indicator).
- **"Exactly under the toolbar menu"** means the indicator is positioned at the top of the screen, directly below the macOS menu bar (approximately 25-30px from the top of the screen, accounting for the menu bar height). The indicator is centered horizontally on the active display.
- **"60pt fonts"** is the default font size. This is configurable to allow user preference adjustments.
- **"Displaying the input source"** means showing the localized name of the input source (e.g., "U.S.", "Greek", "British") or a short identifier. The exact text displayed should be the macOS-provided localized input source name.
- The indicator is a separate overlay from the existing desktop watermark overlay. Both can coexist independently.

---

## 2. Functional Requirements

### Core Behavior

1. **FR-ISI-1: Monitor Active Input Source**
   Jumpee monitors the currently active macOS keyboard input source using the `TISCopyCurrentKeyboardInputSource()` API from the Carbon/Text Input Services framework. The app listens for input source change notifications (`kTISNotifySelectedKeyboardInputSourceChanged` via `DistributedNotificationCenter` or `CFNotificationCenter`) to detect changes in real time.

2. **FR-ISI-2: Display Input Source Indicator**
   When the feature is enabled, Jumpee displays a transparent overlay window positioned directly below the macOS menu bar, showing the name of the current input source in large text (default 60pt). The overlay:
   - Is placed on the active display (same display as the current space)
   - Is horizontally centered on the screen
   - Is vertically positioned immediately below the menu bar
   - Uses a borderless, click-through window (similar to the existing desktop watermark overlay)
   - Floats above normal windows but does not interfere with user interaction

3. **FR-ISI-3: Real-Time Updates**
   The indicator text updates immediately (within one event loop cycle) whenever the user switches the keyboard input source via:
   - The macOS menu bar input source menu
   - A keyboard shortcut (e.g., Ctrl+Space or Fn)
   - Programmatic input source switching by other applications
   - Touch Bar or other input methods

4. **FR-ISI-4: Input Source Name Resolution**
   The displayed text is the localized name of the input source, obtained from `TISGetInputSourceProperty(source, kTISPropertyLocalizedName)`. Examples:
   - "U.S." for the standard US English keyboard
   - "Greek" for the Greek keyboard layout
   - "British" for the UK English keyboard
   - "Pinyin - Simplified" for Chinese Pinyin input

5. **FR-ISI-5: Coexistence with Desktop Overlay**
   The input source indicator is independent of the existing desktop name watermark overlay. Both features can be enabled simultaneously without interference. They use separate overlay windows at different positions and z-levels.

6. **FR-ISI-6: Space Change Handling**
   When the user switches to a different desktop/space, the input source indicator repositions itself to the active display and continues showing the current input source. The input source itself may or may not change when switching spaces (macOS behavior depends on system settings).

7. **FR-ISI-7: Multi-Display Support**
   On multi-display setups, the input source indicator appears on the display that contains the active space (same logic as the existing overlay, using `SpaceDetector.getActiveDisplayID()` and `displayIDToScreen()`).

### Configuration

8. **FR-ISI-8: Feature Enable/Disable**
   An `inputSourceIndicator` configuration section in `~/.Jumpee/config.json` controls whether the feature is active:
   ```json
   {
     "inputSourceIndicator": {
       "enabled": true
     }
   }
   ```
   When `enabled` is `false` or the section is absent, the input source indicator is not shown and no input source monitoring is performed. When absent from config, the feature is disabled (no default fallback -- consistent with the `pinWindow` and `moveWindow` pattern where optional feature sections are nil when not present).

9. **FR-ISI-9: Configurable Appearance**
   The `inputSourceIndicator` section supports optional appearance customization properties:
   ```json
   {
     "inputSourceIndicator": {
       "enabled": true,
       "fontSize": 60,
       "fontName": "Helvetica Neue",
       "fontWeight": "bold",
       "textColor": "#FFFFFF",
       "opacity": 0.8,
       "backgroundColor": "#000000",
       "backgroundOpacity": 0.3,
       "backgroundCornerRadius": 10,
       "verticalOffset": 0
     }
   }
   ```

   | Property | Type | Description | Default |
   |----------|------|-------------|---------|
   | `enabled` | boolean | Show/hide the input source indicator | Feature disabled when absent |
   | `fontSize` | number | Font size in points | `60` |
   | `fontName` | string | Font family name | `"Helvetica Neue"` |
   | `fontWeight` | string | Font weight (same values as overlay: "regular", "bold", etc.) | `"bold"` |
   | `textColor` | string | Hex color code for the text | `"#FFFFFF"` |
   | `opacity` | number | Text opacity (0.0 - 1.0) | `0.8` |
   | `backgroundColor` | string | Hex color code for optional background pill/rectangle | `"#000000"` |
   | `backgroundOpacity` | number | Background opacity (0.0 = no background, 1.0 = solid) | `0.3` |
   | `backgroundCornerRadius` | number | Corner radius for background rectangle (0 = square) | `10` |
   | `verticalOffset` | number | Additional pixels below the menu bar (0 = tight against menu bar) | `0` |

   **Note on defaults:** These default values are documented exceptions to the no-default-fallback rule, following the same pattern as `moveWindowHotkey` and `pinWindowHotkey`. This exception must be recorded in the project's memory/issues file before implementation.

10. **FR-ISI-10: Menu Toggle**
    A menu item in the Jumpee dropdown allows toggling the input source indicator on/off:
    - When enabled: "Disable Input Source Indicator"
    - When disabled: "Enable Input Source Indicator"
    This follows the same pattern as the existing "Enable Overlay" / "Disable Overlay" toggle.

11. **FR-ISI-11: Config Reload Support**
    When the user reloads config (Cmd+R or "Reload Config" menu item), the input source indicator respects the updated configuration -- enabling, disabling, or restyling as needed.

---

## 3. Non-Functional Requirements

1. **NFR-ISI-1: Performance**
   Input source change detection must use event-driven notifications (not polling). The indicator update must be imperceptible to the user (sub-100ms from input source switch to visual update).

2. **NFR-ISI-2: Memory Footprint**
   The feature adds at most one additional NSWindow (the indicator overlay). No background timers or polling loops are used when the feature is enabled. When disabled, zero additional resources are consumed.

3. **NFR-ISI-3: Click-Through Behavior**
   The indicator overlay window must be fully click-through (`ignoresMouseEvents = true`). It must not intercept any mouse events or prevent interaction with windows or the menu bar beneath it.

4. **NFR-ISI-4: No Additional Permissions Required**
   Monitoring the keyboard input source does not require Accessibility, Screen Recording, or any special macOS permissions. The `TISCopyCurrentKeyboardInputSource()` API is available without entitlements.

5. **NFR-ISI-5: Consistent Architecture**
   The implementation must follow the existing codebase patterns:
   - A new config struct (e.g., `InputSourceIndicatorConfig: Codable`) similar to `OverlayConfig`
   - A new optional field on `JumpeeConfig` (e.g., `inputSourceIndicator: InputSourceIndicatorConfig?`)
   - A new window class (e.g., `InputSourceIndicatorWindow: NSWindow`) similar to `OverlayWindow`
   - A new manager class (e.g., `InputSourceIndicatorManager`) similar to `OverlayManager`
   - Integration with `MenuBarController` for lifecycle management

6. **NFR-ISI-6: Code Signing Compatibility**
   The feature must work with Jumpee's existing ad-hoc code signing. No additional entitlements are required.

---

## 4. UI/UX Requirements

1. **UX-ISI-1: Visual Positioning**
   The indicator is positioned:
   - Horizontally: centered on the active screen
   - Vertically: directly below the macOS menu bar (menu bar height is typically 25px on standard displays, 37px on notched displays). The top edge of the indicator text touches or nearly touches the bottom edge of the menu bar, plus any `verticalOffset` from config.

2. **UX-ISI-2: Visual Style**
   - Default: white bold text at 60pt with a semi-transparent dark background pill
   - The background pill provides contrast against any wallpaper/window content behind it
   - The text should be clearly readable at a glance from normal viewing distance
   - The indicator should feel like a HUD (heads-up display) element

3. **UX-ISI-3: Window Behavior**
   - The indicator window uses `NSWindow.Level` high enough to float above normal application windows but below alerts and the menu bar itself
   - The window joins all spaces (`.canJoinAllSpaces`) so it is visible on every desktop
   - The window is stationary (`.stationary`) so it does not move with space transitions

4. **UX-ISI-4: Transition Behavior**
   When the input source changes, the text updates immediately. No animation is required for the initial implementation, but the architecture should not preclude adding fade transitions later.

5. **UX-ISI-5: Notch-Aware Positioning**
   On MacBooks with a display notch, the indicator must account for the notch area and position itself below the full menu bar height (using `screen.frame` and `screen.visibleFrame` to calculate the menu bar height dynamically rather than hardcoding 25px).

---

## 5. Configuration Requirements

### Config File Location
`~/.Jumpee/config.json` (same as all other Jumpee configuration)

### Config Schema Addition
Add an optional `inputSourceIndicator` key to the root config object:

```json
{
  "hotkey": { ... },
  "overlay": { ... },
  "spaces": { ... },
  "inputSourceIndicator": {
    "enabled": true,
    "fontSize": 60,
    "fontName": "Helvetica Neue",
    "fontWeight": "bold",
    "textColor": "#FFFFFF",
    "opacity": 0.8,
    "backgroundColor": "#000000",
    "backgroundOpacity": 0.3,
    "backgroundCornerRadius": 10,
    "verticalOffset": 0
  }
}
```

### Config Behavior
- When `inputSourceIndicator` is absent from config: feature is disabled, no monitoring occurs
- When `inputSourceIndicator.enabled` is `false`: feature is disabled, no monitoring occurs
- When `inputSourceIndicator.enabled` is `true`: feature is active, indicator is shown
- Appearance properties use documented defaults when not specified (exception to no-fallback rule, must be documented)

### Config Reload
Reloading config (Cmd+R) must:
- Start monitoring and show indicator if newly enabled
- Stop monitoring and hide indicator if newly disabled
- Update visual appearance if style properties changed

---

## 6. Technical Considerations

### macOS Input Source APIs

The primary APIs for input source detection on macOS:

1. **`TISCopyCurrentKeyboardInputSource()`** (Carbon/Text Input Sources)
   Returns the currently selected keyboard input source as a `TISInputSource` opaque type.

2. **`TISGetInputSourceProperty(_:_:)`** with `kTISPropertyLocalizedName`
   Extracts the human-readable localized name from a `TISInputSource`.

3. **`kTISNotifySelectedKeyboardInputSourceChanged`** notification
   Posted via `CFNotificationCenter` (Darwin notification center) or `DistributedNotificationCenter` when the active input source changes. This is the event-driven mechanism to avoid polling.

   Alternative: Use `NSTextInputContext.currentInputContext` change observation or `CGEventTapCreate` to detect input source switches.

### Import Requirements
The implementation will need:
```swift
import Carbon.HIToolbox  // Already imported by Jumpee
// TIS functions are in the Carbon framework, specifically InputMethodKit or
// the Text Input Source Services (available via Carbon.HIToolbox or directly)
```

### Window Level
The indicator window should use a level between `CGWindowLevelForKey(.floatingWindow)` and `CGWindowLevelForKey(.statusWindow)` to appear above normal windows but below the menu bar and system alerts. A reasonable choice is `NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.floatingWindow)) + 1)`.

### Menu Bar Height Calculation
```swift
// Dynamic menu bar height (works with notched displays)
let menuBarHeight = screen.frame.height - screen.visibleFrame.height - (screen.visibleFrame.origin.y - screen.frame.origin.y)
```
This approach accounts for the Dock position and the actual menu bar height on the active screen.

---

## 7. Acceptance Criteria

### Must Have

- [ ] **AC-1:** When `inputSourceIndicator.enabled` is `true` in config, the indicator overlay is visible below the menu bar showing the current keyboard input source name
- [ ] **AC-2:** When the user switches input source (via keyboard shortcut, menu bar, or any other method), the indicator text updates within 100ms
- [ ] **AC-3:** When `inputSourceIndicator` is absent from config or `enabled` is `false`, no indicator is shown and no input source monitoring occurs
- [ ] **AC-4:** The indicator overlay is click-through and does not interfere with any mouse interaction
- [ ] **AC-5:** The indicator is horizontally centered on the active display
- [ ] **AC-6:** The indicator is positioned directly below the menu bar (accounting for notch on applicable displays)
- [ ] **AC-7:** The indicator uses 60pt bold font by default
- [ ] **AC-8:** Font size, font name, font weight, text color, opacity, background color, background opacity, corner radius, and vertical offset are all configurable via `config.json`
- [ ] **AC-9:** Reloading config (Cmd+R) enables/disables the indicator and applies style changes
- [ ] **AC-10:** The menu includes a toggle item: "Enable Input Source Indicator" / "Disable Input Source Indicator"
- [ ] **AC-11:** The indicator coexists with the desktop watermark overlay without interference
- [ ] **AC-12:** On multi-display setups, the indicator appears on the display with the active space
- [ ] **AC-13:** The indicator appears on all spaces (`.canJoinAllSpaces`)

### Should Have

- [ ] **AC-14:** The indicator has a semi-transparent background pill/rectangle for readability against any background
- [ ] **AC-15:** The feature works without requiring any additional macOS permissions beyond what Jumpee already needs

### Nice to Have

- [ ] **AC-16:** When only one input source is configured in macOS (no language switching), the indicator shows the single source name (no special handling needed)
- [ ] **AC-17:** The background pill auto-sizes to fit the text with padding

---

## 8. Interactions with Existing Features

| Existing Feature | Interaction |
|-----------------|-------------|
| Desktop watermark overlay | Independent. Both can be enabled simultaneously. Different windows, different positions. |
| Menu bar title | No interaction. The menu bar shows the space name; the indicator shows the input source. |
| Global hotkeys | No new hotkey required for this feature. |
| Space change detection | The input source indicator repositions on space/display change (same notifications). |
| Config reload | The input source indicator respects config reload. |
| Pin window on top | No interaction. Pin overlay and input source indicator are separate features. |
| Move window | No interaction. |

---

## 9. Out of Scope

- Changing the active input source from Jumpee (only monitoring/display)
- Showing input source flags/icons (text only for initial implementation)
- Animating the indicator on input source change (can be added later)
- Per-application input source tracking (macOS handles this at the system level)
- Hotkey to toggle the indicator (use menu or config file)
