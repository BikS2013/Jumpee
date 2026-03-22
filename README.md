# Jumpee

A lightweight native macOS menu bar app for naming and jumping between Mission Control desktops.

## What it does

- Shows the current desktop's custom name in the menu bar
- Press **Cmd+J** (configurable) to open the desktop list from anywhere
- **Cmd+1** through **Cmd+9** to jump directly while the menu is open
- Click a desktop to jump to it instantly (menu reopens after switching)
- Rename the active desktop via the menu
- Displays a transparent watermark overlay on the desktop with the space name
- Names follow desktops when reordered in Mission Control (tracked by space ID)
- All settings persist in `~/.Jumpee/config.json`

## Install via Homebrew (recommended)

```bash
brew tap BikS2013/jumpee
brew install --cask jumpee
```

The Homebrew cask automatically removes the Gatekeeper quarantine flag. Launch from `/Applications/Jumpee.app` or Spotlight.

### Uninstall

```bash
brew uninstall --cask jumpee
```

## Install manually

Download `Jumpee-x.x.x.zip` from [Releases](https://github.com/BikS2013/Jumpee/releases), extract, and move `Jumpee.app` to `/Applications/`.

Since the app is not notarized with Apple, macOS will block it on first launch. Remove the quarantine flag:
```bash
xattr -d com.apple.quarantine /Applications/Jumpee.app
```
Or: right-click `Jumpee.app` in Finder > **Open** > click **Open** in the dialog.

## Build from source

Requires Xcode Command Line Tools:
```bash
xcode-select --install
```

Then:
```bash
cd Jumpee
bash build.sh
open build/Jumpee.app
```

To install the local build:
```bash
cp -r build/Jumpee.app /Applications/
```

### Known Build Issue — SwiftBridging Module
If you get a `redefinition of module 'SwiftBridging'` error, rename the stale modulemap:
```bash
sudo mv /Library/Developer/CommandLineTools/usr/include/swift/module.modulemap \
       /Library/Developer/CommandLineTools/usr/include/swift/module.modulemap.bak
```

## Post-install setup

### 1. Accessibility Permissions (required)
Jumpee needs Accessibility permissions to switch desktops. On first launch, a system dialog will prompt you.

1. Open **System Settings** > **Privacy & Security** > **Accessibility**
2. Find **Jumpee** and toggle it **ON** (or click `+` to add it)

### 2. Mission Control Keyboard Shortcuts (required)
Desktop switching requires **Ctrl+1** through **Ctrl+9** shortcuts:

1. Open **System Settings** > **Keyboard** > **Keyboard Shortcuts** > **Mission Control**
2. Enable **"Switch to Desktop 1"** through **"Switch to Desktop 9"**

### 3. Launch at Login (optional)
**System Settings** > **General** > **Login Items** > click `+` > select **Jumpee**

## Usage

| Action | How |
|--------|-----|
| Open desktop list | **Cmd+J** (global hotkey) or click the menu bar item |
| Jump to a desktop | **Cmd+1..9** while menu is open, or click it |
| Rename current desktop | **Cmd+N** or click "Rename Current Desktop..." |
| Toggle space number | Click "Hide/Show Space Number" |
| Toggle overlay | Click "Enable/Disable Overlay" |
| Edit config | **Cmd+,** from menu, or edit `~/.Jumpee/config.json` |
| Reload config | **Cmd+R** from menu |
| Quit | **Cmd+Q** from menu |

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
    "42": "Mail",
    "15": "Development",
    "8": "Terminal"
  }
}
```

**Note**: The `spaces` keys are macOS space IDs (assigned automatically when you rename a desktop). Do not use position numbers — Jumpee manages these keys for you.

See [docs/design/configuration-guide.md](docs/design/configuration-guide.md) for full parameter reference.

## System requirements

- macOS 13 (Ventura) or later
- Apple Silicon (arm64)
