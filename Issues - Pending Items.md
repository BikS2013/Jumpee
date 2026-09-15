# Issues - Pending Items

## Pending

1. **Deck — the v1.9.x workspace popover is not covered.** Capturing the screenshots on 2026-09-15 showed the app running v1.9.1 (`f4926e1 v1.9.1: fix workspace popover layout`, `4aedcaa v1.9.0: visual workspace popover`) while the deck's copy was derived from documents that predate both. The version strings are corrected, and the dropdown slide now matches the real menu (which the 1.9.0 redesign changed substantially), but the deck never *explains* the workspace popover as a feature — it only shows it. Decide whether it needs its own slide, and if so write the requirement up in `docs/design/project-functions.md` first, since the deck sources every claim from there or from the source.

2. **Deck — three upstream Jumpee documents contradict each other or the source** (found 2026-09-15 while sourcing the deck). The deck's copy was verified against `Sources/main.swift` and `build.sh` rather than against the prose alone. Three claims disagree:

   a. **Architecture.** `README.md` line 147 lists "Apple Silicon (arm64)" under *System requirements*, but line 73 of the same file says every build is a universal binary, and `build.sh` compiles both `arm64` and `x86_64` and merges them with `lipo`. The source wins — the release is universal. The deck says *"One universal download covers Apple silicon and Intel."* Fix: correct the README's System requirements line.

   b. **Overlay anchor count.** `docs/design/project-functions.md` FR-7 says the position is configurable over "9 anchor points"; `docs/design/configuration-guide.md` lists **7**, and `Sources/main.swift` (the `"top-left" … "center"` switch around line 562) implements exactly those 7 — top-left, top-right, top-centre, bottom-left, bottom-right, bottom-centre and centre. The source and the configuration guide agree; FR-7 is wrong. The deck says *"Seven anchors."* Fix: correct FR-7.

   c. **Pin mechanism.** FR-34 and FR-44 describe pinning as setting the window level through the private `CGSSetWindowLevel` API, and FR-44 says pinned windows are restored to `kCGNormalWindowLevel` on quit. The implementation instead captures the target window with `CGWindowListCreateImage` and displays that image in Jumpee's own floating window (with a `promptForScreenRecording()` fallback when the capture returns nil) — which is exactly why Screen Recording is required, as `configuration-guide.md` correctly states and FR-34 does not. The deck describes the user-visible behaviour and the Screen Recording requirement and does not name an API. Fix: bring FR-34/FR-44 in line with the implementation, or confirm the source is right and rewrite the requirements.

   These only affect documentation accuracy — the app itself is consistent. They matter because the next deck or guide built from the prose alone will repeat the error. Note that FR-34's subject overlaps `v1.9.0: visual workspace popover` (4aedcaa), so the window-management requirements are worth re-reading alongside that release rather than patching in isolation.

## Completed

