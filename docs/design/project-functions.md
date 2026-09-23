# Jumpee - Functional Requirements

**Last updated:** 2026-09-15 (visual workspace popover implemented)

---

## 1. Core Features (v1.0 - Implemented)

### FR-1: Space Detection
Jumpee detects the currently active macOS desktop/space using private CGS APIs (`CGSGetActiveSpace`, `CGSCopyManagedDisplaySpaces`). It maps space IDs to ordinal positions and updates in real-time when the user switches desktops.

### FR-2: Custom Space Naming
Users can assign custom names to each desktop/space via a rename dialog. Names are stored in `~/.tool-agents/jumpee/config.json` keyed by the stable `ManagedSpaceID`. Names persist across reboots and space reordering.

### FR-3: Menu Bar Display
The current space's custom name is displayed in the macOS menu bar. The format is configurable: with or without the space number prefix (e.g., "3: Browser" vs "Browser").

### FR-4: Visual Workspace Popover
A transient visual popover lists all desktops with their custom names, groups them by display, and supports filtering. Clicking a desktop row navigates to it. The popover opens by clicking the menu bar item or using the global hotkey.

### FR-5: Space Navigation
Users can navigate to any desktop by clicking its popover row or by pressing Cmd+1 through Cmd+9 while the popover is open. Navigation uses CGEvent synthesis of the Mission Control "Move left/right a space" shortcuts (Ctrl+Left / Ctrl+Right), pressed one at a time towards the target desktop on the active display, each press planned from the desktop that is actually active (v1.9.4, target-driven since v1.9.5); a desktop on another display is reached with the "Switch to Desktop N" shortcut (Ctrl+N). On macOS 27 synthesized Ctrl+1..9 presses are ignored by the system, so Ctrl+N navigation only works on earlier releases.

### FR-6: Global Hotkey
A configurable global hotkey (default: Cmd+J) opens or closes the Jumpee popover from anywhere. The hotkey is registered via the Carbon `RegisterEventHotKey` API.

### FR-7: Desktop Overlay / Watermark
A transparent text overlay displays the current space name on the desktop background. The overlay is fully configurable: opacity, font, font size, font weight, position (9 anchor points), text color, and margin.

### FR-8: Configuration File
All settings are stored in `~/.tool-agents/jumpee/config.json`. The Advanced Settings pane can reveal the file in Finder and reload it without restarting the app. Command+Comma opens the native Settings window rather than the raw file.

### FR-9: No Dock Icon
Jumpee runs as an LSUIElement accessory app with no Dock icon. It has no persistent main window; the transient workspace popover, native Settings window, and focused rename panel appear only when requested.

---

## 2. Multi-Display Support (v1.1 - Implemented)

### FR-10: Per-Display Space Awareness
On multi-display setups, Jumpee detects the active display and groups spaces under their physical display names in the popover. Each display's spaces are numbered independently (per-display local positions); Command-number shortcuts are shown for the active display.

### FR-11: Per-Display Popover Numbering
Popover-row keyboard shortcuts (Cmd+1-9) correspond to per-display local positions on the active display, not global positions. Navigation converts the global position into a step count on the active display (Ctrl+Left / Ctrl+Right, v1.9.4), and falls back to the global Ctrl+N shortcut only for a desktop on another display.

### FR-12: Per-Display Overlay Positioning
The overlay watermark appears on the active display's screen and repositions when the user switches to a different display.

### FR-13: Display Connect/Disconnect Handling
Jumpee responds to display connection and disconnection events (`didChangeScreenParametersNotification`), updating the popover, menu-bar title, and overlay for the new display topology.

---

## 3. Move Window to Desktop (v1.2 - Implemented)

### FR-14: Move Focused Window to Target Desktop
The user can move the currently focused (frontmost) application window from the current desktop to a specified target desktop on the same display. Jumpee grabs the window's title bar with a synthesized mouse drag and, while holding it, presses the Mission Control "Move left/right a space" shortcut (Ctrl+Left / Ctrl+Right) once per desktop between the current and the target desktop (v1.9.2), waiting for each desktop switch to register before the next press (v1.9.4) and choosing each press from the desktop that is actually active, so moves across several desktops arrive at the chosen desktop without stopping short or overshooting (v1.9.5). The desktop follows the window.

**Prerequisite:** The user must enable the "Move left a space" and "Move right a space" shortcuts in System Settings > Keyboard > Keyboard Shortcuts > Mission Control.

