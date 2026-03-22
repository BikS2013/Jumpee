# Refined Request: Space ID-Based Desktop Name Tracking

## Objective

Modify Jumpee so that custom desktop names are associated with the macOS space ID (`ManagedSpaceID` from `CGSCopyManagedDisplaySpaces`) rather than the ordinal position of the desktop. This ensures that when a user reorders desktops in Mission Control, the custom names follow the desktop content instead of remaining fixed at a positional slot.

## Scope

### In Scope

1. Changing the `spaces` dictionary in `JumpeeConfig` to use space IDs (integers from `ManagedSpaceID`) as string keys instead of ordinal position numbers.
2. Updating the rename flow (`renameActiveSpace`) to store the current space's `ManagedSpaceID` as the dictionary key.
3. Updating all name lookup points (menu bar title, overlay text, menu item labels) to resolve names by space ID.
4. Implementing a one-time migration that converts existing position-based config entries to space-ID-based entries on first run after the update.
5. Preserving the user-facing display of positional labels ("Desktop 1", "Desktop 2", etc.) based on the current runtime ordering of spaces.
6. Updating `SpaceDetector` to expose a method that returns the current space's `ManagedSpaceID` directly (it already has `getCurrentSpaceID()` which calls `CGSGetActiveSpace` -- confirm this returns the same value as `ManagedSpaceID`).
7. Rebuilding via `build.sh`, killing the old process, and launching the new app.

### Out of Scope

- Changing the overlay architecture or visual appearance.
- Modifying hotkey registration or navigation logic.
- Multi-display space ID handling beyond what currently exists (current code already iterates all displays).
- Persisting space ordering history or tracking deleted/added spaces.
- App Store distribution concerns (private API usage is accepted).
- Any changes to `build.sh` or `Info.plist`.

## Functional Requirements

1. **FR-1: Space ID as Config Key** -- The `spaces` dictionary in `config.json` must use the macOS `ManagedSpaceID` (as a string) for its keys. Example: `{"58": "Mail", "63": "Dev"}` instead of `{"1": "Mail", "2": "Dev"}`.

2. **FR-2: Rename Stores Space ID** -- When the user invokes "Rename Current Desktop...", the system must retrieve the `ManagedSpaceID` of the active space and use it as the key when storing the name in the config.

3. **FR-3: Menu Bar Title Lookup by Space ID** -- The `updateTitle()` method must look up the custom name using the active space's `ManagedSpaceID`, not its positional index. The positional index is still used for the display prefix (e.g., "3: Dev") and for the fallback label ("Desktop 3").

4. **FR-4: Overlay Lookup by Space ID** -- The `OverlayManager.updateOverlay()` method must look up the custom name using the active space's `ManagedSpaceID`. The positional index continues to be used for display formatting.

5. **FR-5: Menu Items Display Position but Resolve by Space ID** -- When `rebuildSpaceItems()` constructs the dropdown, each menu item must still display "Desktop N" based on the current positional order. However, the custom name appended (e.g., "Desktop 2 - Dev") must be resolved by looking up the space ID at that position, not the position number itself.

6. **FR-6: One-Time Migration** -- On first launch after the update, if the config file contains position-based keys (detectable because they will be small integers like "1", "2", "3" that do not match any current `ManagedSpaceID`), the app must:
   - Read the current space ordering from `CGSCopyManagedDisplaySpaces`.
   - Map each position-based key to the `ManagedSpaceID` at that position.
   - Rewrite the `spaces` dictionary with space-ID keys.
   - Save the migrated config.
   - Log a message to stdout indicating migration occurred.
   - If the number of position-based entries exceeds the current number of spaces, migrate only those positions that have a corresponding space and discard the rest.

7. **FR-7: SpaceDetector API Extension** -- `SpaceDetector` must provide a method (or clarify an existing one) that returns an ordered list of `(position: Int, spaceID: Int)` tuples, so that callers can resolve both the positional index and the space ID for any desktop. The existing `getCurrentSpaceID()` (which calls `CGSGetActiveSpace`) must be confirmed to return the same value as `ManagedSpaceID` -- if not, an additional method is needed.

