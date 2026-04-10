# Jumpee - Functional Requirements

**Last updated:** 2026-04-10

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

## 3. Move Window to Desktop (Proposed - plan-004)

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

## 4. Non-Functional Requirements

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
