# Codebase Scan: Space ID-Based Desktop Name Tracking

Date: 2026-03-22

## 1. Project Structure

```
Jumpee/
  Sources/main.swift              # Single-file Swift app (743 lines)
  build.sh                        # Build script
  build/Jumpee.app/               # Compiled .app bundle
  README.md
  Issues - Pending Items.md
  .gitignore
  docs/
    design/
      project-design.md
      configuration-guide.md
      plan-001-spacenamer-menu-bar-app.md
    reference/
      refined-request-space-id-tracking.md
      codebase-scan-space-id-tracking.md   # (this file)
```

All application logic lives in `Jumpee/Sources/main.swift`. There is no Package.swift -- the project is compiled directly via `build.sh`.

---

## 2. Key Classes/Structs and Responsibilities

| Type | Kind | Lines | Responsibility |
|------|------|-------|----------------|
| `OverlayConfig` | struct | 18-38 | Codable model for overlay appearance settings (opacity, font, position, color, margin). |
| `HotkeyConfig` | struct | 40-89 | Codable model for global hotkey binding. Provides `keyCode`, `carbonModifiers`, and `displayString` computed properties. |
| `JumpeeConfig` | struct | 91-122 | Top-level config model. Contains `spaces: [String: String]` dictionary, `showSpaceNumber`, overlay and hotkey sub-configs. Handles `load()` and `save()` to `~/.Jumpee/config.json`. |
| `NSColor.fromHex` | extension | 126-139 | Hex color string parser. |
| `fontWeight(from:)` | function | 143-156 | Maps string names to `NSFont.Weight`. |
| `SpaceDetector` | class | 160-200 | Wraps private CGS APIs to detect active space and enumerate all spaces. |
| `OverlayWindow` | class | 204-300 | Custom borderless `NSWindow` that renders a text label on the desktop. |
| `OverlayManager` | class | 304-348 | Manages a single `OverlayWindow` instance; resolves display text from config and updates the overlay. |
| `SpaceNavigator` | class | 352-389 | Static methods to navigate to a space by index (simulates Ctrl+N keypress) and check accessibility permissions. |
| `GlobalHotkeyManager` | class | 402-449 | Registers/unregisters a Carbon global hotkey to open the Jumpee menu. |
| `MenuBarController` | class | 453-723 | Central controller. Creates the NSStatusItem, builds the dropdown menu, handles space-change notifications, rename flow, config reload. Conforms to `NSMenuDelegate`. |
| `AppDelegate` | class | 727-734 | Minimal app delegate; instantiates `MenuBarController` on launch. |

---

## 3. How Space IDs Are Currently Used -- SpaceDetector

`SpaceDetector` (lines 160-200) wraps three private CGS functions:

- **`CGSMainConnectionID()`** -- gets the connection ID (stored once in `init`).
- **`CGSGetActiveSpace(cid)`** -- returns the active space's `ManagedSpaceID` as an `Int`.
- **`CGSCopyManagedDisplaySpaces(cid)`** -- returns an array of display dictionaries, each containing a `"Spaces"` array with entries like `{"ManagedSpaceID": Int, "type": Int, ...}`.

### Key methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getCurrentSpaceID()` | `Int` | Calls `CGSGetActiveSpace`. Returns the raw `ManagedSpaceID` of the active space. |
| `getAllSpaceIDs()` | `[Int]` | Iterates all displays, collects `ManagedSpaceID` values where `type == 0` (user desktops, excludes fullscreen spaces). Returns them in display-order. |
| `getCurrentSpaceIndex()` | `Int?` | Finds `getCurrentSpaceID()` within `getAllSpaceIDs()` and returns **1-based position**. This is where space ID is converted to ordinal position. |
| `getSpaceCount()` | `Int` | Returns `getAllSpaceIDs().count`. |

**Key observation**: `getCurrentSpaceID()` already returns the `ManagedSpaceID` directly. The `getCurrentSpaceIndex()` method is the one that converts it to a positional index. Both the menu bar title and overlay currently call `getCurrentSpaceIndex()` and never use `getCurrentSpaceID()` directly.

---

## 4. How Config Keys Are Stored and Looked Up

### JumpeeConfig.spaces dictionary (line 92)

```swift
var spaces: [String: String]   // key = position string ("1","2",...), value = custom name
```

- Loaded from `~/.Jumpee/config.json` via `JSONDecoder` (line 102-104).
- Saved via `JSONEncoder` with pretty-printing and sorted keys (lines 114-121).
- Default is an empty dictionary `[:]` (line 107).

### Current key format

Keys are **positional index strings**: `"1"`, `"2"`, `"3"`, etc. They are derived from `getCurrentSpaceIndex()` which returns a 1-based ordinal position.

### All write points to `config.spaces`

| Location | Method | Line | Key used |
|----------|--------|------|----------|
| `MenuBarController` | `renameActiveSpace()` | 642, 668, 671 | `String(spaceIndex)` where `spaceIndex = getCurrentSpaceIndex()` |

### All read points from `config.spaces`

