# Issues - Pending Items

## Pending

1. **Jumpee - Launch at Login**: Jumpee does not auto-start on login. To add it, go to System Settings > General > Login Items and add Jumpee.app manually, or implement a LaunchAgent plist.

2. **Jumpee - Private API Stability**: Jumpee uses private CoreGraphics APIs (CGSGetActiveSpace, CGSCopyManagedDisplaySpaces) which are not guaranteed to remain stable across macOS updates. If a future macOS update breaks space detection, the CGS API calls may need to be updated.

4. **Swift Command Line Tools - Stale modulemap**: The file `/Library/Developer/CommandLineTools/usr/include/swift/module.modulemap` was renamed to `.bak` to fix a SwiftBridging module redefinition error. This may need to be re-applied after Command Line Tools updates.

5. **Jumpee - Overlay per space**: The overlay currently shows a single name (current space) on all desktops. Ideally each space would show its own name in Mission Control thumbnails, but the `CGSMoveWindowToSpace` private API is not available on the current macOS version.

6. **Jumpee - Navigation limited to 9 desktops**: Desktop switching uses Ctrl+1 through Ctrl+9 shortcuts, limiting navigation to 9 desktops maximum.

## Completed

1. **Jumpee - Global hotkey**: Implemented configurable global hotkey (default Cmd+J) using Carbon RegisterEventHotKey API.

2. **Jumpee - Desktop switching**: Implemented desktop navigation via osascript subprocess with menu close/reopen flow.

3. **Jumpee - Config location**: Config stored in `~/.Jumpee/config.json`.

4. **Jumpee - Rename active only**: Restricted renaming to the currently active desktop only.

5. **Jumpee - Renamed from SpaceNamer**: Project renamed from SpaceNamer to Jumpee on 2026-03-22.

6. **Jumpee - Space ID tracking**: Names now follow desktops when reordered in Mission Control. Config keys use ManagedSpaceID instead of position numbers. Existing configs auto-migrated on first run.
