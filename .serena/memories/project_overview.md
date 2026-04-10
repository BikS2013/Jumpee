# Jumpee - Project Overview

## Purpose
Jumpee is a native macOS menu bar app that displays custom names for Mission Control desktops/spaces, shows a desktop watermark overlay, and allows navigating between spaces via menu or global hotkey.

## Tech Stack
- **Language**: Swift (single-file: Sources/main.swift)
- **Frameworks**: Cocoa (AppKit), Carbon.HIToolbox
- **Private APIs**: CoreGraphics (CGSMainConnectionID, CGSGetActiveSpace, CGSCopyManagedDisplaySpaces)
- **Build**: Shell script (build.sh) using `swiftc` directly (no Xcode project, no SPM)
- **Config**: JSON at ~/.Jumpee/config.json
- **Signing**: Ad-hoc codesign for Accessibility permission persistence

## Key Features
- Custom space names in menu bar
- Global hotkey (default Cmd+J)
- Cmd+1-9 to jump between desktops
- Desktop watermark overlay (configurable)
- Multi-display support
- Rename desktops from menu

## Structure
- `Sources/main.swift` — entire app source (~1500+ lines)
- `build.sh` — build script
- `package.sh` — packaging script
- `docs/design/` — plans, design docs, configuration guide
- `docs/reference/` — investigation and scan documents
- `homebrew-tap/` — Homebrew cask formula