1. **Deck — only two screenshots survived; every other UI panel is drawn** (2026-09-15). The route that worked for capturing the app: `System Events` clicks the status item, and a PyObjC/CGEvent helper in a `uv` venv posts the clicks inside the popover, whose buttons the accessibility tree does not expose; `screencapture` grabs at the display's native 2x.

   Six captures were taken; five were **rejected** and drawn instead. A capture of a *floating* panel is not separable from its backdrop: a rounded corner and a drop shadow cannot be trimmed to nothing, so a sliver of code editor or Terminal tab bar survives at the edges however the crop is set. A captured macOS window also brings the system accent colour with it, and a blue toggle beside copper reads as a mistake on a BikS2013 slide.

   Drawn, in the deck's palette, with copper taking the role the accent plays in the app (switches, the selected tab, sliders, status dots, the primary button, the destructive label):
   - **Slides 22–25, the four Settings panes** — `.stg`, sharing one window frame, tab row and control vocabulary.
   - **Slide 08, the rename panel** — `.rnp`.
   - **Slide 12, the input-source indicator** — `.ind`, a schematic: menu-bar strip, dashed hairline, the pill.
   - **Slide 05, the menu bar** — `.mbar`. Distinct reason: a real capture is mostly *other apps'* status items (ChatGPT, Wi-Fi, battery, the clock), so the one item the slide is about is lost in the crowd. In the drawn version everything but Jumpee's own item is an abstract mark.

   **Slide 06 (the dropdown) keeps its photograph** and is the last one in the deck. It carries the Terminal window behind it, so it is a candidate for the same treatment if the drawn style is wanted throughout.

   Two class-name collisions cost real debugging time and are worth remembering, because the deck's own classes are global and a child class named after one inherits its `position`/`top`/`left` even when the new rule is more specific:
   - `.stat` (the stat-led slide's `position: absolute; top: 360px`) put the drawn indicator's copper status item at the bottom of the panel instead of in the menu bar. Renamed `.sitem`.
   - `.body` (the slide body's `position: absolute; top: 340px`) and `.note` (the footnote's `bottom: 110px`) collapsed all four Settings panes to their title bar and tabs, clipping the content behind `overflow: hidden`. Renamed `.cnt` and `.snote`.

   The check is a two-line loop: for every child class under the new prefix, grep the stylesheet for a bare `.<class> {` rule. Worth running before adding any new drawn panel.

   Doing this corrected three things in the deck beyond the images themselves: the version strings (1.8.0 → 1.9.1), the dropdown slide's copy — the 1.9.0 redesign gave the menu a header card, a filter field, a display group header and three icon buttons, and moved About and Quit into the Settings Advanced pane, none of which the old mock showed — and the Shortcuts pane, which no longer has a greyed-out row as the mock claimed.

   One bug worth remembering: the drawn indicator's status-item element was first classed `.stat`, which collides with the global `.stat` rule for stat-led slides (`position: absolute; top: 360px; left: 90px`). The copper bar escaped the menu-bar strip and parked itself at the bottom of the panel. It is `.sitem` now.

2. **Deck — committed and published to GitHub Pages** (resolved 2026-09-15). The deck lives on the orphan `deck` branch of `BikS2013/Jumpee` and is published at **<https://biks2013.github.io/Jumpee/>**. The branch carries the slide sources, the six generated photographs and their generator scripts, the built HTML and PDF, the rebuild script, and the verification screenshots.

   Two commits: `84b8240` (the deck) and `ff5b303` (the publishing pipeline, vendoring the nbg-design scripts under `deck/tools/nbg-design/` so the runner can rebuild without the plugin — refresh with `deck/tools/sync-nbg-design.sh`).

   `main` points at the site from its README (`7d389d6`).

3. **Pages — enabled and the deploy branch policy fixed** (resolved 2026-09-15). Two repository settings were needed, both applied:

   - Pages had never been enabled. Enabled with **Source = GitHub Actions** (`POST /repos/BikS2013/Jumpee/pages`, `build_type=workflow`); the site URL is derived from the repository name.
   - The auto-created `github-pages` environment allowed deployments from `main` only, so the first run's **build job succeeded but the deploy job failed** with *"Branch `deck` is not allowed to deploy to github-pages due to environment protection rules."* Adding a deployment branch policy for `deck` fixed it, and the re-run deployed successfully.

   Verified after publication: HTTP 200, 4,261,006 bytes, the expected `<title>`, 30 slides, 36 embedded images and zero unresolved `{{TOKEN}}` placeholders in the served HTML.

   The workflow's actions were then bumped off the deprecated Node 20 runner to the current majors (checkout v5, setup-node v5, configure-pages v6, upload-pages-artifact v4, deploy-pages v5) and re-verified with a live deploy. One deprecation notice remains, from `actions/upload-artifact` pulled in transitively by `upload-pages-artifact`; it is not pinnable from this repository and needs no action here.
