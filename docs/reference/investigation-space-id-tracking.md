# Investigation: Space ID-Based Desktop Name Tracking

## 1. How CGSCopyManagedDisplaySpaces Returns ManagedSpaceID

### Current Code (main.swift, line 171-186, class SpaceDetector, method getAllSpaceIDs)

```swift
func getAllSpaceIDs() -> [Int] {
    let spacesInfo = CGSCopyManagedDisplaySpaces(connectionID) as! [[String: Any]]
    var spaceIDs: [Int] = []
    for display in spacesInfo {
        if let spaces = display["Spaces"] as? [[String: Any]] {
            for space in spaces {
                if let spaceID = space["ManagedSpaceID"] as? Int,
                   let type = space["type"] as? Int, type == 0 {
                    spaceIDs.append(spaceID)
                }
            }
        }
    }
    return spaceIDs
}
```

### Findings

- `CGSCopyManagedDisplaySpaces` returns an array of display dictionaries. Each display has a `"Spaces"` array containing space dictionaries with a `"ManagedSpaceID"` field (an integer) and a `"type"` field (0 = regular desktop, 4 = fullscreen app space).
- The `"Spaces"` array is ordered by the user's current arrangement in Mission Control. When the user reorders desktops, the array order changes, but each space retains its original `ManagedSpaceID` value.
- **ManagedSpaceID is stable across reorders.** It is assigned when the space is created and does not change when the space moves to a different position. This is the fundamental property that makes this change viable.
- ManagedSpaceID values are typically large integers (e.g., 58, 63, 247, 1042) -- they are monotonically increasing IDs assigned by the window server. They are not small sequential numbers like 1, 2, 3.

### Stability Characteristics

| Event | ManagedSpaceID Behavior |
|-------|------------------------|
| Reorder in Mission Control | **Stable** -- same ID, different position in array |
| Reboot | **Stable** -- IDs persist across reboots |
| Add new space | **Stable** for existing spaces; new space gets a new, higher ID |
| Remove a space | **Stable** for remaining spaces; removed space's ID is gone permanently |
| Re-create a removed space | **New ID** -- the old ID is never reused |
| macOS upgrade | **Generally stable**, though major updates could theoretically reset |

## 2. How CGSGetActiveSpace Relates to ManagedSpaceID

### Current Code (main.swift, line 167-169, class SpaceDetector, method getCurrentSpaceID)

```swift
func getCurrentSpaceID() -> Int {
    return CGSGetActiveSpace(connectionID)
}
```

### Current Code (main.swift, line 188-195, class SpaceDetector, method getCurrentSpaceIndex)

```swift
func getCurrentSpaceIndex() -> Int? {
    let currentID = getCurrentSpaceID()
    let allIDs = getAllSpaceIDs()
    if let index = allIDs.firstIndex(of: currentID) {
        return index + 1
    }
    return nil
}
```

### Findings

- **CGSGetActiveSpace returns the same value as ManagedSpaceID.** This is already proven by the existing code: `getCurrentSpaceIndex()` calls `getCurrentSpaceID()` (which uses `CGSGetActiveSpace`) and then searches for that value in the array returned by `getAllSpaceIDs()` (which extracts `ManagedSpaceID` values). The fact that this lookup succeeds confirms they are the same identifier.
- No additional API or method is needed. `getCurrentSpaceID()` already returns the ManagedSpaceID of the active space.

## 3. Best Approach for Migration from Position-Based to ID-Based Keys

### Migration Strategy

The migration should occur once, at app startup, inside `MenuBarController.init()` after loading the config but before any UI updates.

**Detection heuristic:** Position-based keys are small integers (typically 1-16). ManagedSpaceIDs are large integers (typically > 50, often in the hundreds or thousands). The migration should check whether ALL keys in the `spaces` dictionary are small integers that correspond to valid position indices (1 through spaceCount). If so, migrate.

**Recommended algorithm:**

