# Jumpee - macOS Desktop/Space Naming & Navigation Tool

## Overview

Jumpee is a lightweight native macOS menu bar application that allows users to assign custom names to their Mission Control desktops (Spaces), jump between them via a global hotkey, and display a configurable watermark overlay on each desktop. Since macOS does not provide any public API to rename Spaces, Jumpee uses private CoreGraphics APIs to detect the current space and displays a user-defined name in the menu bar.

## Architecture

### Technology Stack
- **Language**: Swift (native macOS, required for menu bar apps and private CGS APIs)
- **Framework**: AppKit (NSStatusBar, NSMenu), Carbon (RegisterEventHotKey)
- **Build**: `swiftc` command-line compiler (no full Xcode required)
- **Packaging**: Standard `.app` bundle with Info.plist
- **Config**: JSON file at `~/.Jumpee/config.json`

### Key Components

1. **SpaceDetector** - Uses private CGS APIs to:
   - Get the current active space ID via `CGSGetActiveSpace`
   - List all spaces across all displays via `CGSCopyManagedDisplaySpaces`
   - Map space IDs to ordinal positions (Desktop 1, 2, 3...)
   - Filter by type (type 0 = regular desktop, type 4 = fullscreen app)

2. **JumpeeConfig** - Manages all configuration:
   - Stores config in `~/.Jumpee/config.json`
   - Maps space ordinal numbers to custom names
   - Overlay settings (opacity, font, size, weight, position, color, margin)
   - Hotkey settings (key, modifiers)
   - Auto-saves on every change

3. **MenuBarController** - The menu bar UI:
   - Shows current space's custom name (or "Desktop N" if unnamed)
   - Dropdown lists all spaces — click to navigate
   - "Rename Current Desktop..." for active space only
   - Toggle options for space numbers and overlay
   - Config file access and reload

4. **OverlayManager** - Desktop watermark:
   - Single transparent window at desktop level
   - Joins all spaces (`canJoinAllSpaces`)
   - Updates text on space change
   - Click-through (ignores mouse events)
   - Configurable font, size, weight, color, opacity, position, margin

5. **GlobalHotkeyManager** - Keyboard shortcut:
   - Uses Carbon `RegisterEventHotKey` API (no accessibility permissions needed)
   - Default: Cmd+J
   - Configurable key and modifier combination
   - Opens the status item menu programmatically

6. **SpaceNavigator** - Desktop switching:
   - Uses `osascript` subprocess to send Ctrl+number keystrokes via System Events
   - Closes menu before switching to avoid conflicts
   - Reopens menu after switch completes
   - Requires "Switch to Desktop N" shortcuts enabled in System Settings

7. **AppDelegate** - Application lifecycle:
   - LSUIElement (no dock icon)
   - Listens to `NSWorkspace.activeSpaceDidChangeNotification`
   - Updates menu bar and overlay on space change

### Private APIs Used

```swift
CGSMainConnectionID() -> Int32          // Get connection to window server
CGSGetActiveSpace(_ cid: Int32) -> Int  // Get current space ID
CGSCopyManagedDisplaySpaces(_ cid: Int32) -> CFArray  // List all spaces
```

These are private CoreGraphics APIs. They work on macOS but are not App Store safe (not needed — this is a personal tool).

### Data Flow

1. App starts -> registers Carbon hotkey, creates overlay, registers for space change notifications
2. User presses Cmd+J -> menu opens showing all desktops
3. User clicks a desktop -> menu closes -> `osascript` sends Ctrl+N -> space switches -> menu reopens
4. Space changes -> `SpaceDetector.getCurrentSpaceIndex()` called -> name looked up -> menu bar title and overlay updated
5. User renames desktop -> config saved to `~/.Jumpee/config.json` -> UI updated

### Configuration File

See `docs/design/configuration-guide.md` for full details.

## Limitations

- Uses private macOS APIs (may break with OS updates)
- Cannot modify the actual Mission Control labels (hard OS limitation)
- Space detection relies on space ordering which can change if spaces are reordered
- Overlay shows current space name only (cannot show different names per space in Mission Control thumbnails)
- Desktop switching requires "Switch to Desktop N" shortcuts enabled in System Settings
- Maximum 9 desktops for navigation (limited by Ctrl+1 through Ctrl+9 shortcuts)
