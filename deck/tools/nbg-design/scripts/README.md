# NBG Design — build, verification & export scripts

Zero-dependency Node scripts (Node >= 18, no `npm install`) that make asset embedding
deterministic, add a browser-free quality gate, capture per-slide screenshots, and export
the finished deck to PDF. They exist because the hand-pasting of large base64 data URIs is
the step that silently breaks in headless / SSH / Linux runs — the model "approximates" a
photo with a gradient or substitutes a text/box logo, and with no display to screenshot,
the lapse ships — and because a PDF produced any other way (browser "Save as PDF",
`window.print()` at A4, Office round-trips) changes the deck's aesthetics.

All scripts resolve the bundled assets **relative to the script's own location** (the
skill root), never the current working directory — so they work from any cwd and on any
machine, as long as the **whole skill folder** (including `NBG-Design/assets/` and
`scripts/lib/`) was copied, not just `SKILL.md`.

Skills are commonly reached **through a symlink** (e.g. `<project>/.claude/skills/nbg-design`
→ the plugin checkout). Every script works when invoked through such a link: the one script
with a "run as CLI only when invoked directly" guard (`add-deck-menu.mjs`) compares real paths,
because Node resolves `import.meta.url` to the real file while `process.argv[1]` keeps the
symlinked path. `add-pdf-menu.mjs` remains as a compatibility wrapper for the same CLI.

## 1. Embed assets — `embed-assets.mjs`

Author the deck with `{{TOKEN}}` placeholders instead of inline data URIs, then run:

```
node "<skill-root>/scripts/embed-assets.mjs" my-deck.html
```

- Tokens map to asset files by lower-casing and turning `_` into `-`:
  `{{PHOTO_STREET}}` → `photo-street.datauri.txt`, `{{LOGO_KNOCKOUT}}` → `logo-knockout.datauri.txt`.
- Available tokens: `{{LOGO_PRIMARY}}` `{{LOGO_KNOCKOUT}}` `{{LOGO_SMALL}}`
  `{{PHOTO_FIELDS}}` `{{PHOTO_HEART}}` `{{PHOTO_PARTHENON}}` `{{PHOTO_SKATE}}` `{{PHOTO_STREET}}`,
  and the technology set `{{PHOTO_<SUBJECT>_<N>}}` with `<SUBJECT>` ∈ `DATACENTER`, `TEAM_ANALYTICS`,
  `NETWORK`, `CHIP`, `ATHENS_DUSK`, `SECURITY`, `DEVELOPER` and `<N>` ∈ `1`, `2`, `3`
  (e.g. `{{PHOTO_TEAM_ANALYTICS_2}}` → `photo-team-analytics-2.datauri.txt`). The catalogue with a
  one-line description of every photo is in `SKILL.md` → "Photography catalogue".
- Define each token **once** (e.g. a CSS `background-image: url("{{PHOTO_STREET}}")` class)
  and reuse the class, so the large URI appears only once in the file.
- Fails loudly if a token has no matching asset or the asset isn't a `data:image/` URI.
- `--theme biks2013` takes the assets of the BikS2013 personal theme (`BikS2013-Design/assets/`) instead of
  the NBG ones (`--theme nbg`, the default); the tokens are the same in every theme. `--assets <dir>` still
  overrides the directory outright. Unknown theme names fail.
- `-o out.html` writes to a new file; default overwrites in place.

## 2. Verify the deck — `verify-deck.mjs`

Run this before delivering **any** deck. It needs no browser, so it works over SSH:

```
node "<skill-root>/scripts/verify-deck.mjs" my-deck.html --strict
```

Exit code 0 = pass, 1 = fail.

**Hard failures (always):** unresolved `{{TOKEN}}` placeholders; any image referenced by
`file://` / absolute / relative / `http(s)://` instead of a `data:` URI; zero embedded
images.

**`--strict` also fails on:** fewer than `--min-images` embedded images (default 2); file
smaller than `--min-bytes` (default 200000) — a photo-less deck is the classic tell; bare
`>NBG<` / `>NPG<` text nodes that may be a text/box substitute for the logo lockup; a missing
right-click deck menu (section 5; `--no-deck-menu` only when the user declined it), the
older PDF-only v1.4 block, or a block older than the version the skill ships (re-run
`add-deck-menu.mjs`). A present-but-incomplete menu block is a hard failure in every mode.

## 3. Screenshot the deck — `screenshot-deck.mjs` (optional, needs a browser)

Visual check for hosts that have Chrome/Chromium/Edge. Writes one PNG per slide at the
required viewports so they can be read and inspected:

```
node "<skill-root>/scripts/screenshot-deck.mjs" my-deck.html [-o <dir>] [--viewports WxH,WxH] [--slides 1,2,5]
```

- Auto-detects a browser (override with `--browser <path>` or env `NBG_BROWSER` / `CHROME_BIN`).
- Navigates slides generically: injects a shim (before the **last** `</body>`) that calls the
  deck's `window.showSlide` / `window.gotoSlide` if present, then forces the Nth top-level
  `.slide` to be the only visible one **in place** — so `.active` toggles, `.hidden` toggles,
  inline `display` toggles and stacked scrolling decks all work, and the deck's own
  viewport-fit scaling still applies to the capture.
- Counts slides by the exact class token `slide` (`slide-title` / `slide-footer` do not count).
- Default viewports `1366x768,1440x900`; default output `test_scripts/screenshots/`.
- **Exit codes:** 0 = screenshots written, 1 = error, **3 = no browser found** (a soft signal — fall
  back to `verify-deck.mjs --strict`, which is the mandatory gate on headless hosts).

## 4. Export to PDF — `export-pdf.mjs` (needs a browser)

Turns the finished, verified HTML deck into a PDF **without changing its aesthetics**: one
page per slide at the slide's own box (the 1920×1080 artboard = 20 × 11.25 in at 96 dpi),
zero margins, backgrounds and embedded images preserved, vector (selectable) text.

```
node "<skill-root>/scripts/export-pdf.mjs" my-deck.html [-o my-deck.pdf] [--size WxH] [--selector <css>]
                                                        [--settle <ms>] [--timeout <ms>] [--browser <path>]
                                                        [--debug-html <path>]
```

How it works: the deck is opened in headless Chrome/Chromium/Edge and driven over the
DevTools protocol (`--remote-debugging-pipe`, so nothing to install). A shim
(`lib/print-layout.js`, the same code the in-deck menu inlines) evaluated in the page lifts
the **host layer only** — navigation toggles (`.active` / `.hidden` / inline
`display` / `[hidden]`), the viewport-fit wrappers (scaled `#deck` / `.slide-wrap`, fixed
`#stage`, flex centering), non-slide chrome (buttons, counters) — makes every top-level
`.slide` visible in normal flow, jumps CSS animations/transitions to their end state,
forces `print-color-adjust: exact`, waits for fonts and images, then prints with
`Page.printToPDF` (`printBackground`, `preferCSSPageSize`, `scale: 1`, page size = slide box).
**A slide's own CSS, size, fonts, colours, copy, logos and photography are never touched**;
a slide whose box differs from slide 1 is reported, not resized.

