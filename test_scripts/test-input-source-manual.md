# Manual Test Checklist: Input Source Indicator Feature

**Date:** 2026-04-10
**Tester:** _______________
**Jumpee Version:** _______________
**macOS Version:** _______________

---

## Prerequisites

- [ ] Jumpee is built and running (`cd Jumpee && bash build.sh && open build/Jumpee.app`)
- [ ] At least two keyboard input sources are configured in System Settings > Keyboard > Input Sources (e.g., "U.S." and "Greek")
- [ ] Jumpee has Accessibility permissions granted
- [ ] Config file exists at `~/.Jumpee/config.json`

---

## Test Group 1: Feature Enable/Disable via Config

### T1.1 - Feature disabled when section absent (AC-3)
1. Ensure `~/.Jumpee/config.json` does NOT contain an `inputSourceIndicator` key
2. Launch Jumpee (or Cmd+R to reload config)
3. **Expected:** No input source indicator is visible below the menu bar
4. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

### T1.2 - Feature disabled when enabled=false (AC-3)
1. Add to config: `"inputSourceIndicator": { "enabled": false }`
2. Reload config (Cmd+R)
3. **Expected:** No input source indicator is visible
4. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

### T1.3 - Feature enabled when enabled=true (AC-1)
1. Set config: `"inputSourceIndicator": { "enabled": true }`
2. Reload config (Cmd+R)
3. **Expected:** Input source indicator appears below the menu bar showing the current keyboard input source name (e.g., "U.S.")
4. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

---

## Test Group 2: Indicator Display and Positioning

### T2.1 - Indicator is horizontally centered (AC-5)
1. Enable the feature
2. Observe the indicator position
3. **Expected:** The indicator text is horizontally centered on the active display
4. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

### T2.2 - Indicator is below menu bar (AC-6)
1. Enable the feature
2. Observe the indicator vertical position
3. **Expected:** The indicator is positioned directly below the macOS menu bar (not overlapping it)
4. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

### T2.3 - Notch-aware positioning (AC-6)
1. If testing on a MacBook with notch: enable the feature
2. **Expected:** The indicator appears below the full menu bar height, not obscured by the notch
3. **Result:** [ ] Pass  [ ] Fail  [ ] N/A (no notch)  Notes: _______________

### T2.4 - Default font is 60pt bold (AC-7)
1. Enable with minimal config: `"inputSourceIndicator": { "enabled": true }`
2. **Expected:** Text is rendered in large (~60pt) bold font, clearly readable
3. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

### T2.5 - Background pill is visible (AC-14)
1. Enable with default config
2. **Expected:** A semi-transparent dark background pill/rectangle is visible behind the text
3. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

### T2.6 - Background auto-sizes to text (AC-17)
1. Switch between input sources with different name lengths (e.g., "U.S." vs "Greek")
2. **Expected:** The background pill resizes to fit the text content with padding
3. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

---

## Test Group 3: Real-Time Input Source Detection

### T3.1 - Input source change via keyboard shortcut (AC-2)
1. Enable the feature
2. Switch input source using keyboard shortcut (e.g., Ctrl+Space or Fn)
3. **Expected:** Indicator text updates within 100ms to show the new input source name
4. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

### T3.2 - Input source change via menu bar (AC-2)
1. Click the macOS input source icon in the menu bar
2. Select a different input source
3. **Expected:** Indicator text updates immediately
4. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

### T3.3 - Correct input source name displayed (FR-ISI-4)
1. Switch to each configured input source
2. **Expected:** The displayed name matches the macOS localized name (e.g., "U.S.", "Greek", "British")
3. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

---

## Test Group 4: Click-Through Behavior

### T4.1 - Indicator is click-through (AC-4)
1. Enable the feature
2. Try to click on the indicator text or background
3. **Expected:** Clicks pass through to whatever is behind the indicator (windows, desktop, menu bar)
4. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

### T4.2 - Menu bar interaction not blocked (AC-4)
1. Ensure the indicator is visible
2. Click on menu bar items near or behind the indicator
3. **Expected:** Menu bar items respond normally
4. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

---

## Test Group 5: Menu Toggle

### T5.1 - Menu shows "Disable Input Source Indicator" when enabled (AC-10)
1. Enable the feature via config
2. Open the Jumpee dropdown menu
3. **Expected:** Menu contains "Disable Input Source Indicator" item
4. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

### T5.2 - Menu shows "Enable Input Source Indicator" when disabled (AC-10)
1. Disable the feature (remove section from config or set enabled=false)
2. Open the Jumpee dropdown menu
3. **Expected:** Menu contains "Enable Input Source Indicator" item
4. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

### T5.3 - Toggle via menu enables/disables correctly (AC-10)
1. With feature disabled, click "Enable Input Source Indicator"
2. **Expected:** Indicator appears; config file is updated with `enabled: true`
3. Click "Disable Input Source Indicator"
4. **Expected:** Indicator disappears; config file is updated with `enabled: false`
5. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

---

## Test Group 6: Config Reload

### T6.1 - Reload enables feature (AC-9)
1. Start with feature disabled
2. Manually edit config to set `"enabled": true`
3. Press Cmd+R or click "Reload Config"
4. **Expected:** Indicator appears
5. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

### T6.2 - Reload disables feature (AC-9)
1. Start with feature enabled
2. Manually edit config to set `"enabled": false`
3. Press Cmd+R
4. **Expected:** Indicator disappears
5. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

