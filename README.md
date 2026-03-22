# Jumpee

A lightweight native macOS menu bar app for naming and jumping between Mission Control desktops.

## What it does

- Shows the current desktop's custom name in the menu bar
- Press **Cmd+J** (configurable) to open the desktop list from anywhere
- **Cmd+1** through **Cmd+9** to jump directly while the menu is open
- Click a desktop to jump to it instantly (menu reopens after switching)
- Rename the active desktop via the menu
- Displays a transparent watermark overlay on the desktop with the space name
- All settings persist in `~/.Jumpee/config.json`

## Prerequisites

### macOS Version
- macOS 13 (Ventura) or later
- Apple Silicon (arm64)

### Swift Compiler
- Xcode Command Line Tools must be installed:
  ```bash
  xcode-select --install
  ```

### Known Build Issue - SwiftBridging Module
If you get a `redefinition of module 'SwiftBridging'` error during build, rename the stale modulemap:
```bash
sudo mv /Library/Developer/CommandLineTools/usr/include/swift/module.modulemap \
       /Library/Developer/CommandLineTools/usr/include/swift/module.modulemap.bak
```
This may need to be re-applied after Command Line Tools updates.

### Mission Control Keyboard Shortcuts
Desktop switching requires **Ctrl+1** through **Ctrl+9** shortcuts to be enabled:

1. Open **System Settings** > **Keyboard** > **Keyboard Shortcuts** > **Mission Control**
2. Enable **"Switch to Desktop 1"** through **"Switch to Desktop 9"**
3. Ensure they are set to **Ctrl+1** through **Ctrl+9** (the defaults)

Without these shortcuts, the desktop list will display correctly but clicking to navigate will not work.

### Accessibility Permissions
Jumpee requires **Accessibility** permissions to switch desktops (it uses CGEvent to simulate Ctrl+number keystrokes). On first launch, a system dialog will prompt you to grant access.

1. Open **System Settings** > **Privacy & Security** > **Accessibility**
2. Click `+` and add `Jumpee.app`
3. Ensure it is toggled **ON**

The app is ad-hoc code-signed so the permission persists across rebuilds. If you move the app to a different location, you may need to re-grant the permission.

## Build

```bash
cd Jumpee
bash build.sh
```

## Install

```bash
cp -r Jumpee/build/Jumpee.app /Applications/
```

To launch at login: **System Settings** > **General** > **Login Items** > add Jumpee.app.

## Run

```bash
open Jumpee/build/Jumpee.app
# or if installed:
open /Applications/Jumpee.app
```

## Usage

| Action | How |
|--------|-----|
| Open desktop list | Press **Cmd+J** (global hotkey) or click the menu bar item |
| Jump to a desktop | **Cmd+1..9** while menu is open, or click it |
| Rename current desktop | Click "Rename Current Desktop..." (Cmd+N) |
| Toggle space number | Click "Hide/Show Space Number" |
| Toggle overlay | Click "Enable/Disable Overlay" |
| Edit config | Cmd+, from menu, or edit `~/.Jumpee/config.json` |
| Reload config | Cmd+R from menu |
| Quit | Cmd+Q from menu |

## Configuration

Config file: `~/.Jumpee/config.json`

```json
{
  "hotkey": {
    "key": "j",
    "modifiers": ["command"]
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
    "1": "Mail",
    "2": "Development",
    "3": "Terminal"
  }
}
```

See [docs/design/configuration-guide.md](docs/design/configuration-guide.md) for full parameter reference.
