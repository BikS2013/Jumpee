# Refined Request: Move Window Hotkey, Hotkey Configuration UI, and About Dialog

## Overview

Three new features for Jumpee v1.3: (1) a configurable global hotkey that opens a "Move Window to Desktop N" popup menu, (2) an in-app UI for editing all hotkey configurations without manually editing JSON, and (3) an "About Jumpee" dialog with version info and setup instructions. All features integrate into the existing single-file Swift/AppKit architecture (`Sources/main.swift`) and the JSON config at `~/.Jumpee/config.json`.

---

## Feature 1: Move Window Hotkey

### Description

Add a second global hotkey (default: Cmd+M) that, when pressed from anywhere, opens a floating popup menu listing all desktops on the active display (except the current one). Selecting a desktop moves the focused window to that desktop. This is the global-hotkey counterpart to the existing "Move Window To..." submenu that currently only appears inside the Jumpee dropdown.

### Requirements

1. **New global hotkey registration**: Register a second Carbon `RegisterEventHotKey` alongside the existing dropdown hotkey. The hotkey must be independently configurable.

2. **Configuration**: Add a new `moveWindowHotkey` key to the config, sibling to `hotkey`:
   ```json
   {
     "hotkey": { "key": "j", "modifiers": ["command"] },
     "moveWindowHotkey": { "key": "m", "modifiers": ["command"] },
     ...
   }
   ```
   The `moveWindowHotkey` uses the same `HotkeyConfig` struct as the main hotkey (same key/modifiers schema).

3. **Popup menu behavior**: When the move-window hotkey fires:
   - A temporary `NSMenu` is constructed containing all desktops on the active display except the current one, using the same naming/numbering logic as the existing "Move Window To..." submenu in `rebuildSpaceItems()`.
   - The menu is displayed as a popup at the current mouse location (using `NSMenu.popUp(positioning:at:in:)` or equivalent).
   - Selecting an item calls the existing `WindowMover.moveToSpace(index:)` with the target desktop's global position.
   - Pressing Escape or clicking away dismisses the menu with no action.

4. **Feature gating**: The move-window hotkey is only registered when `moveWindow.enabled == true` in config. If `moveWindow` is absent or `enabled` is false, the hotkey is not registered and pressing Cmd+M does nothing.

5. **Hotkey ID**: The new hotkey must use a distinct `EventHotKeyID` (different `id` field) from the existing dropdown hotkey so both can coexist.

6. **Reload behavior**: When the user reloads config (Cmd+R), both hotkeys must be re-registered with the updated key/modifier combinations.

### Acceptance Criteria

- Pressing Cmd+M (default) from any app opens a floating menu listing available desktops.
- Selecting a desktop moves the focused window to that desktop and follows the user there.
- The hotkey does nothing when `moveWindow.enabled` is false or absent.
- The hotkey key/modifiers are independently configurable in `~/.Jumpee/config.json`.
- Both hotkeys (dropdown and move-window) work simultaneously without conflict.
- Reloading config updates both hotkeys.

### Constraints

- Must use Carbon `RegisterEventHotKey` (same as existing hotkey), not NSEvent global monitors, to avoid requiring Accessibility permissions for the hotkey itself.
- The popup menu must close before `WindowMover.moveToSpace()` fires (same 300ms delay pattern as `navigateToSpace` and `moveWindowToSpace`).
- Maximum 9 desktops in the popup (limited by system shortcuts).
- The "Switch to Desktop N" system shortcuts must be enabled (same prerequisite as existing navigation).

---

## Feature 2: Hotkey Configuration UI

### Description

Add an in-app menu section that allows users to view and edit all hotkey configurations directly from the Jumpee menu, without manually editing the JSON config file. This covers the main dropdown hotkey (`hotkey`) and the move-window hotkey (`moveWindowHotkey`).

### Requirements

1. **New menu section**: Add a "Hotkeys" section to the Jumpee dropdown menu, placed between the overlay toggle and the "Open Config File..." item. The section contains:
   - A disabled header item: "Hotkeys:"
   - "Dropdown Hotkey: [current]..." -- shows current hotkey (e.g., "Cmd+J"), click to edit
   - "Move Window Hotkey: [current]..." -- shows current hotkey (e.g., "Cmd+M"), click to edit (only visible when `moveWindow.enabled == true`)

