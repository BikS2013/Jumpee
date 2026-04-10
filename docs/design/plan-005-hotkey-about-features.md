# Plan 005: Move Window Hotkey, Hotkey Configuration UI, and About Dialog

**Created:** 2026-04-10
**Target Version:** 1.3.0
**Source Files:** `Sources/main.swift` (~1200 lines), `build.sh`

---

## Summary

Three features added to the Jumpee menu bar app:

1. **Move Window Hotkey** -- A second global Carbon hotkey (default Cmd+M) that pops up a "Move Window to Desktop N" menu at the cursor position.
2. **Hotkey Configuration UI** -- In-app modal dialogs to edit hotkey bindings without manually editing JSON.
3. **About Dialog** -- "About Jumpee..." menu item showing version, setup instructions, and config info.

All code lives in `Sources/main.swift`. Changes are organized by MARK section to minimize merge conflicts between phases.

---

## Prerequisites

- Jumpee v1.2.2 codebase on branch `main` (commit `f99acad`)
- Xcode Command Line Tools installed
- Familiarity with the existing MARK sections in `main.swift`:
  - `// MARK: - Configuration` (lines 32-145)
  - `// MARK: - Global Hotkey Manager (Carbon API)` (lines 642-700)
  - `// MARK: - Menu Bar Controller` (lines 702-1173)
  - `// MARK: - NSMenuDelegate` (lines 1175-1181)

---

## Config Default Value Exception

The `moveWindowHotkey` field in `JumpeeConfig` is optional. When absent and `moveWindow.enabled` is true, it defaults to `HotkeyConfig(key: "m", modifiers: ["command"])`. This is an **exception** to the project's "no default fallback for config settings" rule.

**Rationale:** Users who enable `moveWindow.enabled = true` should get a working move-window hotkey without also specifying `moveWindowHotkey`. The default Cmd+M is a reasonable convention.

This exception must be recorded in the project's memory file before implementation begins.

---

## Important Note: Cmd+M System Conflict

The default move-window hotkey Cmd+M conflicts with the system-wide "Minimize" shortcut (Cmd+M) used by most macOS apps. When the Jumpee move-window hotkey is registered, pressing Cmd+M will trigger Jumpee's popup instead of minimizing the focused window.

Users should be aware of this and may wish to change the move-window hotkey to an alternative such as Cmd+Shift+M via the Hotkey Configuration UI or by editing the config file. This conflict is documented in the configuration guide.

---

## Phase 1: Config Model Changes

**MARK section:** `// MARK: - Configuration` (lines 32-145)

### Changes

1. **Add `moveWindowHotkey` property to `JumpeeConfig`** (after `moveWindow: MoveWindowConfig?`):
   ```swift
   var moveWindowHotkey: HotkeyConfig?
   ```

2. **Add `CodingKeys` entry** for `moveWindowHotkey` in `JumpeeConfig` (if CodingKeys enum exists; otherwise the Codable synthesis handles it automatically since the property name matches the JSON key).

3. **Add a computed property** for the effective move-window hotkey:
   ```swift
   var effectiveMoveWindowHotkey: HotkeyConfig {
       return moveWindowHotkey ?? HotkeyConfig(key: "m", modifiers: ["command"])
   }
   ```
   This centralizes the default-fallback logic (the documented exception to the no-defaults rule).

### Acceptance Criteria

- [ ] `JumpeeConfig` compiles with the new optional `moveWindowHotkey` property.
- [ ] Existing config files without `moveWindowHotkey` load without error.
- [ ] A config file with `"moveWindowHotkey": {"key": "m", "modifiers": ["command"]}` loads correctly.
- [ ] `effectiveMoveWindowHotkey` returns the configured value when present, or the Cmd+M default when absent.
- [ ] `config.save()` persists `moveWindowHotkey` to disk when set.

### Verification

```bash
cd Jumpee && bash build.sh
```
Build must succeed with zero errors.

---

## Phase 2: GlobalHotkeyManager Multi-Hotkey Support