### T6.3 - Reload updates appearance (AC-9)
1. Start with feature enabled at default settings
2. Edit config to change `fontSize` to 30 and `textColor` to `"#FF0000"`
3. Press Cmd+R
4. **Expected:** Indicator re-renders with smaller red text
5. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

---

## Test Group 7: Configurable Appearance (AC-8)

### T7.1 - fontSize
1. Set `"fontSize": 30` and reload
2. **Expected:** Text is noticeably smaller than the default 60pt
3. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

### T7.2 - fontName
1. Set `"fontName": "Courier"` and reload
2. **Expected:** Text renders in Courier (monospaced) font
3. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

### T7.3 - fontWeight
1. Set `"fontWeight": "light"` and reload
2. **Expected:** Text renders in a lighter weight
3. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

### T7.4 - textColor
1. Set `"textColor": "#FF0000"` and reload
2. **Expected:** Text is red
3. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

### T7.5 - opacity
1. Set `"opacity": 0.3` and reload
2. **Expected:** Text is significantly more transparent
3. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

### T7.6 - backgroundColor
1. Set `"backgroundColor": "#0000FF"` and reload
2. **Expected:** Background pill is blue
3. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

### T7.7 - backgroundOpacity
1. Set `"backgroundOpacity": 0.0` and reload
2. **Expected:** Background pill is invisible (text only)
3. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

### T7.8 - backgroundCornerRadius
1. Set `"backgroundCornerRadius": 0` and reload
2. **Expected:** Background has sharp corners (rectangular)
3. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

### T7.9 - verticalOffset
1. Set `"verticalOffset": 50` and reload
2. **Expected:** Indicator is pushed 50px further below the menu bar
3. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

---

## Test Group 8: Multi-Display and Space Behavior

### T8.1 - Multi-display: indicator on active display (AC-12)
1. Connect an external display
2. Enable the feature
3. Move focus between displays
4. **Expected:** Indicator appears on the display with the active space
5. **Result:** [ ] Pass  [ ] Fail  [ ] N/A (single display)  Notes: _______________

### T8.2 - Indicator visible on all spaces (AC-13)
1. Enable the feature
2. Switch between different desktops/spaces
3. **Expected:** Indicator is visible on every space (canJoinAllSpaces behavior)
4. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

### T8.3 - Space change repositioning (FR-ISI-6)
1. Switch to a different desktop/space
2. **Expected:** Indicator remains positioned correctly below the menu bar on the active display
3. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

---

## Test Group 9: Coexistence with Desktop Overlay

### T9.1 - Both features enabled simultaneously (AC-11)
1. Enable both `overlay.enabled: true` and `inputSourceIndicator.enabled: true`
2. **Expected:** Both the desktop name watermark and the input source indicator are visible simultaneously without overlapping or interference
3. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

### T9.2 - Independent toggle (AC-11)
1. Disable overlay, keep input source indicator enabled
2. **Expected:** Only input source indicator is visible
3. Enable overlay, disable input source indicator
4. **Expected:** Only desktop watermark overlay is visible
5. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

---

## Test Group 10: Permissions and Performance

### T10.1 - No additional permissions required (AC-15)
1. Launch Jumpee with only Accessibility permission (no Screen Recording)
2. Enable input source indicator
3. **Expected:** Feature works without any permission prompts
4. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

### T10.2 - Performance: no visible lag (NFR-ISI-1)
1. Enable the feature
2. Rapidly switch input sources multiple times
3. **Expected:** Indicator updates are near-instantaneous (no noticeable delay)
4. **Result:** [ ] Pass  [ ] Fail  Notes: _______________

### T10.3 - Single input source behavior (AC-16)
1. If only one input source is configured in macOS
2. **Expected:** Indicator shows the single source name without errors
3. **Result:** [ ] Pass  [ ] Fail  [ ] N/A  Notes: _______________

---

## Acceptance Criteria Coverage Matrix

| AC | Description | Test(s) | Result |
|----|-------------|---------|--------|
| AC-1 | Indicator visible when enabled | T1.3 | |
| AC-2 | Updates within 100ms on switch | T3.1, T3.2 | |
| AC-3 | No indicator when absent/disabled | T1.1, T1.2 | |
| AC-4 | Click-through behavior | T4.1, T4.2 | |
| AC-5 | Horizontally centered | T2.1 | |
| AC-6 | Below menu bar (notch-aware) | T2.2, T2.3 | |
| AC-7 | 60pt bold default | T2.4 | |
| AC-8 | All properties configurable | T7.1-T7.9 | |
| AC-9 | Config reload works | T6.1-T6.3 | |
| AC-10 | Menu toggle item | T5.1-T5.3 | |
| AC-11 | Coexists with overlay | T9.1, T9.2 | |
| AC-12 | Multi-display support | T8.1 | |
| AC-13 | Visible on all spaces | T8.2 | |
| AC-14 | Background pill | T2.5 | |
| AC-15 | No extra permissions | T10.1 | |
| AC-16 | Single input source | T10.3 | |
| AC-17 | Background auto-sizes | T2.6 | |

---

## Sign-off

**All tests passed:** [ ] Yes  [ ] No
**Blocking issues found:** _______________
**Notes:** _______________
**Date completed:** _______________