2. **Hotkey editor dialog**: Clicking a hotkey menu item opens a modal `NSAlert` (or custom `NSPanel`) that:
   - Displays the current key and modifier combination as text.
   - Has a "key" text field where the user types a single character (a-z, 0-9) or selects from a dropdown (space, return, tab, escape).
   - Has checkboxes for each modifier: Command, Control, Option, Shift.
   - At least one modifier must be selected (bare keys are not valid global hotkeys).
   - Has "Save", "Reset to Default", and "Cancel" buttons.
   - On Save: validates the combination, updates config, saves to disk, and re-registers the hotkey immediately (no manual reload needed).
   - On Reset to Default: restores the default hotkey for that slot (Cmd+J for dropdown, Cmd+M for move-window).

3. **Conflict detection**: Before saving, check if the new hotkey combination conflicts with the other Jumpee hotkey. If so, show a warning and do not save. (Conflicts with other apps cannot be detected and are the user's responsibility.)

4. **Display format**: Hotkeys are displayed using macOS symbols: Command, Control, Option, Shift + the key letter. This already exists as `HotkeyConfig.displayString`.

5. **Config persistence**: Changes made via the UI are written to `~/.Jumpee/config.json` immediately, same as rename and toggle operations.

### Acceptance Criteria

- The "Hotkeys:" section appears in the menu with the current hotkey displayed for each configurable hotkey.
- Clicking a hotkey item opens an editor dialog.
- The user can change the key and modifiers via the dialog.
- Saving updates the config file and re-registers the hotkey immediately.
- Conflicting hotkey combinations within Jumpee are rejected with a warning.
- "Reset to Default" restores the original hotkey.
- The move-window hotkey editor is only visible when `moveWindow.enabled == true`.

### Constraints

- The dialog must be a standard modal (NSAlert with accessory view or NSPanel). No custom window or xib files -- everything is built programmatically in code, consistent with the existing codebase style.
- The dialog blocks the main thread (same pattern as `renameActiveSpace`), which is acceptable for a settings dialog.
- Must handle the case where the user's chosen key is not in the `HotkeyConfig.keyCode` map -- show an error rather than silently failing.

---

## Feature 3: About Dialog

### Description

Add an "About Jumpee" menu item that displays app version information, macOS configuration prerequisites, and a brief setup guide.

### Requirements

1. **Menu item placement**: Add "About Jumpee..." as the first item in the menu (before the "Jumpee" header) or immediately after the "Jumpee" header, before the separator. The exact placement should be: after the "Jumpee" header item and before the "Desktops:" separator.

2. **Dialog content**: The About dialog is an `NSAlert` with `alertStyle: .informational` containing:

   **Title**: "About Jumpee"

   **Body** (informativeText):
   ```
   Version: 1.2.2 (or current CFBundleShortVersionString)

   Jumpee displays custom names for your macOS desktops
   in the menu bar, with a desktop overlay watermark and
   global hotkey navigation.

   --- macOS Setup Requirements ---

   1. Accessibility Permissions
      System Settings > Privacy & Security > Accessibility
      Add and enable Jumpee.app.

   2. Desktop Switching Shortcuts
      System Settings > Keyboard > Keyboard Shortcuts >
      Mission Control > Enable "Switch to Desktop 1"
      through "Switch to Desktop 9" (Ctrl+1 through Ctrl+9).

   3. Window Moving Shortcuts (optional)
      Same location as above. Enable "Switch to Desktop N"
      shortcuts. Then set "moveWindow": {"enabled": true}
      in your config file.

   --- Configuration ---

   Config file: ~/.Jumpee/config.json
   Open from menu: Cmd+,
   Reload after editing: Cmd+R

   Hotkeys, overlay style, and space names are all
   configurable. See the config file for all options.
   ```

   **Buttons**: "OK" (single button, dismisses dialog).

3. **Version source**: The version string must be read from the app bundle's `CFBundleShortVersionString` at runtime using `Bundle.main.infoDictionary`. This ensures the dialog always shows the correct version without hardcoding.

4. **Keyboard shortcut**: No keyboard shortcut for the About item (it is infrequently used).

### Acceptance Criteria

- "About Jumpee..." appears in the menu in the correct position.
- Clicking it opens a dialog showing the current app version.
- The dialog includes Accessibility permissions instructions.
- The dialog includes Mission Control shortcut instructions.
- The dialog includes config file location and basic usage.
- The version is read from the app bundle, not hardcoded.
- The dialog dismisses with OK.

### Constraints

- Must use `NSAlert` (same pattern as other dialogs in the codebase). No custom windows.
- The version string must come from the Info.plist bundle, not from a hardcoded constant. If the bundle version is unavailable (e.g., running unpackaged), show "dev" as the version.
- The text should be concise -- this is a quick-reference dialog, not full documentation.

---

## Cross-cutting Concerns

### Configuration Schema Changes

The config schema gains one new optional key at the top level:

```json
{
  "hotkey": { "key": "j", "modifiers": ["command"] },
  "moveWindowHotkey": { "key": "m", "modifiers": ["command"] },
  "moveWindow": { "enabled": true },
  "overlay": { ... },
  "showSpaceNumber": true,
  "spaces": { ... }
}
```

- `moveWindowHotkey` is optional. When absent, defaults to Cmd+M. This is the only new config key.
- The existing `hotkey` and `moveWindow` keys are unchanged.
- Backward compatibility: existing config files without `moveWindowHotkey` work unchanged.

### JumpeeConfig Changes

- Add `moveWindowHotkey: HotkeyConfig?` optional property to `JumpeeConfig`.
- The effective move-window hotkey is `config.moveWindowHotkey ?? HotkeyConfig(key: "m", modifiers: ["command"])` -- but per project conventions, a default is only used when the feature is active (`moveWindow.enabled == true`). When the feature is disabled, no hotkey is registered regardless.
- Note: This is an exception to the "no default fallback for config settings" rule, since the `moveWindowHotkey` is optional and the default Cmd+M is a convenience for users who enable the move-window feature without specifying a hotkey. This exception should be recorded in the project's memory file before implementation.

### GlobalHotkeyManager Changes

The `GlobalHotkeyManager` currently registers a single hotkey. It must be extended to support two independent hotkeys:
- Option A: Add a second `EventHotKeyRef` and handler within the same class.
- Option B: Create two `GlobalHotkeyManager` instances with different IDs and callbacks.

The choice is an implementation detail, but the callback for the move-window hotkey must invoke a different method than `openMenu()` -- it must invoke a new method like `openMoveWindowMenu()` on `MenuBarController`.

### Menu Layout After All Features

```
About Jumpee...
Jumpee (bold header, disabled)
---
Desktops:
  [space items dynamically inserted]
  Rename Current Desktop...     Cmd+N
  Move Window To... >           [submenu]
---
Hide Space Number
Disable Overlay
---
Hotkeys:
  Dropdown Hotkey: Cmd+J...
  Move Window Hotkey: Cmd+M...
---
Open Config File...             Cmd+,
Reload Config                   Cmd+R
---
Quit Jumpee                     Cmd+Q
```

### Build and Version

- Current version: 1.2.2
- These features should target version 1.3.0
- The build script (`build.sh`) must be updated to embed the new version in Info.plist
- The About dialog reads the version from Info.plist at runtime

### Testing Considerations

- Test that both global hotkeys fire independently from any app.
- Test that the move-window popup appears at the mouse cursor location.
- Test that the hotkey editor saves correctly and the new hotkey takes effect immediately.
- Test that conflicting hotkey detection works (set both hotkeys to the same combination).
- Test the About dialog version display.
- Test backward compatibility with config files that lack `moveWindowHotkey`.
- Test with `moveWindow.enabled = false` -- the move-window hotkey and its menu editor should not appear.

---

## Out of Scope

- **Custom key recording widget**: A "press any key" recorder (like System Settings uses) is complex to implement with Carbon APIs. The dialog uses a text field + checkboxes instead.
- **Per-display hotkey configuration**: All hotkeys are global, not per-display.
- **Hotkey configuration for individual desktop switching** (Cmd+1-9): These are in-menu shortcuts, not global hotkeys, and are not configurable.
- **Move window without following**: macOS 15+ does not support this. Not in scope.
- **Cross-display window moving**: Deferred to a future version (Phase 3 in the window-move design).
- **Homebrew cask formula update**: Version bump in the cask formula is a separate release task.
- **Overlay configuration UI**: Overlay settings (font, color, position, etc.) are not editable from the menu -- they require manual JSON editing. Adding an overlay configuration UI is not part of this request.
- **Global hotkeys for individual desktops** (e.g., Ctrl+Cmd+1-9 to move window to Desktop N): This is Phase 2 of the window-move design and is not included here.