Flags:

- `-o, --out` — output path (default: next to the deck, same name, `.pdf`).
- `--size WxH` — force the page box in CSS px; use only when the deck's slide box is wrong.
  The default is the measured box of slide 1 (a 1280×720 deck yields 1280×720 pages).
- `--selector` — slide selector (default `.slide`; nested matches ignored). Only for decks
  not authored with this skill.
- `--settle` — extra ms after fonts/images are ready (default 400).
- `--timeout` — whole browser session (default 120000 ms).
- `--browser` / env `NBG_BROWSER`, `CHROME_BIN` — explicit browser binary.
- `--debug-html` — dump the prepared (print-layout) DOM for inspection when a page looks off.

Fonts: the PDF embeds the faces the browser resolved on the exporting host for the deck's
font stack (`pdffonts my-deck.pdf` lists them). With Aptos absent, both the screenshots and
the PDF use the same system fallback — export where Aptos is installed if it must appear.

Built-in verification (exit 1 on failure): PDF page count must equal the slide count; every
slide box must equal the page box. A mismatch is a defect in the deck (a slide with
`height:auto` that overflows spills to an extra page; an undetected slide is missing) — fix
the HTML and re-export, never add print CSS or resize slides to get past it.

**Exit codes:** 0 = PDF written and verified, 1 = error / verification failure, **3 = no
browser found** — deliver the verified HTML, say the PDF could not be produced on this host,
and give the one-line command to run on a host with a browser.

After a PASS, rasterise a few pages and **read them** next to the screenshots:

```
pdftoppm -r 72 -png my-deck.pdf pages/my-deck     # poppler; 1382x777 px per page at 72 dpi
pdfinfo my-deck.pdf                                # Pages: N, Page size: 1440 x 810 pts
pdftotext -l 1 my-deck.pdf -                       # text is selectable (vector), not a bitmap
```

### Shadows in macOS Preview — soft masks re-anchored (v1.19.0)

Chrome writes every blurred `box-shadow` as a **luminosity soft mask**: a grayscale image in a
transparency-group form, attached to the graphics state, through which the shadow colour is
filled. The page content is in Skia's 300-dpi device units under one `.24 0 0 -.24 0 810 cm`, and
the mask form has no `/Matrix`, so its BBox is in those units too. macOS Quartz (Preview, Quick
Look, Safari) clips the mask form to the page box in **points** but applies it in the form's own
units — the top-left 24 % of the page. A shadow entirely outside that corner gets an empty mask
and Quartz paints the fill **unmasked** (a solid gray block); a shadow that straddles the corner
vanishes outside it. Chrome, Acrobat, Firefox and poppler render the same file correctly.

The exporter therefore re-anchors every such mask before writing the file (`lib/pdf-soft-masks.mjs`):
the form gets `/Matrix` = the inverse of the transform in effect at its `gs`, its content is
prefixed with that transform and its BBox is mapped the same way. The drawing is unchanged
(poppler renders before and after pixel-identically); only the coordinate bookkeeping moves to
page space, where Quartz's clip is right. The rewritten forms are appended as an incremental
update, so the bytes Chrome wrote stay intact. The output line reports
`soft masks re-anchored for macOS Preview: N`. `--keep-soft-masks` skips the step; a PDF whose
structure is not Chrome's (cross-reference streams, encryption) is written as printed with a `!`
note. Zero dependencies — the rewrite is a few hundred lines of Node.

The in-deck menu's *Export to PDF* (and Ctrl/Cmd+P) goes through the browser's print dialog, whose
file cannot be post-processed. So the print-layout shim, on that path only (block v13,
`rasterShadows: true`), replaces every blurred, non-inset `box-shadow` layer for the duration of the
print by a pre-rendered image of the same shadow — a canvas drawing at 2× with the layer's colour,
offsets, blur (σ = blur / 2, as CSS), spread and the element's corner radii, the element's own box
cut out — placed right behind the element as an absolutely positioned sibling at `z-index: -1`, the
parent isolated so the image sits above the parent's background and below every sibling, as the CSS
shadow does. Chrome prints such an image with an alpha mask, which every viewer renders; the element
itself stays vector. Inset or unblurred layers, inline boxes and elements under a rotation / scale
are left as CSS. `nbgRestorePrintLayout()` removes the images and puts the styles back byte for byte.
`window.nbgDeckMenuConfig.rasterShadows = false` keeps the CSS shadows. Decks delivered before
block v13 get the behaviour through their rebuild script; a PDF saved from such a deck is repaired
with `fix-pdf-soft-masks.mjs` (next section).

## 4b. Re-anchor soft masks in an existing PDF — `fix-pdf-soft-masks.mjs`

For PDFs exported before v1.19.0, with `--keep-soft-masks`, or saved from the browser's print dialog:

```
node "<skill-root>/scripts/fix-pdf-soft-masks.mjs" my-deck.pdf [-o out.pdf] [--check]
```

- Default: rewrites the file in place (`-o` writes elsewhere). Prints pages, the number of
  luminosity soft masks, how many were re-anchored and which were left as they are (already
  anchored, set under several transforms, unreadable form).
- `--check`: report only; exit 0 = nothing to do, 1 = masks still need re-anchoring.
- Idempotent: a second run finds nothing to do. Exit 0 = done / nothing to do, 1 = error or
  `--check` found work, 2 = usage. Only Chrome/Skia PDFs (classic cross-reference table, no
  object streams) are supported; anything else is reported and left untouched.

## 5. In-deck right-click menu — `add-deck-menu.mjs`

Idempotent: a deck that already carries a block (any version, the v1.4 PDF-only one included) gets
the current block in its place — `added`, `upgraded from vN`, `refreshed` or `already current` —
and the block's configuration (`window.nbgDeckMenuConfig`, if any) is carried over, so re-running
the script IS the manual update of an existing deck (see "Update an existing deck" at the end).

Gives the people who receive the HTML in-place text editing and the PDF export with no tooling.

```
node "<skill-root>/scripts/add-deck-menu.mjs" my-deck.html [-o <out.html>] [--remove]
```

- Inlines one `<script id="nbg-deck-menu-script" data-nbg-deck-menu="<version>">` before the
  last `</body>`: `lib/print-layout.js` (the print-layout shim shared with `export-pdf.mjs`)
  followed by `lib/deck-menu.js` (menu UI, editing, persistence, saved copy, print
  orchestration). The deck stays fully self-contained (~150 KB more).
- Idempotent: re-running reports `already current`, refreshes a same-version block, or
  upgrades an older one (including the v1.4 `nbg-pdf-menu-script` block). `--remove` strips it.
