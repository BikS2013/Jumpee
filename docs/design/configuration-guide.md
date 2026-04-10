# Jumpee Configuration Guide

## Configuration File Location

**Path**: `~/.Jumpee/config.json`

This is the only configuration method. There are no environment variables, CLI parameters, or fallback values. If the config file is missing, Jumpee creates it with default values on first run.

The config file can be opened directly from Jumpee's menu (Cmd+, or "Open Config File..."). After editing, use "Reload Config" (Cmd+R) to apply changes without restarting.

## Complete Configuration Example

```json
{
  "hotkey": {
    "key": "j",
    "modifiers": ["command"]
  },
  "moveWindow": {
    "enabled": true
  },
  "moveWindowHotkey": {
    "key": "m",
    "modifiers": ["command", "shift"]
  },
  "overlay": {
    "enabled": true,
    "fontName": "Helvetica Neue",
    "fontSize": 72,
    "fontWeight": "bold",
    "margin": 40,
    "opacity": 0.15,
    "position": "top-center",
    "textColor": "#FF0000"
  },
  "showSpaceNumber": true,
  "spaces": {
    "42": "Mail & Calendar",
    "15": "Development",
    "8": "Terminal"
  }
}
```

## Configuration Parameters

### `spaces` (object)

Maps macOS space IDs (ManagedSpaceID as strings) to custom names. Names follow the desktop content when spaces are reordered in Mission Control.

| Property | Type | Description |
|----------|------|-------------|
| `"<spaceID>"` | string | Custom name for the desktop with that space ID |

- **How to set**: Use "Rename Current Desktop..." from the menu (Cmd+N). The space ID is stored automatically.
- **Default**: Empty (`{}`). Unnamed desktops show as "Desktop N".
- **Migration**: If upgrading from a position-based config (keys "1", "2", ...), Jumpee automatically migrates to space-ID keys on first launch.
- **Note**: Space IDs are assigned by macOS when a desktop is created and remain stable across reorders. If you manually edit the config, use the space IDs shown in the file (do not use position numbers).

### `showSpaceNumber` (boolean)

Controls whether the desktop number is shown alongside the custom name in the menu bar.

| Value | Menu bar display |
|-------|-----------------|
| `true` | `4: Browser` |
| `false` | `Browser` |

- **Default**: `true`
- **How to toggle**: Click "Hide Space Number" / "Show Space Number" in the menu.

### `hotkey` (object)

The global keyboard shortcut to open Jumpee's dropdown menu from anywhere.

| Property | Type | Description | Default |
|----------|------|-------------|---------|
| `key` | string | The key to press | `"j"` |
| `modifiers` | string[] | Modifier keys to hold | `["command"]` |

**Supported key values**:
- Letters: `"a"` through `"z"`
- Numbers: `"0"` through `"9"`
- Special: `"space"`, `"return"`, `"tab"`, `"escape"`

**Supported modifier values**:
- `"command"` or `"cmd"`
- `"control"` or `"ctrl"`
- `"option"` or `"alt"`
- `"shift"`

**Examples**:
```json
{"key": "j", "modifiers": ["command"]}
{"key": "space", "modifiers": ["control", "shift"]}
{"key": "k", "modifiers": ["command", "option"]}
```

- **Default**: Cmd+J
- **How to change**: Click "Dropdown Hotkey: ..." in the Hotkeys section of the menu, or edit the config file and reload (Cmd+R).
- **Implementation**: Uses Carbon `RegisterEventHotKey` API. Does not require Accessibility permissions.
- **Note**: Avoid hotkeys that conflict with other apps. If the hotkey doesn't work, another app may have claimed it.

### `moveWindowHotkey` (object, optional)

The global keyboard shortcut to open the "Move Window to Desktop N" popup menu at the mouse cursor. Only active when `moveWindow.enabled` is `true`.

| Property | Type | Description | Default |
|----------|------|-------------|---------|
| `key` | string | The key to press | `"m"` |
| `modifiers` | string[] | Modifier keys to hold | `["command"]` |

Same supported key and modifier values as the `hotkey` property above.

- **Default**: Cmd+M (when omitted from config and `moveWindow.enabled` is `true`). This is a documented exception to the no-default-fallback rule.
- **How to change**: Click "Move Window Hotkey: ..." in the Hotkeys section of the menu, or edit the config file and reload (Cmd+R).
- **Note**: The default Cmd+M conflicts with the system "Minimize" shortcut. Consider using Cmd+Shift+M or another combination to avoid this conflict.

### `overlay` (object)

Controls the transparent text watermark displayed on the desktop showing the current space's name.

| Property | Type | Description | Default |
|----------|------|-------------|---------|
| `enabled` | boolean | Show/hide the overlay | `true` |
| `opacity` | number | Text transparency (0.0 = invisible, 1.0 = solid) | `0.15` |
| `fontName` | string | Font family name | `"Helvetica Neue"` |
| `fontSize` | number | Font size in points | `72` |
| `fontWeight` | string | Font weight | `"bold"` |
| `position` | string | Where to place the text on screen | `"top-center"` |
| `textColor` | string | Hex color code | `"#FF0000"` |
| `margin` | number | Distance from screen edges in pixels | `40` |

**Position options**:

| Value | Placement |
|-------|-----------|
| `"center"` | Center of the screen |
| `"top-left"` | Top-left corner |
| `"top-center"` | Top center |
| `"top-right"` | Top-right corner |
| `"bottom-left"` | Bottom-left corner |
| `"bottom-center"` | Bottom center |
| `"bottom-right"` | Bottom-right corner |

