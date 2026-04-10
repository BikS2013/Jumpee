# Refined Request: Move App Windows Between Desktops via Keyboard

**Date:** 2026-04-10  
**Type:** Research / Feasibility Study  
**Priority:** Before any implementation commitment  

---

## 1. Problem Statement

The user wants Jumpee to support moving the currently focused application window from the current desktop/space to a different desktop/space using only keyboard hotkeys -- without requiring mouse interaction, Mission Control gestures, or drag-and-drop. This would complement Jumpee's existing ability to navigate between spaces (Cmd+1-9) by adding the ability to **relocate windows** across spaces from the keyboard.

The primary question is whether this is technically feasible on macOS given the platform's restrictions around Spaces, and if so, what UX approach would feel natural and efficient.

---

## 2. Functional Requirements

### FR-1: Move Focused Window to a Target Desktop
The user should be able to move the currently focused (frontmost) window to a specified desktop/space. After the move, the window should appear on the target desktop.

### FR-2: Keyboard-Only Invocation
The entire operation must be achievable without touching the mouse. A hotkey or hotkey sequence must trigger the move.

### FR-3: Target Desktop Selection
The user must be able to specify which desktop to move the window to. Possible mechanisms:
- **Direct hotkey**: e.g., Ctrl+Cmd+3 to move the focused window to Desktop 3
- **Menu-based selection**: e.g., a hotkey opens a "Move to..." submenu where the user selects the target with Cmd+1-9
- **Sequential approach**: e.g., "move to next desktop" / "move to previous desktop"

### FR-4: Follow or Stay Behavior (configurable)
After moving a window, the user should be able to configure whether:
- **(a)** They stay on the current desktop (window disappears to the target), or
- **(b)** They follow the window to the target desktop

### FR-5: Visual Feedback
The user should receive some feedback that the move occurred (e.g., a brief notification, overlay text update, or menu bar flash).

### FR-6: Multi-Display Awareness
If multiple displays are connected, the feature should respect the current display context. Moving a window should target spaces on the same display unless explicitly specified otherwise.

---

## 3. Non-Functional Requirements

### NFR-1: Keyboard-Only Workflow
The feature must integrate seamlessly with Jumpee's existing keyboard-centric workflow (Cmd+J to open menu, Cmd+1-9 to navigate).

### NFR-2: Low Latency
The move operation should feel instantaneous (under 500ms perceived delay).

### NFR-3: No Window State Corruption
The move must not alter the window's size, position within the desktop, minimization state, or fullscreen state.

### NFR-4: Graceful Degradation
If a window cannot be moved (e.g., system windows, menu bar items, fullscreen apps), the feature should silently fail or show a brief message rather than crash.

### NFR-5: Minimal Permission Escalation
The feature should work within the Accessibility permissions Jumpee already requires. If additional permissions or entitlements are needed, these must be documented.

---

## 4. Constraints and Assumptions

### C-1: No Public macOS API for Moving Windows Between Spaces
Apple provides **no public API** to programmatically move a window from one Space to another. This is the central technical challenge.

### C-2: Known Private/Undocumented Approaches to Investigate
The following approaches are known to exist in varying degrees of reliability:

1. **Private CGSMoveWindowToSpace / CGSMoveWindowsToManagedSpace APIs**  
   - `CGSMoveWindowToManagedSpace(connectionID, windowID, targetSpaceID)` -- undocumented CoreGraphics SPI  
   - Used by tools like yabai, Amethyst, and other tiling window managers  
   - Requires the CGS connection ID (which Jumpee already obtains) and the target space ID (which Jumpee already enumerates)  
   - Requires the window ID of the target window  

2. **Accessibility API (AXUIElement) for Window Identification**  
   - The focused window can be obtained via `AXUIElementCopyAttributeValue` on the frontmost application  
   - The window's CGWindowID can sometimes be obtained via `_AXUIElementGetWindow` (private but widely used)  
   - Alternatively, `CGWindowListCopyWindowInfo` can enumerate windows to find the focused one  

3. **AppleScript / NSAppleScript**  
   - Some apps support `move window to desktop N` via AppleScript, but this is app-specific and unreliable  
   - Not a general solution  

4. **Synthetic Key Events (CGEvent) to Trigger Mission Control Shortcuts**  
   - macOS supports "Move window to Desktop N" shortcuts but they are **not enabled by default** and must be manually configured in System Settings > Keyboard > Keyboard Shortcuts > Mission Control  
   - If enabled, Jumpee could synthesize Ctrl+N key events to move windows -- similar to how it currently navigates spaces by synthesizing Ctrl+N  
   - This is the simplest approach but depends on user configuration  

### C-3: System Integrity Protection (SIP) Considerations
Some private CGS APIs may be blocked or behave differently when SIP is enabled. The investigation must verify behavior under standard SIP-enabled configurations.

### C-4: macOS Version Compatibility
Private APIs can break between macOS versions. The investigation should target macOS 14 (Sonoma) and macOS 15 (Sequoia) at minimum.

### C-5: Jumpee's Existing Architecture
- Single-file Swift app (Sources/main.swift, ~920 lines)
- Already uses private CGS APIs: `CGSMainConnectionID`, `CGSGetActiveSpace`, `CGSCopyManagedDisplaySpaces`
- Already has the CGS connection ID and full space enumeration
- Already synthesizes CGEvent key presses for space navigation
- Already has Accessibility permissions

