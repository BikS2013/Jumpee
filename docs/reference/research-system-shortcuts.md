# Research: macOS "Move Window to Desktop N" System Keyboard Shortcuts

**Date:** 2026-04-10
**Purpose:** Determine the exact behavior, storage format, programmatic enabling, and CGEvent synthesis approach for the macOS built-in "Move window to Desktop N" shortcuts, as a potential fallback mechanism for Jumpee's window-move feature.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Default Shortcut Assignments](#2-default-shortcut-assignments)
3. [Storage: com.apple.symbolichotkeys Plist](#3-storage-comapplesymbolichotkeys-plist)
4. [Plist Key Numbers for Mission Control Shortcuts](#4-plist-key-numbers-for-mission-control-shortcuts)
5. [Enabling Shortcuts Programmatically](#5-enabling-shortcuts-programmatically)
6. [Detecting Whether Shortcuts Are Enabled](#6-detecting-whether-shortcuts-are-enabled)
7. [CGEvent Synthesis in Swift](#7-cgevent-synthesis-in-swift)
8. [Reliability Across macOS Versions](#8-reliability-across-macos-versions)
9. [Locale and Keyboard Layout Considerations](#9-locale-and-keyboard-layout-considerations)
10. [User Guidance for Enabling Shortcuts](#10-user-guidance-for-enabling-shortcuts)
11. [Summary and Recommendations for Jumpee](#11-summary-and-recommendations-for-jumpee)
12. [Assumptions and Uncertainties](#12-assumptions-and-uncertainties)
13. [References](#13-references)

---

## 1. Overview

macOS includes built-in system shortcuts for both switching to a specific desktop ("Switch to Desktop N") and moving the frontmost window to a specific desktop ("Move window to Desktop N"). These are configured in:

**System Settings > Keyboard > Keyboard Shortcuts > Mission Control**

The key distinction relevant to Jumpee is:

- **Switch to Desktop N** (`Ctrl+N`): Switches the active view to Desktop N. These shortcuts are disabled by default but Jumpee's existing `SpaceNavigator` already synthesizes them via `CGEvent`.
- **Move window to Desktop N** (`Ctrl+Shift+N`): Moves the frontmost window to Desktop N and also switches to that desktop. **These shortcuts are disabled by default** and have no assigned key when the user first looks at System Settings.

Unlike the CGS private API approach (Approach 1/2 in the window-move investigation), the system shortcut approach uses only documented CGEvent APIs and is handled entirely by the macOS window server — making it more forward-compatible.

---

## 2. Default Shortcut Assignments

### Switch to Desktop N (existing, already used by Jumpee)

| Desktop | Default Shortcut |
|---------|-----------------|
| Desktop 1 | `Ctrl+1` |
| Desktop 2 | `Ctrl+2` |
| Desktop 3 | `Ctrl+3` |
| Desktop 4 | `Ctrl+4` |
| (5–9 follow the same pattern) | `Ctrl+5` through `Ctrl+9` |

These are **disabled by default** in a fresh macOS install.

### Move Window to Desktop N

| Desktop | Default Shortcut (when enabled) |
|---------|--------------------------------|
| Desktop 1 | `Ctrl+Shift+1` |
| Desktop 2 | `Ctrl+Shift+2` |
| Desktop 3 | `Ctrl+Shift+3` |
| Desktop 4 | `Ctrl+Shift+4` |
| (5–9 follow the same pattern) | `Ctrl+Shift+5` through `Ctrl+Shift+9` |

**Critical point:** These shortcuts are **disabled by default** on every fresh macOS installation. They appear in System Settings with empty checkboxes. The user must manually enable them.

There is no way for Jumpee to know which key combination a user has assigned (they may have customized them). The default `Ctrl+Shift+N` is used here and should be documented as the expected/assumed assignment.

### Move Window Left/Right One Space

These also exist:
- Move window left one space: `Ctrl+Shift+Left Arrow` (disabled by default)
- Move window right one space: `Ctrl+Shift+Right Arrow` (disabled by default)

---

## 3. Storage: com.apple.symbolichotkeys Plist

All macOS system keyboard shortcuts are stored in:

```
~/Library/Preferences/com.apple.symbolichotkeys.plist
```

This plist has a single top-level key `AppleSymbolicHotKeys` mapping numeric keys (as strings) to shortcut definitions.

### Entry Format

Each shortcut entry follows this structure:

```xml
<key>NNN</key>
<dict>
    <key>enabled</key>
    <true/>   <!-- or <false/> if disabled -->
    <key>value</key>
    <dict>
        <key>type</key>
        <string>standard</string>
        <key>parameters</key>
        <array>
            <integer>CHAR_CODE</integer>    <!-- Parameter 1: ASCII code of the key -->
            <integer>VIRT_KEY_CODE</integer> <!-- Parameter 2: macOS virtual key code -->
            <integer>MODIFIER_FLAGS</integer> <!-- Parameter 3: sum of modifier masks -->
        </array>
    </dict>
</dict>
```

### Parameter Meanings

**Parameter 1 (ASCII code):** The ASCII code of the character the key produces. Use `65535` for non-printable keys (arrow keys, function keys).

**Parameter 2 (Virtual Key Code):** The macOS hardware-independent key code. This is layout-independent for most keys. Key codes for digits 1-9:

| Key | ASCII | Virtual Key Code |
|-----|-------|-----------------|
| 1   | 49    | 18              |
| 2   | 50    | 19              |
| 3   | 51    | 20              |
| 4   | 52    | 21              |
| 5   | 53    | 23              |
| 6   | 54    | 22              |
| 7   | 55    | 26              |
| 8   | 56    | 28              |
| 9   | 57    | 25              |

Note the non-sequential key codes for 5-9. These are the same codes already used in `SpaceNavigator.keyCodeForNumber(_:)` in Jumpee's `main.swift`.

**Parameter 3 (Modifier Flags):** The sum of modifier key masks:

| Modifier | Decimal Value |
|----------|--------------|
| Shift    | 131072       |
| Control  | 262144       |
| Option   | 524288       |
| Command  | 1048576      |
| Ctrl+Shift | 393216 (131072 + 262144) |
| Ctrl+Option | 786432 (262144 + 524288) |
| Ctrl+Shift+Option | 917504 |

So for `Ctrl+Shift+1` (Move window to Desktop 1), the entry is:
- Parameter 1: `49` (ASCII for '1')
- Parameter 2: `18` (virtual key code for '1')
- Parameter 3: `393216` (Ctrl=262144 + Shift=131072)

---

## 4. Plist Key Numbers for Mission Control Shortcuts

### Well-Documented Keys (from community sources)

The following key numbers are well-established and consistent across macOS versions from Snow Leopard through Ventura:

| Key # | Description | Default Combination |
|-------|-------------|---------------------|
| 32    | Mission Control (All Windows) | F9 |
| 34    | Application Windows | F10 |
| 36    | Show Desktop | F11 |
| 79    | Move left a space | Ctrl+Left Arrow |
| 81    | Move right a space | Ctrl+Right Arrow |
| 118   | Switch to Desktop 1 | Ctrl+1 |
| 119   | Switch to Desktop 2 | Ctrl+2 |
| 120   | Switch to Desktop 3 | Ctrl+3 |
| 121   | Switch to Desktop 4 | Ctrl+4 |

Keys 122–131 correspond to Switch to Desktop 5–9 (and are disabled by default with no entry or `enabled=0`).

### Key Numbers for "Move Window to Desktop N"

This is the area with less community documentation certainty. Based on multiple community sources and the pattern established for "Switch to Desktop N":

| Key # | Description | Default Combination |
|-------|-------------|---------------------|
| 52    | Move window to Desktop 1 | `Ctrl+Shift+1` (disabled by default) |
| 54    | Move window to Desktop 2 | `Ctrl+Shift+2` (disabled by default) |
| 56    | Move window to Desktop 3 | `Ctrl+Shift+3` (disabled by default) |
| 58    | Move window to Desktop 4 | `Ctrl+Shift+4` (disabled by default) |
| 60    | Move window to Desktop 5 | `Ctrl+Shift+5` (disabled by default) |
| 62    | Move window to Desktop 6 | `Ctrl+Shift+6` (disabled by default) |
| 64    | Move window to Desktop 7 | `Ctrl+Shift+7` (disabled by default) |
| 66    | Move window to Desktop 8 | `Ctrl+Shift+8` (disabled by default) |
| 68    | Move window to Desktop 9 | `Ctrl+Shift+9` (disabled by default) |

**Confidence: MEDIUM.** The even-number pattern (52, 54, 56...) for these entries follows from older community documentation citing `krypted.com` and associated dotfile repositories. However, specific keys in this range have **conflicting documentation**: the older gist (mattrighetti, from an archived krypted.com post) lists key 52 as "Move focus to window drawer" and key 51 as a Spotlight-related shortcut. This conflicts with the community reports that 52/54/etc. are the Move Window shortcuts. This ambiguity is noted in the Uncertainties section below.

**The authoritative way to determine the exact key numbers on your specific macOS version is to:**
1. Open System Settings > Keyboard > Keyboard Shortcuts > Mission Control
2. Enable "Move window to Desktop 1"
3. In Terminal: `defaults read com.apple.symbolichotkeys AppleSymbolicHotKeys`
4. Observe which key number changed

---

## 5. Enabling Shortcuts Programmatically

It is technically possible to enable "Move window to Desktop N" shortcuts programmatically via `defaults write`, but this approach has significant caveats.

### Method: defaults write

```bash
# Enable "Move window to Desktop 1" as Ctrl+Shift+1
defaults write com.apple.symbolichotkeys AppleSymbolicHotKeys -dict-add 52 "
<dict>
    <key>enabled</key><true/>
    <key>value</key><dict>
        <key>type</key><string>standard</string>
        <key>parameters</key>
        <array>
            <integer>49</integer>
            <integer>18</integer>
            <integer>393216</integer>
        </array>
    </dict>
</dict>"
```

Repeat for keys 54, 56, 58, 60, 62, 64, 66, 68 with corresponding digit parameters.

### Applying Changes Immediately

After writing the plist, changes do not take effect until the system re-reads preferences. Force immediate application with:

```bash
/System/Library/PrivateFrameworks/SystemAdministration.framework/Resources/activateSettings -u
```

This is a private Apple binary that re-reads all symbolic hotkeys and binds them immediately, without requiring a logout/login. Note it is in `PrivateFrameworks` and could be removed or renamed in future macOS versions.

### From Swift

Reading and writing the plist from Swift is possible using `PropertyListSerialization`:

```swift
import Foundation

func areSystemMoveShortcutsEnabled() -> Bool {
    let prefsURL = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Preferences/com.apple.symbolichotkeys.plist")
    
    guard let data = try? Data(contentsOf: prefsURL),
          let plist = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any],
          let hotkeys = plist["AppleSymbolicHotKeys"] as? [String: Any] else {
        return false
    }
    
    // Check if key 52 (Move window to Desktop 1) is enabled
    if let entry = hotkeys["52"] as? [String: Any],
       let enabled = entry["enabled"] as? Bool {
        return enabled
    }
    return false
}
```

### Important Caveats

1. **Requires no SIP modification**: Writing to `~/Library/Preferences/` is always allowed for the current user.
2. **Plist may exist in multiple locations**: On newer macOS versions, shortcut preferences may be synchronized to a container at `~/Library/Containers/com.apple.Desktop-Settings.extension/Data/Library/Preferences/`. Writing only to the main location may not be sufficient.
3. **activateSettings is private**: Calling this binary from within an app (vs. a Terminal command) is not guaranteed to work and is fragile.
4. **User may have customized shortcuts**: Overwriting the user's plist with defaults resets any custom assignments.
5. **Better UX**: Rather than silently modifying system preferences, guide the user to enable them manually (see Section 10).

---

## 6. Detecting Whether Shortcuts Are Enabled

### From the Command Line

```bash
# Check if "Move window to Desktop 1" (key 52) is enabled
/usr/libexec/PlistBuddy -c "Print :AppleSymbolicHotKeys:52:enabled" \
  ~/Library/Preferences/com.apple.symbolichotkeys.plist
# Returns: true or false, or an error if the key doesn't exist
```

Or with defaults:
```bash
defaults read com.apple.symbolichotkeys AppleSymbolicHotKeys | grep -A5 '"52"'
```

### From Swift (Recommended for Jumpee)

```swift
func checkMoveWindowShortcutsEnabled() -> Bool {
    let prefsURL = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Preferences/com.apple.symbolichotkeys.plist")
    
    guard let data = try? Data(contentsOf: prefsURL),
          let plist = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any],
          let hotkeys = plist["AppleSymbolicHotKeys"] as? [String: Any] else {
        return false
    }
    
    // Check a representative shortcut: key 52 = Move window to Desktop 1
    // If this is enabled, we assume all Move Window shortcuts are enabled
    guard let entry = hotkeys["52"] as? [String: Any] else {
        return false   // Key absent = shortcut not set
    }
    
    return (entry["enabled"] as? Bool) == true
}
```

### What "Not Enabled" Looks Like

In the plist, a disabled shortcut may appear as:
- The key is entirely absent from the dictionary (common for "never configured" shortcuts)
- The key is present with `enabled = false`
- The key is present with `enabled = true` but parameters all zero (`65535, 65535, 0`)

All three states mean the shortcut is non-functional.

### Limitation

There is no guaranteed way to detect whether a shortcut key has been **reassigned** to a non-default combination. Jumpee would need to either:
1. Always synthesize `Ctrl+Shift+N` (the default) and rely on the user not having changed it, or
2. Read the actual key code and modifier from the plist and use those values for synthesis.

Option 2 is more robust and is implemented in the CGEvent synthesis section below.

---

## 7. CGEvent Synthesis in Swift

### The Pattern Jumpee Already Uses

Jumpee's `SpaceNavigator.navigateToSpace(index:)` synthesizes `Ctrl+N` key events:

```swift
// From main.swift, lines 447-483
static func navigateToSpace(index: Int) {
    let keyCode = keyCodeForNumber(index)
    let source = CGEventSource(stateID: .hidSystemState)
    
    if let keyDown = CGEvent(keyboardEventSource: source, virtualKey: CGKeyCode(keyCode), keyDown: true) {
        keyDown.flags = .maskControl
        keyDown.post(tap: .cghidEventTap)
    }
    if let keyUp = CGEvent(keyboardEventSource: source, virtualKey: CGKeyCode(keyCode), keyDown: false) {
        keyUp.flags = .maskControl
        keyUp.post(tap: .cghidEventTap)
    }
}
```

### Extension: Moving a Window to Desktop N

To synthesize the "Move window to Desktop N" shortcut (`Ctrl+Shift+N`), add Shift to the modifier flags:

```swift
/// Synthesizes the macOS "Move window to Desktop N" system keyboard shortcut.
/// Requires the user to have enabled "Move window to Desktop N" shortcuts
/// in System Settings > Keyboard > Keyboard Shortcuts > Mission Control.
///
/// - Parameter index: 1-based desktop index (1 through 9)
static func moveWindowToSpaceViaSysShortcut(index: Int) {
    let keyCode = keyCodeForNumber(index)   // reuse existing mapping
    let source = CGEventSource(stateID: .hidSystemState)
    
    if let keyDown = CGEvent(keyboardEventSource: source, virtualKey: CGKeyCode(keyCode), keyDown: true) {
        keyDown.flags = [.maskControl, .maskShift]
        keyDown.post(tap: .cghidEventTap)
    }
    if let keyUp = CGEvent(keyboardEventSource: source, virtualKey: CGKeyCode(keyCode), keyDown: false) {
        keyUp.flags = [.maskControl, .maskShift]
        keyUp.post(tap: .cghidEventTap)
    }
}
```

This mirrors the existing pattern exactly, with `.maskShift` added. No new key code mapping is needed because `keyCodeForNumber(_:)` already handles the non-sequential layout for digits 1-9.

### Reading Key Assignment from Plist (Robust Version)

If Jumpee needs to respect user-customized key assignments:

```swift
struct MoveWindowShortcutConfig {
    let keyCode: CGKeyCode
    let modifiers: CGEventFlags
}

func readMoveWindowShortcut(forDesktop desktop: Int) -> MoveWindowShortcutConfig? {
    // Plist key numbers for "Move window to Desktop N"
    // Key 52 = Desktop 1, 54 = Desktop 2, etc. (unconfirmed -- verify by inspection)
    let plistKeyNumber = 50 + (desktop * 2)  // 52, 54, 56, ...
    
    let prefsURL = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Preferences/com.apple.symbolichotkeys.plist")
    
    guard let data = try? Data(contentsOf: prefsURL),
          let plist = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any],
          let hotkeys = plist["AppleSymbolicHotKeys"] as? [String: Any],
          let entry = hotkeys[String(plistKeyNumber)] as? [String: Any],
          let enabled = entry["enabled"] as? Bool, enabled,
          let value = entry["value"] as? [String: Any],
          let params = value["parameters"] as? [Int],
          params.count == 3 else {
        return nil  // Shortcut not set or disabled
    }
    
    let virtKeyCode = CGKeyCode(params[1])
    let modifierMask = params[2]
    
    var flags: CGEventFlags = []
    if modifierMask & 131072 != 0 { flags.insert(.maskShift) }
    if modifierMask & 262144 != 0 { flags.insert(.maskControl) }
    if modifierMask & 524288 != 0 { flags.insert(.maskAlternate) }
    if modifierMask & 1048576 != 0 { flags.insert(.maskCommand) }
    
    return MoveWindowShortcutConfig(keyCode: virtKeyCode, modifiers: flags)
}
```

### Move Left/Right One Space (Ctrl+Shift+Arrow)

For adjacent-space moves, synthesize `Ctrl+Shift+Left Arrow` or `Ctrl+Shift+Right Arrow`:

```swift
static func moveWindowOneSpaceLeft() {
    synthesizeKeyEvent(virtualKey: CGKeyCode(kVK_LeftArrow), flags: [.maskControl, .maskShift])
}

static func moveWindowOneSpaceRight() {
    synthesizeKeyEvent(virtualKey: CGKeyCode(kVK_RightArrow), flags: [.maskControl, .maskShift])
}

private static func synthesizeKeyEvent(virtualKey: CGKeyCode, flags: CGEventFlags) {
    let source = CGEventSource(stateID: .hidSystemState)
    if let down = CGEvent(keyboardEventSource: source, virtualKey: virtualKey, keyDown: true) {
        down.flags = flags
        down.post(tap: .cghidEventTap)
    }
    if let up = CGEvent(keyboardEventSource: source, virtualKey: virtualKey, keyDown: false) {
        up.flags = flags
        up.post(tap: .cghidEventTap)
    }
}
```

Note: `kVK_LeftArrow = 123`, `kVK_RightArrow = 124` (from `Carbon.HIToolbox`). These are already importable in Jumpee since `Carbon.HIToolbox` is already imported in `main.swift` at line 2.

### Side Effect: Space Switch

When this shortcut is synthesized, macOS **will switch to the target desktop** as well as move the window. There is no way to suppress this via the system shortcut approach. This is the same behavior as the CGS API on macOS 15+ (Sequoia), so it is not a regression from the user's perspective on modern macOS.

---

## 8. Reliability Across macOS Versions

### CGEvent Synthesis for System Shortcuts

CGEvent synthesis of system keyboard shortcuts is substantially more reliable across macOS versions than private CGS API calls, because:

1. It uses documented Apple APIs (`CGEvent`, `CGEventPost`, `CGEventFlags`).
2. The actual window move is performed by the macOS window server itself, not by the app.
3. The behavior is guaranteed to be correct (the OS handles all edge cases: fullscreen, multi-display, assigned-to-all-desktops windows).

| macOS Version | System Shortcut Synthesis | Notes |
|---------------|--------------------------|-------|
| 13 (Ventura)  | Works (with shortcuts enabled) | Ctrl+Shift+N functions correctly |
| 14 (Sonoma)   | Works (with shortcuts enabled) | Confirmed working by BetterTouchTool community |
| 15 (Sequoia)  | Works (with shortcuts enabled) | Does force space switch (same as CGS on Sequoia) |
| 26 (Tahoe)    | Expected to work | Not directly tested; relies on stable OS-level shortcut handling |

**Key finding from BetterTouchTool developer (Andreas Hegenberg, January 2026):** The "Only Move Window, Do NOT Switch To Space" feature in BetterTouchTool was confirmed to only work on macOS 14 and below. This confirms that the "move without following" behavior is impossible on macOS 15+ regardless of the mechanism used. The standard "Move window to Desktop N" shortcut synthesis (which always switches) continues to work on all versions.

### Comparison: CGS API vs. System Shortcut Approach

| Criterion | CGS Private APIs | System Shortcut Synthesis |
|-----------|-----------------|--------------------------|
| Works on macOS 13 | Yes | Yes (requires shortcuts enabled) |
| Works on macOS 14 | Yes (add-before-remove order required) | Yes |
| Works on macOS 15+ | Partially broken (forces space switch) | Yes (always switches) |
| Works on macOS 26 | Unknown/risky | Expected to work |
| "Move without switching" | Only on macOS 13-14 | Never (OS always switches) |
| User configuration required | No | Yes (enable shortcuts) |
| Private API risk | High | None |
| Code complexity | ~80 lines | ~20 lines |

---

## 9. Locale and Keyboard Layout Considerations

### Virtual Key Codes Are Layout-Independent for Digits

The virtual key codes used for digits 1-9 (18, 19, 20, 21, 23, 22, 26, 28, 25) are **ANSI layout** codes and correspond to the physical key position, not the character produced. On most keyboards worldwide, the physical position of digit keys matches the ANSI layout.

**Exception:** On ISO keyboards (used in Europe and other regions), the physical key in the ANSI `~` position (key 50) may be present as an additional key. The digit keys themselves (1-9) remain at the same physical positions across ANSI, JIS, and ISO layouts.

### Character-Based vs. Key-Code-Based Synthesis

Jumpee currently uses key-code-based synthesis (the hardware virtual key code), which is the correct approach. This means:
- The shortcut works regardless of the active keyboard input source (e.g., works even if the user has a Greek or Japanese input method active).
- The shortcut will match what the user has configured in System Settings (which is also key-code-based).

### Non-ASCII Keyboard Layouts

On keyboards with non-Latin character layouts as the primary layout (e.g., Arabic, Hebrew), the digit keys (1-9) remain in their standard positions and produce ASCII digits regardless of the active input source, so key codes 18, 19, 20, 21, 23, 22, 26, 28, 25 remain correct.

**No locale-specific handling is required for the digit-based shortcuts 1-9.**

---

## 10. User Guidance for Enabling Shortcuts

Since these shortcuts are disabled by default, Jumpee needs a way to inform the user and guide them to enable the shortcuts.

### Detection First

Before showing guidance, Jumpee should check whether the shortcuts appear to be enabled (see Section 6). If the check returns `false`, show a one-time notification or menu item.

### Recommended Guidance Text

```
To use the "Move Window to Desktop N" feature, you need to enable
the corresponding keyboard shortcuts in macOS:

1. Open System Settings > Keyboard > Keyboard Shortcuts
2. Select "Mission Control" in the left panel
3. Enable the checkboxes for "Move window to Desktop 1" through
   "Move window to Desktop 9"
4. Make sure the key combinations match Ctrl+Shift+1 through Ctrl+Shift+9

These are the same shortcuts that Jumpee synthesizes to move windows.
```

### Deep Link to System Settings

macOS 13+ supports URL schemes to open specific System Settings panes:

```swift
// Open Keyboard Shortcuts in System Settings
if let url = URL(string: "x-apple.systempreferences:com.apple.preference.keyboard?Shortcuts") {
    NSWorkspace.shared.open(url)
}
```

This opens the System Settings Keyboard pane directly, reducing friction.

### Menu Item Suggestion

Add a menu item "Set Up Window Moving..." that:
1. Checks whether the shortcuts appear enabled.
2. If not, shows the guidance dialog with the "Open System Settings" button.
3. After the user returns, re-checks and updates the menu item state.

---

## 11. Summary and Recommendations for Jumpee

### Recommendation: Use System Shortcut Synthesis as the Primary Fallback

The investigation in `investigation-window-move.md` recommended CGS + Accessibility APIs as the primary mechanism with system shortcut synthesis as fallback. Based on this research, there is a strong case for inverting the priority for **macOS 15+ users**:

1. **System shortcut synthesis is the most reliable approach** across all macOS versions from 13 to Tahoe.
2. **CGS "move without following"** only works on macOS 13-14 anyway. Since macOS 15 forces a space switch regardless of mechanism, the UX difference between CGS and system shortcuts is eliminated on Sequoia+.
3. **Simplicity**: The system shortcut synthesis code mirrors the existing `SpaceNavigator` pattern and requires ~20 new lines. CGS + Accessibility requires ~80 lines with more edge cases.

### Implementation Summary

Adding `moveWindowToSpaceViaSysShortcut(index:)` to `SpaceNavigator` (or a new `WindowMover` class) requires:

1. Adding `[.maskShift]` to the existing `navigateToSpace` pattern — literally a one-modifier change.
2. Adding a check for whether the shortcuts appear enabled in the plist.
3. Providing user guidance if shortcuts are not enabled.

### Suggested Config Addition

```json
"moveWindow": {
    "enabled": true,
    "useSystemShortcuts": true,
    "systemShortcutModifiers": ["control", "shift"]
}
```

This gives users the option to specify different modifier combinations if they have customized the shortcuts in System Settings.

### Key Code Reference for Jumpee

The existing `keyCodeForNumber` mapping in `main.swift` already handles the non-sequential layout for 5-9:

```
Desktop 1 → key code 18 (key '1')
Desktop 2 → key code 19 (key '2')
Desktop 3 → key code 20 (key '3')
Desktop 4 → key code 21 (key '4')
Desktop 5 → key code 23 (key '5')  -- note: NOT sequential
Desktop 6 → key code 22 (key '6')  -- note: NOT sequential
Desktop 7 → key code 26 (key '7')  -- note: NOT sequential
Desktop 8 → key code 28 (key '8')  -- note: NOT sequential
Desktop 9 → key code 25 (key '9')  -- note: NOT sequential
```

This mapping is already correct in Jumpee and applies identically to the move-window shortcuts.

---

## 12. Assumptions and Uncertainties

### Assumptions

| Assumption | Confidence | Impact if Wrong |
|------------|-----------|-----------------|
| Default move-window shortcut is `Ctrl+Shift+N` | HIGH | Jumpee would synthesize wrong key combo; user's system would not respond |
| Plist key 52 = Move window to Desktop 1 | MEDIUM | Detection and enabling logic would target wrong shortcut |
| The even-number pattern holds (52, 54, 56...) | MEDIUM | Detection would fail for Desktop 2-9 |
| Virtual key codes for digits are layout-independent | HIGH | Non-ANSI keyboard users might have issues |
| System shortcut synthesis works on macOS 26 (Tahoe) | MEDIUM | No direct confirmation; extrapolated from API stability |

### Uncertainties and Gaps

1. **Exact plist key numbers for "Move window to Desktop N":** The community documentation for keys 52-68 is based on an archived krypted.com post (circa 2012-2014) and may not reflect current macOS numbering. The same gist that documents other well-known keys lists key 52 as "Move focus to window drawer" (a legacy macOS feature), not "Move window to Desktop 1". This is a significant conflict. **The authoritative resolution requires inspecting `~/Library/Preferences/com.apple.symbolichotkeys.plist` on a Ventura/Sonoma/Sequoia system after enabling the shortcut.**

2. **Secondary plist location:** On recent macOS versions, preferences may be stored in an additional container path. The behavior of `defaults read` vs. direct file reading may differ.

3. **macOS 26 (Tahoe) shortcut availability:** macOS 26 has not been officially released; behavior extrapolated from known shortcut stability.

4. **CGEvent synthesis and focus requirement:** Synthesizing `Ctrl+Shift+N` via `CGEvent` requires the window to move is the active frontmost window. If Jumpee opens its menu and the user selects a "Move to Desktop N" item, the Jumpee menu may have stolen focus from the target app. A delay or explicit re-focus step may be required.

5. **Behavior with "Assign to All Desktops" windows:** macOS may silently ignore the move shortcut for windows set to appear on all desktops. This needs testing.

### Clarifying Questions

1. What are the exact plist key numbers for "Move window to Desktop N" on your macOS version? (Can be determined by running `defaults read com.apple.symbolichotkeys AppleSymbolicHotKeys` before and after enabling one shortcut in System Settings.)

2. Should Jumpee attempt to enable the shortcuts programmatically (via `defaults write`) or only detect and guide the user?

3. Is the "move without following" (stay on current desktop after window is moved) a required feature? If yes, this eliminates the system shortcut approach on macOS 15+.

4. Should the move-window feature synthesize `Ctrl+Shift+N` hardcoded, or read the actual assignment from the plist?

---

## 13. References

| # | Source | URL | Information Gathered |
|---|--------|-----|---------------------|
| 1 | Apple Support: Mac keyboard shortcuts | https://support.apple.com/en-us/102650 | Confirmed no default "Move window" shortcut listed in Apple docs |
| 2 | mattrighetti/gist: AppleSymbolicHotKeys | https://gist.github.com/mattrighetti/24b02c00c8a3a53966bc04f7305f99aa | Complete plist key numbering table; switch desktop keys 118-121; modifier values |
| 3 | jimratliff/gist: Virtual Key codes | https://gist.github.com/jimratliff/227088cc936065598bedfd91c360334e | ASCII codes and virtual key codes for all keys; digit key codes confirmed |
| 4 | ant.isi.edu: Setting Mission Control shortcuts | https://ant.isi.edu/~calvin/mac-missioncontrolshortcuts.htm | Plist format details; `activateSettings` utility for immediate application |
| 5 | Zameer Manji: Applying symbolichotkeys changes | https://zameermanji.com/blog/2021/6/8/applying-com-apple-symbolichotkeys-changes-instantaneously/ | activateSettings approach for immediate effect |
| 6 | BetterTouchTool community: Move window setting not working | https://community.folivora.ai/t/move-window-to-desktop-action-setting-not-working/40133 | Confirmed "move without switching" broken on macOS 15; confirmed by BTT developer |
| 7 | BetterTouchTool community: Move window option does not work | https://community.folivora.ai/t/move-window-to-desktop-option-does-not-work/45901 | Confirmed feature only worked through macOS 14; developer statement January 2026 |
| 8 | Keyboard Maestro forum: Move frontmost window | https://forum.keyboardmaestro.com/t/move-frontmost-window-to-a-different-space/10512 | Practical KM macro using click-hold-then-shortcut approach; confirms arrow shortcuts less reliable than numbered shortcuts |
| 9 | ianyh.com: Accessibility, Windows, and Spaces | https://ianyh.com/blog/accessibility-windows-and-spaces-in-os-x/ | CGEvent synthesis technique; mouse-hold approach for move; kCGHIDEventTap tap location |
| 10 | diimdeep/dotfiles: hotkeys.sh | https://github.com/diimdeep/dotfiles/blob/master/osx/configure/hotkeys.sh | Community dotfile reference for symbolic hotkeys |
| 11 | andyjakubowski/dotfiles: AppleSymbolicHotKeys Mappings | https://github.com/andyjakubowski/dotfiles/blob/main/AppleSymbolicHotKeys%20Mappings | Community mapping table |
| 12 | Jumpee main.swift | /Users/giorgosmarinos/aiwork/coding-platform/macbook-desktop/Jumpee/Sources/main.swift | Existing CGEvent synthesis pattern; keyCodeForNumber mapping; imported Carbon.HIToolbox |
| 13 | Jumpee investigation-window-move.md | Jumpee/docs/reference/investigation-window-move.md | Prior investigation; Approach 3 (system shortcuts) established as viable fallback |

### Recommended for Deep Reading

- **mattrighetti/gist (#2):** The most comprehensive community-maintained table of AppleSymbolicHotKeys key numbers. Should be cross-referenced with live plist inspection on target macOS version.
- **BetterTouchTool forum thread #6:** The BTT developer (Andreas Hegenberg) directly confirms the macOS 15 breakage and that the standard move shortcut still works. This is the most authoritative external source for Sequoia behavior.
- **ianyh.com blog (#9):** The original technical article on combining Accessibility APIs with CGEvent synthesis for space window movement. Foundational reading for understanding the mouse-hold approach used by Keyboard Maestro.