**MARK section:** `// MARK: - Global Hotkey Manager (Carbon API)` (lines 642-700)

### Changes

1. **Refactor the free function `hotkeyEventHandler`** (line 646) to dispatch based on hotkey ID:
   - Read `EventHotKeyID` from the Carbon event using `GetEventParameter(event, kEventParamDirectObject, typeEventHotKeyID, ...)`.
   - If `hotKeyID.id == 1`, call `globalMenuBarController?.openMenu()` (existing behavior).
   - If `hotKeyID.id == 2`, call `globalMenuBarController?.openMoveWindowMenu()` (new).
   - `default: break` for unknown IDs.

2. **Add a second `EventHotKeyRef` field** to `GlobalHotkeyManager`:
   ```swift
   private var moveWindowHotkeyRef: EventHotKeyRef?
   ```

3. **Refactor `register()` to accept both configs:**
   ```swift
   func register(config: HotkeyConfig, moveWindowConfig: HotkeyConfig?) {
       unregister()
       // Install a single EventHandler for all kEventHotKeyPressed events
       // Register main hotkey with EventHotKeyID(signature: 0x4A4D5045, id: 1)
       // Register move-window hotkey with EventHotKeyID(signature: 0x4A4D5045, id: 2) if moveWindowConfig is non-nil
   }
   ```

4. **Update `unregister()`** to unregister both `hotkeyRef` and `moveWindowHotkeyRef`.

5. **Update `deinit`** to call the updated `unregister()` (should already work if `unregister()` handles both).

### Key Technical Detail

- `InstallEventHandler` is called once for the `kEventHotKeyPressed` event class. Both hotkeys share this single handler.
- Each `RegisterEventHotKey` call produces a separate `EventHotKeyRef`. The `EventHotKeyID.id` field (UInt32) distinguishes them in the callback.
- The `signature` field remains `0x4A4D5045` ("JMPE") for both hotkeys; only `id` differs.

### Acceptance Criteria

- [ ] The Carbon handler dispatches based on `EventHotKeyID.id` (1 = dropdown, 2 = move window).
- [ ] `register(config:moveWindowConfig:)` registers one or two hotkeys depending on whether `moveWindowConfig` is nil.
- [ ] `unregister()` cleans up both hotkey refs.
- [ ] Passing `moveWindowConfig: nil` registers only the main hotkey (same as current behavior).

### Verification

```bash
cd Jumpee && bash build.sh
```
Build must succeed. Note: `openMoveWindowMenu()` does not exist yet; add a stub method on `MenuBarController` to avoid compile errors:
```swift
func openMoveWindowMenu() {
    // TODO: Phase 3
}
```

---

## Phase 3: Move Window Popup Menu

**MARK section:** `// MARK: - Menu Bar Controller` (lines 702-1173)

### Changes

1. **Add `openMoveWindowMenu()` method** to `MenuBarController` (replace the stub from Phase 2):
   - Construct a temporary `NSMenu` listing all desktops on the active display, excluding the current one.
   - Reuse the same space enumeration logic as the existing "Move Window To..." submenu in `rebuildSpaceItems()` (lines ~930-966).
   - Display desktop names with the same naming/numbering logic (custom names, `showSpaceNumber` toggle).
   - Pop up the menu at the current mouse cursor position using `NSMenu.popUp(positioning: nil, at: NSEvent.mouseLocation, in: nil)`.
   - When `in:` is nil, `at:` is interpreted as screen coordinates -- this places the menu exactly at the mouse cursor.

2. **Add `moveWindowFromPopup(_:)` action handler:**
   ```swift
   @objc private func moveWindowFromPopup(_ sender: NSMenuItem) {
       let targetGlobalPosition = sender.tag
       DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
           WindowMover.moveToSpace(index: targetGlobalPosition)
       }
   }
   ```
   - Uses the same 300ms delay pattern as `navigateToSpace` and `moveWindowToSpace`.
   - Does NOT need `cancelTracking()` because the popup menu self-dismisses when an item is selected.