- **Configuration (block v11).** Programmatic callers can pass a configuration —
  `addMenu(html, { mode, root, unit, title, aiSystem })` / `buildMenuBlock(config)` — which the
  block writes as its first statement, `window.nbgDeckMenuConfig = {...};`, before the library:
  `root` is the CSS selector of the editable region(s) (default `.slide`, top-level matches only,
  an invalid selector throws), `mode` is `deck` (default) or `page` (browser pagination on print,
  page wording, page-oriented assistant prompts), `unit` / `title` relabel the UI, `aiSystem`
  replaces the assistant's system prompt. `readMenuConfig(html)` reads it back; `already current`
  means same version *and* same configuration. The CLI has no flags for it: a deck gets the
  defaults, and re-running this CLI on a configured file replaces the block with the default one.
  The development workspace's `html-editor` skill is the CLI for arbitrary pages.
- The menu: NBG-styled panel (white, teal accent, Aptos stack) with *Edit text* (when the
  right-click landed on text), *Resize / move shape* (when it landed on a shape; *Reset shape*
  once that shape was changed), *Export to PDF*, and — once edits exist — *Save edited copy*
  and *Discard edits*, plus *Cancel*. Escape / click outside closes it; arrow keys move; deck
  shortcuts are suppressed while it is open; right-clicking a link or form field keeps the
  browser's native menu. 📌 pins it: it then stays open after a choice or a click elsewhere,
  keeps its place (a right-click elsewhere re-renders it for the new target where it is) and is
  draggable by its header (`menuDrag`, 8 px margin like `clampMenu`); unpinned, it follows the
  pointer again. **Tabs (v1.15.0):** the menu header carries *Menu / Outline / Tree* tabs
  (`menuTab`, `setMenuTab`, `MENU_TABS`): the structure panel (`#nbg-code`) is embedded in the menu
  (`ensureMenu()` appends it, `.nbg-embedded` hides its own header) and shown on the Outline / Tree
  tabs (`showStructure` / `hideStructure`, `.nbg-tabbed` gives the menu the panel's size and
  `resize: both`); a structure tab holds the menu open (`menuHeld()` = pinned, structure tab, or
  detached) and hides the pin. `openCode(el, tab)` → `openMenuTab(tab)` (docked top-right, or where
  the viewer dragged it — `menuPos`); `closeCode()` closes the menu; `codeIsOpen()` = menu open on a
  structure tab. The Toolbars section lists text / shape / assistant only. ⧉ (`data-action=mdetach`)
  detaches the menu itself — `detachPanel('menu')`, `'code'` and `'ai'` map to it — into a PiP / pop-up
  window, structure and assistant included; ✕ / Esc there reattach and close it. **Picker (`#nbg-stack-pop`):**
  when the menu is held away from the pointer (detached, or on a panel tab), `openMenu` refreshes the
  menu and opens `openStackPop(x, y)` at the pointer: the `menuStack` hierarchy as rows (front-most /
  encloses the one above / behind, outermost), *Edit text* when there is a text target, Cancel; a click
  `selectSolo`s (Shift+click adds), rows outline their element on hover, Esc / a click elsewhere / a
  scroll close it; it is in `OURS` and hidden while capturing / printing. **Assistant tab:**
  the assistant panel (`#nbg-ai`) is embedded the same way (`.nbg-embedded` keeps its own view tabs
  but hides its title, grip, ⧉ ▾ ✕); `openAi(view)` → `openMenuTab('ai')`; `closeAi()` closes the
  menu; `aiIsOpen()` = menu open on the Assistant tab; the Toolbars section lists text / shape only;
  `aiSettings.pos` / `size` are no longer applied (the menu's size is remembered across tab switches
  in `menuSize`); nothing re-opens on load — the menu and its tabs open on request.
- **Edit text** / **double-click**: the whole text block (accent spans inside a title stay
  intact) becomes `contenteditable` with a teal outline; Enter or a click outside applies, Esc
  cancels, Shift+Enter inserts a line break, Ctrl/Cmd+Z undoes. Paste/drop insert plain text
  (`beforeinput`), and every element the browser wraps around typed text — other than `<br>`
  and the toolbar's `b/strong/i/em/u/s` tags — is unwrapped on commit; original descendants
  are tagged during the edit so they can be told apart. The slide's CSS is never touched, and
  the element's `white-space` and box do not change while editing (rich mode, not
  `plaintext-only`, which would force `pre-wrap` and re-flow the text).
- **One floating toolbar** (`#nbg-tools`, `.nbg-panel.nbg-tbar`): a side strip (`.nbg-tbside`: grip, ⚓, ⧉) and
  `.nbg-tbrows` holding the text row `#nbg-text-tools` above the shape rows `#nbg-shape-tools` (both
  `.nbg-inrow`: static, no own chrome; each still toggled by `syncToolbars` from its mode); the panel shows with
  either row, is placed once by `placeTbar()` (the edited text, else the selection, else the selected text blocks,
  else docked), anchors as one (`ui.anchor.tools`) and detaches as one (`detachPanel('tools')`; `'text'` /
  `'shape'` map to it). `inTools` / `inShapeTools` mean "anywhere on the toolbar".