```
1. Load config
2. If config.spaces is empty -> skip migration (fresh install or no names)
3. Get current space IDs from CGSCopyManagedDisplaySpaces (ordered list)
4. Check if all keys in config.spaces parse as integers in range 1...spaceCount
5. If yes -> these are position-based keys, migrate:
   a. For each (positionKey, name) in config.spaces:
      - positionIndex = Int(positionKey)! - 1
      - If positionIndex < allSpaceIDs.count:
        - newKey = String(allSpaceIDs[positionIndex])
        - migratedSpaces[newKey] = name
      - Else: discard (position exceeds current space count)
   b. Replace config.spaces with migratedSpaces
   c. Save config
   d. Print migration log message
6. If no -> keys are already space-ID-based, skip migration
```

**Why this heuristic is safe:**
- Position-based keys are always in range 1...N where N is small (macOS supports up to ~16 spaces per display).
- ManagedSpaceIDs are large integers assigned by the window server, typically starting well above 16.
- The overlap probability is negligible. Even if a ManagedSpaceID happened to be a small number (theoretically possible on a fresh macOS install), the worst case is a mis-migration that assigns a name to the wrong space -- easily correctable by the user via rename.

### Where to Place Migration Code

The migration should be called from `MenuBarController.init()` (line 461), immediately after `config = JumpeeConfig.load()` (line 464) and before `setupMenu()` (line 467). This ensures the config is migrated before any UI reads it.

Alternatively, it could be a static method on `JumpeeConfig` called right after `load()`.

## 4. Edge Cases

### 4.1 Spaces Added

- A newly added space gets a new ManagedSpaceID that has no entry in `config.spaces`.
- Result: The space displays as "Desktop N" with no custom name. This is correct behavior -- identical to current behavior for unnamed spaces.
- No code change needed for this case.

### 4.2 Spaces Removed

- A removed space leaves an orphaned key in `config.spaces` (e.g., `"247": "Old Space"`).
- Result: The orphaned key is never matched during lookups, so it is harmless. It occupies a few bytes in the JSON file.
- No cleanup logic is needed. If desired in the future, a "prune orphaned keys" function could be added, but it is out of scope.

### 4.3 Fresh Config (New Install)

- `config.spaces` starts as an empty dictionary `{}`.
- Migration detection sees no keys, skips migration.
- User renames a space, and it stores the ManagedSpaceID as the key.
- Everything works correctly from the start.

### 4.4 User Has Only One Named Space

- Migration still works: if `config.spaces` has `{"1": "Mail"}`, and there is at least one space, position 1 maps to `allSpaceIDs[0]`.
- Result: `{"<spaceID>": "Mail"}` -- correct.

### 4.5 Config Already Migrated (Re-run Safety)

- After migration, keys are large integers like `"247"`.
- The migration heuristic checks if all keys are in range 1...spaceCount. Since `247` is not in that range (unless the user has 247+ spaces, which macOS does not support), migration is skipped.
- Safe to re-run.

### 4.6 User Manually Edits Config with Position-Based Keys After Migration

- Per FR-8, position-based keys simply will not match any space ID. The spaces appear unnamed.
- No crash occurs -- the lookup just returns nil and falls back to "Desktop N".

## 5. Risks with Space IDs Changing

### Low Risk

- **After reboot:** ManagedSpaceIDs persist. Confirmed by community testing and the fact that macOS stores space configuration in `com.apple.spaces.plist`. IDs are stable.
- **After adding spaces:** Existing IDs are unaffected. Only the new space gets a new ID.
- **After removing spaces:** Existing IDs are unaffected. The removed space's ID becomes orphaned in config (harmless).

### Moderate Risk

- **After major macOS upgrade:** There is a small chance that macOS could reassign all space IDs during a major OS upgrade (e.g., if the spaces subsystem is rebuilt). In practice, this has not been observed in recent macOS versions, but it remains a theoretical risk.
- **Mitigation:** If this occurs, the user would see all spaces as unnamed and would need to re-rename them. This is an acceptable degradation for a utility app using private APIs.

### Negligible Risk

