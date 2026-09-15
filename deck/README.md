# Jumpee product deck

A 30-slide HTML presentation about Jumpee — what it does, how to install and set it up, how to configure it, and where it fits — built with the `nbg-design` skill on its **BikS2013 theme** (ink and copper on warm paper, Avenir Next, the BikS2013 wheel lockups).

**Live deck (HTML):** <https://biks2013.github.io/Jumpee/> — published automatically by GitHub Pages, see [Publishing](#publishing-github-pages).

## Deliverables

| File | Purpose |
|---|---|
| `jumpee-deck.html` | The self-contained deck (all photography and the lockups embedded as data URIs). Open in any browser; arrow keys or the on-screen buttons navigate, and `#12` in the URL opens a given slide. Right-click for the in-deck menu (edit text, resize shapes, edit inline SVG, export to PDF, save an edited copy). |
| `jumpee-deck.pdf` | One page per slide, exported from the HTML with the skill's exporter. |
| `jumpee-deck.rebuild.mjs` | Re-embeds the newest version of the in-deck editing tools after the nbg-design skill is updated (`node jumpee-deck.rebuild.mjs --check` reports; without `--check` it rebuilds, re-verifies and re-exports the PDF). |

## Photography

Six photorealistic images carry the cover and the five section dividers. The subjects are workspace-and-display scenes, literal to the product: a desk at dusk with a laptop and a display for the cover, an everyday desk, two displays side by side, a laptop lifted out of its box, a macro of brass and copper control knobs, and a person working at a two-screen desk.

- The prompts live in `images/generate-images.sh` and are generated with `image-tool` (Azure OpenAI `gpt-image-2`, `--quality high`).
- The style brief in that script is lifted **verbatim** from the theme's own candidate generator (`nbg-design-skill-dev/docs/nbg-design-docs/biks2013-theme/candidates/gen.mjs`), so this set sits in the same visual family as the 21 BikS2013 candidates still awaiting review.
- Every prompt forbids text, letters, logos and UI labels, and the screens in every image are dark or warmly lit and unreadable. Nothing is teal or blue — that is the NBG theme's palette.

## Screenshots of the running app

One thing in the deck is a photograph of the app — `menu.png` on slide 06, taken from the running Jumpee v1.9.1 with `screencapture` at the display's native 2x. It shows the dropdown: the header card, the filter field, the display group, the desktops and their key equivalents, the three action buttons and the overlay status line. `make-datauris.sh` converts it to JPEG (quality 85) and writes `assets/shot-menu.datauri.txt`, so the slide places it with `{{SHOT_MENU}}`.

Note that this capture *does* carry the Terminal window behind it. It is the one place where that is still visible, and it is a candidate for the same treatment as the rest.

Everything else that depicts the UI is **drawn**, in the deck's own palette:

- `.stg` — the four Settings panes (slides 22–25)
- `.mbar` — the menu bar (slide 05)
- `.rnp` — the rename panel (slide 08)
- `.ind` — the input-source indicator (slide 12)
- `.mock`, `.mock-menu` — the pinned-window illustration (slide 11) and the macOS System Settings panes (slides 17–18)

A capture of a macOS window brings the system accent colour with it, and a blue toggle beside copper reads as a mistake. Worse, every one of these is a *floating* panel, so its backdrop is whatever happened to be behind it — a code editor, the Terminal's tab bar — and that backdrop survives at the edges of any crop, because a rounded corner and a drop shadow cannot be trimmed to nothing. Copper takes the role the accent plays in the app: switches, the selected tab, sliders, status dots, the primary button, the destructive label.

The menu bar (`.mbar`) is drawn for one more reason: a real capture of it is mostly *other apps'* status items — ChatGPT, Wi-Fi, battery, the clock — so the one item the slide is about is lost in the crowd. In the drawn version everything but Jumpee's own item is an abstract mark.

Slide 09's watermark is drawn for a different reason: the shipped default is 9% black, which photographs as nothing. The Appearance pane's live preview on slide 23 shows it instead.

