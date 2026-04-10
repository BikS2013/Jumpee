# Jumpee - Functional Requirements

**Last updated:** 2026-04-10 (v1.4.0 pin-window-on-top proposed)

---

## 1. Core Features (v1.0 - Implemented)

### FR-1: Space Detection
Jumpee detects the currently active macOS desktop/space using private CGS APIs (`CGSGetActiveSpace`, `CGSCopyManagedDisplaySpaces`). It maps space IDs to ordinal positions and updates in real-time when the user switches desktops.

### FR-2: Custom Space Naming
Users can assign custom names to each desktop/space via a rename dialog. Names are stored in `~/.Jumpee/config.json` keyed by the stable `ManagedSpaceID`. Names persist across reboots and space reordering.

### FR-3: Menu Bar Display
The current space's custom name is displayed in the macOS menu bar. The format is configurable: with or without the space number prefix (e.g., "3: Browser" vs "Browser").

### FR-4: Menu Bar Dropdown
A dropdown menu lists all desktops with their custom names. Clicking a desktop navigates to it. The menu opens via clicking the menu bar item or via the global hotkey.

### FR-5: Space Navigation
Users can navigate to any desktop by clicking it in the dropdown menu or by pressing Cmd+1 through Cmd+9 while the menu is open. Navigation uses CGEvent synthesis to trigger the macOS Ctrl+N system shortcuts.

### FR-6: Global Hotkey
A configurable global hotkey (default: Cmd+J) opens the Jumpee dropdown from anywhere. The hotkey is registered via the Carbon `RegisterEventHotKey` API.

### FR-7: Desktop Overlay / Watermark
A transparent text overlay displays the current space name on the desktop background. The overlay is fully configurable: opacity, font, font size, font weight, position (9 anchor points), text color, and margin.

### FR-8: Configuration File
All settings are stored in `~/.Jumpee/config.json`. The config file can be opened from the menu (Cmd+,) and reloaded (Cmd+R) without restarting the app.

### FR-9: No Dock Icon
Jumpee runs as a menu bar-only app (LSUIElement) with no Dock icon and no main window.

---

## 2. Multi-Display Support (v1.1 - Implemented)

### FR-10: Per-Display Space Awareness
On multi-display setups, Jumpee detects which display is active and shows only that display's spaces in the menu. Each display's spaces are numbered independently (per-display local positions).

### FR-11: Per-Display Menu Numbering
Menu item keyboard shortcuts (Cmd+1-9) correspond to per-display local positions, not global positions. Navigation uses the global position internally (Ctrl+N system shortcut).

### FR-12: Per-Display Overlay Positioning
The overlay watermark appears on the active display's screen and repositions when the user switches to a different display.

### FR-13: Display Connect/Disconnect Handling
Jumpee responds to display connection and disconnection events (`didChangeScreenParametersNotification`), updating the menu and overlay for the new display topology.

---

## 3. Move Window to Desktop (v1.2 - Implemented)

### FR-14: Move Focused Window to Target Desktop
The user can move the currently focused (frontmost) application window from the current desktop to a specified target desktop. The operation uses synthesized macOS system keyboard shortcuts (Ctrl+Shift+N).

**Prerequisite:** The user must enable "Move window to Desktop N" shortcuts in System Settings > Keyboard > Keyboard Shortcuts > Mission Control.

### FR-15: Menu-Based Window Move
A "Move Window To..." submenu in the Jumpee dropdown lists all desktops on the active display (excluding the current desktop). Selecting an entry moves the focused window to that desktop. Keyboard equivalents (Shift+Cmd+1-9) are available when the menu is open.

### FR-16: Move Shortcut Detection
Jumpee detects whether the required "Move window to Desktop N" system shortcuts are enabled by reading the `com.apple.symbolichotkeys` preferences plist. If not enabled, a setup guidance dialog is shown.

### FR-17: Setup Guidance for Window Moving
A "Set Up Window Moving..." menu item provides step-by-step instructions for enabling the required system shortcuts, with an "Open System Settings" button that navigates directly to the Keyboard Shortcuts pane.

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
The move-window hotkey is independently configurable via the `moveWindowHotkey` key in `~/.Jumpee/config.json`, using the same schema as the main `hotkey` (key + modifiers). When absent and `moveWindow.enabled` is true, it defaults to Cmd+M.

### FR-23: Multi-Hotkey Coexistence
Both the dropdown hotkey (default Cmd+J) and the move-window hotkey (default Cmd+M) work simultaneously. They are dispatched via distinct `EventHotKeyID.id` values within a shared Carbon event handler.

### FR-24: Hotkey Reload
Reloading config (Cmd+R) re-registers both hotkeys with any updated key/modifier combinations.

---

## 5. Hotkey Configuration UI (Proposed - plan-005)

### FR-25: Hotkey Menu Section
A "Hotkeys:" section in the Jumpee dropdown menu displays the current hotkey combination for each configurable hotkey. The section appears between the overlay toggle and the "Open Config File..." item.