3. **Wire up hotkey registration in `MenuBarController.init()`** (line ~724):
   - Change the existing `hotkeyManager?.register(config: config.hotkey)` call to:
     ```swift
     hotkeyManager?.register(
         config: config.hotkey,
         moveWindowConfig: config.moveWindow?.enabled == true
             ? config.effectiveMoveWindowHotkey
             : nil
     )
     ```

4. **Update `reloadConfig(_:)`** (line ~1161) to pass both hotkey configs when re-registering.

5. **Update `quit(_:)`** (line ~1168) -- no change needed if `unregister()` already handles both refs.

### Feature Gating

- The move-window hotkey is only registered when `config.moveWindow?.enabled == true`.
- If `moveWindow` is absent or `enabled` is false, `moveWindowConfig: nil` is passed, and the hotkey is not registered.
- `openMoveWindowMenu()` should also guard on `config.moveWindow?.enabled == true` as a safety check.

### Acceptance Criteria

- [ ] Pressing the move-window hotkey (default Cmd+M) from any app opens a popup menu at the cursor.
- [ ] The popup lists all desktops on the active display except the current one.
- [ ] Selecting a desktop moves the focused window to that desktop (with 300ms delay).
- [ ] Pressing Escape or clicking away dismisses the popup with no action.
- [ ] The popup does nothing when `moveWindow.enabled` is false or absent.
- [ ] Both hotkeys (dropdown Cmd+J and move-window Cmd+M) work simultaneously.
- [ ] Reloading config (Cmd+R) updates both hotkeys.

### Verification

```bash
cd Jumpee && bash build.sh
```
Build and run. Test:
1. Open a Finder window.
2. Press Cmd+M -- a popup menu should appear at the mouse cursor listing available desktops.
3. Select a desktop -- the Finder window moves to that desktop and the view follows.
4. Set `moveWindow.enabled: false` in config, reload (Cmd+R), press Cmd+M -- nothing should happen (system Minimize should resume working).

---

## Phase 4: Hotkey Configuration UI

**MARK sections:** `// MARK: - Menu Bar Controller` (setupMenu, rebuildSpaceItems, new methods)

### Changes

#### 4.1 Menu Items (in `setupMenu()`)

Add a new "Hotkeys:" section between the overlay toggle (tag 101) and the "Open Config File..." separator. Insert the following items:

```
[separator]
"Hotkeys:" (disabled header)
"Dropdown Hotkey: Cmd+J..."        tag=300
"Move Window Hotkey: Cmd+M..."     tag=301  (added unconditionally, hidden/shown dynamically)
[separator]
```

- Tag 300: Dropdown hotkey editor trigger.
- Tag 301: Move-window hotkey editor trigger. Added unconditionally in `setupMenu()` but set to `isHidden = true` initially; shown/hidden in `rebuildSpaceItems()` based on `config.moveWindow?.enabled`.

#### 4.2 Dynamic Menu Item Updates (in `rebuildSpaceItems()`)

Add title and visibility updates at the end of `rebuildSpaceItems()`:

```swift
// Update hotkey display in menu
if let item = menu.item(withTag: 300) {
    item.title = "Dropdown Hotkey: \(config.hotkey.displayString)..."
}
if let item = menu.item(withTag: 301) {
    if config.moveWindow?.enabled == true {
        item.title = "Move Window Hotkey: \(config.effectiveMoveWindowHotkey.displayString)..."
        item.isHidden = false
    } else {
        item.isHidden = true
    }
}
```

#### 4.3 HotkeySlot Enum

Add a private enum to identify which hotkey is being edited:

```swift
private enum HotkeySlot {
    case dropdown
    case moveWindow
}
```

#### 4.4 Hotkey Editor Dialog

Add `editHotkey(slot:)` method to `MenuBarController`:

- **Dialog type:** `NSAlert` with accessory view (same pattern as `renameActiveSpace()` and `showMoveWindowSetup()`).
- **Accessory view contents:**
  - `NSTextField` for key input (single character: a-z, 0-9, or special keys "space", "return", "tab", "escape").
  - Four `NSButton` checkboxes: Command, Control, Option, Shift.
- **Buttons:** "Save", "Reset to Default", "Cancel".
- **Pre-populated:** Current key and modifier state for the selected slot.

**Validation on Save:**

1. **At least one modifier selected.** If not, show error alert: "At least one modifier (Command, Control, Option, Shift) must be selected."
2. **Key is in the `HotkeyConfig.keyCode` map.** If not, show error alert: "The key 'X' is not supported. Use a-z, 0-9, space, return, tab, or escape."
3. **No conflict with the other Jumpee hotkey.** Compare key + normalized modifiers. If conflict, show error alert: "This combination is already used by the other Jumpee hotkey."
4. **Single character enforcement.** Take only the first character of the text field input (`String(keyField.stringValue.prefix(1))`).

**On Save (validation passed):**

1. Create new `HotkeyConfig` from the dialog inputs.
2. Update `config.hotkey` or `config.moveWindowHotkey` depending on slot.
3. Call `config.save()`.
4. Re-register hotkeys via `hotkeyManager?.register(config:moveWindowConfig:)`.

**On Reset to Default:**

1. Set the slot to its default: `HotkeyConfig(key: "j", modifiers: ["command"])` for dropdown, `HotkeyConfig(key: "m", modifiers: ["command"])` for move-window.
2. Call `config.save()`.
3. Re-register hotkeys.

**On Cancel:** Do nothing.

#### 4.5 Action Methods

Add two `@objc` methods that call `editHotkey(slot:)`:

```swift
@objc private func editDropdownHotkey() { editHotkey(slot: .dropdown) }
@objc private func editMoveWindowHotkey() { editHotkey(slot: .moveWindow) }
```

### Acceptance Criteria

- [ ] "Hotkeys:" section appears in the menu between the overlay toggle and "Open Config File...".
- [ ] Current hotkey is displayed in the menu item title (e.g., "Dropdown Hotkey: Cmd+J...").
- [ ] Clicking the menu item opens an NSAlert with key field and modifier checkboxes.
- [ ] Saving a valid combination updates the config file and re-registers the hotkey immediately.
- [ ] Bare keys (no modifier) are rejected with an error.
- [ ] Unsupported keys are rejected with an error referencing the supported key set.
- [ ] Conflicting combinations (same as other Jumpee hotkey) are rejected.
- [ ] "Reset to Default" restores Cmd+J (dropdown) or Cmd+M (move-window).
- [ ] Move-window hotkey editor is hidden when `moveWindow.enabled` is false.
- [ ] After saving, the next menu open shows the updated hotkey in the menu item title.

### Verification

```bash
cd Jumpee && bash build.sh
```
Build and run. Test:
1. Open menu -- "Hotkeys:" section visible with "Dropdown Hotkey: Cmd+J...".
2. Click "Dropdown Hotkey: Cmd+J..." -- editor dialog appears.
3. Change key to "k", keep Command checked, click Save.
4. Press Cmd+K -- menu opens. Press Cmd+J -- nothing happens (old hotkey deregistered).
5. Open menu again -- title reads "Dropdown Hotkey: Cmd+K...".
6. Click "Dropdown Hotkey: Cmd+K...", click "Reset to Default" -- hotkey reverts to Cmd+J.
7. Try setting both hotkeys to the same combination -- conflict error shown.

---

## Phase 5: About Dialog

**MARK section:** `// MARK: - Menu Bar Controller` (setupMenu, new method)

### Changes

1. **Add "About Jumpee..." menu item** in `setupMenu()`, immediately after the "Jumpee" bold header item and before the first separator:
   ```swift
   let aboutItem = NSMenuItem(title: "About Jumpee...",
                               action: #selector(showAboutDialog),
                               keyEquivalent: "")
   aboutItem.target = self
   menu.addItem(aboutItem)
   ```

