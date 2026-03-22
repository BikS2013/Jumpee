# Plan 002: Space ID-Based Desktop Name Tracking

## Objective

Convert Jumpee from position-based space naming (keys "1", "2", "3") to ManagedSpaceID-based naming (keys "58", "63", "247"), so that custom desktop names follow the desktop content when the user reorders spaces in Mission Control.

## Scope

All changes are in a single file: `Jumpee/Sources/main.swift` (currently 743 lines). No changes to `build.sh`, `Info.plist`, or project structure.

## Requirements Reference

- Full requirements: `docs/reference/refined-request-space-id-tracking.md`
- Codebase analysis: `docs/reference/codebase-scan-space-id-tracking.md`
- Investigation: `docs/reference/investigation-space-id-tracking.md`

## Prerequisites

- ManagedSpaceID is stable across reorders and reboots (confirmed by investigation).
- `CGSGetActiveSpace()` returns the same identifier as `ManagedSpaceID` (confirmed by existing code in `getCurrentSpaceIndex()` which searches `getAllSpaceIDs()` for `getCurrentSpaceID()`).
- ManagedSpaceID values are large integers (typically >50), clearly distinguishable from position-based keys (1-16).

---

## Implementation Steps

### Step 1: Add `getOrderedSpaces()` to SpaceDetector

**File:** `main.swift`
**Location:** Class `SpaceDetector`, after `getSpaceCount()` (after line 199)
**Satisfies:** FR-7

Add a new method that returns an ordered array of (position, spaceID) tuples:

```swift
func getOrderedSpaces() -> [(position: Int, spaceID: Int)] {
    return getAllSpaceIDs().enumerated().map { (index, id) in
        (position: index + 1, spaceID: id)
    }
}
```

**Rationale:** This method provides a single API call that gives callers both the positional index (for display as "Desktop N") and the space ID (for config key lookup). It wraps `getAllSpaceIDs()` which already returns IDs in Mission Control order.

**Verification:** The method is a pure transformation of `getAllSpaceIDs()` output. No new private API calls. If `getAllSpaceIDs()` works (it does -- it is used throughout the app), this will work.

---

### Step 2: Add Migration Logic

**File:** `main.swift`
**Location:** New private method `migratePositionBasedConfig()` on `MenuBarController`, called from `init()` between `config = JumpeeConfig.load()` (line 464) and `setupMenu()` (line 467).
**Satisfies:** FR-6

**Migration algorithm:**

1. If `config.spaces` is empty, skip (fresh install or no names set).
2. Get `allSpaceIDs` from `spaceDetector.getAllSpaceIDs()`.
3. Let `spaceCount = allSpaceIDs.count`.
4. Check if ALL keys in `config.spaces` parse as integers in the range `1...spaceCount`. If any key does not parse as an integer, or parses to a value outside `1...spaceCount`, skip migration (keys are already space-ID-based or manually edited).
5. If the check passes, build a new dictionary: for each `(positionKey, name)`, compute `newKey = String(allSpaceIDs[Int(positionKey)! - 1])` and set `migratedSpaces[newKey] = name`.
6. Replace `config.spaces` with `migratedSpaces`.
7. Call `config.save()`.
8. Print a log message: `"[Jumpee] Migrated \(migratedSpaces.count) space name(s) from position-based to space-ID-based keys."`.

**Code outline:**

```swift
private func migratePositionBasedConfig() {
    guard !config.spaces.isEmpty else { return }

    let allSpaceIDs = spaceDetector.getAllSpaceIDs()
    let spaceCount = allSpaceIDs.count
    guard spaceCount > 0 else { return }

    // Check if all keys are position-based (integers in 1...spaceCount)
    let allPositionBased = config.spaces.keys.allSatisfy { key in
        guard let pos = Int(key) else { return false }
        return pos >= 1 && pos <= spaceCount
    }

    guard allPositionBased else { return }

    // Migrate
    var migratedSpaces: [String: String] = [:]
    for (positionKey, name) in config.spaces {
        let positionIndex = Int(positionKey)! - 1
        if positionIndex < allSpaceIDs.count {
            let newKey = String(allSpaceIDs[positionIndex])
            migratedSpaces[newKey] = name
        }
    }

    config.spaces = migratedSpaces
    config.save()
    print("[Jumpee] Migrated \(migratedSpaces.count) space name(s) from position-based to space-ID-based keys.")
}
```