8. **FR-8: Config File Backward Compatibility** -- If a user manually edits the config and uses position-based keys, these should simply not match any space ID and result in unnamed desktops. No crash or error should occur. The migration logic runs only once (it should be safe to re-run but it will only find matching small-integer keys if they happen to coincide with actual space IDs, which is acceptable).

## Technical Constraints

1. **Single Source File** -- All code resides in `Jumpee/Sources/main.swift`. Changes must stay within this file.

2. **Private API Stability** -- `ManagedSpaceID` values are assigned by macOS and persist across reboots for the lifetime of a space. They change only when a space is destroyed and recreated. This is a known characteristic of the private API.

3. **Space ID vs Active Space ID** -- The value returned by `CGSGetActiveSpace()` must match the `ManagedSpaceID` field in the `CGSCopyManagedDisplaySpaces` output for the same space. The existing code in `getCurrentSpaceIndex()` already relies on this equivalence (it searches `getAllSpaceIDs()` for `getCurrentSpaceID()`). This confirms they are the same identifier.

4. **No Fallback Defaults** -- Per project conventions, missing configuration values must not be silently substituted with defaults. If a space has no name entry, the display falls back to "Desktop N" -- this is existing behavior and acceptable because it is a display convention, not a missing config value.

5. **Build Process** -- Build with `cd Jumpee && bash build.sh`. No changes to the build script are needed.

6. **Config Path** -- `~/.Jumpee/config.json` remains unchanged.

## Acceptance Criteria

1. **AC-1**: After rebuilding and launching, the config file uses `ManagedSpaceID` values as keys in the `spaces` dictionary.

2. **AC-2**: Renaming a desktop stores the name under the space's `ManagedSpaceID` key, not its positional index.

3. **AC-3**: Reordering desktops in Mission Control causes custom names to follow the desktop content. For example, if "Desktop 1" is named "Mail" and is moved to position 3, the menu bar shows "Mail" (or "3: Mail") when that desktop is active at position 3.

4. **AC-4**: The dropdown menu still displays "Desktop 1", "Desktop 2", etc., based on current positional order, with the correct custom name appended based on space ID resolution.

5. **AC-5**: An existing `config.json` with position-based keys (e.g., `{"1": "Mail", "2": "Dev"}`) is automatically migrated to space-ID-based keys on first launch, and the correct names appear on the correct desktops.

6. **AC-6**: A fresh install (no existing config) works correctly -- spaces dictionary starts empty, renaming creates space-ID-based entries.

7. **AC-7**: The overlay displays the correct name after desktop reordering, consistent with the menu bar title.

8. **AC-8**: No crashes or errors when spaces are added or removed (new spaces simply have no name; removed spaces leave orphaned keys in config that are harmless).

## Original Request

> Modify the Jumpee macOS menu bar app to track desktop names by space ID instead of ordinal position, so that when the user reorders desktops in Mission Control, the custom names follow the desktop content rather than staying at a fixed position.
>
> Current state:
> - Source: Jumpee/Sources/main.swift
> - Config: ~/.Jumpee/config.json
> - Names are stored as {"1": "Mail", "2": "Dev"} keyed by position number
> - Space IDs are available from CGSCopyManagedDisplaySpaces (ManagedSpaceID field)
>
> Required changes:
> 1. Change config spaces dict to use space IDs as keys instead of position numbers (e.g. {"12345": "Mail"})
> 2. When renaming, store the current space's ManagedSpaceID as the key
> 3. When displaying names (menu bar, overlay, menu items), look up by space ID
> 4. Migrate existing position-based config to space-ID-based on first run
> 5. The menu should still show "Desktop 1", "Desktop 2" based on current position, but names follow space IDs
> 6. After implementation: rebuild with bash build.sh, kill old process, launch new app
