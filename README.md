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
- All settings persist in `~/.tool-agents/jumpee/config.json` (before v1.7.0: `~/.Jumpee/config.json`; the file is moved automatically on first launch)

## Install via Homebrew (recommended)

```bash
brew tap BikS2013/jumpee
brew install --cask jumpee
```

Launch from `/Applications/Jumpee.app` or Spotlight.

### Uninstall

```bash
brew uninstall --cask jumpee
```

## Install manually

Download from [Releases](https://github.com/BikS2013/Jumpee/releases), either:

- `Jumpee-x.x.x.dmg` — open it and drag `Jumpee.app` onto the `Applications` shortcut, or
- `Jumpee-x.x.x.zip` — extract and move `Jumpee.app` to `/Applications/`.

Releases from v1.6.0 onward are signed with a Developer ID Application certificate and notarized by Apple, so macOS opens the app without a Gatekeeper warning. Only older releases (v1.5.1 and earlier) need the quarantine flag removed:
```bash
xattr -d com.apple.quarantine /Applications/Jumpee.app
```

## Build from source

Requires Xcode Command Line Tools:
```bash
xcode-select --install
```

Then:
```bash
cd Jumpee
bash build.sh
open build.noindex/Jumpee.app
```

To install the local build:
```bash
cp -r build.noindex/Jumpee.app /Applications/
```

### Build a signed release package

`package.sh` builds, signs, notarizes, and staples the app, then produces `dist/Jumpee-<version>.zip` and a signed, notarized drag-to-Applications disk image `dist/Jumpee-<version>.dmg`. Pass `--dmg-only` to rebuild just the disk image from the existing stapled `build.noindex/Jumpee.app`. The version is set by `VERSION=` in `build.sh`. A Developer ID Application identity is required (the script refuses to package an ad-hoc-signed build), and a notarytool keychain profile is needed for notarization:
```bash
CODESIGN_IDENTITY="Developer ID Application: <Name> (<TEAMID>)" NOTARY_PROFILE=jumpee-notary bash package.sh
```
Create the `jumpee-notary` profile once, from an App Store Connect API key (Users and Access > Integrations > App Store Connect API, role Developer):
```bash
xcrun notarytool store-credentials jumpee-notary --key ~/path/AuthKey_<KEYID>.p8 --key-id <KEYID> --issuer <ISSUER-ID>
```
Omit `NOTARY_PROFILE` to produce a signed but un-notarized package (local testing only).
Plain `bash build.sh` (no `CODESIGN_IDENTITY`) keeps producing an ad-hoc-signed development build.

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
| Edit config | **Cmd+,** from menu, or edit `~/.tool-agents/jumpee/config.json` |
| Reload config | **Cmd+R** from menu |
| Quit | **Cmd+Q** from menu |

## Configuration

Config file: `~/.tool-agents/jumpee/config.json`

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