**Edge cases handled:**
- Empty config: skipped (guard at top).
- More config entries than spaces: impossible because the `allSatisfy` check ensures all keys are in `1...spaceCount`.
- Already migrated: large-integer keys fail the `1...spaceCount` range check, so migration is skipped.
- Re-run safety: after migration, keys are large integers, so the check fails and migration does not re-run.

**Call site in `init()`:**

```swift
config = JumpeeConfig.load()
overlayManager = OverlayManager(spaceDetector: spaceDetector)
super.init()
migratePositionBasedConfig()   // NEW -- must be after super.init() since it's a private method
setupMenu()
```

Note: `migratePositionBasedConfig()` must be called after `super.init()` because it is an instance method that accesses `self.config` and `self.spaceDetector`.

---

### Step 3: Update `updateTitle()` to Look Up by Space ID

**File:** `main.swift`
**Location:** Method `updateTitle()` in `MenuBarController` (lines 536-552)
**Satisfies:** FR-3

**Current code (lines 542-543):**
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

The `index` variable (from `getCurrentSpaceIndex()`) continues to be used for the display prefix (`"\(index): \(customName)"`) and fallback label (`"Desktop \(index)"`). Only the config lookup key changes.

---

### Step 4: Update `updateOverlay()` to Look Up by Space ID

**File:** `main.swift`
**Location:** Method `updateOverlay()` in `OverlayManager` (lines 312-342)
**Satisfies:** FR-4

**Current code (lines 321-322):**
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

The `spaceIndex` variable continues to be used for display text (`"Desktop \(spaceIndex)"` and `"\(spaceIndex): \(name)"`). Only the config lookup key changes.

---

### Step 5: Update `rebuildSpaceItems()` to Look Up by Space ID

**File:** `main.swift`
**Location:** Method `rebuildSpaceItems()` in `MenuBarController` (lines 554-611)
**Satisfies:** FR-5

**Current code (lines 570-596):**
```swift
let spaceCount = spaceDetector.getSpaceCount()
let currentIndex = spaceDetector.getCurrentSpaceIndex()

for i in 1...spaceCount {
    let key = String(i)
    let customName = config.spaces[key]

    let displayName: String
    if let name = customName, !name.isEmpty {
        displayName = "Desktop \(i) - \(name)"
    } else {
        displayName = "Desktop \(i)"
    }

    let keyEquiv = i <= 9 ? String(i) : ""
    let item = NSMenuItem(title: displayName, action: #selector(navigateToSpace(_:)), keyEquivalent: keyEquiv)
    item.keyEquivalentModifierMask = .command
    item.target = self
    item.tag = i

    if i == currentIndex {
        item.state = .on
    }

    menu.insertItem(item, at: insertIndex)
    spaceMenuItems.append(item)
    insertIndex += 1
}
```

**Change to:**
```swift
let orderedSpaces = spaceDetector.getOrderedSpaces()
let currentIndex = spaceDetector.getCurrentSpaceIndex()

for (position, spaceID) in orderedSpaces {
    let key = String(spaceID)
    let customName = config.spaces[key]

    let displayName: String
    if let name = customName, !name.isEmpty {
        displayName = "Desktop \(position) - \(name)"
    } else {
        displayName = "Desktop \(position)"
    }

    let keyEquiv = position <= 9 ? String(position) : ""
    let item = NSMenuItem(title: displayName, action: #selector(navigateToSpace(_:)), keyEquivalent: keyEquiv)
    item.keyEquivalentModifierMask = .command
    item.target = self
    item.tag = position

    if position == currentIndex {
        item.state = .on
    }

    menu.insertItem(item, at: insertIndex)
    spaceMenuItems.append(item)
    insertIndex += 1
}
```