- **Formatting row** (`#nbg-text-tools`, the top row of the toolbar, shown while editing or with text blocks selected —
  editing; drag it anywhere by the `⋮⋮` grip — it is then **anchored**: `ui.anchor.text` / `.shape` keep the position per deck, the panel gets `.nbg-anchored` and a ⚓ button, `placePanel` opens it there; ⚓ or the grip's double-click release it (`setAnchored(null)` in `makeMovable`, which takes an `anchorKey`) and it follows the selection again). Every control is
  selection-aware: with a selection it changes only the selected run, with a collapsed caret the
  whole block. B / I / U / S on a run go through `execCommand` with `styleWithCSS` off (semantic
  tags; an un-bold inside a CSS-bold block arrives as a formatting span and is kept); on the block
  they toggle inline `font-weight` / `font-style` / `text-decoration`. A− / A+ (x1.1), the exact
  px size, font family (design-system stacks) and text colour (NBG palette) wrap exactly the
  selected text runs in `<span style>` (`wrapSelection`: text nodes intersecting the range are
  split at the boundaries and wrapped, reusing a span that already wraps just that run) or become
  block inline style (the block gets a unitless `line-height` equal to its current ratio the first
  time, so a px-fixed line-height does not collapse). Alignment is block-level. Clear removes the
  selection's tags and spans (`removeFormat` + unwrap) or returns the block to the inline style it
  had before any formatting. Done applies. `pointerdown` on the toolbar is default-prevented so
  the editable keeps focus and its selection; the size field and family select save/restore the
  selection around their own focus; the live selection is authoritative while the editable is
  focused. Shortcuts: Ctrl/Cmd+B/I/U (collapsed caret → whole block), Ctrl/Cmd+Shift+> / <.
  Block formatting changes the element's `style` attribute and is recorded as a `style` edit
  alongside the `html` edit; selection spans travel in the `html` edit; Esc restores both.
  Panels hide through `.nbg-panel[hidden]{display:none!important}` (a bare `hidden` attribute
  loses to the panel's `display:flex`).
- **Resize / move shape**: offered for the card, photo panel, image, decorative block or text
  block under the pointer (an element is a "shape" when it is positioned, has a background,
  border or shadow, or is an image; otherwise the text block is used). A fixed-position
  selection frame (`#nbg-shape-box`) with eight handles follows the element's bounding rect;
  flow elements get only the east/south/corner handles. Dragging converts pointer deltas
  through the slide's current scale (`slide.getBoundingClientRect().width / slide.offsetWidth`)
  and writes inline `width`/`height` (respecting the element's `box-sizing`) and, for
  positioned elements, `left`/`top` with `right`/`bottom: auto` so the top-left corner is pinned;
  a moved flow element gets `position: relative` offsets. Shift on a corner keeps the
  proportions; arrows nudge 1 px (Shift 10), Alt+arrows resize; Tab selects the enclosing shape;
  Esc cancels a drag in progress or finishes; the frame is hidden in the print layout.
  *Reset shape* restores one element's original inline style.
- **Shape toolbar** (`#nbg-shape-tools`, a draggable `.nbg-panel` that appears with the frame):
  X / Y / W / H number fields (artboard px for positioned elements, relative offsets for flow
  elements; a resize pins the top-left corner like the handles do), fill swatches (NBG palette,
  transparent, Default = remove), border select (Default / none / 1–6 px; a new border gets
  `solid` and deep teal unless a colour is set) with palette colour swatches, corner radius,
  opacity (%), shadow (Default / none / soft / strong), Reset (same as *Reset shape*), Done.
  Each change writes the element's inline style and updates the same `style` record as its
  geometry. Keys typed in its inputs are not treated as deck shortcuts. With several shapes
  selected, X / Y / W / H show the selection box (moving it shifts all, W / H scale all from the
  top-left corner) and the style controls apply to every selected shape.
- **Several shapes at once** (text blocks, cards, panels, images): Shift+click adds the smallest shape
  under the pointer (`shiftPick`: the front of `shapeStack`, backdrops excluded — as in the SVG editor)
  or, inside a selected shape, removes that shape (`shiftToggle`); Shift+drag on the slide draws a rubber band (`#nbg-marquee`) and adds
  every top-level shape fully inside it; Ctrl/Cmd+A selects every top-level shape of the slide;
  Ctrl/Cmd+click selects everything inside the precise shape under the pointer (`selectInside`:
  its `childShapes`, whole groups; a shape with nothing inside is picked alone, a group member included);
  the menu offers *Add to selection* / *Remove from selection* / *Select all shapes on this
  slide*. "Top-level shape" = an element that `resolveShapeTarget` maps to itself with no such
  ancestor inside the slide, excluding layers that fill ≥ 98 % of the slide (backdrops) — what the
  selection box and Select all work with. The
  frame (`#nbg-shape-box`) spans the union of the members, each member gets a dashed mark
  (`#nbg-sel-marks`, the primary one solid), the chip and the toolbar report the count. Dragging
  inside moves every member (`shift()`: absolute geometry for positioned elements, relative
  offsets for flow ones); a handle scales the whole selection proportionally
  (`scaleMembers()`: each member keeps its fraction of the union box; Shift keeps the union's
  proportions); arrows nudge all; Reset resets every member with a record. Modifier clicks and
  rubber-band drags are default-prevented and the following `click` is swallowed so the deck's
  own click handlers never see them; a right-click keeps the selection so the menu can add to it.
- **Stack picker** for nested / overlapping shapes: `shapeStack(x, y)` = the shape candidates
  (`isShapeCandidate`: a boxed element or a text block — so a text block inside a card is
  reachable here although a click resolves to the card) among `elementsFromPoint`, front-most
  first. The menu renders them as *Select at this point* items (click = select alone,
  Shift+click = add); the toolbar's `[data-a=stack]` select lists `ancestorShapes(el)`, the
  selected element and `childShapes(el)` (first shape level inside it), hidden for a single
  shape with nothing around or inside it; Ctrl/Cmd+click on a shape with nothing inside goes through
  `pickAtPoint()` — the front-most shape at the point, or the next one out when the current selection
  is already in that stack; Tab selects `parentShape`, Shift+Tab the child shape under the last pointer
  position (`lastPoint`) or the first child. API: `shape.stackAt(x, y)`, `enclosing(el)`,
  `inside(el)`.
- **Arrange row** (second row of the shape toolbar, `data-a` buttons):
  - *Order* — bring to front / bring forward / send backward / send to back (Ctrl/Cmd+] / [ step,
    with Shift to the front/back; *Bring to front* / *Send to back* are in the menu too). The
    element's siblings are ranked by their effective layer (`zKey`: negative z-index < in-flow
    content 0 < positioned with z-index auto/0 = 0.5 < positive z-index; ties in document
    order) and the target gets the next free tier (`tierAbove` / `tierBelow`); one-step moves
    push the neighbours out of the way only on a collision. `setZ()` writes inline `z-index`,
    adds `position: relative` to a static element, and — for a negative index — sets
    `isolation: isolate` on the parent when it is not already a stacking context (otherwise the
    element would sink below the slide background). No DOM re-ordering, so every recorded path
    stays valid; each touched element gets its own `style` record.
  - *Align* left / centre / right / top / middle / bottom and *Distribute* horizontally /
    vertically: computed on screen rects and converted through the slide scale; the reference
    is the selection's union box (default with 2+ shapes; distribute keeps the first and last
    in place, needs 3+) or the slide (`to slide` in the select; distribute spreads 2+ shapes
    with equal gaps to the slide edges). Shapes are ordered along the axis, ties by the other
    axis, then document order.
  - *Group* (Ctrl/Cmd+G) / *Ungroup* (Ctrl/Cmd+Shift+G): logical groups — each member gets
    `data-nbg-group="<id>"`, recorded as a `group` edit (`{ path, kind: 'group', original,
    value }`, so it persists, lands in the saved copy and is removed by Discard); selecting any
    member selects the whole group (`expandGroups`), grouping a selection that contains groups
    merges them; the menu's Select at this point, the Stack list or `solo()` picks one member.
- **Tabs (block v12)**: `#nbg-tools` holds a side strip (grip, ⚓, ⧉), a tab strip (`.nbg-tbtabs`: Text /
  Shape / SVG) and the rows; `tbTab` is the tab in front, `tbAutoKind()` the editor in use (editing → text; a
  selection of text blocks only → text, any other selection → shape; an SVG session → svg) and it takes the
  front whenever it changes (`tbAuto`); `setTbTab(k)` / `toolbars.tab(k)` bring a tab to the front (a hidden
  tab is pinned first), `setToolbarMode(k, 'on')` too; `toolbarVisible(k)` for the three means "the tab is on the
  toolbar" (mode not `'off'`); a tab whose editor has nothing applying (`tbApplies`) is dimmed (`.nbg-tbidle`)
  but opens its idle row; the panel shows when any tab is wanted.
- **Toolbar modes**: `ui = { text, shape, svg, code, ai }`, each `'auto'` (appears with the selection),
  `'on'` (pinned) or `'off'` (closed), persisted in `localStorage` under `nbg-deck-ui:<pathname>`.
  `syncToolbars()` is the single place that shows or hides the three panels (`toolbarWanted`:
  text = editing or a selected text block, shape = a selection, code = on request) and is called
  from `startEdit` / `endEdit` / `setSelection` / `deselectShape` / `openCode` / `closeCode`;
  the old `show*` / `hide*` helpers delegate to it. Each toolbar has a ✕ (`setToolbarMode(k,
  'off')`); pinned toolbars render an idle state (`.nbg-idle`: controls dimmed and inert, a note
  such as "No shape selected" / "Select text, or double-click to edit", docked top-left by
  `placePanel(panel, null)`); the shape toolbar slides below the text toolbar when both are
  shown. The menu's *Toolbars* section (`tb-text` / `tb-shape` / `tb-code`, `tb-auto`) ticks
  what is visible: click = hide (`'off'`) or show-and-pin (`'on'`; the structure panel through
  `openCode`). API: `window.nbgDeck.toolbars = { mode, set, visible, sync, names }`.
- **Toolbars follow the selection**: `layoutTools()` / `layoutShapeTools()` re-read the selection
  on every sync. Without an edit session the text toolbar targets `textTargets()` (every selected
  element with its own text): `format()` routes to `formatBlocks()`, which applies the block-level
  variants (`toggleBlock`, `toggleDecoration`, `setBlockFontSize`, `setTextStyle` — all now take
  the element) to each target inside `withRecords()`; Clear restores the record's original. A
  document-level `MutationObserver` on class / style / hidden (our own elements ignored) drives
  `onDeckChange()`: an edit or selection whose slide is off-screen (`slideOffscreen`: display
  none, hidden, opacity 0, zero size, or outside the viewport) is committed / dropped, and when
  the visible slide changes the toolbars and the structure panel are re-synced; scroll, hashchange,
  popstate, resize and transitionend schedule the same check for decks that navigate without an
  attribute change. `codeSlide()` lets the slide on screen win over a followed element whose
  slide left the screen, so the Outline / Tree always show the current slide.
- **AI assistant panel** (`#nbg-ai`, the menu's *Assistant* tab — no separate menu item since block v12 —, Ctrl/Cmd+Shift+L, or the *AI assistant*
  entry of the Toolbars section; `ui.ai` is `'auto'` = opens on request, like the structure panel;
  `placeAi()` docks it right, or beside the structure panel when that is open). Three views (`setAiView`):
  *Ask* — prompt drop-down (`AI_BUILTIN` + the viewer's `aiPrompts`, stored under
  `nbg-deck-ai-prompts`), request textarea (a `paste` with an image file attaches it; `drop` too;
  *Read clipboard* uses `navigator.clipboard.read()`), Attach checkboxes (`aiSettings.include`),
  Reply radio (`aiSettings.output`: `answer` / `replace`), Send, status, the answer with Copy /
  Apply to selection / Undo (`aiSetReply` keeps the raw text and renders it with `aiMd`: escaped, then
  fences, inline code, bold, italic, headings). *Prompts* — list with Use / Edit / Delete (own) or Copy to mine
  (built-in), an inline editor (name, text, mode). *Settings* — provider (`AI_PROVIDERS`), URL,
  model, API version (Azure OpenAI only), key with Show, key scope, Standard values, Save, Test.
  *Structure* — `renderAiStructure()`: the prompt for *Answer me* (`structure.askPrompt`), for *Replace this
  element* (`structure.changePrompt`) and the default attachments (`structure.include`). The popup
  (`#nbg-ai-pop`, `openAiPop(x, y, el)` from the structure panel's `contextmenu` on a `.nbg-tr` row)
  offers the request box, the Answer / Replace radio (which resets the prompt select to the matching
  default), the prompt, the attachments; `aiPopSend()` `selectSolo`s the element, builds the assistant
  panel if needed (without showing it) and calls `aiSend({ target, promptId, output, include, request,
  pop: true })` — the overrides leave `aiSettings` alone. The popup **stays open** until ✕ / Cancel /
  Esc (a click outside does not close it; it is movable by its header): the status and the answer are
  mirrored into it (`aiPopStatus`, `aiPopReply`; Copy, Undo after a replacement, *Open in the assistant
  panel* → `openAi('ask')`, where the `[data-ai=asked]` note and the same answer wait). The panel opens
  on its own only when the settings are incomplete (`openAi('settings')`). **Tree + source (v1.15.0):**
  the structure panel has two tabs — the former Code tab is the bottom half of the Tree tab
  (`.nbg-ctree` | `.nbg-csplit` | `.nbg-craw`); `setTab('code')` maps to `'tree'` and focuses the
  editor; the splitter drags with pointer capture, `ui.split` (the tree's share, default 0.55,
  clamped 0.1–0.9) is stored per deck in the `nbg-deck-ui:` record, `applySplit()` re-applies it on
  open, on the panel's resize (ResizeObserver) and on a detached window's resize; double-click resets.
  The source attachments go
  through `aiSourceHtml(el)`: `cleanOuterHtml` minus `<script>` elements (this editor's own block when the
  root is the body), `#nbg-deck-menu-style` and the runtime elements — otherwise a page-mode "Page source"
  weighed 300 KB of editor code and was refused. Both panels fold: `ui.fold = { code,
  ai }` in `nbg-deck-ui:<pathname>`, `setFold()` / `applyFold()`, `.nbg-folded` hides the body and lets
  the height collapse; `toolbars.fold(k, on)` in the API. Tree rows are `width: max-content; min-width:
  100%` so the row highlight spans the scrolled width, and the scroll containers style
  `::-webkit-scrollbar` so the bars are always visible (macOS overlay bars hid them); the panel itself is `flex-wrap: nowrap` — with `wrap`, a column flexbox sizes its line to the widest row and the panel clipped the body, which is why no horizontal scrollbar ever appeared.
  `aiSend()`: `aiCheckSettings()` first (no fallbacks — a missing provider / URL / model / key
  returns a message and opens Settings), then the text (prompt, additional instructions, the slide
  source via `cleanOuterHtml(slide)` + `aiDeckCss(slide, store)` — the rules the slide uses, read from
  `document.styleSheets` (root / body rules, style rules matching the slide or something inside it, the
  same inside @media / @supports; @font-face and @keyframes are named in a comment, not copied; the raw
  `<style>` text is the fallback when the sheets cannot be read) — and the selected elements' sources,
  all through `aiStripData()` (`AI_DATA_RE`: any data URI of 64+ payload chars, base64 or not, with
  parameters, in attributes or `url()`) into `nbg-image:N` placeholders, one store per request; text above
  `AI_MAX_TEXT` (300 KB) is refused with the per-attachment breakdown, which every error message also
  carries),
  then the images (`aiCaptureSlide()`: the `.nbg-capturing` class hides our UI *before*
  `getDisplayMedia({ preferCurrentTab: true, … })` opens the picker, and the first frame whose
  `captureTime` is later than the hide — at most six frames / 2 s — is drawn to a canvas cropped to
  the slide's rect × the capture scale; `aiNormaliseImage()` caps the longest side at 1600 px and re-encodes
  when needed), then `aiCall()` → `aiBuildRequest()` (Messages API: `<url>/v1/messages`, image
  blocks `{ type: 'image', source: { type: 'base64', media_type, data } }`, `x-api-key` +
  `anthropic-dangerous-direct-browser-access` for Anthropic, `api-key` for Foundry, always
  `anthropic-version`; chat completions: `<url>/chat/completions` or Azure's `/openai/v1/…` /
  deployments route, `image_url` parts with data URLs, Bearer or `api-key`) and `aiParseReply()`
  (text blocks / `choices[0].message.content`; a `refusal` stop reason and error envelopes become
  messages). *Replace*: `aiApplyReply()` unfences the reply, restores the placeholders and calls
  `applySource()` — the function the source editor's `applyRaw()` now shares (one root of the same
  tag, `sanitise()`, style / group / attrs / html records); `aiUndo()` re-applies the element's
  previous source. Keys: `nbg-deck-ai-key:<provider>` in `localStorage` or `sessionStorage` (`keyScope`),
  never inside the settings object; a pre-profile `nbg-deck-ai-key` is migrated to the active provider on load.
  Per provider: `aiSettings.profiles[provider] = { url, model, apiVersion, keyScope }` (`aiSyncProfile()` keeps
  the active one current); `aiSwitchProvider()` (the form's provider change, `settings({ provider })`, or a
  differing provider on load) stores the current fields and loads the target's, blank when never entered. Remembered per browser in `nbg-deck-ai-settings` (`aiMergeSettings`
  validates every field on load): provider / URL / model / API version / key scope, prompt, attachments,
  reply choice, `view`, `request`, `pos` (`makeMovable`'s new `onMoved` callback after a drag; `null`
  when the grip's double-click re-docks) and `size` (a `ResizeObserver` records the corner resize's
  inline width / height; `aiApplySize()` restores it clamped to the viewport); the request box and the
  settings fields save on `input` (300 ms debounce), selects and checkboxes on `change`. Test hooks: `window.nbgDeck.ai.hooks({ capture, fetch })`
  replace the capture and the network call; `lastRequest()` returns what was built.