### FR-15: Popover-Based Window Move
The popover's Move Window button opens a focused destination menu listing all other desktops on the active display. Selecting an entry moves the focused window to that desktop. The independent move-window global shortcut opens the same destination workflow directly at the pointer. The window that is moved is the focused window of the application the user was working in before the popover or menu took focus (v1.9.2), so the move still targets the right window when Jumpee itself is momentarily frontmost.

### FR-16: Move Shortcut Detection
Jumpee detects whether the required "Move window to Desktop N" system shortcuts are enabled by reading the `com.apple.symbolichotkeys` preferences plist. If not enabled, a setup guidance dialog is shown.

### FR-17: Setup Guidance for Window Moving
The Advanced Settings pane reports whether Mission Control desktop-switching shortcuts are detected and provides a "Review Shortcuts..." button that opens the relevant System Settings pane.

### FR-18: Move-and-Follow Behavior
When a window is moved, the user's view automatically switches to the target desktop. This is the only supported behavior -- "move without following" is not available due to macOS 15+ system restrictions.

### FR-19: Multi-Display Move Awareness
Window moves target desktops on the active display using global desktop positions, consistent with the system shortcut numbering. The move operation respects multi-display topology.

### FR-20: Graceful Degradation for Unmovable Windows
Fullscreen windows, "Assign to All Desktops" windows, and system UI elements cannot be moved. The system shortcut is silently ignored for these windows. No crash or error dialog is produced.

---

## 4. Move Window Global Hotkey (Proposed - plan-005)

### FR-21: Global Move Window Hotkey
A second global hotkey (default: Cmd+M), registered via Carbon `RegisterEventHotKey`, opens a floating popup menu at the mouse cursor listing all desktops on the active display (excluding the current one). Selecting a desktop moves the focused window to that desktop using the existing `WindowMover.moveToSpace()` mechanism.

**Prerequisite:** `moveWindow.enabled` must be true in the config. When disabled, the hotkey is not registered.

### FR-22: Move Window Hotkey Configuration
The move-window hotkey is independently configurable via the `moveWindowHotkey` key in `~/.tool-agents/jumpee/config.json`, using the same schema as the main `hotkey` (key + modifiers). When absent and `moveWindow.enabled` is true, it defaults to Cmd+M.

### FR-23: Multi-Hotkey Coexistence
Both the dropdown hotkey (default Cmd+J) and the move-window hotkey (default Cmd+M) work simultaneously. They are dispatched via distinct `EventHotKeyID.id` values within a shared Carbon event handler.

### FR-24: Hotkey Reload
Reloading the configuration from Advanced Settings re-registers all global hotkeys with any updated key/modifier combinations.

---

## 5. Hotkey Configuration UI (Implemented; modernized 2026-09-15)

### FR-25: Shortcut Settings Section
The Shortcuts Settings pane displays all three configurable global shortcuts and the fixed popover shortcuts (⌘1–9, ⌘N, ⌘M, ⌘P, ⌘,). Hotkey configuration is kept out of the daily workspace popover.

### FR-26: Hotkey Editor Dialog
Each configurable shortcut uses a recorder-style control. Clicking the control enters recording mode and captures the complete modifier-and-key chord directly, including supported named keys such as Space, Return, Tab, and Escape. Escape without modifiers cancels recording.

### FR-27: Hotkey Validation
The editor validates that: (a) at least one modifier is selected, (b) the key is in the supported key map (a-z, 0-9, space, return, tab, escape), and (c) the combination does not conflict with the other Jumpee hotkey. Invalid input produces a descriptive error alert.

### FR-28: Immediate Hotkey Application
Recording a hotkey immediately updates the config file and re-registers the hotkey; no manual reload is required.

### FR-29: Hotkey Reset to Default
Each shortcut row includes a reset control, and the pane provides "Restore Defaults" for all shortcut slots. Reset values apply and re-register immediately.

### FR-30: Conditional Move Window Hotkey Editor
The move-window and pin-window recorder controls remain visible for discoverability but are disabled when their corresponding feature is disabled in General Settings.

---

## 6. About Panel (Implemented; modernized 2026-09-15)

### FR-31: About Menu Item
An "About Jumpee" item appears with the application-level commands in the popover's compact overflow menu.

### FR-32: About Dialog Content
Jumpee uses the standard macOS About panel with its runtime version and a concise description. Setup requirements and configuration-file actions live in Advanced Settings instead of overloading the About experience.

### FR-33: Runtime Version Source
The version string is read from the app bundle's Info.plist at runtime, not hardcoded. When running unpackaged, "dev" is shown.

---

## 7. Non-Functional Requirements