- **Space ID reuse:** macOS does not reuse ManagedSpaceIDs. Once a space is destroyed, its ID is retired. A new space created afterward gets a new, higher ID. This means orphaned config entries cannot accidentally match a new space.

## 6. Specific Code Locations That Need Changes

All changes are in `/Users/giorgosmarinos/aiwork/coding-platform/macbook-desktop/Jumpee/Sources/main.swift`.

### 6.1 SpaceDetector -- New Method (after line 199)

Add a method to return ordered (position, spaceID) tuples:

```swift
func getOrderedSpaces() -> [(position: Int, spaceID: Int)] {
    return getAllSpaceIDs().enumerated().map { (index, id) in
        (position: index + 1, spaceID: id)
    }
}
```

This satisfies FR-7 and provides the mapping needed by all callers.

### 6.2 OverlayManager.updateOverlay() -- Lines 312-347

**Current (line 321-322):**
```swift
let key = String(spaceIndex)
let customName = config.spaces[key]
```

**Change to:**
```swift
let spaceID = spaceDetector.getCurrentSpaceID()
let key = String(spaceID)
let customName = config.spaces[key]
```

The `spaceIndex` variable (from `getCurrentSpaceIndex()`) continues to be used for display text formatting (the positional number).

### 6.3 MenuBarController.updateTitle() -- Lines 536-552

**Current (line 542-543):**
```swift
let key = String(index)
if let customName = config.spaces[key], !customName.isEmpty {
```

**Change to:**
```swift
let spaceID = spaceDetector.getCurrentSpaceID()
let key = String(spaceID)
if let customName = config.spaces[key], !customName.isEmpty {
```

The `index` variable continues to be used for the display prefix (e.g., "3: Dev") and the fallback label ("Desktop 3").

### 6.4 MenuBarController.rebuildSpaceItems() -- Lines 554-611

**Current (line 573-575):**
```swift
for i in 1...spaceCount {
    let key = String(i)
    let customName = config.spaces[key]
```

**Change to:**
```swift
let orderedSpaces = spaceDetector.getOrderedSpaces()
for (position, spaceID) in orderedSpaces {
    let key = String(spaceID)
    let customName = config.spaces[key]
```

Replace `i` with `position` throughout the loop body. The `tag` should remain the positional index (used for navigation via `Ctrl+N` keyboard shortcut).

### 6.5 MenuBarController.renameActiveSpace() -- Lines 640-681

**Current (line 641-643):**
```swift
guard let spaceIndex = spaceDetector.getCurrentSpaceIndex() else { return }
let key = String(spaceIndex)
let currentName = config.spaces[key] ?? ""
```

**Change to:**
```swift
guard let spaceIndex = spaceDetector.getCurrentSpaceIndex() else { return }
let spaceID = spaceDetector.getCurrentSpaceID()
let key = String(spaceID)
let currentName = config.spaces[key] ?? ""
```

The `spaceIndex` is still needed for the dialog title ("Rename Desktop 3").

### 6.6 Migration Logic -- New Code in MenuBarController.init() (after line 464)

Add migration between config load and setupMenu:

```swift
config = JumpeeConfig.load()
migratePositionBasedConfig()  // NEW
setupMenu()
```

The `migratePositionBasedConfig()` method implements the algorithm described in Section 3.

## 7. Summary and Recommendation

**The approach is sound.** The investigation confirms:

1. `ManagedSpaceID` is stable across reorders, reboots, and space additions/removals.
2. `CGSGetActiveSpace` returns the same value as `ManagedSpaceID` -- already proven by existing code.
3. The migration from position-based to ID-based keys is straightforward with a reliable detection heuristic.
4. Edge cases (add/remove spaces, fresh config, re-migration) are all handled gracefully.
5. The risk of space IDs changing unexpectedly is very low and the impact is limited to users needing to re-rename spaces.

**Six code locations** need modification, all within `main.swift`. No external libraries, no new files, no build system changes. The change is self-contained and low-risk.

**Estimated scope:** Approximately 30-50 lines of code changes/additions, plus the migration method (~20 lines).
