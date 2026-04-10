# Investigation: Move Window Hotkey, Hotkey Configuration UI, and About Dialog

## Feature 1: Move Window Hotkey (Global Cmd+M Popup)

### Recommended Approach

**Extend the existing `GlobalHotkeyManager` to support two hotkeys with ID-based dispatch.**

The current Carbon hotkey handler (`hotkeyEventHandler` at line 646) unconditionally calls `openMenu()`. The recommended change is:

1. **Read the hotkey ID from the Carbon event** using `GetEventParameter` to determine which hotkey fired, then dispatch accordingly.
2. **Register two `EventHotKeyRef` instances** within the same `GlobalHotkeyManager` class, sharing a single `EventHandlerRef`.
3. **Pop up an `NSMenu` at the mouse cursor** using `NSMenu.popUp(positioning:at:in:)` with a nil view (or the status item button's window view).

#### Technical Details

**Hotkey ID dispatch in the Carbon handler:**

```swift
func hotkeyEventHandler(nextHandler: EventHandlerCallRef?, event: EventRef?,
                         userData: UnsafeMutableRawPointer?) -> OSStatus {
    var hotKeyID = EventHotKeyID()
    let err = GetEventParameter(event,
                                EventParamName(kEventParamDirectObject),
                                EventParamType(typeEventHotKeyID),
                                nil,
                                MemoryLayout<EventHotKeyID>.size,
                                nil,
                                &hotKeyID)
    guard err == noErr else { return err }

    DispatchQueue.main.async {
        switch hotKeyID.id {
        case 1:
            globalMenuBarController?.openMenu()
        case 2:
            globalMenuBarController?.openMoveWindowMenu()
        default:
            break
        }
    }
    return noErr
}
```

Key points:
- `kEventParamDirectObject` with `typeEventHotKeyID` extracts the `EventHotKeyID` struct from the event.
- The `id` field (UInt32) distinguishes hotkey 1 (dropdown) from hotkey 2 (move window).
- The `signature` field remains `0x4A4D5045` ("JMPE") for both -- only `id` differs.

**Registering two hotkeys:**

The `InstallEventHandler` call only needs to happen once for both hotkeys (it handles all `kEventHotKeyPressed` events). Each `RegisterEventHotKey` call produces its own `EventHotKeyRef`. The `GlobalHotkeyManager` gains a second `hotkeyRef2: EventHotKeyRef?` and a `register(moveWindowConfig:)` method (or a unified method that registers both).

```swift
class GlobalHotkeyManager {
    private var hotkeyRef: EventHotKeyRef?
    private var moveWindowHotkeyRef: EventHotKeyRef?
    private var handlerRef: EventHandlerRef?

    func register(config: HotkeyConfig, moveWindowConfig: HotkeyConfig?) {
        unregister()

        // Install a single handler for all hotkey events
        var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard),
                                       eventKind: UInt32(kEventHotKeyPressed))
        InstallEventHandler(GetApplicationEventTarget(), hotkeyEventHandler,
                            1, &eventType, nil, &handlerRef)

        // Register main hotkey (id=1)
        if let keyCode = config.keyCode {
            var id1 = EventHotKeyID(signature: OSType(0x4A4D_5045), id: 1)
            RegisterEventHotKey(UInt32(keyCode), config.carbonModifiers,
                                id1, GetApplicationEventTarget(), 0, &hotkeyRef)
        }

        // Register move-window hotkey (id=2)
        if let mwConfig = moveWindowConfig, let keyCode = mwConfig.keyCode {
            var id2 = EventHotKeyID(signature: OSType(0x4A4D_5045), id: 2)
            RegisterEventHotKey(UInt32(keyCode), mwConfig.carbonModifiers,
                                id2, GetApplicationEventTarget(), 0, &moveWindowHotkeyRef)
        }
    }
    // ...
}
```

**Popup menu at mouse cursor:**

```swift
func openMoveWindowMenu() {
    let menu = NSMenu()
    // Build items using same logic as rebuildSpaceItems() move-window submenu
    // (lines 940-966 of current code)
    let displays = spaceDetector.getSpacesByDisplay()
    let currentSpaceID = spaceDetector.getCurrentSpaceID()
    let activeDisplayID = spaceDetector.getActiveDisplayID()

    for display in displays {
        guard display.displayID == activeDisplayID else { continue }
        for space in display.spaces {
            if space.spaceID == currentSpaceID { continue }
            let key = String(space.spaceID)
            let customName = config.spaces[key]
            let displayName: String
            if let name = customName, !name.isEmpty {
                displayName = "Desktop \(space.localPosition) - \(name)"
            } else {
                displayName = "Desktop \(space.localPosition)"
            }
            let item = NSMenuItem(title: displayName,
                                   action: #selector(moveWindowFromPopup(_:)),
                                   keyEquivalent: "")
            item.target = self
            item.tag = space.globalPosition
            menu.addItem(item)
        }
    }

    // Pop up at mouse cursor
    let mouseLocation = NSEvent.mouseLocation
    // Convert screen coordinates: NSMenu.popUp needs coordinates in the view's space,
    // but with a nil view and appropriate positioning, we can use a temporary window.
    // Simplest approach: use popUp(positioning:at:in:) with nil positioning item.
    menu.popUp(positioning: nil, at: mouseLocation, in: nil)
}
```

**Important note on `NSMenu.popUp(positioning:at:in:)`:** When `in:` (the view parameter) is `nil`, the `at:` point is interpreted in screen coordinates. This is the simplest approach and avoids creating a temporary window. The menu will appear at the mouse cursor location.

The action handler `moveWindowFromPopup(_:)` follows the same pattern as `moveWindowToSpace(_:)` but does NOT need `cancelTracking()` because the popup menu dismisses itself when an item is selected:

```swift
@objc private func moveWindowFromPopup(_ sender: NSMenuItem) {
    let targetGlobalPosition = sender.tag
    // Small delay to let the popup menu fully dismiss
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
        WindowMover.moveToSpace(index: targetGlobalPosition)
    }
}
```

### Alternative Approaches Considered

1. **Two separate `GlobalHotkeyManager` instances** -- Each with its own handler and callback. Rejected because it duplicates `InstallEventHandler` overhead and makes it harder to share the global variable bridge. The single-handler-with-dispatch pattern is cleaner and is the standard Carbon approach.

2. **NSEvent global monitor instead of Carbon** -- `NSEvent.addGlobalMonitorForEvents(matching: .keyDown)` could capture keystrokes globally. Rejected because:
   - Global monitors cannot consume the event (the keystroke passes through to the focused app).
   - Requires Accessibility permissions for reliable operation.
   - The existing codebase already uses Carbon hotkeys, and consistency is valuable.

3. **Show an NSPanel/NSWindow instead of NSMenu for the popup** -- Would allow richer UI (keyboard navigation with number keys, etc.). Rejected as over-engineered; `NSMenu` provides native popup behavior, keyboard navigation, and automatic dismissal with zero additional window management.

4. **Reuse the existing submenu items from `rebuildSpaceItems()`** -- Share the same `NSMenuItem` objects. Rejected because menu items can only belong to one menu at a time (`NSMenuItem.menu` is set by the parent). Building fresh items for the popup is simple and avoids ownership conflicts.

### Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `GetEventParameter` returns unexpected hotkey ID | Low | Validate `hotKeyID.id` is 1 or 2; ignore unknown IDs with `default: break` |
| `NSMenu.popUp` with `in: nil` behaves differently on multi-monitor setups | Low | `NSEvent.mouseLocation` returns screen coordinates in the global coordinate space, which `popUp` handles correctly with `in: nil`. Test on multi-monitor. |
| Popup menu steals focus from the frontmost app, causing `WindowMover.moveToSpace()` to fail (no focused window) | Medium | The 300ms delay after menu dismissal (same as existing pattern) should allow the previously-focused app to regain focus. If needed, capture the focused window AXUIElement *before* showing the popup. |
| Carbon hotkey Cmd+M conflicts with system "Minimize" shortcut | Medium | Cmd+M is the standard "Minimize" shortcut in most apps. Users may want a different default. Document this in the config guide. Consider Cmd+Shift+M as an alternative default. |

---

## Feature 2: Hotkey Configuration UI

### Recommended Approach

**NSAlert with an accessory view containing a text field and checkboxes, following the existing `renameActiveSpace()` pattern.**

This is the simplest approach that matches the codebase's existing dialog style. The dialog blocks the main thread with `runModal()`, which is the established pattern for all Jumpee dialogs.

#### Technical Details

**Menu items (static, in `setupMenu()`):**

Add a new section between the overlay toggle (tag 101) and the "Open Config File..." separator:

```swift
menu.addItem(NSMenuItem.separator())

let hotkeysHeader = NSMenuItem(title: "Hotkeys:", action: nil, keyEquivalent: "")
hotkeysHeader.isEnabled = false
menu.addItem(hotkeysHeader)

let dropdownHotkeyItem = NSMenuItem(
    title: "Dropdown Hotkey: \(config.hotkey.displayString)...",
    action: #selector(editDropdownHotkey),
    keyEquivalent: "")
dropdownHotkeyItem.target = self
dropdownHotkeyItem.tag = 300
menu.addItem(dropdownHotkeyItem)

if config.moveWindow?.enabled == true {
    let moveHotkeyItem = NSMenuItem(
        title: "Move Window Hotkey: \(effectiveMoveWindowHotkey.displayString)...",
        action: #selector(editMoveWindowHotkey),
        keyEquivalent: "")
    moveHotkeyItem.target = self
    moveHotkeyItem.tag = 301
    menu.addItem(moveHotkeyItem)
}

menu.addItem(NSMenuItem.separator())
```

Note: Since the move-window hotkey item visibility depends on `config.moveWindow?.enabled`, and `setupMenu()` is called once, the item should be added unconditionally but hidden/shown in `rebuildSpaceItems()`. Alternatively, use a tag to find and update/remove it during rebuild.

**Hotkey editor dialog:**

```swift
@objc private func editDropdownHotkey() {
    editHotkey(slot: .dropdown)
}

@objc private func editMoveWindowHotkey() {
    editHotkey(slot: .moveWindow)
}

enum HotkeySlot {
    case dropdown
    case moveWindow
}

private func editHotkey(slot: HotkeySlot) {
    let currentConfig: HotkeyConfig
    let slotName: String
    let defaultConfig: HotkeyConfig

    switch slot {
    case .dropdown:
        currentConfig = config.hotkey
        slotName = "Dropdown"
        defaultConfig = HotkeyConfig(key: "j", modifiers: ["command"])
    case .moveWindow:
        currentConfig = config.moveWindowHotkey ?? HotkeyConfig(key: "m", modifiers: ["command"])
        slotName = "Move Window"
        defaultConfig = HotkeyConfig(key: "m", modifiers: ["command"])
    }

    let alert = NSAlert()
    alert.messageText = "Edit \(slotName) Hotkey"
    alert.informativeText = "Current: \(currentConfig.displayString)\nEnter a key (a-z, 0-9) and select modifiers."
    alert.addButton(withTitle: "Save")
    alert.addButton(withTitle: "Reset to Default")
    alert.addButton(withTitle: "Cancel")

    // Build accessory view
    let container = NSView(frame: NSRect(x: 0, y: 0, width: 300, height: 100))

    let keyLabel = NSTextField(labelWithString: "Key:")
    keyLabel.frame = NSRect(x: 0, y: 70, width: 40, height: 24)
    container.addSubview(keyLabel)

    let keyField = NSTextField(frame: NSRect(x: 45, y: 70, width: 60, height: 24))
    keyField.stringValue = currentConfig.key
    keyField.placeholderString = "e.g., j"
    container.addSubview(keyField)

    let cmdCheck = NSButton(checkboxWithTitle: "Command", target: nil, action: nil)
    cmdCheck.frame = NSRect(x: 0, y: 40, width: 120, height: 20)
    cmdCheck.state = currentConfig.modifiers.contains(where: {
        $0.lowercased() == "command" || $0.lowercased() == "cmd"
    }) ? .on : .off
    container.addSubview(cmdCheck)

    let ctrlCheck = NSButton(checkboxWithTitle: "Control", target: nil, action: nil)
    ctrlCheck.frame = NSRect(x: 120, y: 40, width: 100, height: 20)
    ctrlCheck.state = currentConfig.modifiers.contains(where: {
        $0.lowercased() == "control" || $0.lowercased() == "ctrl"
    }) ? .on : .off
    container.addSubview(ctrlCheck)

    let optCheck = NSButton(checkboxWithTitle: "Option", target: nil, action: nil)
    optCheck.frame = NSRect(x: 0, y: 15, width: 120, height: 20)
    optCheck.state = currentConfig.modifiers.contains(where: {
        $0.lowercased() == "option" || $0.lowercased() == "alt"
    }) ? .on : .off
    container.addSubview(optCheck)

    let shiftCheck = NSButton(checkboxWithTitle: "Shift", target: nil, action: nil)
    shiftCheck.frame = NSRect(x: 120, y: 15, width: 100, height: 20)
    shiftCheck.state = currentConfig.modifiers.contains(where: {
        $0.lowercased() == "shift"
    }) ? .on : .off
    container.addSubview(shiftCheck)

    alert.accessoryView = container
    alert.window.initialFirstResponder = keyField

    NSApp.activate(ignoringOtherApps: true)
    let response = alert.runModal()

    if response == .alertFirstButtonReturn {
        // Save
        let newKey = keyField.stringValue.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        var newModifiers: [String] = []
        if cmdCheck.state == .on { newModifiers.append("command") }
        if ctrlCheck.state == .on { newModifiers.append("control") }
        if optCheck.state == .on { newModifiers.append("option") }
        if shiftCheck.state == .on { newModifiers.append("shift") }

        // Validate: at least one modifier
        guard !newModifiers.isEmpty else {
            let errAlert = NSAlert()
            errAlert.messageText = "Invalid Hotkey"
            errAlert.informativeText = "At least one modifier (Command, Control, Option, Shift) must be selected."
            errAlert.runModal()
            return
        }

        // Validate: key is in the supported key map
        let newConfig = HotkeyConfig(key: newKey, modifiers: newModifiers)
        guard newConfig.keyCode != nil else {
            let errAlert = NSAlert()
            errAlert.messageText = "Unsupported Key"
            errAlert.informativeText = "The key '\(newKey)' is not supported. Use a-z, 0-9, space, return, tab, or escape."
            errAlert.runModal()
            return
        }

        // Conflict detection: check against the other hotkey
        let otherConfig: HotkeyConfig
        switch slot {
        case .dropdown:
            otherConfig = config.moveWindowHotkey ?? HotkeyConfig(key: "m", modifiers: ["command"])
        case .moveWindow:
            otherConfig = config.hotkey
        }
        if newConfig.key == otherConfig.key
           && Set(newConfig.modifiers.map { $0.lowercased() }) == Set(otherConfig.modifiers.map { $0.lowercased() }) {
            let errAlert = NSAlert()
            errAlert.messageText = "Hotkey Conflict"
            errAlert.informativeText = "This combination is already used by the other Jumpee hotkey."
            errAlert.runModal()
            return
        }

        // Apply
        switch slot {
        case .dropdown:
            config.hotkey = newConfig
        case .moveWindow:
            config.moveWindowHotkey = newConfig
        }
        config.save()
        // Re-register hotkeys
        hotkeyManager?.register(config: config.hotkey,
                                 moveWindowConfig: config.moveWindow?.enabled == true
                                     ? (config.moveWindowHotkey ?? HotkeyConfig(key: "m", modifiers: ["command"]))
                                     : nil)

    } else if response == .alertSecondButtonReturn {
        // Reset to default
        switch slot {
        case .dropdown:
            config.hotkey = defaultConfig
        case .moveWindow:
            config.moveWindowHotkey = defaultConfig
        }
        config.save()
        hotkeyManager?.register(config: config.hotkey,
                                 moveWindowConfig: config.moveWindow?.enabled == true
                                     ? (config.moveWindowHotkey ?? HotkeyConfig(key: "m", modifiers: ["command"]))
                                     : nil)
    }
    // Cancel: do nothing
}
```

**Updating hotkey display in menu items:** The static menu items (tags 300, 301) need their titles updated when the menu opens. Add to `rebuildSpaceItems()`:

```swift
if let item = menu.item(withTag: 300) {
    item.title = "Dropdown Hotkey: \(config.hotkey.displayString)..."
}
if let item = menu.item(withTag: 301) {
    if config.moveWindow?.enabled == true {
        let mwHotkey = config.moveWindowHotkey ?? HotkeyConfig(key: "m", modifiers: ["command"])
        item.title = "Move Window Hotkey: \(mwHotkey.displayString)..."
        item.isHidden = false
    } else {
        item.isHidden = true
    }
}
```

### Alternative Approaches Considered

1. **NSEvent key recorder ("press any key" widget)** -- A custom NSView that captures keystrokes via `NSEvent.addLocalMonitorForEvents(matching: .keyDown)`. This would provide a native-feeling "press the key combination you want" experience. Rejected because:
   - More complex to implement correctly (must handle modifier-only presses, key-up, focus management).
   - Carbon key codes differ from Cocoa virtual key codes in some edge cases.
   - The text field + checkboxes approach is simpler and adequate for the small set of supported keys.
   - Explicitly listed as out of scope in the refined requirements.

2. **Custom NSPanel (floating window)** -- A standalone window with proper Auto Layout controls. Rejected because:
   - The codebase convention is `NSAlert` with `runModal()`.
   - A panel requires window lifecycle management (close, become key, etc.).
   - `NSAlert.accessoryView` provides sufficient layout control for this simple form.

3. **NSPopover attached to the menu item** -- Would provide in-place editing. Rejected because popovers cannot be shown from menu items (the menu's tracking loop conflicts with popover display).

### Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| User enters multiple characters in the key field | Medium | Take only the first character: `String(keyField.stringValue.prefix(1))`. Or use an `NSTextField` subclass that limits input to 1 character. |
| Text field allows pasting long strings | Low | Validate length after modal returns; show error if > 1 char (excluding "space", "return", "tab", "escape"). |
| Menu item titles with hotkey display don't refresh after editing | Low | Update titles in `rebuildSpaceItems()` which runs on every `menuWillOpen`. |
| Conflict detection misses case variations (e.g., "Command" vs "command") | Low | Normalize to lowercase before comparison, as shown in the code above. |

---

## Feature 3: About Dialog

### Recommended Approach

**Standard `NSAlert` with `.informational` style, reading version from `Bundle.main.infoDictionary`.**

This is the simplest approach and matches every other dialog in the codebase.

#### Technical Details

**Reading the version:**

```swift
let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "dev"
```

When running as a packaged `.app` bundle (built by `build.sh`), `Bundle.main` points to the `.app` bundle and `Info.plist` is readable. When running unpackaged (e.g., `swift Sources/main.swift` directly), `Bundle.main` points to the Swift runtime and `infoDictionary` will not contain `CFBundleShortVersionString`, so the fallback to `"dev"` is correct.

**Dialog implementation:**

```swift
@objc private func showAboutDialog() {
    let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "dev"

    let alert = NSAlert()
    alert.alertStyle = .informational
    alert.messageText = "About Jumpee"
    alert.informativeText = """
        Version: \(version)

        Jumpee displays custom names for your macOS desktops \
        in the menu bar, with a desktop overlay watermark and \
        global hotkey navigation.

        --- macOS Setup Requirements ---

        1. Accessibility Permissions
           System Settings > Privacy & Security > Accessibility
           Add and enable Jumpee.app.

        2. Desktop Switching Shortcuts
           System Settings > Keyboard > Keyboard Shortcuts > \
           Mission Control > Enable "Switch to Desktop 1" \
           through "Switch to Desktop 9" (Ctrl+1 through Ctrl+9).

        3. Window Moving Shortcuts (optional)
           Same location as above. Enable "Switch to Desktop N" \
           shortcuts. Then set "moveWindow": {"enabled": true} \
           in your config file.

        --- Configuration ---

        Config file: ~/.Jumpee/config.json
        Open from menu: \u{2318},
        Reload after editing: \u{2318}R

        Hotkeys, overlay style, and space names are all \
        configurable. See the config file for all options.
        """
    alert.addButton(withTitle: "OK")

    NSApp.activate(ignoringOtherApps: true)
    alert.runModal()
}
```

**Menu placement (in `setupMenu()`):**

Insert "About Jumpee..." after the "Jumpee" header and before the separator:

```swift
let headerItem = NSMenuItem(title: "Jumpee", action: nil, keyEquivalent: "")
// ... existing header setup ...
menu.addItem(headerItem)

let aboutItem = NSMenuItem(title: "About Jumpee...", action: #selector(showAboutDialog),
                            keyEquivalent: "")
aboutItem.target = self
menu.addItem(aboutItem)

menu.addItem(NSMenuItem.separator())
```

### Alternative Approaches Considered

1. **Custom NSPanel with NSTextView for rich text** -- Would allow clickable hyperlinks (e.g., to System Settings URLs) and styled text. Rejected because:
   - The existing codebase has no custom windows for dialogs.
   - `NSAlert.informativeText` is sufficient for the content.
   - Adding hyperlinks would require `NSAttributedString` in a `NSTextView` accessory view, which adds complexity for marginal benefit.

2. **NSAlert with NSTextView as accessory view** -- Could provide scrollable, selectable, attributed text. A reasonable enhancement if the text grows longer, but rejected for now because the informativeText is short enough to fit in the standard alert layout.

3. **Reading version from a hardcoded constant** -- Simpler but violates the requirement that version comes from Info.plist. Rejected.

### Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `Bundle.main.infoDictionary` is nil when running unpackaged | Low (dev-only) | Fallback to `"dev"` as shown above |
| Alert text is too long and gets truncated on small screens | Low | `NSAlert` auto-sizes; the text is ~20 lines which fits comfortably. If needed, move to a `NSTextView` accessory view. |
| Unicode modifier symbols render differently across macOS versions | Very Low | The same symbols (U+2318, U+2303, etc.) are used throughout macOS UI and are stable. |

---

## Cross-cutting: GlobalHotkeyManager Refactoring

The most significant code change is to `GlobalHotkeyManager`. The recommended refactoring:

1. **Single `InstallEventHandler`** -- Install once, handles all `kEventHotKeyPressed` events.
2. **Dispatch in the handler** -- Read `EventHotKeyID.id` from the event, dispatch to `openMenu()` (id=1) or `openMoveWindowMenu()` (id=2).
3. **Two `EventHotKeyRef` fields** -- `hotkeyRef` and `moveWindowHotkeyRef`, registered/unregistered independently.
4. **Unified `register()` method** -- Takes both configs, registers both (or just the main one if move-window is disabled).
5. **Clean `unregister()`** -- Unregisters both hotkeys and removes the handler.

This is a straightforward extension of the existing pattern. The Carbon `RegisterEventHotKey` API explicitly supports multiple hotkeys per application -- each call returns a separate `EventHotKeyRef`.

---

## Cross-cutting: Config Schema and Default Value Exception

The `moveWindowHotkey` field in `JumpeeConfig` is optional. When absent and `moveWindow.enabled` is true, it defaults to `HotkeyConfig(key: "m", modifiers: ["command"])`. This is an exception to the project's "no default fallback for config settings" rule, as documented in the refined requirements. This exception must be recorded in the project's memory file before implementation.

The rationale: users who enable `moveWindow.enabled = true` should get a working hotkey without also having to specify `moveWindowHotkey`. The default Cmd+M is a reasonable convention.

---

## Implementation Order

Recommended implementation sequence:

1. **About Dialog** (simplest, no dependencies, good warm-up)
2. **Move Window Hotkey** (requires GlobalHotkeyManager refactoring + new config field)
3. **Hotkey Configuration UI** (depends on the refactored GlobalHotkeyManager being in place)

---

## Technical Research Guidance

**Research needed: No**

All three features use well-established macOS APIs that are already present (or closely analogous to patterns) in the existing codebase:

- **Carbon hotkey registration**: The codebase already has a working `GlobalHotkeyManager` using `RegisterEventHotKey`. Extending it to support multiple hotkeys uses the same API; `GetEventParameter` with `typeEventHotKeyID` is the standard dispatch mechanism, documented in Apple's Carbon Event Manager reference and widely used in open-source macOS apps (e.g., ShortcutRecorder, Amethyst, Hammerspoon).

- **NSMenu popup at cursor**: `NSMenu.popUp(positioning:at:in:)` is a stable Cocoa API available since macOS 10.0. Using `nil` for the view parameter and screen coordinates from `NSEvent.mouseLocation` is a well-known pattern.

- **NSAlert with accessory view**: The codebase already uses this pattern in `renameActiveSpace()` (line 1098) and `showMoveWindowSetup()` (line 1051). The hotkey editor extends this with checkboxes, which are standard `NSButton` controls.

- **Bundle version reading**: `Bundle.main.infoDictionary?["CFBundleShortVersionString"]` is the standard way to read version info in any macOS/iOS app, documented in Apple's Foundation framework reference.

No genuinely uncertain areas were identified. The APIs are mature, well-documented, and the codebase already demonstrates the core patterns that each feature builds upon.