**Font weight options**:

| Value | Description |
|-------|-------------|
| `"ultralight"` | Thinnest weight |
| `"thin"` | Very thin |
| `"light"` | Light weight |
| `"regular"` | Normal weight |
| `"medium"` | Medium weight |
| `"semibold"` | Semi-bold |
| `"bold"` | Bold (default) |
| `"heavy"` | Heavy weight |
| `"black"` | Heaviest weight |

**Font examples**:
- `"Helvetica Neue"` (default, clean sans-serif)
- `"SF Pro"` (macOS system font)
- `"Menlo"` (monospace)
- `"Georgia"` (serif)
- Any font installed on your system

**Color examples**:
- `"#FF0000"` (red — default)
- `"#FFFFFF"` (white — good for dark wallpapers)
- `"#000000"` (black — good for light wallpapers)
- `"#FF6600"` (orange)
- `"#4A90D9"` (blue)

- **How to toggle**: Click "Enable Overlay" / "Disable Overlay" in the menu.
- **Recommended opacity**: 0.10-0.20 for subtle watermark, 0.30-0.50 for more visible text.

## System Requirements

### Mission Control Keyboard Shortcuts

Desktop switching requires these shortcuts to be enabled:

1. Open **System Settings** > **Keyboard** > **Keyboard Shortcuts** > **Mission Control**
2. Enable **"Switch to Desktop 1"** through **"Switch to Desktop 9"** (Ctrl+1 through Ctrl+9)

Without these shortcuts, the desktop list will display correctly but clicking a desktop to navigate will not work.

### Accessibility Permissions

Desktop switching uses `osascript` to send keystrokes. Your terminal app must have Accessibility permissions:

1. Open **System Settings** > **Privacy & Security** > **Accessibility**
2. Add and enable your terminal app (Terminal.app, iTerm2, etc.)

### `pinWindow` (object, optional)

Controls the pin-window-on-top feature. When enabled, you can pin any window to float above all other windows.

| Property | Type | Description | Default |
|----------|------|-------------|---------|
| `enabled` | boolean | Enable/disable the pin window feature | Feature disabled when absent |

- **How to enable**: Add `"pinWindow": { "enabled": true }` to your config file, then reload (Cmd+R).
- **How it works**: Jumpee captures the target window's image and displays it in its own floating window. The overlay is click-through — clicks pass to the real window underneath.
- **Required permission**: Screen Recording (System Settings > Privacy & Security > Screen Recording). Jumpee prompts you if this is missing.
- **Note**: Pin state is in-memory only and does not persist across Jumpee restarts. All windows are unpinned when Jumpee quits.

### `pinWindowHotkey` (object, optional)

The global keyboard shortcut to toggle pin/unpin on the currently focused window. Only active when `pinWindow.enabled` is `true`.

| Property | Type | Description | Default |
|----------|------|-------------|---------|
| `key` | string | The key to press | `"p"` |
| `modifiers` | string[] | Modifier keys to hold | `["control", "command"]` |

Same supported key and modifier values as the `hotkey` property above.

- **Default**: Ctrl+Cmd+P (when omitted from config and `pinWindow.enabled` is `true`). This is a documented exception to the no-default-fallback rule.
- **How to change**: Click "Pin Window Hotkey: ..." in the Hotkeys section of the menu, or edit the config file and reload (Cmd+R).
- **Behavior**: Press once to pin the focused window on top. Press again (while the same window is focused) to unpin it. Use "Unpin All Windows" in the menu to release all pinned windows at once.

### Complete Configuration Example (with all features)

```json
{
  "hotkey": {
    "key": "j",
    "modifiers": ["command"]
  },
  "moveWindow": {
    "enabled": true
  },
  "moveWindowHotkey": {
    "key": "m",
    "modifiers": ["command", "shift"]
  },
  "pinWindow": {
    "enabled": true
  },
  "pinWindowHotkey": {
    "key": "p",
    "modifiers": ["control", "command"]
  },
  "overlay": {
    "enabled": true,
    "fontName": "Helvetica Neue",
    "fontSize": 72,
    "fontWeight": "bold",
    "margin": 40,
    "opacity": 0.15,
    "position": "top-center",
    "textColor": "#FF0000"
  },
  "showSpaceNumber": true,
  "spaces": {
    "42": "Mail & Calendar",
    "15": "Development",
    "8": "Terminal"
  }
}
```

## Permissions Summary

| Permission | Required for | How to grant |
|------------|-------------|--------------|
| Accessibility | Desktop switching, window moving, pin window | System Settings > Privacy & Security > Accessibility |
| Screen Recording | Pin window on top | System Settings > Privacy & Security > Screen Recording |

## Applying Configuration Changes

| Change | How to apply |
|--------|-------------|
| Rename a desktop | Use menu "Rename Current Desktop..." — saves automatically |
| Toggle space number | Use menu toggle — saves automatically |
| Toggle overlay | Use menu toggle — saves automatically |
| Change dropdown hotkey | Click "Dropdown Hotkey: ..." in menu, or edit config + Cmd+R |
| Change move-window hotkey | Click "Move Window Hotkey: ..." in menu, or edit config + Cmd+R |
| Change pin-window hotkey | Click "Pin Window Hotkey: ..." in menu, or edit config + Cmd+R |
| Enable pin window | Add `"pinWindow": {"enabled": true}` to config, then Cmd+R |
| Change overlay style | Edit config file, then Cmd+R to reload |
| Change font weight | Edit config file, then Cmd+R to reload |
