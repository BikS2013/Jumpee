# Technical Design: v1.3.0 -- Move Window Hotkey, Hotkey Configuration UI, About Dialog

**Created:** 2026-04-10
**Target Version:** 1.3.0
**Source:** `Sources/main.swift` (single-file, ~1200 lines)
**Companion:** `docs/design/plan-005-hotkey-about-features.md` (implementation plan)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Data Model Changes](#2-data-model-changes)
3. [GlobalHotkeyManager Refactor](#3-globalhotkeymanager-refactor)
4. [Move Window Popup Menu](#4-move-window-popup-menu)
5. [Hotkey Configuration UI](#5-hotkey-configuration-ui)
6. [About Dialog](#6-about-dialog)
7. [Menu Layout](#7-menu-layout)
8. [Build Script Changes](#8-build-script-changes)
9. [Component Interaction Diagram](#9-component-interaction-diagram)
10. [Method Signature Index](#10-method-signature-index)

---

## 1. Overview

Three features are added to `Sources/main.swift`:

| Feature | Summary | Key Integration Points |
|---------|---------|----------------------|
| Move Window Hotkey | Second Carbon global hotkey (default Cmd+M) pops up NSMenu at cursor | `GlobalHotkeyManager`, new `openMoveWindowMenu()` on `MenuBarController` |
| Hotkey Configuration UI | Modal NSAlert dialogs to edit hotkey bindings | New `editHotkey(slot:)` on `MenuBarController`, config save + re-register |
| About Dialog | Informational NSAlert with version and setup instructions | New `showAboutDialog()` on `MenuBarController` |

All three features follow existing codebase conventions: programmatic NSAlert dialogs with `runModal()`, Carbon hotkey registration, tag-based menu item identification, and the `config.save()` + UI update pattern.

---

## 2. Data Model Changes

### 2.1 JumpeeConfig -- New Property

**File:** `Sources/main.swift`
**Struct:** `JumpeeConfig` (line 113)
**Change:** Add one new optional property after `moveWindow`:

```swift
struct JumpeeConfig: Codable {
    var spaces: [String: String]
    var showSpaceNumber: Bool
    var overlay: OverlayConfig
    var hotkey: HotkeyConfig
    var moveWindow: MoveWindowConfig?
    var moveWindowHotkey: HotkeyConfig?    // NEW -- v1.3.0
    // ... rest unchanged
}
```

**JSON schema after change:**

```json
{
    "hotkey": { "key": "j", "modifiers": ["command"] },
    "moveWindowHotkey": { "key": "m", "modifiers": ["command"] },
    "moveWindow": { "enabled": true },
    "overlay": { "..." },
    "showSpaceNumber": true,
    "spaces": { "..." }
}
```

- `moveWindowHotkey` is **optional**. Absent means "use default Cmd+M when feature is active."
- Backward compatible: existing configs without this key decode with `moveWindowHotkey = nil`.
- The property name `moveWindowHotkey` matches the JSON key via automatic `Codable` synthesis (no `CodingKeys` enum needed).

### 2.2 Computed Property: effectiveMoveWindowHotkey

Add a computed property to `JumpeeConfig` that centralizes the default-fallback logic:

```swift
var effectiveMoveWindowHotkey: HotkeyConfig {
    return moveWindowHotkey ?? HotkeyConfig(key: "m", modifiers: ["command"])
}
```

This is the **documented exception** to the project's "no default fallback for config settings" rule. The rationale: users who set `moveWindow.enabled = true` should get a working hotkey without also specifying `moveWindowHotkey`. The exception must be recorded in the project's memory file before implementation.

### 2.3 HotkeySlot Enum

Add a new private enum inside `MenuBarController` (or at file scope) to identify which hotkey is being edited:

```swift
private enum HotkeySlot {
    case dropdown
    case moveWindow
}
```

### 2.4 New Menu Item Tags

| Tag | Item | Purpose |
|-----|------|---------|
| 100 | "Hide/Show Space Number" | Existing |
| 101 | "Disable/Enable Overlay" | Existing |
| 200 | "Rename Current Desktop..." | Existing |
| 300 | "Dropdown Hotkey: ..." | NEW -- hotkey editor trigger |
| 301 | "Move Window Hotkey: ..." | NEW -- hotkey editor trigger (hidden when feature disabled) |

---

## 3. GlobalHotkeyManager Refactor

### 3.1 Current State (lines 642-700)

The current implementation has:
- A free function `hotkeyEventHandler` that unconditionally calls `globalMenuBarController?.openMenu()`
- A single `hotkeyRef: EventHotKeyRef?` and `handlerRef: EventHandlerRef?`
- A fixed `hotkeyID` with signature `0x4A4D5045` ("JMPE") and id `1`
- `register(config:)` installs handler + registers one hotkey
- `unregister()` removes both

### 3.2 Refactored Free Function: hotkeyEventHandler

Replace the current handler (line 646) with an ID-dispatching version:

```swift
func hotkeyEventHandler(nextHandler: EventHandlerCallRef?, event: EventRef?,
                         userData: UnsafeMutableRawPointer?) -> OSStatus {
    var hotKeyID = EventHotKeyID()
    let status = GetEventParameter(
        event,
        EventParamName(kEventParamDirectObject),
        EventParamType(typeEventHotKeyID),
        nil,
        MemoryLayout<EventHotKeyID>.size,
        nil,
        &hotKeyID
    )
    guard status == noErr else { return status }

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

**Key technical details:**
- `GetEventParameter` with `kEventParamDirectObject` / `typeEventHotKeyID` extracts the `EventHotKeyID` struct from the Carbon event.
- The `id` field (UInt32) distinguishes hotkey 1 (dropdown) from hotkey 2 (move window).
- The `signature` field remains `0x4A4D5045` ("JMPE") for both -- only `id` differs.
- Unknown IDs are silently ignored via `default: break`.

### 3.3 Refactored GlobalHotkeyManager Class

```swift
class GlobalHotkeyManager {
    private var hotkeyRef: EventHotKeyRef?
    private var moveWindowHotkeyRef: EventHotKeyRef?
    private var handlerRef: EventHandlerRef?

    /// Register both hotkeys. The move-window hotkey is only registered
    /// when moveWindowConfig is non-nil (i.e., the feature is enabled).
    func register(config: HotkeyConfig, moveWindowConfig: HotkeyConfig?) {
        unregister()

        // Install a single event handler for all kEventHotKeyPressed events.
        // This handler dispatches based on the EventHotKeyID.id field.
        var eventType = EventTypeSpec(
            eventClass: OSType(kEventClassKeyboard),
            eventKind: UInt32(kEventHotKeyPressed)
        )
        InstallEventHandler(
            GetApplicationEventTarget(),
            hotkeyEventHandler,
            1,
            &eventType,
            nil,
            &handlerRef
        )

        // Register main dropdown hotkey (id=1)
        if let keyCode = config.keyCode {
            var id1 = EventHotKeyID(signature: OSType(0x4A4D_5045), id: 1)
            RegisterEventHotKey(
                UInt32(keyCode),
                config.carbonModifiers,
                id1,
                GetApplicationEventTarget(),
                0,
                &hotkeyRef
            )
        }

        // Register move-window hotkey (id=2), only if config provided
        if let mwConfig = moveWindowConfig, let keyCode = mwConfig.keyCode {
            var id2 = EventHotKeyID(signature: OSType(0x4A4D_5045), id: 2)
            RegisterEventHotKey(
                UInt32(keyCode),
                mwConfig.carbonModifiers,
                id2,
                GetApplicationEventTarget(),
                0,
                &moveWindowHotkeyRef
            )
        }
    }

    func unregister() {
        if let ref = hotkeyRef {
            UnregisterEventHotKey(ref)
            hotkeyRef = nil
        }
        if let ref = moveWindowHotkeyRef {
            UnregisterEventHotKey(ref)
            moveWindowHotkeyRef = nil
        }
        if let ref = handlerRef {
            RemoveEventHandler(ref)
            handlerRef = nil
        }
    }

    deinit {
        unregister()
    }
}
```

**Design decisions:**
- Single `InstallEventHandler` for both hotkeys -- the Carbon event system routes all `kEventHotKeyPressed` events to the same handler.
- Two separate `EventHotKeyRef` fields allow independent registration/unregistration.
- `unregister()` cleans up both refs plus the handler.
- Passing `moveWindowConfig: nil` registers only the dropdown hotkey (backward-compatible behavior).

### 3.4 Call Sites That Must Change

#### MenuBarController.init() (line 724-725)

**Before:**
```swift
hotkeyManager?.register(config: config.hotkey)
```

**After:**
```swift
hotkeyManager?.register(
    config: config.hotkey,
    moveWindowConfig: config.moveWindow?.enabled == true
        ? config.effectiveMoveWindowHotkey
        : nil
)
```

#### MenuBarController.reloadConfig(_:) (line 1165)

**Before:**
```swift
hotkeyManager?.register(config: config.hotkey)
```

**After:**
```swift
hotkeyManager?.register(
    config: config.hotkey,
    moveWindowConfig: config.moveWindow?.enabled == true
        ? config.effectiveMoveWindowHotkey
        : nil
)
```

#### MenuBarController.quit(_:) (line 1169)

No change needed -- `unregister()` already handles both refs.

---

## 4. Move Window Popup Menu

### 4.1 New Method: openMoveWindowMenu()

Add to `MenuBarController` (after `openMenu()` at line 732):

```swift
func openMoveWindowMenu() {
    // Guard: only show popup if feature is enabled
    guard config.moveWindow?.enabled == true else { return }

    let menu = NSMenu()

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
                if config.showSpaceNumber {
                    displayName = "\(space.localPosition): \(name)"
                } else {
                    displayName = name
                }
            } else {
                displayName = "Desktop \(space.localPosition)"
            }

            let item = NSMenuItem(
                title: displayName,
                action: #selector(moveWindowFromPopup(_:)),
                keyEquivalent: ""
            )
            item.target = self
            item.tag = space.globalPosition
            menu.addItem(item)
        }
    }

    guard menu.items.count > 0 else { return }

    // Pop up at mouse cursor. When `in:` is nil, `at:` is screen coordinates.
    let mouseLocation = NSEvent.mouseLocation
    menu.popUp(positioning: nil, at: mouseLocation, in: nil)
}
```

**Coordinate handling:** `NSEvent.mouseLocation` returns a point in the global screen coordinate system (origin at bottom-left of primary display). When `NSMenu.popUp(positioning:at:in:)` receives `nil` for the `in:` (view) parameter, it interprets `at:` as screen coordinates. This correctly handles multi-monitor setups.

### 4.2 New Method: moveWindowFromPopup(_:)

```swift
@objc private func moveWindowFromPopup(_ sender: NSMenuItem) {
    let targetGlobalPosition = sender.tag
    // The popup menu self-dismisses when an item is selected.
    // Wait 300ms for the previously-focused app to regain focus
    // before firing the window-move shortcut.
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
        WindowMover.moveToSpace(index: targetGlobalPosition)
    }
}
```

**Why no `cancelTracking()`:** Unlike `moveWindowToSpace(_:)` which operates on the status item menu (which must be explicitly cancelled), the popup menu from `NSMenu.popUp()` dismisses itself when an item is selected. Calling `cancelTracking()` is unnecessary and could cause issues.

### 4.3 Naming Consistency

The popup uses the same naming logic as the dropdown "Move Window To..." submenu (`rebuildSpaceItems()` lines 940-966) but additionally respects the `showSpaceNumber` toggle for the display format, since the popup is shown in isolation (not as part of a "Desktop N - Name" list where the number is always visible).

---

## 5. Hotkey Configuration UI

### 5.1 Menu Items in setupMenu()

Insert a new "Hotkeys:" section between the overlay toggle (tag 101) and the "Open Config File..." separator. The items are added **unconditionally** in `setupMenu()` but the move-window hotkey item is hidden/shown dynamically.

**Insert after the overlay toggle item (line 796) and before the separator (line 798):**

```swift
menu.addItem(NSMenuItem.separator())

let hotkeysHeader = NSMenuItem(title: "Hotkeys:", action: nil, keyEquivalent: "")
hotkeysHeader.isEnabled = false
menu.addItem(hotkeysHeader)

let dropdownHotkeyItem = NSMenuItem(
    title: "Dropdown Hotkey: \(config.hotkey.displayString)...",
    action: #selector(editDropdownHotkey),
    keyEquivalent: ""
)
dropdownHotkeyItem.target = self
dropdownHotkeyItem.tag = 300
menu.addItem(dropdownHotkeyItem)

let moveHotkeyItem = NSMenuItem(
    title: "Move Window Hotkey: \(config.effectiveMoveWindowHotkey.displayString)...",
    action: #selector(editMoveWindowHotkey),
    keyEquivalent: ""
)
moveHotkeyItem.target = self
moveHotkeyItem.tag = 301
moveHotkeyItem.isHidden = !(config.moveWindow?.enabled == true)
menu.addItem(moveHotkeyItem)

menu.addItem(NSMenuItem.separator())
```

**Note:** The existing separator before "Open Config File..." (line 798) is now replaced by this new section's trailing separator.

### 5.2 Dynamic Updates in rebuildSpaceItems()

Add at the end of `rebuildSpaceItems()` (after the toggle title updates, line 997):

```swift
// Update hotkey menu items
if let item = statusItem.menu?.item(withTag: 300) {
    item.title = "Dropdown Hotkey: \(config.hotkey.displayString)..."
}
if let item = statusItem.menu?.item(withTag: 301) {
    if config.moveWindow?.enabled == true {
        item.title = "Move Window Hotkey: \(config.effectiveMoveWindowHotkey.displayString)..."
        item.isHidden = false
    } else {
        item.isHidden = true
    }
}
```

### 5.3 Action Methods

```swift
@objc private func editDropdownHotkey() {
    editHotkey(slot: .dropdown)
}

@objc private func editMoveWindowHotkey() {
    editHotkey(slot: .moveWindow)
}
```

### 5.4 editHotkey(slot:) -- Complete Method Design

```swift
private func editHotkey(slot: HotkeySlot) {
    // --- Determine current, default, and "other" hotkey configs ---
    let currentConfig: HotkeyConfig
    let slotName: String
    let defaultConfig: HotkeyConfig
    let otherConfig: HotkeyConfig

    switch slot {
    case .dropdown:
        currentConfig = config.hotkey
        slotName = "Dropdown"
        defaultConfig = HotkeyConfig(key: "j", modifiers: ["command"])
        otherConfig = config.effectiveMoveWindowHotkey
    case .moveWindow:
        currentConfig = config.effectiveMoveWindowHotkey
        slotName = "Move Window"
        defaultConfig = HotkeyConfig(key: "m", modifiers: ["command"])
        otherConfig = config.hotkey
    }

    // --- Build the NSAlert ---
    let alert = NSAlert()
    alert.messageText = "Edit \(slotName) Hotkey"
    alert.informativeText = """
        Current: \(currentConfig.displayString)
        Enter a key (a-z, 0-9) and select modifiers.
        """
    alert.addButton(withTitle: "Save")
    alert.addButton(withTitle: "Reset to Default")
    alert.addButton(withTitle: "Cancel")

    // --- Build accessory view ---
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

    // --- Show dialog ---
    NSApp.activate(ignoringOtherApps: true)
    let response = alert.runModal()

    // --- Handle response ---
    if response == .alertFirstButtonReturn {
        // SAVE
        let rawKey = keyField.stringValue
            .lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let newKey = String(rawKey.prefix(1))  // Single character enforcement

        var newModifiers: [String] = []
        if cmdCheck.state == .on { newModifiers.append("command") }
        if ctrlCheck.state == .on { newModifiers.append("control") }
        if optCheck.state == .on { newModifiers.append("option") }
        if shiftCheck.state == .on { newModifiers.append("shift") }

        // Validation 1: At least one modifier
        guard !newModifiers.isEmpty else {
            showValidationError(
                title: "Invalid Hotkey",
                message: "At least one modifier (Command, Control, Option, Shift) must be selected."
            )
            return
        }

        // Validation 2: Key is in the supported keyCode map
        let newConfig = HotkeyConfig(key: newKey, modifiers: newModifiers)
        guard newConfig.keyCode != nil else {
            showValidationError(
                title: "Unsupported Key",
                message: "The key '\(newKey)' is not supported. Use a-z, 0-9, space, return, tab, or escape."
            )
            return
        }

        // Validation 3: No conflict with the other Jumpee hotkey
        let newModsNormalized = Set(newModifiers.map { $0.lowercased() })
        let otherModsNormalized = Set(otherConfig.modifiers.map { $0.lowercased() })
        if newConfig.key.lowercased() == otherConfig.key.lowercased()
            && newModsNormalized == otherModsNormalized {
            // Only flag conflict if the other hotkey is actually active
            let otherIsActive: Bool
            switch slot {
            case .dropdown:
                otherIsActive = config.moveWindow?.enabled == true
            case .moveWindow:
                otherIsActive = true  // dropdown hotkey is always active
            }
            if otherIsActive {
                showValidationError(
                    title: "Hotkey Conflict",
                    message: "This combination is already used by the other Jumpee hotkey (\(otherConfig.displayString))."
                )
                return
            }
        }

        // Apply and save
        switch slot {
        case .dropdown:
            config.hotkey = newConfig
        case .moveWindow:
            config.moveWindowHotkey = newConfig
        }
        config.save()
        reRegisterHotkeys()

    } else if response == .alertSecondButtonReturn {
        // RESET TO DEFAULT
        switch slot {
        case .dropdown:
            config.hotkey = defaultConfig
        case .moveWindow:
            config.moveWindowHotkey = defaultConfig
        }
        config.save()
        reRegisterHotkeys()
    }
    // Cancel: do nothing
}
```

### 5.5 Helper Methods

```swift
/// Show a validation error alert. Used by editHotkey(slot:).
private func showValidationError(title: String, message: String) {
    let errAlert = NSAlert()
    errAlert.messageText = title
    errAlert.informativeText = message
    errAlert.alertStyle = .warning
    errAlert.addButton(withTitle: "OK")
    errAlert.runModal()
}

/// Re-register both hotkeys using current config state.
/// Extracted to avoid duplication between editHotkey, reloadConfig, etc.
private func reRegisterHotkeys() {
    hotkeyManager?.register(
        config: config.hotkey,
        moveWindowConfig: config.moveWindow?.enabled == true
            ? config.effectiveMoveWindowHotkey
            : nil
    )
}
```

### 5.6 Accessory View Layout

```
+--------------------------------------------------+
|  Key: [ j  ]                                     |  y=70
|                                                  |
|  [x] Command     [ ] Control                     |  y=40
|  [ ] Option      [ ] Shift                       |  y=15
+--------------------------------------------------+
   300px wide x 100px tall
```

- The key field is a standard `NSTextField`, 60px wide, positioned at x=45.
- Checkboxes use standard `NSButton(checkboxWithTitle:)`, arranged in a 2x2 grid.
- Layout uses absolute frames (consistent with `renameActiveSpace()` which uses `NSRect` for the input field).

### 5.7 Validation Rules

| Rule | Check | Error |
|------|-------|-------|
| Modifier required | `newModifiers.isEmpty` | "At least one modifier must be selected." |
| Supported key | `newConfig.keyCode == nil` | "The key 'X' is not supported. Use a-z, 0-9, space, return, tab, or escape." |
| No internal conflict | Same key + same modifiers as the other active Jumpee hotkey | "This combination is already used by the other Jumpee hotkey." |
| Single character | `String(rawKey.prefix(1))` | Silently takes first character (no error needed) |

### 5.8 Save Flow

```
User clicks Save
  |
  v
Validate inputs (3 checks)
  |
  v (pass)
Mutate config.hotkey or config.moveWindowHotkey
  |
  v
config.save()  -->  writes to ~/.Jumpee/config.json
  |
  v
reRegisterHotkeys()
  |-- hotkeyManager?.register(config:moveWindowConfig:)
  |     |-- UnregisterEventHotKey (both)
  |     |-- RemoveEventHandler
  |     |-- InstallEventHandler (fresh)
  |     |-- RegisterEventHotKey id=1 (dropdown)
  |     |-- RegisterEventHotKey id=2 (move-window, if enabled)
  |
  v
Menu reopens on next click --> rebuildSpaceItems() updates tag 300/301 titles
```

---

## 6. About Dialog

### 6.1 Menu Item Placement

Insert "About Jumpee..." in `setupMenu()`, immediately after the "Jumpee" bold header item (line 773) and before the separator (line 774):

```swift
let headerItem = NSMenuItem(title: "Jumpee", action: nil, keyEquivalent: "")
// ... existing header setup ...
menu.addItem(headerItem)

// NEW: About item
let aboutItem = NSMenuItem(
    title: "About Jumpee...",
    action: #selector(showAboutDialog),
    keyEquivalent: ""
)
aboutItem.target = self
menu.addItem(aboutItem)

menu.addItem(NSMenuItem.separator())  // existing separator
```

No keyboard shortcut for the About item (infrequently used).

### 6.2 showAboutDialog() Method

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

### 6.3 Version Source

- Runtime: `Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String`
- Built .app: Returns the version from `Info.plist` (e.g., "1.3.0")
- Unpackaged (dev): `Bundle.main` points to the Swift runtime; `infoDictionary` lacks `CFBundleShortVersionString`, so fallback to `"dev"` activates
- The fallback to `"dev"` is NOT a config setting fallback (it does not violate the no-defaults rule) -- it is a runtime detection of the build environment

---

## 7. Menu Layout

### 7.1 Complete Menu Structure After v1.3.0

```
About Jumpee...                                         (NEW)
Jumpee (bold header, disabled)
---
Desktops:
  [display header, if multi-display]
  Desktop 1 - Development          Cmd+1                (dynamic)
  Desktop 2 - Terminal             Cmd+2                (dynamic)
  Desktop 3                        Cmd+3                (dynamic)
  Rename Current Desktop...        Cmd+N                tag=200
  Move Window To... >              [submenu]            (if moveWindow.enabled)
  Set Up Window Moving...                               (conditional)
---
Hide Space Number                                       tag=100
Disable Overlay                                         tag=101
---                                                     (NEW separator)
Hotkeys:                           (disabled header)    (NEW)
  Dropdown Hotkey: Cmd+J...                             tag=300 (NEW)
  Move Window Hotkey: Cmd+M...                          tag=301 (NEW, hidden if disabled)
---
Open Config File...                Cmd+,
Reload Config                      Cmd+R
---
Quit Jumpee                        Cmd+Q
```

### 7.2 setupMenu() Item Insertion Order

The `setupMenu()` method builds items in this exact order:

1. "Jumpee" header (disabled, bold)
2. "About Jumpee..." (NEW)
3. Separator
4. "Desktops:" header (disabled)
5. Separator (space items inserted dynamically before this)
6. "Hide Space Number" (tag 100)
7. "Disable Overlay" (tag 101)
8. Separator (NEW)
9. "Hotkeys:" header (disabled) (NEW)
10. "Dropdown Hotkey: ..." (tag 300) (NEW)
11. "Move Window Hotkey: ..." (tag 301, initially hidden) (NEW)
12. Separator
13. "Open Config File..." (Cmd+,)
14. "Reload Config" (Cmd+R)
15. Separator
16. "Quit Jumpee" (Cmd+Q)

### 7.3 Dynamic vs Static Items

| Category | Items | Managed by |
|----------|-------|------------|
| Static | Header, About, Desktops label, toggles, hotkeys section, config items, quit | `setupMenu()` (built once) |
| Dynamic | Desktop items, rename, move submenu, setup | `rebuildSpaceItems()` (rebuilt on every `menuWillOpen`) |
| Semi-dynamic | Hotkey titles (tags 300, 301) | Titles updated in `rebuildSpaceItems()`, visibility toggled for tag 301 |

---

## 8. Build Script Changes

### 8.1 Version Bump

In `build.sh`, change lines 39-40:

**Before:**
```xml
<string>1.2.2</string>
```

**After:**
```xml
<string>1.3.0</string>
```

Both `CFBundleVersion` and `CFBundleShortVersionString` are updated.

---

## 9. Component Interaction Diagram

### 9.1 Dual-Hotkey System Architecture

```
+---------------------------+
|   macOS Carbon Event System   |
|   (kEventHotKeyPressed)       |
+---------------------------+
             |
             v
+---------------------------------------+
| hotkeyEventHandler()                  |
| (free function, C callback bridge)    |
|                                       |
| GetEventParameter -> EventHotKeyID    |
|                                       |
|   hotKeyID.id == 1 ?                  |
|     --> globalMenuBarController       |
|           .openMenu()                 |
|                                       |
|   hotKeyID.id == 2 ?                  |
|     --> globalMenuBarController       |
|           .openMoveWindowMenu()       |
+---------------------------------------+
             ^
             |  (registered by)
             |
+---------------------------------------+
| GlobalHotkeyManager                   |
|                                       |
| +-- hotkeyRef (id=1)                 |  <-- config.hotkey
| |   RegisterEventHotKey(keyCode,      |      (e.g., Cmd+J)
| |     carbonMods, id=1)              |
| |                                     |
| +-- moveWindowHotkeyRef (id=2)       |  <-- config.effectiveMoveWindowHotkey
| |   RegisterEventHotKey(keyCode,      |      (e.g., Cmd+M)
| |     carbonMods, id=2)              |      (only if moveWindow.enabled)
| |                                     |
| +-- handlerRef                        |
|     InstallEventHandler               |
|     (single handler for both)         |
+---------------------------------------+
             ^
             |  (owned by)
             |
+---------------------------------------+
| MenuBarController                     |
|                                       |
| openMenu()                            |  --> statusItem.button?.performClick
|                                       |      (opens dropdown menu)
|                                       |
| openMoveWindowMenu()                  |  --> NSMenu.popUp at cursor
|   |-- builds temp NSMenu              |      (floating popup)
|   |-- lists desktops (active display) |
|   |-- moveWindowFromPopup(_:)         |
|        |-- 300ms delay                |
|        |-- WindowMover.moveToSpace()  |
+---------------------------------------+
```

### 9.2 Hotkey Editor Save Flow

```
User clicks "Dropdown Hotkey: Cmd+J..." (tag 300)
  |
  v
editDropdownHotkey()
  |
  v
editHotkey(slot: .dropdown)
  |
  +-- Build NSAlert with accessory view
  |     (key field + 4 modifier checkboxes)
  |
  +-- alert.runModal() -- blocks main thread
  |
  v  (user clicks Save)
  |
  +-- Validate: modifier required?
  +-- Validate: key in keyCode map?
  +-- Validate: no conflict with other hotkey?
  |
  v  (all pass)
  |
  +-- config.hotkey = newConfig
  +-- config.save()
  +-- reRegisterHotkeys()
  |     |-- hotkeyManager.register(config:moveWindowConfig:)
  |           |-- unregister() both
  |           |-- InstallEventHandler (fresh)
  |           |-- RegisterEventHotKey id=1 (new key/mods)
  |           |-- RegisterEventHotKey id=2 (unchanged)
  |
  v
Next menu open: rebuildSpaceItems() updates tag 300 title
```

### 9.3 Configuration Data Flow

```
~/.Jumpee/config.json
  |
  v
JumpeeConfig.load()
  |-- .hotkey: HotkeyConfig          --> GlobalHotkeyManager id=1
  |-- .moveWindowHotkey: HotkeyConfig? --> (optional)
  |-- .moveWindow: MoveWindowConfig?   --> gates feature
  |-- .effectiveMoveWindowHotkey       --> computed: moveWindowHotkey ?? Cmd+M
  |                                        --> GlobalHotkeyManager id=2
  |                                            (only if moveWindow.enabled)
  v
JumpeeConfig.save()
  |-- Encodes all properties including moveWindowHotkey
  |-- Pretty-printed, sorted keys
  |-- Written to ~/.Jumpee/config.json
```

---

## 10. Method Signature Index

### 10.1 New Methods on MenuBarController

| Method | Signature | Visibility | Purpose |
|--------|-----------|------------|---------|
| `openMoveWindowMenu` | `func openMoveWindowMenu()` | `internal` (called from free function) | Pop up move-window menu at cursor |
| `moveWindowFromPopup` | `@objc private func moveWindowFromPopup(_ sender: NSMenuItem)` | `private` | Handle popup menu item selection |
| `showAboutDialog` | `@objc private func showAboutDialog()` | `private` | Display About dialog |
| `editDropdownHotkey` | `@objc private func editDropdownHotkey()` | `private` | Trigger dropdown hotkey editor |
| `editMoveWindowHotkey` | `@objc private func editMoveWindowHotkey()` | `private` | Trigger move-window hotkey editor |
| `editHotkey` | `private func editHotkey(slot: HotkeySlot)` | `private` | Hotkey editor dialog implementation |
| `showValidationError` | `private func showValidationError(title: String, message: String)` | `private` | Validation error alert helper |
| `reRegisterHotkeys` | `private func reRegisterHotkeys()` | `private` | Re-register both hotkeys from current config |

### 10.2 Changed Methods on GlobalHotkeyManager

| Method | Old Signature | New Signature |
|--------|--------------|---------------|
| `register` | `func register(config: HotkeyConfig)` | `func register(config: HotkeyConfig, moveWindowConfig: HotkeyConfig?)` |
| `unregister` | `func unregister()` | `func unregister()` (unchanged signature, handles two refs) |

### 10.3 Changed Free Functions

| Function | Change |
|----------|--------|
| `hotkeyEventHandler` | Now reads `EventHotKeyID` from event and dispatches by `id` (1 or 2) |

### 10.4 New Properties on JumpeeConfig

| Property | Type | Default | Purpose |
|----------|------|---------|---------|
| `moveWindowHotkey` | `HotkeyConfig?` | `nil` | Move-window hotkey key/modifiers |
| `effectiveMoveWindowHotkey` | `HotkeyConfig` (computed) | `Cmd+M` | Resolved hotkey with default fallback |

### 10.5 New Enum

| Enum | Cases | Location |
|------|-------|----------|
| `HotkeySlot` | `.dropdown`, `.moveWindow` | Private to `MenuBarController` |

---

## Appendix A: Lines Modified Summary

| Area | Current Lines | Change Type |
|------|---------------|-------------|
| `JumpeeConfig` struct | 113-145 | Add `moveWindowHotkey` property + computed `effectiveMoveWindowHotkey` |
| `hotkeyEventHandler` free function | 646-651 | Replace with ID-dispatching version |
| `GlobalHotkeyManager` class | 653-700 | Add `moveWindowHotkeyRef`, refactor `register()` signature, update `unregister()` |
| `MenuBarController.init()` | 724-725 | Change `register` call to pass both configs |
| `MenuBarController.setupMenu()` | 766-816 | Add About item, Hotkeys section (4 items + 2 separators) |
| `MenuBarController.rebuildSpaceItems()` | 992-998 | Add tag 300/301 title + visibility updates |
| `MenuBarController.reloadConfig()` | 1165 | Change `register` call to pass both configs |
| New methods on `MenuBarController` | (insert) | 8 new methods (~200 lines total) |
| `HotkeySlot` enum | (insert) | ~4 lines |
| `build.sh` | 39-40 | Version 1.2.2 -> 1.3.0 |

## Appendix B: Risk Register

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| `GetEventParameter` returns unexpected hotkey ID | Low | Low | `default: break` ignores unknown IDs |
| `NSMenu.popUp` with `in: nil` behaves differently on multi-monitor | Low | Low | `NSEvent.mouseLocation` returns global screen coordinates; tested pattern |
| Popup steals focus, WindowMover fails (no focused window) | Medium | Medium | 300ms delay matches proven pattern in existing code |
| Cmd+M conflicts with system Minimize shortcut | Medium | High | Documented; user can change via Hotkey Config UI |
| User enters multi-character string in key field | Low | Medium | `String(prefix(1))` silently takes first character |
| `Bundle.main.infoDictionary` nil when unpackaged | Low | Low (dev-only) | Fallback to `"dev"` |
| Existing configs without `moveWindowHotkey` cause parse error | None | None | Optional property decodes as nil automatically |
| Menu item tags 300/301 collide with other tags | None | None | Verified: existing tags are 100, 101, 200 |