### NFR-1: Lightweight Footprint
Jumpee is a small native Swift app with no external dependencies. The build uses one `swiftc` invocation over the Swift files under `Sources/` via `build.sh`.

### NFR-2: Accessibility Permissions
Jumpee requires Accessibility permissions for CGEvent synthesis (space navigation and window moving). The app prompts for this on first launch.

### NFR-3: System Shortcut Dependency
Space navigation (Ctrl+Left / Ctrl+Right within a display, Ctrl+N across displays) and window moving (Ctrl+Left / Ctrl+Right while dragging) both require the user to enable the corresponding Mission Control shortcuts in macOS System Settings. This is an inherent platform limitation.

### NFR-4: macOS Version Support
Minimum macOS 13 (Ventura). `build.sh` compiles with `-target <arch>-apple-macos13.0` for both arm64 and x86_64 (universal binary) and verifies the declared minimum OS, so the binary's load commands agree with `LSMinimumSystemVersion`. All features work on macOS 13, 14 (Sonoma), 15 (Sequoia), and are expected to work on macOS 26 (Tahoe).

### NFR-5: Code Signing and Notarization
Development builds (`build.sh` without `CODESIGN_IDENTITY`) are ad-hoc signed (`codesign --force --sign -`) so Accessibility permissions persist across local rebuilds. Release packages (`package.sh`, from v1.6.0) must be signed with a Developer ID Application identity, with the hardened runtime enabled and a secure timestamp; `package.sh` refuses to package an ad-hoc build. With `NOTARY_PROFILE` set (a notarytool keychain profile backed by an App Store Connect API key), the package is notarized by Apple and the ticket is stapled to the bundle, so Gatekeeper accepts downloaded releases without the quarantine workaround. Every public release must be notarized. Each release ships two artifacts built by `package.sh`: a zip of the stapled app bundle (used by the Homebrew cask) and a drag-to-Applications disk image (`.dmg`, UDZO, containing the app and an `/Applications` symlink) that is itself Developer ID signed, notarized, and stapled.

### NFR-6: Low Latency
Space navigation and window moving should complete within 500ms perceived delay. The 300ms menu-close delay before keystroke synthesis is the primary latency contributor.

---

## 8. Pin Window on Top (Proposed - plan-006)

### FR-34: Pin Focused Window on Top
The user can pin the currently focused (frontmost) application window so it remains above all other non-pinned windows. Pinning is achieved via the private `CGSSetWindowLevel` API, setting the target window's level to `kCGFloatingWindowLevel` (3). The implementation uses the same `CGSMainConnectionID()` connection and `_AXUIElementGetWindow` pattern already established in Jumpee.

**Prerequisite:** `pinWindow.enabled` must be `true` in the config. Jumpee must have Accessibility permissions.

### FR-35: Unpin a Pinned Window
The user can unpin a previously pinned window to restore its normal z-order behavior. Unpinning sets the window level back to `kCGNormalWindowLevel` (0) via `CGSSetWindowLevel`.

### FR-36: Multiple Pinned Windows
Multiple windows from different applications can be pinned simultaneously. All pinned windows float above non-pinned windows. The relative z-order among pinned windows follows normal stacking rules (last focused is on top among pinned windows).

### FR-37: Pin State Tracking
Jumpee maintains an in-memory `Set<CGWindowID>` of currently pinned windows. This set is not persisted across app restarts -- all pins are released when Jumpee quits. The `WindowPinner` static class (following the same pattern as `WindowMover`) manages this state.

### FR-38: Pin Toggle Semantics
The pin operation is a toggle: if the focused window is not pinned, the action pins it; if the focused window is already pinned, the action unpins it. This applies to both the global hotkey and the popover action.

### FR-39: Graceful Handling of Closed Pinned Windows
If a pinned window is closed by the user or its owning application, Jumpee silently removes it from the pinned set during the next cleanup pass. Cleanup is reflected the next time the popover snapshot is refreshed. No error dialog is shown.

### FR-40: Pin Window Configuration
A `pinWindow` configuration section in `~/.tool-agents/jumpee/config.json` controls whether the feature is available:
```json
{
    "pinWindow": {
        "enabled": true
    }
}
```
When absent or `enabled: false`, the popover action remains visible but disabled with guidance, and the hotkey is not registered. Existing configs without this key work without modification.

### FR-41: Pin Window Global Hotkey
A configurable global hotkey (default: Ctrl+Cmd+P) toggles pin state on the focused window. The hotkey is stored in `pinWindowHotkey` in the config, using the same `HotkeyConfig` schema as the existing `hotkey` and `moveWindowHotkey` fields. Registered as Carbon hotkey id=3 in the shared event handler.