| Location | Method | Line | Key used |
|----------|--------|------|----------|
| `MenuBarController` | `updateTitle()` | 542 | `String(index)` where `index = getCurrentSpaceIndex()` |
| `OverlayManager` | `updateOverlay()` | 321 | `String(spaceIndex)` where `spaceIndex = getCurrentSpaceIndex()` |
| `MenuBarController` | `rebuildSpaceItems()` | 574 | `String(i)` where `i` is loop counter `1...spaceCount` |

---

## 5. Where Position-Based Lookups Occur

### 5.1 MenuBarController.updateTitle() -- lines 536-552

```swift
guard let index = spaceDetector.getCurrentSpaceIndex() else { ... }
let key = String(index)
if let customName = config.spaces[key], !customName.isEmpty { ... }
```

Uses positional index as the dictionary key. The index is also used for the display prefix (`"\(index): \(customName)"`) and fallback (`"Desktop \(index)"`).

**Change needed**: Look up by space ID; keep positional index for display only.

### 5.2 OverlayManager.updateOverlay() -- lines 312-342

```swift
guard let spaceIndex = spaceDetector.getCurrentSpaceIndex() else { return }
let key = String(spaceIndex)
let customName = config.spaces[key]
```

Same pattern as `updateTitle()`. Uses positional index for both lookup and display text.

**Change needed**: Look up by space ID; keep positional index for display formatting.

### 5.3 MenuBarController.rebuildSpaceItems() -- lines 554-611

```swift
for i in 1...spaceCount {
    let key = String(i)
    let customName = config.spaces[key]
    ...
    displayName = "Desktop \(i) - \(name)"
    ...
}
```

Iterates by position `1..spaceCount`. Uses the loop counter directly as the config key. Does not have access to the space ID at each position.

**Change needed**: Get the ordered list of space IDs from `SpaceDetector`, use `spaceIDs[i-1]` as the dictionary key, keep `i` for the display label "Desktop N".

### 5.4 MenuBarController.renameActiveSpace() -- lines 640-681

```swift
guard let spaceIndex = spaceDetector.getCurrentSpaceIndex() else { return }
let key = String(spaceIndex)
...
config.spaces[key] = newName
```

Stores the custom name keyed by positional index.

**Change needed**: Use `getCurrentSpaceID()` as the key. Keep `spaceIndex` for the dialog title "Rename Desktop N".

---

## 6. Integration Points for the Space-ID Change

### 6.1 SpaceDetector API extension (FR-7)

Need to add a method that returns ordered `(position: Int, spaceID: Int)` tuples. This is straightforward -- `getAllSpaceIDs()` already returns IDs in positional order; just zip with indices.

Suggested addition:
```swift
func getSpaceIDAtIndex(_ index: Int) -> Int?   // 1-based
func getOrderedSpaces() -> [(position: Int, spaceID: Int)]
```

`getCurrentSpaceID()` already returns `ManagedSpaceID` -- confirmed by the fact that `getCurrentSpaceIndex()` searches `getAllSpaceIDs()` (which collects `ManagedSpaceID` values) for the result of `getCurrentSpaceID()`.

### 6.2 Config key migration (FR-6)

Add a static method to `JumpeeConfig` or a standalone function that:
1. Checks if existing `spaces` keys are small integers (say, < 100) that do not appear in `getAllSpaceIDs()`.
2. Maps position N to `getAllSpaceIDs()[N-1]`.
3. Rewrites the dictionary.
4. Saves and logs.

Should run once in `MenuBarController.init()` after loading config.

### 6.3 Summary of code changes by location

| File | Line range | What changes |
|------|-----------|--------------|
| `main.swift` | 160-200 (`SpaceDetector`) | Add `getOrderedSpaces()` method |
| `main.swift` | 91-122 (`JumpeeConfig`) | Add migration logic (new static method) |
| `main.swift` | 536-552 (`updateTitle`) | Change key from `String(index)` to `String(spaceID)` |
| `main.swift` | 312-342 (`updateOverlay`) | Change key from `String(spaceIndex)` to `String(spaceID)` |
| `main.swift` | 554-611 (`rebuildSpaceItems`) | Get space IDs array, use `spaceIDs[i-1]` as key |
| `main.swift` | 640-681 (`renameActiveSpace`) | Change key from `String(spaceIndex)` to `String(spaceID)` |
| `main.swift` | 461-478 (`MenuBarController.init`) | Call migration after loading config |

### 6.4 Risk areas

- **`rebuildSpaceItems`** is the most complex change because it loops by position and must now also resolve space IDs at each position.
- **Migration** must handle edge cases: more config entries than current spaces, spaces that have been destroyed, fresh installs with empty config.
- **`OverlayManager`** holds its own `SpaceDetector` reference but needs both space ID (for lookup) and position index (for display). Currently it only calls `getCurrentSpaceIndex()`. After the change, it needs both values -- either two calls or a combined method.

### 6.5 No-change areas

- `OverlayWindow` -- purely visual, no config interaction.
- `SpaceNavigator` -- navigates by position index (Ctrl+N), unrelated to naming.
- `GlobalHotkeyManager` -- hotkey registration, unrelated.
- `HotkeyConfig`, `OverlayConfig` -- sub-configs, unaffected.
- `build.sh`, `Info.plist` -- no changes needed.