2. **Add `showAboutDialog()` method** to `MenuBarController`:
   - Use `NSAlert` with `.informational` alertStyle.
   - `messageText`: "About Jumpee"
   - `informativeText`: Multi-line string containing:
     - Version (from `Bundle.main.infoDictionary?["CFBundleShortVersionString"]`, fallback to `"dev"`)
     - Brief app description
     - macOS setup requirements (Accessibility, Desktop Switching Shortcuts, Window Moving Shortcuts)
     - Configuration file location and menu shortcuts
   - Single "OK" button.
   - Call `NSApp.activate(ignoringOtherApps: true)` before `alert.runModal()`.

### Version Source

The version is read at runtime from the app bundle's `Info.plist`:
```swift
let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "dev"
```
- When built as `.app` bundle via `build.sh`, this returns the version set in the Info.plist (e.g., "1.3.0").
- When running unpackaged (e.g., `swift Sources/main.swift`), returns `"dev"`.

### Acceptance Criteria

- [ ] "About Jumpee..." appears in the menu after the "Jumpee" header and before the separator.
- [ ] Clicking it opens a dialog showing "About Jumpee" as title.
- [ ] The dialog shows the app version (e.g., "Version: 1.3.0").
- [ ] The dialog includes Accessibility permissions instructions.
- [ ] The dialog includes Mission Control shortcut instructions.
- [ ] The dialog includes config file location and Cmd+, / Cmd+R shortcuts.
- [ ] The "OK" button dismisses the dialog.
- [ ] No keyboard shortcut is assigned to the "About Jumpee..." menu item.

### Verification

```bash
cd Jumpee && bash build.sh
```
Build and run. Open menu, click "About Jumpee..." -- verify dialog content and version.

---

## Phase 6: Menu Integration and Wiring

**MARK section:** `// MARK: - Menu Bar Controller` (setupMenu, rebuildSpaceItems)

This phase ensures all features are wired together in the correct menu layout. Most of the wiring is done incrementally in Phases 3-5, but this phase covers the final menu layout verification.

### Final Menu Layout

```
About Jumpee...
Jumpee (bold header, disabled)
---
Desktops:
  [dynamic space items]
  Rename Current Desktop...         Cmd+N
  Move Window To... >               [submenu, if enabled]
  Set Up Window Moving...           [if shortcuts not detected]
---
Hide Space Number                   (tag 100)
Disable Overlay                     (tag 101)
---
Hotkeys:                            (disabled header)
  Dropdown Hotkey: Cmd+J...         (tag 300)
  Move Window Hotkey: Cmd+M...      (tag 301, hidden if disabled)
---
Open Config File...                 Cmd+,
Reload Config                       Cmd+R
---
Quit Jumpee                         Cmd+Q
```

### Changes

1. **Verify `setupMenu()` order:** Ensure menu items are added in the order shown above. The About item goes before the Jumpee header (or immediately after -- per the refined requirements it goes after the header and before the separator).

2. **Verify `rebuildSpaceItems()` updates:** Confirm that tag 300 and 301 items are updated on every menu open.

3. **Verify `reloadConfig(_:)` re-registers both hotkeys** and triggers menu rebuild logic.

### Acceptance Criteria

- [ ] Menu layout matches the specification above.
- [ ] All features accessible from the menu.
- [ ] Enabling/disabling `moveWindow.enabled` and reloading config shows/hides the move-window hotkey editor and the move-window submenu.
- [ ] All existing features (navigation, rename, overlay toggle, etc.) continue to work.

### Verification

```bash
cd Jumpee && bash build.sh
```
Full integration test:
1. Launch Jumpee, verify menu layout.
2. Test space navigation (Cmd+1-9 in menu).
3. Test rename (Cmd+N).
4. Test move window from submenu.
5. Test move window from global hotkey (Cmd+M).
6. Test hotkey editor for both hotkeys.
7. Test About dialog.
8. Test reload config (Cmd+R) after editing config.json manually.
9. Test with `moveWindow.enabled: false` -- move-window items hidden.

