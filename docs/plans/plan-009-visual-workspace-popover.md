# Plan 009 — Visual Workspace Popover

**Status:** Complete  
**Date:** 2026-09-15

## Objective

Apply the selected “B — Visual Workspace Popover” direction while retaining the native Settings window and all existing desktop, overlay, movement, pinning, and configuration behavior.

## Implemented Scope

1. Replace the ordinary status-item menu with a transient AppKit popover.
2. Show the current desktop name, number, and physical display in a visual header.
3. Group desktop rows by display, highlight the current desktop, show available Command-number shortcuts, and support immediate filtering.
4. Navigate when a desktop row is selected.
5. Provide large Rename, Move Window, and Pin/Unpin Window actions.
6. Keep visual-feature status and Settings access in the footer.
7. Keep About, Quit, and conditional Unpin All actions in a compact overflow menu.
8. Anchor status-item clicks beneath the menu bar item and preserve pointer placement for hotkey-triggered opening when configured.
9. Preserve focus restoration for navigation and window actions.

## Files

- `Sources/WorkspacePopover.swift` — popover presentation, search, desktop rows, actions, footer, keyboard handling, and placement.
- `Sources/main.swift` — status-item integration, snapshot creation, callbacks, and runtime refresh.
- `docs/design/project-design.md` — current interface architecture and data flow.
- `docs/design/project-functions.md` — popover functional requirements.
- `README.md` — updated user workflow.

## Acceptance Evidence

- Universal arm64/x86_64 build succeeds with the macOS 13.0 deployment target and valid development signature.
- Existing configuration and input-source tests pass: 86 assertions total, zero failures.
- Live launch verifies the popover header, search field, scrollable nine-desktop list, current-row highlight, action row, status footer, and Settings entry.
- The existing JSON configuration format and native Settings window are unchanged.