Key changes:
- Replace `spaceCount` with `orderedSpaces` from the new `getOrderedSpaces()` method.
- Loop over `(position, spaceID)` tuples instead of `1...spaceCount`.
- Use `spaceID` for the config key, `position` for display and navigation tag.

---

### Step 6: Update `renameActiveSpace()` to Store by Space ID

**File:** `main.swift`
**Location:** Method `renameActiveSpace()` in `MenuBarController` (lines 640-681)
**Satisfies:** FR-2

**Current code (lines 641-643):**
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

The `spaceIndex` is retained for the dialog title (`"Rename Desktop \(spaceIndex)"`). The `key` (now space-ID-based) is used for both reading the current name and storing the new name. The rest of the method (lines 665-680) uses `key` which is already a local variable, so no further changes are needed in those lines.

---

### Step 7: Build, Test, Verify

**Build:**
```bash
cd Jumpee && bash build.sh
```

**Test procedure:**

1. **Fresh launch test**: Delete `~/.Jumpee/config.json`, build and launch. Verify all desktops show as "Desktop N". Rename one desktop and verify the config file stores a large-integer key (e.g., `"247": "Mail"`).

2. **Migration test**: Create a position-based config file (`{"spaces": {"1": "Mail", "2": "Dev"}, ...}`), build and launch. Verify:
   - Console shows migration log message.
   - Config file now has space-ID keys.
   - Correct names appear on correct desktops.

3. **Reorder test**: After naming desktops, open Mission Control and drag a desktop to a different position. Verify:
   - The custom name follows the desktop content.
   - Menu bar shows the correct name.
   - Overlay shows the correct name.
   - Menu dropdown shows "Desktop N - Name" with correct associations.

4. **Add/remove space test**: Add a new space. Verify it appears unnamed. Remove a space. Verify remaining spaces keep their names.

5. **Reload config test**: Use "Reload Config" menu item. Verify names still display correctly.

---

## Change Summary

| Step | Location | Lines Affected | Change Type |
|------|----------|---------------|-------------|
| 1 | `SpaceDetector` | After line 199 | New method (~5 lines) |
| 2 | `MenuBarController.init()` | After line 464 | New method call + new method (~25 lines) |
| 3 | `MenuBarController.updateTitle()` | Lines 542-543 | Modify 2 lines |
| 4 | `OverlayManager.updateOverlay()` | Lines 321-322 | Modify 2 lines |
| 5 | `MenuBarController.rebuildSpaceItems()` | Lines 570-596 | Modify ~10 lines |
| 6 | `MenuBarController.renameActiveSpace()` | Lines 641-643 | Modify 2 lines |
| 7 | Build & test | N/A | Verification |

**Total estimated change:** ~45 lines modified/added. No lines deleted. No new files.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Migration misidentifies space-ID keys as position keys | Negligible | A name gets assigned to wrong space | ManagedSpaceIDs are large integers (>50); position keys are 1-16. Overlap is extremely unlikely. |
| Space IDs change after macOS upgrade | Low | Users must re-rename spaces | Acceptable for a private-API utility. No mitigation needed. |
| `getOrderedSpaces()` returns empty array | Low | `rebuildSpaceItems()` shows no items | Same risk exists today with `getSpaceCount()`. Handled by guard clauses. |
| `getCurrentSpaceID()` returns an ID not in `getAllSpaceIDs()` | Low | Config lookup misses, shows "Desktop N" | Same risk exists today. Graceful degradation. |

## Dependencies

None. All required APIs already exist in the codebase. No external libraries or system changes needed.
