# Plan 001 - Jumpee Menu Bar App (originally SpaceNamer)

## Objective
Build a native macOS menu bar app that detects the current desktop/space, displays a user-assigned custom name, provides a global hotkey for desktop switching, and shows a configurable watermark overlay.

## Steps

1. Create Swift source code with:
   - Private CGS API declarations for space detection
   - Config manager for JSON-based name mappings (~/.Jumpee/config.json)
   - Menu bar UI with rename capability (active desktop only)
   - Space change notification handling
   - Desktop watermark overlay (configurable opacity, font, weight, size, position, color)
   - Global hotkey via Carbon RegisterEventHotKey API
   - Desktop navigation via osascript subprocess

2. Create build script:
   - Compile with `swiftc`
   - Package into `.app` bundle
   - Generate `Info.plist`

3. Test and validate:
   - Verify space detection works
   - Verify menu bar shows correctly
   - Verify renaming persists
   - Verify global hotkey opens menu
   - Verify desktop switching works
   - Verify overlay displays correctly

4. Document in CLAUDE.md, README.md, and configuration-guide.md

## Deliverables
- `Jumpee/Sources/main.swift` - Complete app source
- `Jumpee/build.sh` - Build script
- `Jumpee/build/Jumpee.app` - Built application
- `README.md` - Prerequisites and usage guide
- `docs/design/configuration-guide.md` - Full configuration reference

## History
- Originally named "SpaceNamer", renamed to "Jumpee" on 2026-03-22