- **Detachable panels** (`detachPanel(k, target?)` / `reattachPanel(k)` for `shape`, `code`, `ai`; ⧉ buttons;
  API `toolbars.detach / reattach / detached`): the target window is
  `documentPictureInPicture.requestWindow(size)` when present, else `window.open('', 'nbg-deck-<k>',
  'popup=yes,…')` (null → toast), or a window passed in (the round-trip test passes an iframe's
  `contentWindow`). The deck's `#nbg-deck-menu-style` is `importNode`d into the window plus
  `DETACHED_CSS` (`.nbg-panel.nbg-detached` static, filling the window, grip / ⧉ / fold hidden); the
  panel element is appended to that document (adoption keeps its listeners), `.nbg-detached` added,
  `ui[k] = 'on'`; `toolbarWanted()` is true while detached, `placePanel` / `placeCode` / `placeAi` and
  `makeMovable`'s drag return early for a detached panel; `stools.ownerDocument.activeElement` /
  `ai.ownerDocument.activeElement` replace `document.activeElement` where the panel's inputs are checked.
  The window's `pagehide` (close), `closeCode()` / `closeAi()` / the shape toolbar's ✕ reattach; the
  deck's `pagehide` closes the windows. `aiCaptureSlide()` calls `getDisplayMedia` on the assistant's
  window when detached (that window holds the user activation; `preferCurrentTab` only when attached).