### C-6: Code Signing
Jumpee uses ad-hoc code signing. Some private APIs may require specific entitlements or behave differently without proper signing.

---

## 5. Acceptance Criteria

Since this is a **feasibility study**, the acceptance criteria are for the research phase:

### AC-1: Technical Feasibility Determination
A clear YES/NO/PARTIAL answer to: "Can Jumpee programmatically move a window from one Space to another on macOS 14+ with SIP enabled?"

### AC-2: Approach Ranking
If feasible, a ranked list of implementation approaches (e.g., private CGS API vs. synthetic key events) with pros, cons, and reliability assessment for each.

### AC-3: Proof of Concept
If feasible, a minimal proof-of-concept Swift code snippet demonstrating the core operation (get focused window ID, move it to a target space).

### AC-4: UX Recommendation
A recommended UX design for how the feature should be invoked and configured, considering:
- Hotkey scheme (direct move vs. menu-based vs. sequential)
- Configuration options (follow window vs. stay)
- Integration with existing Jumpee menu and hotkey system

### AC-5: Risk Assessment
Identification of risks: API stability across macOS versions, App Store compatibility (not relevant since Jumpee is distributed directly), SIP restrictions, edge cases (fullscreen windows, multi-display scenarios).

---

## 6. Open Questions Requiring Investigation

### Q-1: Does `CGSMoveWindowToManagedSpace` work on macOS 14/15 with SIP enabled?
This is the critical technical question. Tools like yabai use this API, but yabai also requires SIP modifications for some features.

### Q-2: Can we reliably get the CGWindowID of the focused window?
Options: `_AXUIElementGetWindow` (private AX API), or matching via `CGWindowListCopyWindowInfo` against the frontmost app's PID and window title.

### Q-3: What happens to fullscreen windows?
macOS creates a dedicated space for fullscreen windows. Can they be moved? Should they be excluded?

### Q-4: What happens with windows that span multiple spaces (Assign to All Desktops)?
These windows have special space assignment. Moving them may be undefined behavior.

### Q-5: Are "Move to Desktop N" keyboard shortcuts available as a fallback?
If the user has "Move window to Desktop N" shortcuts enabled in Mission Control settings, Jumpee could synthesize those key events as a simpler alternative to private CGS APIs.

### Q-6: Does the window need to be "unassigned" from the current space before moving?
Some implementations suggest you must both add the window to the target space and remove it from the source space as two separate operations.

### Q-7: How do tiling window managers (yabai, Amethyst) implement this?
Reviewing their open-source code would reveal the exact API calls and workarounds they use.

---

## 7. Scope Boundaries

### In Scope
- Feasibility research for moving windows between spaces
- Investigation of private CGS APIs, Accessibility APIs, and synthetic key events
- UX design recommendation for keyboard-driven window movement
- Proof-of-concept code (if feasible)
- Risk and compatibility assessment

### Out of Scope
- Full implementation (pending feasibility confirmation)
- Window tiling or automatic layout management
- Moving windows between physical displays (different from moving between spaces)
- Resizing windows during or after the move
- App Store distribution concerns (Jumpee is distributed directly)
- Integration with third-party window managers

---

## 8. Proposed UX Approaches (To Be Evaluated)

### Option A: Direct Hotkey (Ctrl+Cmd+N)
- Ctrl+Cmd+1 moves focused window to Desktop 1, Ctrl+Cmd+2 to Desktop 2, etc.
- Pros: Fastest, single keystroke. Mirrors existing Ctrl+N navigation pattern.
- Cons: Consumes 9 global hotkey combinations. May conflict with other apps.

### Option B: Two-Step via Jumpee Menu
- Cmd+J opens menu, then Shift+Cmd+N (or similar modifier) moves window to Desktop N.
- Pros: No additional global hotkeys. Reuses existing menu infrastructure.
- Cons: Two keystrokes required. Menu must remain open during the operation.

### Option C: Move Hotkey + Number
- A dedicated "move mode" hotkey (e.g., Cmd+Shift+J) followed by a number key.
- Pros: Only one global hotkey consumed. Clear mental model (enter move mode, pick target).
- Cons: Two keystrokes. Must handle timeout/cancellation of move mode.

### Option D: Move to Next/Previous Desktop
- A hotkey (e.g., Ctrl+Cmd+Right/Left) moves the focused window one desktop forward/backward.
- Pros: Simple, no target selection needed. Works well for adjacent desktops.
- Cons: Moving across multiple desktops requires repeated presses. Less precise.

### Option E: Synthesize System "Move Window" Shortcuts
- Jumpee synthesizes the macOS built-in "Move window to Desktop N" key events.
- Pros: Uses official (though user-configured) macOS mechanism. Most reliable.
- Cons: Requires user to enable shortcuts in System Settings. Not zero-configuration.

---

## 9. Recommended Investigation Plan

1. **Code review of yabai and Amethyst** -- Identify exact private API calls for window-to-space movement
2. **Prototype CGSMoveWindowToManagedSpace** -- Test on macOS 14/15 with SIP enabled
3. **Prototype Accessibility-based window ID retrieval** -- Verify `_AXUIElementGetWindow` or `CGWindowListCopyWindowInfo` approach
4. **Test synthetic key events for "Move window to Desktop N"** -- Verify if this system shortcut can be triggered programmatically
5. **Document findings** -- Feasibility determination, approach ranking, and UX recommendation
6. **Build proof-of-concept** -- If feasible, minimal working demo in Jumpee's existing codebase