### FR-26: Hotkey Editor Dialog
Clicking a hotkey menu item opens a modal NSAlert with an accessory view containing a key text field and modifier checkboxes (Command, Control, Option, Shift). The dialog has "Save", "Reset to Default", and "Cancel" buttons.

### FR-27: Hotkey Validation
The editor validates that: (a) at least one modifier is selected, (b) the key is in the supported key map (a-z, 0-9, space, return, tab, escape), and (c) the combination does not conflict with the other Jumpee hotkey. Invalid input produces a descriptive error alert.

### FR-28: Immediate Hotkey Application
Saving a hotkey via the editor dialog immediately updates the config file and re-registers the hotkey -- no manual reload (Cmd+R) is required.

### FR-29: Hotkey Reset to Default
The "Reset to Default" button restores the original hotkey for the selected slot: Cmd+J for the dropdown hotkey, Cmd+M for the move-window hotkey.

### FR-30: Conditional Move Window Hotkey Editor
The move-window hotkey editor menu item is only visible when `moveWindow.enabled` is true in the config.

---

## 6. About Dialog (Proposed - plan-005)

### FR-31: About Menu Item
An "About Jumpee..." menu item is placed after the "Jumpee" header and before the "Desktops:" separator. It has no keyboard shortcut.

### FR-32: About Dialog Content
The About dialog is an `NSAlert` with `.informational` style displaying: the app version (read from `Bundle.main.infoDictionary["CFBundleShortVersionString"]`, fallback to "dev"), a brief app description, macOS setup requirements (Accessibility permissions, Desktop Switching Shortcuts, Window Moving Shortcuts), and configuration file location with menu shortcuts.

### FR-33: Runtime Version Source
The version string is read from the app bundle's Info.plist at runtime, not hardcoded. When running unpackaged, "dev" is shown.

---

## 7. Non-Functional Requirements

### NFR-1: Lightweight Footprint
Jumpee is a single-file Swift app (~130KB compiled) with no external dependencies. The build uses a single `swiftc` invocation via `build.sh`.

### NFR-2: Accessibility Permissions
Jumpee requires Accessibility permissions for CGEvent synthesis (space navigation and window moving). The app prompts for this on first launch.

### NFR-3: System Shortcut Dependency
Space navigation (Ctrl+N) and window moving (Ctrl+Shift+N) both require the user to enable the corresponding shortcuts in macOS System Settings. This is an inherent platform limitation.

### NFR-4: macOS Version Support
Minimum macOS 13 (Ventura). All features work on macOS 13, 14 (Sonoma), 15 (Sequoia), and are expected to work on macOS 26 (Tahoe).

### NFR-5: Code Signing
Ad-hoc code signing (`codesign --force --sign -`) ensures Accessibility permissions persist across rebuilds.

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
The pin operation is a toggle: if the focused window is not pinned, the action pins it; if the focused window is already pinned, the action unpins it. This applies to both the global hotkey and the menu item.

### FR-39: Graceful Handling of Closed Pinned Windows
If a pinned window is closed by the user or its owning application, Jumpee silently removes it from the pinned set during the next cleanup pass. Cleanup is triggered before menu rebuild and on space change. No error dialog is shown.

### FR-40: Pin Window Configuration
A `pinWindow` configuration section in `~/.Jumpee/config.json` controls whether the feature is available:
```json
{
    "pinWindow": {
        "enabled": true
    }
}
```
When absent or `enabled: false`, the menu items and hotkey for pin-on-top are hidden/not registered. Existing configs without this key work without modification.

### FR-41: Pin Window Global Hotkey
A configurable global hotkey (default: Ctrl+Cmd+P) toggles pin state on the focused window. The hotkey is stored in `pinWindowHotkey` in the config, using the same `HotkeyConfig` schema as the existing `hotkey` and `moveWindowHotkey` fields. Registered as Carbon hotkey id=3 in the shared event handler.

**Hotkey lifecycle:** Registered only when `pinWindow.enabled` is `true`. Re-registered on config reload (Cmd+R). Unregistered when the feature is disabled.

### FR-42: Pin/Unpin Menu Item
A menu item in the Jumpee dropdown toggles the pin state of the focused window:
- When the focused window is **not pinned**: displays "Pin Window on Top" with Ctrl+Cmd+P keyboard equivalent
- When the focused window **is pinned**: displays "Unpin Window" with the same keyboard equivalent
- Placed near the "Move Window To..." submenu (both are window-management operations)
- Only visible when `pinWindow.enabled` is `true`

### FR-43: Pin Window Hotkey Editor
A "Pin Window Hotkey: Ctrl+Cmd+P..." entry appears in the Hotkeys section of the menu (alongside the dropdown and move-window hotkey entries). Clicking it opens the same hotkey editor dialog used for the other hotkeys. Includes 3-way conflict checking against the dropdown and move-window hotkeys. Only visible when `pinWindow.enabled` is `true`.

### FR-44: Pin Cleanup on Quit
When Jumpee quits (Cmd+Q), all pinned windows are restored to normal z-order (`kCGNormalWindowLevel`) before the application terminates. This ensures no windows are left permanently floating after Jumpee exits.