- **The menu**: `menuPinned` (📌 in the head, `data-action=pin`) makes `closeMenu()` a re-render
  (`refreshMenu()`: `renderMenu()`, `clampMenu()`, focus kept) unless `closeMenu(true)` — Cancel and Esc;
  a pinned menu ignores outside pointerdowns, scrolling and resizing (clamped), and `syncToolbars()`
  refreshes it so ticks and hints follow the selection; its keyboard handling only applies while the focus
  is inside it. `ui.menuFold` (per deck) collapses the Toolbars section behind a `nbg-subbtn` header that,
  collapsed, names the toolbars shown. `menuItemEl(button)` maps an item to its element (stack entry, the
  shape, the text block) for `pointerover` / `focusin` → `hoverEl()`. *Show structure & HTML* is one item
  (`data-action=structure`, `openCode(el)` on the panel's current tab).
- **Structure / HTML panel** (`#nbg-code`, menu *Show structure & HTML*, toolbar `</>`,
  Ctrl/Cmd+Shift+O / H; movable by its grip and by its header row — `makeMovable(panel,
  relayout, '.nbg-ch')` adds the header's empty space and the "Slide N" title as a second drag
  surface while buttons, fields and the tabs keep their own behaviour; resizable; docked right by
  default). *Outline*
  (default tab): `renderOutline()` walks `childShapes()` from the slide (shape candidates only,
  backdrops included and badged), one `.nbg-or` row per shape with a checkbox (`toggleSelection`),
  a kind icon (`shapeKind`: img / text / box), `shapeLabel()` (text preview, image alt, or
  tag.class), size, a per-slide group badge (`groupBadges`), an edited dot; *All* =
  `selectAllIn`, *None* = `deselectShape`, the filter keeps matching rows and their ancestors;
  twisties share the tree's `codeClosed` set. `setSelection()` now drops any element whose
  container is also selected (a move would apply twice). *Tree*: `renderTree()` renders the current slide
  (`codeSlide()`: the slide of the followed element, else the one at the viewport centre) as
  rows keyed by element path (`data-path`), expanded two levels plus the ancestors of the
  selection, twisties remembered per path; rows carry tag, id, classes (ours filtered), truncated
  attributes (data: URIs elided), a text preview, and a dot for elements with records. Sync:
  `codeFollow()` runs on selection / edit changes, `codeRefresh()` (one rAF) on records and on a
  `MutationObserver` over the body (our own elements ignored) so deck-driven slide switches keep
  the tree current; clicking a row → `selectSolo` (Shift → `addToSelection`), double-click →
  `startEdit`, hover → `#nbg-hover` outline, arrows / Enter navigate. *Code*: a textarea with the
  followed element's `cleanOuterHtml` (our transient attributes removed); `applyRaw()` parses the
  text into a `<template>`, requires exactly one root of the same tag, `sanitise()`s it
  (script / iframe / object / embed, `on*` attributes, `javascript:` URLs), then writes style,
  `data-nbg-group`, the other attributes and `innerHTML` and records each that changed —
  `style`, `group`, `html`, and the fourth kind **`attrs`** (`attrsOf()`: the remaining
  attributes as sorted `[name, value]` JSON; `applyAttrs()` reconciles). A dirty textarea is not
  overwritten when the selection moves (Apply or Revert first). Records are kept for
  descendants too, so earlier edits inside the element still replay in order.
- **Persistence**: edits are recorded as `{ path, kind: 'html' | 'style' | 'group' | 'attrs', original, value }`
  (child-index path from the root) and stored in `localStorage` under
  `nbg-deck-edits:<pathname>#<title>`; a reload re-applies them, dropping entries whose original
  markup or style no longer matches.
- **Save edited copy**: applies the edits to a pristine snapshot of the deck taken when the
  script ran (`DOMParser`; path lookup with a unique-markup fallback) and downloads
  `<name>-edited.html` — loads exactly like the original, still self-contained, still carrying
  the menu. **Discard changes on this slide** (`discardSlideEdits(slide)`: the records whose
  element lives inside the slide under the pointer — `slideAtPoint`, else the slide at the
  viewport centre — restored newest first and dropped) leaves the other slides alone;
  **Discard edits** restores the originals of every slide and clears storage.
- **Export to PDF**: commits any open edit, applies the print layout (every slide in flow, page
  box = slide box, zero margins, backgrounds forced, animations settled), calls
  `window.print()`, and restores the interactive deck — classes, inline styles, attributes and
  the viewport-fit scaling — when the dialog closes. Ctrl/Cmd+P and the browser's Print command
  use the same `beforeprint`/`afterprint` hooks, so any print of the deck is faithful.
- **Edit SVG (block v12)**: right-click an inline `<svg>` → *Edit SVG* (or double-click the selected SVG,
  or click one of its parts in the Tree tab). The SVG gets a dashed outline; its parts — `path`, `rect`,
  `circle`, `ellipse`, `line`, `polyline`, `polygon`, `text`, `image`, `use`, `g`, nothing inside `defs` /
  `clipPath` / `mask` / `symbol` / `pattern` / `marker` / gradients / `filter` — are picked by a click
  (innermost, `svgLeafAt`; a click without a drag on the selected part's frame picks the part underneath —
  a member of a selected group, or an overlapping part — while a drag moves the selected part; hovering
  outlines parts through the frame), Shift+click (adds / removes a part — through the frame too; a plain
  click on a member of several picks it alone), Ctrl/Cmd+click (`svgSelectInside`: what is inside the smallest part under the pointer — a leaf alone; the
  members of a selected group when the click lands inside its frame), Ctrl/Cmd+A or the All button (every top-level part; a
  group and a member never travel together, the group stays), Tab (enclosing `g`), Shift+Tab (first
  child), or the toolbar's Parts list. Several parts: `svgEd.parts` in document order with a primary
  (`svgEd.part`, the last picked), one frame spanning the union with a dashed mark per part
  (`#nbg-svg-marks`); a drag moves or scales all of them proportionally (`svgPlaceMembers`: each member
  keeps its place within the box, restored from its own snapshot before every recompute); X / Y / W / H show
  the union in the primary's parent units; fill / stroke / width / opacity, order (members keep their own
  order), Duplicate and Delete apply to every member; the text field needs one `<text>` alone.
  The part's frame (`#nbg-svg-box`, eight handles) moves / resizes it; arrows nudge by one SVG unit
  (Shift 10, Alt resizes). Geometry (`svgPlace`) is written in the parent's user space — the screen box
  is mapped through `parent.getScreenCTM().inverse()` — as plain `x` / `y` / `width` / `height` on a
  rect or image without a transform, `x` / `y`, `cx` / `cy`, `x1…y2` for a pure move of text / use /
  circle / ellipse / line, else a `matrix()` = M × (the part's consolidated transform) prepended, so
  path data is untouched. The SVG toolbar row (`#nbg-svg-tools`, the third row of `#nbg-tools`): Parts,
  X / Y / W / H, fill and stroke (NBG palette, `none`, default), stroke width, opacity — presentation
  attributes, or the inline style property when the part already sets it (`svgPaint`) — the text of a
  `<text>` with one run, Order (DOM order inside the parent), Duplicate (clone without ids, after the
  original), Delete, Reset SVG, Done. **One record**: every operation records the `<svg>`'s innerHTML
  as its single `html` edit (`svgOp` / `track`), so it persists, is in the saved copy, is discarded per
  slide and prints; Reset SVG drops it. Sessions are exclusive: starting text editing, selecting a
  shape, applying source, discarding or preparing a print ends the SVG session (`svgEnd`), and the
  `nbg-svg-editing` class never enters a record (`cleanClass`). SVG `<text>` is never contenteditable
  (`resolveTextTarget` returns null inside an SVG); a part passed to `shape.solo` / `setSelection`
  routes to SVG editing / stands for its SVG. Known limits: the box mapping assumes the parent's
  coordinate system is not rotated relative to the screen (a part inside a rotated group is moved in
  that group's own space, which is right, but its frame is the axis-aligned screen box); parts sized
  in percentages or with a CSS `transform` fall back to the matrix path; `<text>` with several runs
  (tspans) is edited in the Tree tab's source.
- `window.nbgDeck = { version, pdf: { prepare, restore, exportPdf }, edit: { start, commit,
  cancel, isEditing, list, format, buildEditedHtml, save, discard, discardSlide(slide),
  listFor(slide), slideAt(x, y) }, code: { open(el), show(el), close, isOpen, tab, refresh,
  target, source, setSource, apply, revert, rowOf(el), outlineRowOf(el), filter(q) }, shape: { select, selectMany,
  add, remove, toggle, solo, selectAll, deselect, selected, selection, reset, align(kind, ref),
  distribute('h'|'v', ref), order('front'|'forward'|'backward'|'back'), group, ungroup, groupOf,
  shapesOf(slide), stackAt(x, y), enclosing(el), inside(el) }, svg: { edit(svg, part), end, isEditing,
  target, part, selection, select(part), selectMany(list), add(part), remove(part), toggle(part), selectAll, selectInside(part), parts(svg),
  partAt(x, y), set(name, value), text(value), geom('x'|'y'|'w'|'h', v),
  nudge(dx, dy, resize), order(action), remove, duplicate, reset(svg), box(part), ownerOf(el) }, resolveTextTarget,
  resolveShapeTarget }` is exposed (`window.nbgPdf`
  aliases the pdf part); an external driver sets `window.__nbgPdfExternal = true` to keep the
  print hooks idle (`export-pdf.mjs` does).
- Chrome and Edge honour the page's `@page { size: 1920px 1080px; margin: 0 }` in the dialog;
  the viewer only has to pick *Save as PDF* (keep Scale 100 %). Safari's `@page size` support
  is partial — the CLI exporter remains the deterministic reference.
- The CLI exporter prints the file on disk, not a viewer's unsaved edits: to get a PDF of an
  edited deck, export the saved `-edited.html` copy.

### The theme (block v14, v1.20.0)

`add-deck-menu.mjs <deck> --theme biks2013` records `{"theme":"biks2013"}` in the block's configuration
(`window.nbgDeckMenuConfig`), and the editor then serves the BikS2013 personal theme: the swatches of the
formatting, shape and SVG toolbars are the BikS2013 palette (ink `#1B1D21`, copper `#C8623A`, copper
light `#E08A5E`, amber `#E3A64A`, black `#111316`, grey `#6E7379`, paper `#F6F3EC`, white), the
editor's own accent colours and font follow the theme, the assistant's system prompt and its built-in
prompts speak of the BikS2013 system, and the menu is titled "BikS2013 deck". `--theme nbg` (the
default) is the NBG editor as before. Re-running the CLI without `--theme` keeps the theme the block
carries, as it keeps every other configuration key, and the rebuild script carries it over on every
rebuild. `theme` is the sixth configuration key next to `mode`, `root`, `unit`, `title` and `aiSystem`;
only `nbg` and `biks2013` are accepted.

## 6. Rebuild script — `write-rebuild-script.mjs`

The editor block a deck carries (section 5) is a snapshot of the editing tools at delivery time.
This script writes the third deliverable, `<deck>.rebuild.mjs`, next to the deck: a self-contained
Node script the recipient runs after the skill was updated, so the deck receives the current tools
without being regenerated.

```
node "<skill-root>/scripts/write-rebuild-script.mjs" my-deck.html [-o <script.mjs>] [--pdf <file> | --no-pdf]
                                                     [--selector <css>] [--size WxH]
```

- Requires the editor block in the deck (run `add-deck-menu.mjs` first; the old PDF-only block and
  page-mode blocks are refused — a page has no slide PDF, use the workspace's `html-editor` skill
  for those). Exit 0 = written, 1 = error, 2 = usage.
- Records at the top of the generated script, as plain JSON: the deck and PDF names **relative to
  the script** (the delivery folder can move as a whole; `--pdf` names another PDF, `--no-pdf`
  records that none was delivered), this `scripts/` directory, the embedded block version, the
  plugin version when the skill sits in its plugin checkout, the block's configuration
  (`readMenuConfig`), and the exporter options (`--selector` — defaults to the block's `root` when
  it is not `.slide` — and `--size`). Warns when the PDF does not exist yet.
- Exports `buildRecord(deck, opts)`, `renderRebuildScript(record)`, `shippedBlockVersion()`,
  `readPluginVersion()` for programmatic use.

The generated `<deck>.rebuild.mjs`:

```
node my-deck.rebuild.mjs                    # rebuild the deck next to the script and its PDF
node my-deck.rebuild.mjs --check            # report CURRENT (exit 0) / REBUILD NEEDED (exit 1); writes nothing
node my-deck.rebuild.mjs --no-pdf           # HTML only
node my-deck.rebuild.mjs --pdf out.pdf      # PDF to another path
node my-deck.rebuild.mjs my-deck-edited.html --no-backup   # another copy, no backup
node my-deck.rebuild.mjs --scripts <dir>    # the skill's scripts/ directory, explicitly
```

- Steps: backup (`<name>.backup-<yyyymmdd-hhmmss>.html`, unless `--no-backup`) → `addMenu(html,
  recordedConfig)` imported from the resolved `add-deck-menu.mjs` (added / refreshed / upgraded from
  vN / already current; the slides are untouched) → `verify-deck.mjs --strict` → `export-pdf.mjs
  <deck> -o <pdf> [recorded options]`. Exit 0 = rebuilt, 1 = error or gate failed (the HTML is
  already rebuilt; the backup holds the previous file), 2 = usage, 3 = HTML rebuilt but no browser
  for the PDF.
- **Scripts directory resolution** (highest priority first): `--scripts <dir>`, `NBG_DESIGN_SCRIPTS`,
  the recorded directory. It must hold `add-deck-menu.mjs`, `verify-deck.mjs`, `export-pdf.mjs`,
  `lib/deck-menu.js`, `lib/print-layout.js`; otherwise the script exits 1 naming the source and the
  path. No other location is ever tried.
- Windows: the script only uses `node:path`, `node:fs`, `node:child_process` and `process.execPath`;
  it has not been run on Windows yet (see the issue register).

## Recommended workflow

```
# 1. author my-deck.html using {{TOKEN}} placeholders for every image
#    (a BikS2013 personal deck: add --theme biks2013 to embed-assets.mjs and add-deck-menu.mjs below)
node "<skill-root>/scripts/embed-assets.mjs"    my-deck.html
node "<skill-root>/scripts/add-deck-menu.mjs"   my-deck.html            # standard: right-click menu (edit text / export PDF)
node "<skill-root>/scripts/verify-deck.mjs"     my-deck.html --strict   # mandatory, headless-safe
node "<skill-root>/scripts/write-rebuild-script.mjs" my-deck.html       # standard: my-deck.rebuild.mjs, delivered with the deck
node "<skill-root>/scripts/screenshot-deck.mjs" my-deck.html            # optional, when a browser exists
# then READ the PNGs and inspect them
node "<skill-root>/scripts/export-pdf.mjs"      my-deck.html            # when a PDF was requested (shadows re-anchored for Preview)
# then rasterise a few pages and READ them against the screenshots
# deliver my-deck.html + my-deck.pdf + my-deck.rebuild.mjs
```

### Update an existing deck

An existing deck is never regenerated: only its editor block is replaced, then the PDF re-exported.

```
grep -o 'data-nbg-deck-menu="[0-9]*"' my-deck.html                  # the block the deck carries
node my-deck.rebuild.mjs --check && node my-deck.rebuild.mjs         # 2a: the deck has its rebuild script (v1.16.0+)
# 2b: no rebuild script — the same steps by hand
cp my-deck.html my-deck.backup-$(date +%Y%m%d-%H%M%S).html
node "<skill-root>/scripts/add-deck-menu.mjs"        my-deck.html    # adds / upgrades the block, keeps its configuration
node "<skill-root>/scripts/verify-deck.mjs"          my-deck.html --strict
node "<skill-root>/scripts/write-rebuild-script.mjs" my-deck.html    # next time it is 2a
node "<skill-root>/scripts/export-pdf.mjs"           my-deck.html    # when a PDF is delivered
node "<skill-root>/scripts/fix-pdf-soft-masks.mjs"   my-deck.pdf     # only when the PDF cannot be re-exported here
```

Full instructions, symptoms of an old block and the version history: `SKILL.md` → "Updating an existing
deck to the current skill".

`<skill-root>` is the directory that contains `SKILL.md`. Shared code under `scripts/lib/`:
`find-browser.mjs` (browser locator), `cdp.mjs` (DevTools-protocol client), `print-layout.js`
(print-layout shim, browser JS, used by the exporter and inlined by the menu; prints blurred
box-shadows as images on the menu's print path — block v13), `deck-menu.js`
(menu UI, text editing, persistence, saved copy, print orchestration; browser JS),
`pdf-soft-masks.mjs` (re-anchors Chrome's luminosity soft masks for macOS Preview; used by the
exporter and by `fix-pdf-soft-masks.mjs`).