**Hotkey lifecycle:** Registered only when `pinWindow.enabled` is `true`. Re-registered on Settings changes or configuration reload. Unregistered when the feature is disabled.

### FR-42: Pin/Unpin Popover Action
A large action button in the Jumpee popover toggles the pin state of the focused window:
- When the focused window is **not pinned**: displays "Pin Window"
- When the focused window **is pinned**: displays "Unpin Window"
- Appears beside Rename and Move Window
- Remains visible but disabled when `pinWindow.enabled` is not `true`

### FR-43: Pin Window Hotkey Editor
The Shortcuts Settings pane includes the pin-window recorder alongside the dropdown and move-window recorders. It performs three-way conflict checking and is enabled only while the pin feature is enabled.

### FR-44: Pin Cleanup on Quit
When Jumpee quits (Cmd+Q), all pinned windows are restored to normal z-order (`kCGNormalWindowLevel`) before the application terminates. This ensures no windows are left permanently floating after Jumpee exits.

---

## 9. Input Source Indicator (Proposed - plan-007)

### FR-45: Monitor Active Input Source
Jumpee monitors the currently active macOS keyboard input source using the `TISCopyCurrentKeyboardInputSource()` API from `Carbon.HIToolbox` (already imported). The app listens for input source change notifications (`AppleSelectedInputSourcesChangedNotification` via `DistributedNotificationCenter`) to detect changes in real time. No polling is used.

### FR-46: Display Input Source Indicator
When the feature is enabled, Jumpee displays a transparent overlay window positioned directly below the macOS menu bar, showing the localized name of the current input source (e.g., "U.S.", "Greek", "British") in large text (default 60pt). The overlay:
- Is horizontally centered on the active display
- Is vertically positioned immediately below the menu bar (notch-aware via `screen.frame` / `screen.visibleFrame`)
- Uses a borderless, click-through window (`ignoresMouseEvents = true`)
- Floats above normal windows at `floatingWindow + 1` level
- Joins all spaces (`.canJoinAllSpaces`, `.stationary`)
- Has a semi-transparent background pill/rectangle for contrast

### FR-47: Real-Time Input Source Updates
The indicator text updates immediately (within one event loop cycle) whenever the user switches the keyboard input source via any method: menu bar, keyboard shortcut, Touch Bar, or programmatic switch. Duplicate notifications (same source name) are silently ignored.

### FR-48: Input Source Name Resolution
The displayed text is the localized name of the input source, obtained from `TISGetInputSourceProperty(source, kTISPropertyLocalizedName)`. Examples: "U.S.", "Greek", "British", "Pinyin - Simplified".

### FR-49: Coexistence with Desktop Overlay
The input source indicator is independent of the existing desktop name watermark overlay. Both features can be enabled simultaneously without interference. They use separate overlay windows at different positions and window levels (`desktopWindow + 1` for the watermark vs `floatingWindow + 1` for the indicator).

### FR-50: Space Change Handling
When the user switches to a different desktop/space, the input source indicator repositions itself to the active display. The indicator continues showing the current input source regardless of which space is active.

### FR-51: Multi-Display Support
On multi-display setups, the input source indicator appears on the display that contains the active space, using the existing `SpaceDetector.getActiveDisplayID()` and `displayIDToScreen()` infrastructure. The menu bar height is calculated per-screen to handle displays with different heights (e.g., notched MacBook vs external monitor).

### FR-52: Feature Enable/Disable via Config
An `inputSourceIndicator` configuration section in `~/.tool-agents/jumpee/config.json` controls whether the feature is active:
```json
{
  "inputSourceIndicator": {
    "enabled": true
  }
}
```
When `enabled` is `false` or the section is absent, the input source indicator is not shown and no input source monitoring is performed.

### FR-53: Configurable Appearance
The `inputSourceIndicator` section supports optional appearance customization: `fontSize` (default 60), `fontName` (default "Helvetica Neue"), `fontWeight` (default "bold"), `textColor` (default "#FFFFFF"), `opacity` (default 0.8), `backgroundColor` (default "#000000"), `backgroundOpacity` (default 0.3), `backgroundCornerRadius` (default 10), and `verticalOffset` (default 0). These defaults are a documented exception to the no-default-fallback rule (see Issues - Pending Items.md, item 16).

### FR-54: Menu Toggle
General Settings includes an immediate input-source-indicator switch. The daily-action menu does not contain persistent preference toggles.