Those slides say so on the slide.

One hazard worth knowing before editing the drawn panels: the deck's own classes are global, so a child class named after one of them silently inherits its `position`/`top`/`left`. `.body` (slides' absolute body) and `.note` (absolute footnote) both bit these panes — hence `.cnt` and `.snote`. Everything under `.stg` is now verified collision-free.

## Copy provenance

Every screenshot was re-taken and every version string re-checked against the running app on 2026-09-15. The deck previously said v1.8.0; the app is v1.9.1.

## Sources and how to rebuild

- `src/shell-head.html` — the viewport frame, the BikS2013 palette as CSS custom properties, and every slide primitive (`.title`, `.grid`, `.card`, `.kv`, `.callout`, `.divider-dark`, `.divider-bright`, `.cover.has-photo`, `.mock`, `.mock-menu`, `.legend`).
- `src/slides.html` — the 30 slides, in order.
- `src/shell-tail.html` — navigation, keyboard handling, the 1920×1080 viewport scaler and the automatic footer page numbers.
- `images/generate-images.sh` — generates the photographs (existing PNGs are skipped, so delete one to regenerate it).
- `images/make-datauris.sh` — converts each PNG to a 1600px-wide JPEG (quality 78) and writes `assets/<name>.datauri.txt`.
- `assets/` — one assets directory for every token: the generated photographs plus the four BikS2013 lockup data URIs copied from the skill's `BikS2013-Design/assets/`. This is why `build.sh` passes `--assets assets`.
- `build.sh` — concatenates the three sources, embeds everything, inlines the deck menu with `--theme biks2013`, runs the strict verifier, writes the rebuild script and exports the PDF.

```
./images/generate-images.sh   # only when an image must be (re)generated
./images/make-datauris.sh
./build.sh                    # or ./build.sh --no-pdf
```

The build needs the `nbg-design` plugin 1.20.0 or newer (override the path with `NBG_DESIGN_SKILL`) and Chrome for the PDF. `jumpee-deck.src.html` is an intermediate file produced by the build.

## Verifying a build

```bash
node "$SK/scripts/verify-deck.mjs" deck/jumpee-deck.html --strict   # browser-free gate, must PASS
node "$SK/scripts/screenshot-deck.mjs" deck/jumpee-deck.html        # writes test_scripts/screenshots/
```

Screenshots land in `../test_scripts/screenshots/` at 1366×768 and 1440×900. Read them before delivering — the strict gate cannot see a layout collision.

## Where the copy comes from

Every factual claim in the deck was checked against `Sources/main.swift` and `build.sh` in the Jumpee source tree, not only against the prose documents, because three Jumpee documents contradict each other or the source. See `../Issues - Pending Items.md` item 1 for the details; the deck follows the source in each case.

## Note on the mock overlays

The desktop watermark in the CSS mocks is shown at 35% opacity so it is legible at presentation size; the shipped default is 15%. The deck says so on the slide that introduces it.

## Publishing (GitHub Pages)

The deck is published at **<https://biks2013.github.io/Jumpee/>** by the workflow `.github/workflows/deploy-deck.yml` (on the `deck` branch). Every push to `deck` that touches anything under `deck/` — or the workflow itself — rebuilds `jumpee-deck.html` from the sources (`./build.sh --no-pdf`) and deploys it as the site's `index.html`; the workflow can also be started by hand from the Actions tab (*Run workflow*). The PDF is not rebuilt by the workflow.

The workflow does not have the `nbg-design` plugin, so it builds with `tools/nbg-design/`, a vendored copy of the plugin's `scripts/` folder (`tools/nbg-design/plugin.json` records the version). After updating the plugin locally, run `tools/sync-nbg-design.sh` and commit the result so the published deck carries the newer editing tools.

Repository settings the workflow relies on: Pages source = *GitHub Actions*, and the `github-pages` environment allowing deployments from the `deck` branch.