---

## Phase 7: Build and Version Update

**File:** `build.sh`

### Changes

1. **Update version** from `1.2.2` to `1.3.0` in `build.sh` (lines 39-40 where `CFBundleVersion` and `CFBundleShortVersionString` are set in the Info.plist generation).

### Acceptance Criteria

- [ ] `build.sh` sets version to `1.3.0`.
- [ ] `bash build.sh` completes with zero errors and zero warnings.
- [ ] Running the built app: About dialog shows "Version: 1.3.0".
- [ ] All three features function correctly in the built app.

### Verification

```bash
cd Jumpee && bash build.sh
open build/Jumpee.app
```

---

## Implementation Order and Dependencies

```
Phase 1: Config Model ──────┐
                             ├──> Phase 3: Move Window Popup ──┐
Phase 2: GlobalHotkeyManager ┘                                 │
                                                                ├──> Phase 6: Integration
Phase 4: Hotkey Config UI (depends on Phase 2 + 3) ────────────┘
                                                                │
Phase 5: About Dialog (independent) ────────────────────────────┘
                                                                │
Phase 7: Build & Version ───────────────────────────────────────┘
```

- **Phase 1** and **Phase 2** can be developed in sequence (Phase 2 depends on Phase 1 for the config type).
- **Phase 3** depends on Phases 1 and 2 (needs the multi-hotkey manager and the config property).
- **Phase 4** depends on Phase 2 (needs the `register(config:moveWindowConfig:)` method) and Phase 3 (needs the popup to exist for testing).
- **Phase 5** is fully independent and can be implemented at any point.
- **Phase 6** is a verification/integration pass after all features are in place.
- **Phase 7** is the final step before release.

---

## Risk Summary

| Risk | Phase | Likelihood | Mitigation |
|------|-------|------------|------------|
| `GetEventParameter` returns unexpected hotkey ID | 2 | Low | Validate `hotKeyID.id` is 1 or 2; `default: break` ignores unknown IDs |
| `NSMenu.popUp` with `in: nil` behaves differently on multi-monitor | 3 | Low | `NSEvent.mouseLocation` returns global screen coordinates; test on multi-monitor setup |
| Popup menu steals focus, causing WindowMover to fail (no focused window) | 3 | Medium | 300ms delay after popup dismissal allows previously-focused app to regain focus; if needed, capture window AXUIElement before showing popup |
| Cmd+M conflicts with system Minimize shortcut | 3 | Medium | Documented; user can change via Hotkey Config UI (Phase 4) |
| User enters multi-character string in hotkey editor key field | 4 | Medium | Take `String(keyField.stringValue.prefix(1))` and validate against keyCode map |
| `Bundle.main.infoDictionary` is nil when running unpackaged | 5 | Low (dev-only) | Fallback to `"dev"` |
| Existing configs without `moveWindowHotkey` cause parse errors | 1 | Very Low | Property is `HotkeyConfig?` (optional); absent fields decode as nil |

---

## Files Modified

| File | Phases | Nature of Change |
|------|--------|------------------|
| `Sources/main.swift` | 1-6 | Add config property, refactor hotkey manager, add popup menu method, add hotkey editor dialog, add about dialog, update setupMenu and rebuildSpaceItems |
| `build.sh` | 7 | Version bump from 1.2.2 to 1.3.0 |

---

## Estimated Scope

| Phase | Estimated Lines Added/Changed | Complexity |
|-------|-------------------------------|------------|
| 1. Config Model | ~10 lines | Low |
| 2. GlobalHotkeyManager | ~40 lines changed, ~20 new | Medium |
| 3. Move Window Popup | ~50 new lines | Medium |
| 4. Hotkey Config UI | ~120 new lines | Medium-High |
| 5. About Dialog | ~40 new lines | Low |
| 6. Menu Integration | ~20 lines changed | Low |
| 7. Build & Version | ~2 lines changed | Trivial |
| **Total** | **~300 lines** | **Medium** |