### FR-55: Config Reload Support
When the user chooses "Reload Now" in Advanced Settings, the input source indicator respects the updated configuration: enabling, disabling, or restyling as needed. No app restart is required.

### FR-56: No Additional Permissions
Monitoring the keyboard input source does not require Accessibility, Screen Recording, or any special macOS permissions beyond what Jumpee already needs. The TIS APIs are available without entitlements.

---

## 10. macOS-Native Interface (Implemented 2026-09-15)

### FR-57: Visual Workspace Popover
The status item and global open shortcut present a transient visual workspace popover instead of an ordinary application menu. The popover prioritizes desktop navigation, rename, move-window, and pin-window actions. Persistent settings, permission guidance, hotkey editors, raw configuration commands, and lengthy help content are excluded from the primary workflow.

### FR-58: Current Desktop Context
The popover header displays the current desktop name, its local desktop number, and display name beside a tinted system display symbol. The status item uses the system display symbol beside its existing title.

### FR-59: Native Settings Window
Command+Comma and "Settings…" open a non-resizable, non-minimizable macOS Settings window with a stable, noncustomizable toolbar. The panes are General, Appearance, Shortcuts, and Advanced. The window title and size follow the selected pane.

### FR-60: Immediate Settings Application
Settings controls write through the existing `JumpeeConfig` model and take effect immediately. There is no Apply button and no secondary preference store. Existing JSON keys and optional sections remain compatible.

### FR-61: General Settings
General Settings controls menu-bar visibility, desktop-number visibility, dropdown location, overlay enablement, input-source-indicator enablement, move-window enablement, and pin-window enablement.

### FR-62: Appearance Settings and Preview
Appearance Settings exposes the primary overlay and input-source visual options through native controls and provides a live, noninteractive preview. Less common per-language mappings and typography details remain available in the JSON configuration. Restoring defaults preserves each feature's enabled state and preserves per-language input labels/colors.

### FR-63: Advanced Setup Status
Advanced Settings reports Accessibility, Mission Control shortcut, and Screen Recording status, linking or prompting through the corresponding macOS system facilities. It also reveals and reloads the existing configuration file.

### FR-64: Focused Rename Panel
Renaming uses a compact native panel with a focused name field, Return-to-rename, Escape-to-cancel, a standard primary Rename button, and a visually separate Remove Name action.

### FR-65: Searchable Display-Grouped Desktop List
The popover groups desktop rows by physical display and filters them immediately by custom name or desktop number. Each row shows a clearly legible 17-point medium-weight display symbol in a 24×24 frame, its local position, resolved name, available Command-number shortcut, and a checkmark for the current desktop. Selecting a row closes the popover and navigates to that desktop; focus is handed back to the previously active app only when the chosen desktop is the current one, since re-activating it after a switch would pull macOS back to that app's desktop (v1.9.3). The three action buttons show their popover shortcut under their title (Rename ⌘N, Move Window ⌘M, Pin/Unpin Window ⌘P) and the Settings button shows ⌘, (v1.9.2); ⌘M and ⌘P are ignored while the corresponding feature is disabled, and Escape closes the popover. Since v1.9.6: while the filter field has focus, ↑/↓ move a keyboard selection (accent outline) through the visible desktop rows, scrolling it into view, and Return switches to the selected desktop; typing a filter selects the first match. A hint line under the list states that ⌃1–⌃9 jump straight to a desktop from any app and, for the selected desktop, names its ⌃N key (its global position; none beyond 9); each row's tooltip repeats it. A Reset Dock button in the footer closes the popover and restarts the Dock (`killall Dock`), which restores "Switch to Desktop N" when it has stopped working. Focus goes back to the previously active app on close only if the desktop has not changed, checked on close and again 0.3 s later, so pressing ⌃N with the popover open does not bounce back.

### FR-66: Popover Actions and Status
The popover presents large Rename, Move Window, and Pin/Unpin Window action cards. Each card has an explicit centered icon-and-label layout contained within a full-card border and click target, plus hover, disabled, tooltip, and accessibility states. Disabled features remain visible with explanatory tooltips. A footer summarizes the overlay and input-source-indicator state and opens Settings. A compact overflow menu contains About, Quit, and Unpin All when applicable.

### FR-67: Contextual Popover Placement
Clicking the visible status item anchors the popover beneath the menu bar item. Opening it through the global shortcut respects the existing dropdown-location preference: it anchors at the pointer when configured or at the status item otherwise. Closing or completing a transient action restores focus to the previously active application when appropriate.
