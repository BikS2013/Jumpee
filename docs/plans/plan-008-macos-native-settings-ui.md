# Plan 008 — macOS-Native Focused Menu and Settings UI

**Status:** Complete  
**Date:** 2026-09-15

## Objective

Modernize Jumpee's interface to follow macOS utility conventions while preserving its existing desktop detection, navigation, overlays, window movement, pinning, hotkeys, and JSON configuration compatibility.

## Implemented Scope

1. Reduce the status-item menu to desktop navigation, current-context actions, Settings, About, and Quit.
2. Add current-desktop and active-display context at the top of the menu and a system display symbol in the status item.
3. Add a native Settings window with General, Appearance, Shortcuts, and Advanced toolbar panes.
4. Apply Settings changes immediately through the existing `JumpeeConfig` and runtime managers.
5. Add a live appearance preview and native controls for the existing overlay and input-source appearance values.
6. Replace modifier checkboxes and the single-character field with direct shortcut recorders, conflict checking, per-row reset, and restore-all defaults.
7. Move permission status, System Settings links, and configuration-file actions into Advanced Settings.
8. Replace the generic rename alert with a focused native panel and replace the verbose About alert with the standard macOS About panel.
9. Compile all Swift sources under `Sources/` into the existing dependency-free universal application binary.

## Files

- `Sources/main.swift` — focused menu integration, Settings lifecycle, immediate config application, standard About panel.
- `Sources/SettingsUI.swift` — Settings window, four panes, appearance preview, shortcut recorder, system-status controls.
- `Sources/RenamePanel.swift` — focused rename interaction.
- `build.sh` — compile every Swift file under `Sources/`.
- `docs/design/project-design.md` — authoritative architecture and UI design.
- `docs/design/project-functions.md` — updated and new functional requirements.
- `Issues - Pending Items.md` — resolved UI and shortcut-entry issues.

## Acceptance Evidence

- Universal arm64/x86_64 build succeeds with macOS 13.0 deployment target verification and valid ad-hoc signature.
- Existing Swift configuration and input-source tests pass: 86 assertions total, zero failures.
- Live launch verifies the General, Appearance, Shortcuts, and Advanced panes, animated pane sizing, pane-specific window titles, and the focused rename panel.
- The live verification did not save any test changes to the user's configuration.
