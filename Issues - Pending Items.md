# Issues - Pending Items

## Pending

1. **Jumpee - Launch at Login**: Jumpee does not auto-start on login. To add it, go to System Settings > General > Login Items and add Jumpee.app manually, or implement a LaunchAgent plist.

2. **Jumpee - Private API Stability**: Jumpee uses private CoreGraphics APIs (CGSGetActiveSpace, CGSCopyManagedDisplaySpaces) which are not guaranteed to remain stable across macOS updates. If a future macOS update breaks space detection, the CGS API calls may need to be updated.

3. **Jumpee - Multi-display global position verification**: The multi-display feature assumes that the display order in CGSCopyManagedDisplaySpaces matches macOS's global Ctrl+N space numbering. This needs verification on actual multi-display hardware. If the ordering doesn't match, navigation to spaces on non-primary displays may go to the wrong space.

4. **Jumpee - Multi-display UUID format verification**: The display ID mapping uses CGDisplayCreateUUIDFromDisplayID to match CGS display identifiers to NSScreen instances. The case-insensitive UUID comparison should handle format variations, but needs testing on various display configurations (HDMI, DisplayPort, USB-C, AirPlay).

5. **Swift Command Line Tools - Stale modulemap**: The file `/Library/Developer/CommandLineTools/usr/include/swift/module.modulemap` was renamed to `.bak` to fix a SwiftBridging module redefinition error. This may need to be re-applied after Command Line Tools updates.

6. **Jumpee - Overlay per space**: The overlay currently shows a single name (current space) on all desktops. Ideally each space would show its own name in Mission Control thumbnails, but the `CGSMoveWindowToSpace` private API is not available on the current macOS version.

7. **Jumpee - Navigation limited to 9 desktops per display**: Desktop switching uses Ctrl+1 through Ctrl+9 shortcuts, limiting navigation to 9 desktops per display (and 9 total across all displays for global numbering).

8. **Jumpee - Move Window: Plist key number verification needed**: The plist key numbers for "Move window to Desktop N" in `com.apple.symbolichotkeys` are believed to be 52, 54, 56, 58, 60, 62, 64, 66, 68 (even numbers). However, community documentation has conflicts (key 52 is listed as "Move focus to window drawer" in some sources). Must verify by enabling the shortcut in System Settings and inspecting the plist diff before implementing shortcut detection. See plan-004, Section 8.2.

9. **Jumpee - Move Window: macOS 15+ forces follow-window behavior**: On macOS 15 (Sequoia) and later, all approaches to moving a window between spaces force the user to follow the window. "Move without following" is impossible. This is a platform limitation, not a Jumpee limitation. Documented in plan-004.

## Completed

1. **Jumpee - Global hotkey**: Implemented configurable global hotkey (default Cmd+J) using Carbon RegisterEventHotKey API.

2. **Jumpee - Desktop switching**: Implemented desktop navigation via osascript subprocess with menu close/reopen flow.

3. **Jumpee - Config location**: Config stored in `~/.Jumpee/config.json`.

4. **Jumpee - Rename active only**: Restricted renaming to the currently active desktop only.

5. **Jumpee - Renamed from SpaceNamer**: Project renamed from SpaceNamer to Jumpee on 2026-03-22.

6. **Jumpee - Space ID tracking**: Names now follow desktops when reordered in Mission Control. Config keys use ManagedSpaceID instead of position numbers. Existing configs auto-migrated on first run.

7. **Jumpee - Multi-display workspace support**: Added per-display workspace lists, per-display numbering, display headers in menu, overlay on correct screen, and display connect/disconnect handling. No config format changes needed.
