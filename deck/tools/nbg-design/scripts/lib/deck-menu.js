/* NBG Design — in-deck right-click menu: "Edit text", "Resize / move shape", "Export to PDF",
 * "Save edited copy".
 *
 * Inlined into every delivered HTML deck by add-deck-menu.mjs, right after print-layout.js
 * (which defines nbgPreparePrintLayout / nbgRestorePrintLayout). Plain browser JavaScript.
 *
 * Text editing
 *   - double-click a text element inside a slide (or right-click it → "Edit text") to edit it; a
 *     double-click on a shape or an image (no text under the pointer) selects it for resize / move;
 *     in place: the element becomes contenteditable (its inline markup and the slide's CSS are
 *     untouched; paste/drop insert plain text; anything the browser wraps around typed text
 *     other than the toolbar's b/i/u/s tags is unwrapped on commit); Enter or a click outside
 *     applies, Escape cancels, Shift+Enter inserts a line break; deck shortcuts are suppressed;
 *   - a formatting toolbar floats above the text while editing (draggable by its grip; double-click
 *     the grip to re-dock). Every control applies to the selected text when there is a selection
 *     and to the whole block otherwise: Bold / Italic / Underline / Strikethrough (semantic tags on
 *     a run), A− / A+ and an exact px size, font family (the design system's stacks), text colour
 *     (the theme's palette, NBG or BikS2013) — on a run these wrap exactly the selected text in a styled span, on the
 *     block they are inline style (line-height kept proportional) — alignment (block), Clear, Done.
 *     Block-level formatting is recorded as a 'style' edit. Shortcuts: Ctrl/Cmd+B/I/U,
 *     Ctrl/Cmd+Shift+> and < for size.
 *
 * Shape resizing / moving
 *   - right-click a card, photo panel, image, decorative block or text block → "Resize / move
 *     shape": a selection frame with eight handles appears (three for elements in normal flow,
 *     which can only grow to the right/bottom). Drag a handle to resize (Shift keeps the
 *     proportions), drag inside the frame to move, arrow keys nudge by 1 px (Shift: 10 px),
 *     Alt+arrows resize, Tab selects the enclosing shape, Esc / Enter / click outside finishes.
 *     Only the element's inline geometry (left/top/width/height, position for flow elements)
 *     changes; pointer deltas are divided by the slide's current scale so the artboard
 *     coordinates stay exact at any viewport size. "Reset shape" restores one element;
 *   - a shape toolbar (draggable) appears with the frame: X / Y / W / H fields, fill, border,
 *     corner radius, opacity, shadow (the theme's palette), Reset, Done — all inline style on the element.
 *
 * Several shapes at once (text blocks, shapes and images alike)
 *   - Shift+click adds the smallest shape under the pointer to the selection (inside a selected shape it
 *     removes that shape — as in the SVG editor), Shift+drag on the slide
 *     draws a selection box (every top-level shape fully inside is added), Ctrl/Cmd+A selects every
 *     top-level shape of the slide, Ctrl/Cmd+click selects everything inside the shape under the pointer (its
 *     child shapes; a shape with nothing inside is picked alone, even a group member); the
 *     menu offers "Add to selection" / "Remove from selection" / "Select all shapes" as well. The
 *     frame spans the selection (each member gets a dashed mark), dragging moves all, handles scale
 *     all proportionally, arrows nudge all, the toolbar's style controls apply to all;
 *   - the shape toolbar's second row arranges: Order (bring to front / forward / backward / send to
 *     back — inline z-index computed from the siblings' effective stacking order, the parent made a
 *     stacking context when a negative index is needed; Ctrl/Cmd+] / [ with Shift for front/back),
 *     Align (left / centre / right / top / middle / bottom) and Distribute (horizontal / vertical,
 *     equal gaps) relative to the selection's own box or to the slide, Group / Ungroup
 *     (Ctrl/Cmd+G / Ctrl/Cmd+Shift+G). A group is logical: its members carry
 *     data-nbg-group="<id>" — recorded as a 'group' edit — and always select together;
 *   - nested / overlapping shapes: the menu lists every shape under the pointer ("Select at this
 *     point": nested parts, their containers, shapes behind — a text block inside a card included),
 *     the toolbar's Stack list offers the enclosing shapes, the selected one and its child shapes,
 *     Ctrl/Cmd+click on a shape with nothing inside cycles outward at the same spot, Tab / Shift+Tab step out / in.
 *
 * Printing (block v13) — the print path (Export to PDF, Ctrl/Cmd+P) hands nbgPreparePrintLayout
 *   rasterShadows: true (unless window.nbgDeckMenuConfig.rasterShadows === false): every blurred, non-inset
 *   box-shadow inside the slides is printed as a pre-rendered image behind its element instead of Chrome's
 *   luminosity soft mask, which macOS Preview / Quick Look / Safari mis-position (solid gray blocks); the
 *   deck is restored afterwards. See lib/print-layout.js.
 *
 * SVG editing (block v12) — the parts of an inline <svg> (icons, diagrams, charts drawn in the deck)
 *   - right-click an SVG → "Edit SVG" (or double-click the selected SVG, or click one of its parts in the
 *     Tree tab): the SVG gets a dashed outline and its parts — path, rect, circle, ellipse, line, polyline,
 *     polygon, text, image, use, g (nothing inside <defs>, <clipPath>, <mask>, <symbol>…) — become selectable:
 *     a click picks the innermost part under the pointer (through the selected part's frame too: a click without a
 *     drag there picks the part underneath, a drag moves the selection), Shift+click adds a part to the selection or
 *     removes it (through the frame as well), Ctrl/Cmd+click selects what is inside the smallest part under the pointer —
 *     a leaf alone; the members of a selected group when its frame is clicked — Ctrl/Cmd+A selects every top-level part,
 *     the toolbar's All button too,
 *     Tab the enclosing group, Shift+Tab the first part inside, the toolbar's Parts list any of them (drawing order);
 *     several parts: one frame spans them (a dashed mark per part), dragging moves all, handles scale all, arrows
 *     nudge all, and the toolbar's colours, width, opacity, order, Duplicate and Delete apply to every one;
 *   - the selected part gets a frame with eight handles: drag inside to move, a handle to resize (Shift keeps
 *     the proportions), arrows nudge by one SVG unit (Shift: ten), Alt+arrows resize. Geometry is written in
 *     the part's parent coordinate system: x / y / width / height on a rect or image without a transform,
 *     x / y / cx / cy / x1… on a plain move of text, use, circle, ellipse, line — otherwise a matrix()
 *     prepended to the part's own transform, so the path data itself is never rewritten;
 *   - the SVG row of the floating toolbar: Parts, X / Y / W / H (SVG units), fill and stroke (the theme's palette,
 *     None, Default), stroke width, opacity, the text of a <text> part (one run), Order (front / forward /
 *     backward / back — document order inside the parent; Ctrl/Cmd+] / [), Duplicate (Ctrl/Cmd+D), Delete,
 *     Reset SVG (as designed), Done. Fill / stroke / width / opacity are written as presentation attributes,
 *     or as the inline style property when the part already carries one;
 *   - every change is one 'html' edit record of the <svg> element (its innerHTML), so it persists, lands in
 *     the saved copy, is discarded with the slide and prints. Esc deselects the part, then ends the session;
 *     Enter / Done end it; a click outside the SVG ends it too. Reset SVG drops the record.
 *
 * Detachable panels: the shape toolbar, the structure panel and the assistant can be moved into a
 * window of their own (⧉ in their header): a Document Picture-in-Picture window where the browser
 * offers one (Chrome / Edge — always on top, movable anywhere on the desktop, closed with the deck),
 * else a pop-up window. The panel element itself moves into that window's document, so everything it
 * does still acts on the deck; closing the window brings it back. The text toolbar stays attached: it
 * works on the deck window's live text selection.
 *
 * The picker at the pointer: when the menu is detached into its own window, or open on a panel tab, a
 * right-click on the deck opens a compact menu at the pointer with the same "Select at this point"
 * hierarchy as the menu (front-most first, containers and shapes behind), plus Edit text; a click selects,
 * Shift+click adds, Esc / a click elsewhere closes it.
 *
 * One floating toolbar (#nbg-tools) with three tabs — Text (formatting), Shape (shape & arrange rows), SVG (parts) —
 * in a single panel with one grip, one ⚓ and one ⧉ in a side strip. One tab's row shows at a time: the tab of the
 * editor in use comes to the front on its own, a tab the viewer clicks stays in front until another editor takes over,
 * a tab whose editor has nothing to work on is dimmed but opens (idle row); a row's ✕ or the menu's Toolbars section
 * hides a tab (and the menu brings a tab to the front); the panel shows when any tab is wanted. Anchored toolbar: dragging it
 * anchors it — it opens at that spot from then on (ui.anchor.tools, per deck), shows ⚓; ⚓ or a
 * double-click on the grip releases it, and it follows the selection again.
 *
 * Toolbars (menu "Toolbars" section): each toolbar — text formatting, shape & arrange, structure /
 * HTML — is 'auto' (appears with the selection), 'on' (pinned: stays visible, idle when nothing
 * applies) or 'off' (closed with its ✕ or unticked in the menu; stays hidden until shown again);
 * the choice is remembered per deck in this browser. Every toolbar follows the selection: the text
 * toolbar formats the text being edited or, without an edit session, every selected text block at
 * block level; the shape toolbar shows the selection's geometry and style; the structure panel
 * follows the selection and the slide; a slide change drops an off-screen selection.
 *
 * AI assistant — the menu's Assistant tab (Ctrl/Cmd+Shift+L opens it; travels with the menu when detached; no separate menu item)
 *   - a request to an LLM, supported — each behind a checkbox — by a screenshot of the current slide
 *     (tab capture, our UI hidden, cropped to the slide), the slide's full HTML source with the deck's
 *     stylesheet, the selected element's source, and an image from the clipboard (paste into the
 *     request box, drop a file, or "Read clipboard"); embedded images travel as nbg-image:N
 *     placeholders and come back on apply;
 *   - a prompt picked from a drop-down (built-in ones, plus the viewer's own: add / edit / delete,
 *     stored in this browser) and free "additional instructions"; the reply is shown in the panel or,
 *     on request, replaces the selected element through the same path as the Code tab's Apply
 *     (same tag, sanitised, recorded — Undo in the panel);
 *   - the row popup (right-click a row of the structure panel — in the panel's own window when it is
 *     detached): a small movable dialog for one element
 *     with the request box, Answer / Replace, the prompt and the attachments; it stays open until the
 *     viewer closes it (✕, Cancel, Esc) — the status and the reply appear in the popup itself (Copy,
 *     Undo after a replacement, "Open in the assistant panel" for the full panel), and the assistant
 *     panel is never opened on its own;
 *   - providers: Anthropic, Azure-hosted Anthropic (Microsoft Foundry), OpenAI-compatible, Azure
 *     OpenAI, DeepSeek. Endpoint, model and API key live in this browser's storage only (the key
 *     optionally for the tab only) and are never written into the deck; nothing is defaulted — a
 *     missing value blocks the request with a message.
 *
 * Structure / HTML panel — the Outline and Tree tabs of the menu itself (toolbar </>, Ctrl/Cmd+Shift+O / H;
 * a structure tab pins the menu; the menu is detachable into its own window with ⧉, structure included)
 *   - Outline tab: only the shapes (cards, text blocks, images) nested by containment, with a
 *     checkbox per row for picking several, All / None, a text filter, kind icons, sizes, group
 *     badges; click a name selects it alone, Shift+click adds, Ctrl/Cmd+click toggles, Space
 *     toggles the focused row; the selection is highlighted on the slide and in the list;
 *   - Tree tab: the slide's elements (tag, id, classes, attributes, text previews), synced with the
 *     visual selection both ways — selecting on the slide highlights and reveals the row, clicking a
 *     row selects that exact element on the slide (Shift+click adds, double-click edits its text,
 *     hovering outlines it, arrows / Enter navigate); edited elements carry a dot;
 *   - under the Tree (the former Code tab; the API still accepts 'code'): the selected element's source,
 *     editable, below a draggable splitter whose position is remembered per deck (ui.split). Apply (Ctrl/Cmd+Enter) keeps the element's
 *     type, strips scripts / event handlers / javascript: URLs, and records the result as the usual
 *     'style' / 'group' / 'html' edits plus an 'attrs' edit (the other attributes as sorted JSON).
 *
 * Persistence and hand-back
 *   - every change is recorded as { path, kind: 'html' | 'style' | 'group' | 'attrs', original, value } and kept in
 *     localStorage under a key derived from the file, so a reload keeps it until saved/discarded;
 *   - "Save edited copy" downloads <name>-edited.html: the changes applied to a pristine snapshot
 *     of the deck taken when this script ran, so the copy loads exactly like the original — still
 *     self-contained, still carrying this menu; "Discard changes on this slide" restores the slide
 *     under the pointer only, "Discard edits" restores everything.
 *
 * PDF export
 *   - "Export to PDF" applies the shared print layout (every slide visible in flow, one
 *     1920x1080 page per slide, zero margins, backgrounds forced — exactly what
 *     scripts/export-pdf.mjs produces), opens the browser's print dialog, and restores the
 *     interactive deck when the dialog closes. The viewer picks "Save as PDF" (Chrome / Edge);
 *   - Ctrl/Cmd+P and the browser's own Print command go through the same prepare / restore.
 *
 * window.nbgDeck = { version, pdf: { prepare, restore, exportPdf }, edit: { start, commit,
 * cancel, isEditing, list, format, buildEditedHtml, save, discard, discardSlide, listFor, slideAt },
 * ai: { open, close, isOpen, view, send, test, settings, prompts, attach, clearImage, image, reply, apply, undo,
 * capture, hooks, lastRequest, providers }, shape: { select, selectMany,
 * add, remove, toggle, solo, selectAll, deselect, selected, selection, reset, align, distribute,
 * order, group, ungroup, groupOf, shapesOf }, svg: { edit, end, isEditing, target, part, selection, select, selectMany, add,
 * remove, toggle, selectAll, parts, partAt,
 * set, text, geom, nudge, order, remove, duplicate, reset, box, ownerOf }, config, roots, resolveTextTarget, resolveShapeTarget } is exposed; window.nbgPdf aliases
 * the pdf part. An external driver (export-pdf.mjs, tests) sets window.__nbgPdfExternal = true so
 * the native print hooks stay out of its way.
 *
 * The menu, toast, selection frame and toolbars live outside the slides, so the print layout
 * hides them.
 *
 * Configuration (block v11): an optional window.nbgDeckMenuConfig object, set by the inlining script
 * BEFORE this file runs (add-deck-menu.mjs writes it as the first statement of the block), makes the
 * same editor work on documents that are not NBG decks:
 *   - root:  CSS selector of the editable region(s) — the "slides" (default '.slide'; nested matches
 *            are ignored; e.g. 'body', 'main', 'article', 'section.page'); an invalid selector throws;
 *   - mode:  'deck' (default) or 'page'. Page mode changes what does not apply to a web page: the
 *            print path uses the browser's own pagination (backgrounds kept, animations frozen, the
 *            editor's panels hidden) instead of the one-artboard-per-page layout, the assistant's
 *            system prompt and built-in prompts speak of a page, and the wording says page / section;
 *   - unit:  the label of one root in the UI ('Slide' by default, 'Section' in page mode);
 *   - title: the menu's header and the detached windows' title ('NBG deck' / 'Page editor');
 *   - aiSystem: replaces the assistant's system prompt.
 *   - theme: 'nbg' (default) or 'biks2013' (block v14) — the swatches of the formatting, shape and SVG
 *            toolbars, the editor's own accent colours and font, the assistant's system prompt and built-in
 *            prompts, and the default title follow the theme (SKILL.md "Themes").
 * Nothing else changes: the same edits, records, storage keys, saved copy and API.
 */
(function () {
  if (window.nbgDeck) return;
  var VERSION = 14;
  // configuration hook (see the header): root selector, page mode, labels
  var CFG = (typeof window.nbgDeckMenuConfig === 'object' && window.nbgDeckMenuConfig) || {};
  function cfgStr(k) { return typeof CFG[k] === 'string' && CFG[k].trim() ? CFG[k].trim() : ''; }
  var PAGE_MODE = cfgStr('mode') === 'page';
  var ROOT_SEL = cfgStr('root') || '.slide';
  try { document.querySelector(ROOT_SEL); } catch (e) { throw new Error('nbg deck menu: invalid root selector "' + ROOT_SEL + '" in window.nbgDeckMenuConfig.root'); }
  var UNIT = cfgStr('unit') || (PAGE_MODE ? 'Section' : 'Slide');          // one root, in labels: "Slide 2", "Section 2"
  var THEME = cfgStr('theme') === 'biks2013' ? 'biks2013' : 'nbg', BIKS = THEME === 'biks2013', THEME_NAME = BIKS ? 'BikS2013' : 'NBG';   // block v14: the theme
  var TITLE = cfgStr('title') || (PAGE_MODE ? 'Page editor' : THEME_NAME + ' deck');  // menu header, detached windows
  var AREA = PAGE_MODE ? 'page' : 'slide', AREA_CAP = PAGE_MODE ? 'Page' : 'Slide';   // generic wording ("on the page")
  var WHOLE = PAGE_MODE ? 'page' : 'deck';                                            // the document ("download the page")
  function rootOf(el) { return el && el.closest ? el.closest(ROOT_SEL) : null; }
  function isRoot(el) { return !!el && el.nodeType === 1 && el.matches(ROOT_SEL); }
  function allRoots() {   // top-level matches only (a root inside a root is part of its content)
    return Array.prototype.filter.call(document.querySelectorAll(ROOT_SEL), function (s) { return !(s.parentElement && s.parentElement.closest(ROOT_SEL)); });
  }
  function rootScoped(tag) { return ROOT_SEL.split(',').map(function (s) { return s.trim() + ' ' + tag; }).join(', '); }
  function unitLabel(root) { return PAGE_MODE && allRoots().length <= 1 ? 'Page' : UNIT + ' ' + (slideIndex(root) + 1); }   // "Slide 2" / "Section 2" / "Page"
  function unitOf(root) { var n = allRoots().length; return unitLabel(root) + (n > 1 ? ' of ' + n : ''); }                  // "Slide 2 of 12"
  function unitPhrase(root) { var l = unitLabel(root); return l === 'Page' ? 'the page' : l.charAt(0).toLowerCase() + l.slice(1); }   // "slide 2" / "the page"
  var ACCENT = BIKS ? '#1B1D21' : '#003841', CYAN = BIKS ? '#C8623A' : '#00ADBF', INK = BIKS ? '#111316' : '#0A1416', CREAM = BIKS ? '#F6F3EC' : '#F5F8F6', MUTED = BIKS ? '#6E7379' : '#5B6B6D';
  var FONT = BIKS ? "'Avenir Next', 'Inter', Helvetica, Arial, sans-serif" : "'Aptos', 'Inter', Helvetica, Arial, sans-serif";
  // the swatches of every toolbar: the theme's palette (SKILL.md), the only colours a deck may use
  var PALETTE = BIKS
    ? [['#1B1D21', 'Ink'], ['#C8623A', 'Copper'], ['#E08A5E', 'Copper light'], ['#E3A64A', 'Amber'], ['#111316', 'Black'], ['#6E7379', 'Grey'], ['#F6F3EC', 'Paper'], ['#FFFFFF', 'White']]
    : [['#003841', 'Deep teal'], ['#007B85', 'Teal'], ['#00ADBF', 'Bright cyan'], ['#00CFE7', 'Electric cyan'], ['#0A1416', 'Black'], ['#5B6B6D', 'Grey'], ['#F5F8F6', 'Cream'], ['#FFFFFF', 'White']];
  var PALETTE_NAME = THEME_NAME + ' palette';

  // Pristine snapshot of the deck as loaded — BEFORE persisted edits are re-applied and before any
  // runtime element of ours exists. "Save edited copy" applies the edits to this markup.
  var DOCTYPE = document.doctype ? '<!DOCTYPE ' + document.doctype.name + '>' : '<!DOCTYPE html>';
  var PRISTINE = document.documentElement.outerHTML;

  /* ---------- element paths (stable between the live DOM and the pristine snapshot) ---------- */
  function pathOf(el) {
    var path = [];
    while (el && el !== document.documentElement) {
      var p = el.parentElement; if (!p) return null;
      path.unshift(Array.prototype.indexOf.call(p.children, el));
      el = p;
    }
    return path;
  }
  function elAt(root, path) {
    var el = root.documentElement;
    for (var i = 0; i < path.length && el; i++) el = el.children[path[i]];
    return el || null;
  }

  /* ---------- target resolution ---------- */
  var OURS = '#nbg-deck-menu, #nbg-deck-toast, #nbg-shape-box, #nbg-svg-box, #nbg-svg-marks, #nbg-sel-marks, #nbg-marquee, #nbg-hover, #nbg-tools, #nbg-text-tools, #nbg-shape-tools, #nbg-svg-tools, #nbg-code, #nbg-ai, #nbg-ai-pop, #nbg-stack-pop';
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var INLINE = /^(span|a|b|i|em|strong|small|code|sup|sub|mark|u|abbr|time|label|s|q)$/i;
  function hasOwnText(el) {
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.nodeValue.trim()) return true;
    return false;
  }
  function resolveTextTarget(t) {
    if (t && t.nodeType === 3) t = t.parentElement;
    if (!t || !t.closest) return null;
    if (t.closest(OURS)) return null;
    var slide = rootOf(t); if (!slide) return null;
    var el = t;
    while (el && el !== slide && !hasOwnText(el)) el = el.parentElement;
    if (!el || el === slide) return null;
    // an inline run inside a text block edits the whole block (keeps the accent spans intact)
    while (el.parentElement && el.parentElement !== slide && INLINE.test(el.tagName) && hasOwnText(el.parentElement)) el = el.parentElement;
    if (/^(img|svg|video|canvas|input|textarea|select|button)$/i.test(el.tagName)) return null;
    if (el.namespaceURI === SVG_NS) return null;   // SVG <text> is edited through "Edit SVG", not contenteditable
    return el;
  }
  function isBoxy(el) {
    if (/^(img|svg|video|canvas|picture|iframe)$/i.test(el.tagName)) return true;
    var cs = getComputedStyle(el);
    if (cs.position === 'absolute' || cs.position === 'fixed') return true;
    if (cs.backgroundImage !== 'none') return true;
    if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') return true;
    if (cs.boxShadow !== 'none') return true;
    if (parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0 || parseFloat(cs.borderRightWidth) > 0) return true;
    return false;
  }
  function resolveShapeTarget(t) {
    if (t && t.nodeType === 3) t = t.parentElement;
    if (!t || !t.closest) return null;
    if (t.closest(OURS)) return null;
    var slide = rootOf(t); if (!slide || t === slide) return null;
    var el = t;
    while (el && el !== slide) { if (isBoxy(el)) return el; el = el.parentElement; }
    return resolveTextTarget(t);
  }
  // a "shape" for the stack pickers: a boxed element or a text block (a text block inside a card is
  // reachable this way, although a click resolves to the card)
  function isShapeCandidate(el) { return !!el && el.nodeType === 1 && !el.closest(OURS) && (isBoxy(el) || resolveTextTarget(el) === el); }
  function parentShape(el) {
    var slide = rootOf(el); if (!slide) return null;
    var p = el.parentElement;
    while (p && p !== slide) { if (isShapeCandidate(p)) return p; p = p.parentElement; }
    return null;
  }
  function ancestorShapes(el) { var out = [], p = parentShape(el); while (p) { out.unshift(p); p = parentShape(p); } return out; }   // outermost first
  // the element's box in artboard px — offsetWidth / offsetHeight, or the screen box unscaled for an <svg> (no offset box)
  function offW(el) { return el.offsetWidth !== undefined ? el.offsetWidth : el.getBoundingClientRect().width / (slideScale(el) || 1); }
  function offH(el) { return el.offsetHeight !== undefined ? el.offsetHeight : el.getBoundingClientRect().height / (slideScale(el) || 1); }
  function childShapes(el) {   // the first shape level inside el
    var out = [];
    Array.prototype.forEach.call(el.querySelectorAll('*'), function (c) {
      if (!isShapeCandidate(c) || !offW(c) || !offH(c)) return;
      var p = c.parentElement; while (p && p !== el && !isShapeCandidate(p)) p = p.parentElement;
      if (p === el) out.push(c);
    });
    return out;
  }
  // every shape under a point, front-most / innermost first (nested ancestors and overlapping siblings alike)
  function shapeStack(x, y) {
    var out = [];
    document.elementsFromPoint(x, y).forEach(function (el) {
      if (el.closest(OURS)) return;
      var slide = rootOf(el); if (!slide || el === slide) return;
      if (isShapeCandidate(el) && out.indexOf(el) < 0) out.push(el);
    });
    return out;
  }
  var lastPoint = null;   // where the pointer last went down / right-clicked (for Shift+Tab and the Ctrl/Cmd+click cycling on a leaf)
  function describe(el) {
    var cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(function (c) { return c && !/^nbg-/.test(c) && c !== 'active'; })[0];
    var w = el.offsetWidth, h = el.offsetHeight;
    if (w === undefined) { var r = el.getBoundingClientRect(), sc = slideScale(el) || 1; w = r.width / sc; h = r.height / sc; }   // SVG elements have no offset box: artboard px from the screen box
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : cls ? '.' + cls : '') + ' · ' + Math.round(w) + '×' + Math.round(h);
  }

  /* ---------- edit records + persistence ---------- */
  var STORAGE_KEY = 'nbg-deck-edits:' + location.pathname + '#' + document.title;
  var edits = [];          // { path, kind: 'html' | 'style' | 'group' | 'attrs', original, value }
  var editing = null;      // { el, original }
  function attrStyle(el) { return el.hasAttribute('style') ? el.getAttribute('style') : null; }
  function current(el, kind) { return kind === 'style' ? attrStyle(el) : kind === 'group' ? (el.getAttribute('data-nbg-group') || null) : kind === 'attrs' ? attrsOf(el) : el.innerHTML; }
  function apply(el, kind, value) {
    if (kind === 'style') { if (value === null) el.removeAttribute('style'); else el.setAttribute('style', value); }
    else if (kind === 'group') { if (value === null) el.removeAttribute('data-nbg-group'); else el.setAttribute('data-nbg-group', value); }
    else if (kind === 'attrs') applyAttrs(el, value);
    else el.innerHTML = value;
  }
  function store() {
    try { if (edits.length) localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 2, edits: edits })); else localStorage.removeItem(STORAGE_KEY); } catch (e) { /* storage unavailable */ }
    codeRefresh();
  }
  function loadStored() {
    var raw = null; try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return; }
    if (!raw) return;
    var data; try { data = JSON.parse(raw); } catch (e) { return; }
    if (!data || !data.edits) return;
    data.edits.forEach(function (ed) {
      if (!ed.kind) { ed.kind = 'html'; ed.value = ed.html; delete ed.html; }   // v1 records
      var el = elAt(document, ed.path);
      if (el && current(el, ed.kind) === ed.original) { apply(el, ed.kind, ed.value); edits.push(ed); }   // stale entries (deck changed) are dropped
    });
    store();
  }
  function findEdit(el, kind) {
    var key = pathOf(el).join('/');
    for (var i = 0; i < edits.length; i++) if (edits[i].kind === kind && edits[i].path.join('/') === key) return edits[i];
    return null;
  }
  function recordEdit(el, kind, original, value) {
    var ed = findEdit(el, kind);
    if (ed) { ed.value = value; }                                    // keep the first original
    else edits.push({ path: pathOf(el), kind: kind, original: original, value: value });
    // an edit that lands back on the original is no edit
    edits = edits.filter(function (e) { return e.value !== e.original; });
    store();
  }
  function changesLabel() { return edits.length + ' unsaved change' + (edits.length === 1 ? '' : 's'); }

  /* ---------- toolbar visibility: 'auto' (with the selection), 'on' (pinned), 'off' (closed by the viewer) ---------- */
  var UI_KEY = 'nbg-deck-ui:' + location.pathname;
  var ui = { text: 'auto', shape: 'auto', svg: 'auto', code: 'auto', ai: 'auto', fold: { code: false, ai: false }, menuFold: false, split: 0.55, anchor: { tools: null } };   // anchor: where the viewer dragged the toolbar — it opens there until released   // split: the Tree tab's share above the source editor   // code / ai: 'auto' = opens on request only; fold: collapsed to the header; menuFold: the menu's Toolbars section collapsed
  try { var uiStored = JSON.parse(localStorage.getItem(UI_KEY) || 'null'); if (uiStored) { ['text', 'shape', 'svg', 'code', 'ai'].forEach(function (k) { if (/^(auto|on|off)$/.test(uiStored[k])) ui[k] = uiStored[k]; }); if (uiStored.fold && typeof uiStored.fold === 'object') ['code', 'ai'].forEach(function (k) { if (typeof uiStored.fold[k] === 'boolean') ui.fold[k] = uiStored.fold[k]; }); if (typeof uiStored.menuFold === 'boolean') ui.menuFold = uiStored.menuFold; if (typeof uiStored.split === 'number' && uiStored.split >= 0.1 && uiStored.split <= 0.9) ui.split = uiStored.split; if (uiStored.anchor && typeof uiStored.anchor === 'object') ['tools'].forEach(function (k) { var a = uiStored.anchor[k]; if (a && typeof a.left === 'number' && typeof a.top === 'number') ui.anchor[k] = { left: a.left, top: a.top }; }); } } catch (e) { /* storage unavailable */ }
  // the structure and assistant panels collapse to their header row (the ▾ / ▸ button); remembered per deck
  function applyFold(k) {
    return;   // the structure and the assistant live in the menu now — nothing folds
    var on = !!ui.fold[k]; panel.classList.toggle('nbg-folded', on);
    var b = panel.querySelector('[data-c=fold]'); if (b) { b.textContent = on ? '▸' : '▾'; b.title = on ? 'Expand this panel' : 'Collapse this panel to its header — click again to expand'; }
  }
  function setFold(k, on) { return; }   // kept for the API; the panels are tabs of the menu and do not fold
  function uiSave() { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (e) { /* ignore */ } }
  var TOOLBAR_NAMES = { text: 'Text formatting', shape: 'Shape & arrange', svg: 'SVG parts', code: 'Structure & HTML', ai: 'AI assistant', menu: 'Menu & structure', tools: 'Text, shape & SVG toolbar' };
  function textTargets() { return editing ? [editing.el] : sel.filter(hasOwnText); }   // what the text toolbar works on
  function toolbarWanted(k) {
    if (isDetached(k)) return true;                 // a detached panel stays in its window (idle when nothing applies)
    if (ui[k] === 'off') return false;
    if (ui[k] === 'on') return true;
    if (k === 'text') return !!editing || textTargets().length > 0;
    if (k === 'shape') return !!shape;
    if (k === 'svg') return !!svgEd;
    return false;                                   // the structure and assistant panels open on request only
  }
  function toolbarPanel(k) { return k === 'text' ? tools : k === 'shape' ? stools : k === 'svg' ? gtools : k === 'tools' ? tbar : k === 'code' ? code : k === 'menu' ? menu : ai; }
  function toolbarVisible(k) { if (k === 'text' || k === 'shape' || k === 'svg') return !!(tbar && !tbar.hidden && ui[k] !== 'off'); var p = toolbarPanel(k); return !!(p && !p.hidden); }   // text / shape / svg: their tab is on the toolbar
  function setToolbarMode(k, mode) { ui[k] = mode; uiSave(); if (mode === 'on' && TB_TABS.indexOf(k) >= 0) tbTab = k; syncToolbars(); }   // pinning a tab brings it to the front
  // show / hide every toolbar according to its mode and the current selection, then lay them out
  // the one floating toolbar has three tabs — Text, Shape, SVG — one row at a time: the tab of the editor in use comes to the
  // front on its own (tbAuto), a tab the viewer picked stays until another editor takes over; the panel shows when any tab is
  // wanted (its editor applies, or it is pinned); a tab whose editor has nothing to work on is dimmed but still opens (idle row)
  var TB_TABS = ['text', 'shape', 'svg'], tbTab = null, tbAuto = null;
  function tbApplies(k) { return k === 'text' ? !!editing || textTargets().length > 0 : k === 'shape' ? !!shape : k === 'svg' ? !!svgEd : false; }
  // the editor in use: text being edited; a selection made of text blocks only → Text, any other selection → Shape; an SVG session → SVG
  function tbAutoKind() { return editing ? 'text' : shape ? (sel.length && sel.every(hasOwnText) ? 'text' : 'shape') : svgEd ? 'svg' : textTargets().length ? 'text' : null; }
  function setTbTab(k) { if (TB_TABS.indexOf(k) < 0) return false; tbTab = k; if (ui[k] === 'off') ui[k] = 'on'; syncToolbars(); return true; }
  function syncToolbars() {
    var want = {}, any = false;
    TB_TABS.forEach(function (k) { want[k] = toolbarWanted(k); if (want[k]) any = true; });
    var auto = tbAutoKind();
    if (auto && auto !== tbAuto) tbTab = auto;   // the editor in use takes the front
    tbAuto = auto;
    if (!tbTab || ui[tbTab] === 'off' || (!want[tbTab] && !any)) tbTab = TB_TABS.filter(function (k) { return want[k]; })[0] || (any ? tbTab : null);
    if (any && tbTab && ui[tbTab] === 'off') tbTab = TB_TABS.filter(function (k) { return want[k]; })[0] || null;
    if (any) { ensureTbar(); if (tbTab === 'text' && !tools) buildTools(); if (tbTab === 'shape' && !stools) buildShapeTools(); if (tbTab === 'svg' && !gtools) buildSvgTools(); }
    if (tools) tools.hidden = !(any && tbTab === 'text'); if (!any || tbTab !== 'text') toolsSel = null;
    if (stools) stools.hidden = !(any && tbTab === 'shape');
    if (gtools) gtools.hidden = !(any && tbTab === 'svg');
    if (tbar) { tbar.hidden = !any; renderTbTabs(); }
    layoutTools(); layoutShapeTools(); layoutSvgTools(); placeTbar(); layoutAi();
    if (menuHeld() && menu && !menu.hidden) refreshMenu();
  }
  function renderTbTabs() {
    if (!tbar) return;
    Array.prototype.forEach.call(tbar.querySelectorAll('.nbg-tbtab'), function (b) {
      var k = b.getAttribute('data-tab');
      b.hidden = ui[k] === 'off';
      b.classList.toggle('nbg-on', k === tbTab);
      b.classList.toggle('nbg-tbidle', !tbApplies(k));
      b.title = TOOLBAR_NAMES[k] + (tbApplies(k) ? '' : k === 'text' ? ' — double-click a text to edit it, or select text blocks' : k === 'shape' ? ' — right-click → Resize / move shape, or double-click a shape' : ' — right-click an SVG → Edit SVG');
    });
  }

  /* ---------- text editing ---------- */
  function startEdit(el, keepSelection) {
    if (!el || busy) return false;
    if (editing && editing.el === el) return true;
    if (editing) commitEdit();
    if (svgEd) svgEnd();
    deselectShape();
    closeMenu();
    var sel = window.getSelection(), ranges = [];
    if (keepSelection && sel) for (var i = 0; i < sel.rangeCount; i++) ranges.push(sel.getRangeAt(i).cloneRange());
    editing = { el: el, original: el.innerHTML, preStyle: attrStyle(el) };
    // Rich contenteditable (plaintext-only would force white-space:pre-wrap and re-flow the text
    // while editing). Only the toolbar's formatting commands are allowed in `beforeinput` (rich
    // paste and drops insert plain text), and every element the browser inserts — other than
    // <br> and the semantic b/i/u/s tags the toolbar produces — is unwrapped on commit; the
    // original descendants are tagged so they can be told apart.
    el.querySelectorAll('*').forEach(function (c) { c.setAttribute('data-nbg-orig', ''); });
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'true');
    el.classList.add('nbg-editing');
    try { document.execCommand('styleWithCSS', false, false); } catch (x) { /* tags, not spans */ }
    el.focus({ preventScroll: true });
    if (sel) {
      sel.removeAllRanges();
      if (ranges.length) ranges.forEach(function (r) { sel.addRange(r); });
      else { var r = document.createRange(); r.selectNodeContents(el); r.collapse(false); sel.addRange(r); }
    }
    showTools();
    codeFollow();
    toast('Editing — Enter applies, Esc cancels, Shift+Enter for a line break. Use the toolbar (or Ctrl/Cmd+B/I/U, Ctrl/Cmd+Shift+> / <) to format.', 3000);
    return true;
  }
  var KEEP_TAGS = /^(BR|B|STRONG|I|EM|U|S|STRIKE)$/;
  // Chrome expresses "un-bold inside a bold block" (and the italic/underline equivalents) as a
  // styled span; keep such spans when their style holds nothing but those three properties.
  var FORMAT_PROPS = /^(font-weight|font-style|font-size|font-family|color|line-height|text-decoration(-line|-style|-color|-thickness)?)$/;
  function isFormatSpan(c) {
    if (c.tagName !== 'SPAN' || c.attributes.length !== 1 || !c.hasAttribute('style')) return false;
    for (var i = 0; i < c.style.length; i++) if (!FORMAT_PROPS.test(c.style[i])) return false;
    return c.style.length > 0;
  }
  function endEdit() {
    var e = editing; editing = null;
    hideTools();
    codeRefresh();
    e.el.removeAttribute('contenteditable');
    e.el.removeAttribute('spellcheck');
    e.el.classList.remove('nbg-editing');
    if (e.el.getAttribute('class') === '') e.el.removeAttribute('class');
    // keep the original inline markup and the toolbar's b/i/u/s wrappers, drop whatever else the
    // browser wrapped around typed text (styled spans, fonts, divs)
    var all = Array.prototype.slice.call(e.el.querySelectorAll('*')).reverse();   // deepest first
    all.forEach(function (c) {
      if (c.hasAttribute('data-nbg-orig')) { c.removeAttribute('data-nbg-orig'); return; }
      if (KEEP_TAGS.test(c.tagName) || isFormatSpan(c)) { if (c.tagName !== 'BR' && !c.textContent) c.parentNode.removeChild(c); else if (c.tagName === 'STRIKE') { var s2 = document.createElement('s'); while (c.firstChild) s2.appendChild(c.firstChild); c.parentNode.replaceChild(s2, c); } return; }
      while (c.firstChild) c.parentNode.insertBefore(c.firstChild, c);
      c.parentNode.removeChild(c);
    });
    return e;
  }
  function commitEdit() {
    if (!editing) return false;
    var e = endEdit();
    var changed = false;
    if (e.el.innerHTML !== e.original) {
      var ed = findEdit(e.el, 'html');
      recordEdit(e.el, 'html', ed ? ed.original : e.original, e.el.innerHTML);
      changed = true;
    }
    if (attrStyle(e.el) !== e.preStyle) {
      var sd = findEdit(e.el, 'style');
      recordEdit(e.el, 'style', sd ? sd.original : e.preStyle, attrStyle(e.el));
      changed = true;
    }
    if (changed) toast('Text updated — ' + changesLabel() + '. Right-click → “Save edited copy” to download the ' + WHOLE + ' with your changes.', 5000);
    return true;
  }
  function cancelEdit() {
    if (!editing) return false;
    var e = endEdit();
    e.el.innerHTML = e.original;
    apply(e.el, 'style', e.preStyle);
    return true;
  }

  /* ---------- floating panels (movable toolbars) ---------- */
  var panelPos = {};   // panel id -> { left, top } once the viewer dragged it; cleared by double-clicking the grip
  // dragSurface: an optional selector for a second drag handle (e.g. a panel's header row) — its
  // empty space and labels move the panel, its buttons / fields keep their own behaviour
  // anchorKey ('text' | 'shape'): a dragged toolbar is anchored — it opens at that spot from then on, per deck
  // (ui.anchor), shows ⚓, and the ⚓ (or the grip's double-click) releases it to follow the selection again
  function makeMovable(panel, relayout, dragSurface, onMoved, anchorKey) {   // onMoved(pos | null): after a drag, or when the panel is released
    var grip = document.createElement('span');
    grip.className = 'nbg-grip'; grip.textContent = '⋮⋮';
    grip.title = anchorKey ? 'Drag to move this toolbar — it then stays anchored there; double-click (or ⚓) to let it follow the selection again' : 'Drag to move this toolbar — double-click to let it follow the selection again';
    var host = panel.querySelector('.nbg-tbside, .nbg-row') || panel;   // the toolbar's side strip, else a multi-row panel's first row
    host.insertBefore(grip, host.firstChild);
    var anchorBtn = null;
    if (anchorKey) {
      anchorBtn = document.createElement('button');
      anchorBtn.type = 'button'; anchorBtn.className = 'nbg-anchor'; anchorBtn.textContent = '⚓'; anchorBtn.hidden = true;
      anchorBtn.title = 'Anchored here — this toolbar opens at this spot. Click to release it: it follows the selection again.';
      anchorBtn.setAttribute('aria-label', 'Anchored — click to release');
      host.insertBefore(anchorBtn, grip.nextSibling);
      anchorBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      anchorBtn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); setAnchored(null); relayout(); toast('Toolbar released — it follows the selection again.', 2000); });
    }
    function setAnchored(pos) {   // pos = { left, top } | null
      if (pos) panelPos[panel.id] = { left: pos.left, top: pos.top }; else delete panelPos[panel.id];
      panel.classList.toggle('nbg-anchored', !!pos);
      if (anchorBtn) anchorBtn.hidden = !pos;
      if (anchorKey) { ui.anchor[anchorKey] = pos ? { left: pos.left, top: pos.top } : null; uiSave(); }
      if (onMoved) onMoved(pos ? { left: pos.left, top: pos.top } : null);
    }
    if (anchorKey && ui.anchor[anchorKey]) { var a0 = ui.anchor[anchorKey]; panelPos[panel.id] = { left: a0.left, top: a0.top }; panel.classList.add('nbg-anchored'); anchorBtn.hidden = false; }
    var pd = null;
    function down(handle, e) {
      if (detachedPanel(panel)) return;
      if (handle !== grip && e.target.closest('button, input, select, textarea, a, .nbg-grip')) return;
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      var r = panel.getBoundingClientRect();
      pd = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false };
      try { handle.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    }
    function move(e) {
      if (!pd || e.pointerId !== pd.id) return;
      var r = panel.getBoundingClientRect();
      var left = Math.max(0, Math.min(e.clientX - pd.dx, window.innerWidth - r.width));
      var top = Math.max(0, Math.min(e.clientY - pd.dy, window.innerHeight - r.height));
      if (!pd.moved && panelPos[panel.id] && panelPos[panel.id].left === left && panelPos[panel.id].top === top) return;
      pd.moved = true;
      panelPos[panel.id] = { left: left, top: top };
      panel.style.left = left + 'px'; panel.style.top = top + 'px';
    }
    function up(e) {
      if (!pd || e.pointerId !== pd.id) return;
      var moved = pd.moved; pd = null;
      if (!moved) return;
      var was = anchorKey && panel.classList.contains('nbg-anchored');
      setAnchored(panelPos[panel.id] || null);
      if (anchorKey && !was && panelPos[panel.id]) toast('Toolbar anchored here — it opens at this spot from now on. ⚓ (or a double-click on the grip) releases it.', 3000);
    }
    var handles = [grip].concat(dragSurface ? Array.prototype.slice.call(panel.querySelectorAll(dragSurface)) : []);
    handles.forEach(function (h) {
      h.addEventListener('pointerdown', function (e) { down(h, e); });
      h.addEventListener('pointermove', move);
      h.addEventListener('pointerup', up);
      h.addEventListener('pointercancel', up);
      if (h !== grip) h.classList.add('nbg-dragsurface');
    });
    grip.addEventListener('dblclick', function (e) { e.preventDefault(); e.stopPropagation(); setAnchored(null); relayout(); });
    grip.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); });
  }
  function placePanel(panel, anchor) {   // anchor = the selection's rect, or null for an idle toolbar (docked top-left)
    if (detachedPanel(panel)) return;
    panel.style.left = '0px'; panel.style.top = '0px';
    var tr = panel.getBoundingClientRect(), pos = panelPos[panel.id], left, top;
    if (pos) {
      left = Math.max(0, Math.min(pos.left, window.innerWidth - tr.width));
      top = Math.max(0, Math.min(pos.top, window.innerHeight - tr.height));
    } else if (!anchor) { left = 8; top = 8; }
    else {
      left = Math.max(8, Math.min(anchor.left, window.innerWidth - tr.width - 8));
      // above the anchor; else below it; else just inside its top edge (keeps the frame's handles free)
      top = anchor.top - tr.height - 12;
      if (top < 8) top = anchor.bottom + 12 + tr.height <= window.innerHeight - 8 ? anchor.bottom + 12 : Math.max(8, Math.min(anchor.top + 16, window.innerHeight - tr.height - 8));
    }
    panel.style.left = left + 'px'; panel.style.top = top + 'px';
  }
  /* ---------- the one floating toolbar: the text row and the shape rows in a single panel ---------- */
  var tbar = null;
  function ensureTbar() {
    if (tbar) return tbar;
    tbar = document.createElement('div');
    tbar.id = 'nbg-tools'; tbar.className = 'nbg-panel nbg-tbar'; tbar.hidden = true;
    tbar.setAttribute('role', 'toolbar'); tbar.setAttribute('aria-label', 'Text and shape toolbar');
    tbar.innerHTML = '<div class="nbg-tbside"><button type="button" data-tb="detach" class="nbg-tquiet nbg-detach" title="Detach this toolbar into its own window — in Chrome / Edge an always-on-top window you can move anywhere, even off the browser; close it to bring the toolbar back">⧉</button></div>' +
      '<div class="nbg-tbmain"><div class="nbg-tbtabs" role="tablist">' + TB_TABS.map(function (k) { return '<button type="button" role="tab" class="nbg-tbtab" data-tab="' + k + '">' + (k === 'text' ? 'Text' : k === 'shape' ? 'Shape' : 'SVG') + '</button>'; }).join('') + '</div><div class="nbg-tbrows"></div></div>';
    tbar.querySelector('[data-tb=detach]').addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); detachPanel('tools'); });
    var tabs = tbar.querySelector('.nbg-tbtabs');
    tabs.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); if (editing) saveSelection(); });   // keep the text being edited focused
    tabs.addEventListener('click', function (e) { var b = e.target.closest('.nbg-tbtab'); if (!b) return; e.preventDefault(); e.stopPropagation(); setTbTab(b.getAttribute('data-tab')); if (editing) restoreSelection(); });
    document.body.appendChild(tbar);
    makeMovable(tbar, placeTbar, null, null, 'tools');   // one grip, one anchor for the three tabs
    return tbar;
  }
  function placeTbar() {   // next to what is being edited or selected; docked top-left when idle; where it is anchored
    if (!tbar || tbar.hidden) return;
    var anchor = null;
    if (editing) anchor = editing.el.getBoundingClientRect();
    else if (sel.length) anchor = unionRect(sel);
    else if (svgEd) anchor = (svgEd.part && svgEd.part.isConnected ? svgEd.part : svgEd.svg).getBoundingClientRect();
    else { var tt = textTargets(); if (tt.length) anchor = unionRect(tt); }
    placePanel(tbar, anchor);
  }
  function swatches(attr, list) {
    return '<span class="nbg-swatches">' + list.map(function (c) {
      var bg = c[0] === '' ? 'linear-gradient(135deg,#fff 45%,#0A1416 55%)' : c[0] === 'transparent' ? 'repeating-linear-gradient(45deg,#ddd 0 4px,#fff 4px 8px)' : c[0];
      return '<button type="button" data-' + attr + '="' + c[0] + '" title="' + c[1] + '" style="background:' + bg + '"></button>';
    }).join('') + '</span>';
  }
  function normColor(v) { if (!v) return ''; var d = document.createElement('i'); d.style.color = v; return d.style.color || v; }

  /* ---------- text formatting toolbar (shown while editing) ---------- */
  var FONTS = [
    ['', 'Default (Aptos)'], ["'Aptos', 'Inter', Helvetica, Arial, sans-serif", 'Aptos'], ["'Inter', Helvetica, Arial, sans-serif", 'Inter'],
    ['Helvetica, Arial, sans-serif', 'Helvetica'], ['Arial, sans-serif', 'Arial'], ['Georgia, serif', 'Georgia'],
    ["'Times New Roman', Times, serif", 'Times New Roman'], ["'Courier New', Courier, monospace", 'Courier New'],
  ];
  var COLORS = [['', 'Default']].concat(PALETTE);
  var tools = null, toolsSel = null;
  function selectionInEditing() {
    var sel = window.getSelection();
    return !!(sel && sel.rangeCount && editing && editing.el.contains(sel.getRangeAt(0).commonAncestorContainer));
  }
  function currentRange() { var sel = window.getSelection(); return (sel && sel.rangeCount && selectionInEditing()) ? sel.getRangeAt(0) : null; }
  function saveSelection() { var r = currentRange(); toolsSel = r ? r.cloneRange() : null; }
  function restoreSelection() {
    if (!editing) return;
    if (document.activeElement === editing.el) return;      // the live selection is authoritative
    editing.el.focus({ preventScroll: true });
    var sel = window.getSelection();
    if (sel && toolsSel) { sel.removeAllRanges(); sel.addRange(toolsSel); }
  }
  function styleProp(el, prop) { return el.style.getPropertyValue(prop); }
  function setTextStyle(prop, value, el) {
    el = el || editing.el;
    if (value === '' || value === null) el.style.removeProperty(prop); else el.style.setProperty(prop, value);
    if (el.getAttribute('style') === '') el.removeAttribute('style');
  }
  function fontSizePx(el) { return parseFloat(getComputedStyle(el).fontSize) || 16; }
  function setBlockFontSize(px, el) {
    el = el || editing.el;
    var cs = getComputedStyle(el);
    // keep the line-height proportional when the design fixed it in px
    if (!styleProp(el, 'line-height') && cs.lineHeight !== 'normal') {
      var ratio = (parseFloat(cs.lineHeight) || 0) / fontSizePx(el);
      if (ratio > 0) setTextStyle('line-height', String(Math.round(ratio * 1000) / 1000), el);
    }
    setTextStyle('font-size', Math.max(8, Math.round(px)) + 'px', el);
  }
  function toggleBlock(prop, on, off, el) {
    el = el || editing.el;
    var cur = styleProp(el, prop) || getComputedStyle(el)[prop.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); })];
    setTextStyle(prop, (cur || '').indexOf(on) >= 0 ? off : on, el);
  }
  function toggleDecoration(kind, el) {
    el = el || editing.el;
    var cur = (styleProp(el, 'text-decoration') || getComputedStyle(el).textDecorationLine || '').split(/\s+/).filter(function (x) { return x && x !== 'none'; });
    var i = cur.indexOf(kind);
    if (i >= 0) cur.splice(i, 1); else cur.push(kind);
    setTextStyle('text-decoration', cur.length ? cur.join(' ') : 'none', el);
  }
  // the text toolbar on selected text blocks (no edit session): block-level, on every selected text block
  function formatBlocks(action, value) {
    var els = textTargets(); if (!els.length) return false;
    var f = action === 'bigger' ? 1.1 : 1 / 1.1;
    var n = withRecords(els, function () {
      els.forEach(function (el) {
        switch (action) {
          case 'bold': toggleBlock('font-weight', '700', '400', el); break;
          case 'italic': toggleBlock('font-style', 'italic', 'normal', el); break;
          case 'underline': toggleDecoration('underline', el); break;
          case 'strike': toggleDecoration('line-through', el); break;
          case 'bigger': case 'smaller': setBlockFontSize(fontSizePx(el) * f, el); break;
          case 'size': if (value) setBlockFontSize(parseFloat(value), el); break;
          case 'family': setTextStyle('font-family', value || '', el); break;
          case 'color': setTextStyle('color', value || '', el); break;
          case 'align': setTextStyle('text-align', value || '', el); break;
          case 'clear': { var rec = findEdit(el, 'style'); if (rec) apply(el, 'style', rec.original); break; }
          default: break;
        }
      });
    });
    layoutTools();
    if (n) toast('Formatting applied to ' + (els.length === 1 ? describe(els[0]) : els.length + ' text blocks') + ' — ' + changesLabel() + '.', 2500);
    return n > 0;
  }
  // Selection-level styling: wrap exactly the selected text runs in styled spans (reusing a span
  // that already wraps just that run), so the rest of the block is untouched.
  function wrapSelection(styler) {
    var range = currentRange(); if (!range || range.collapsed) return false;
    var root = range.commonAncestorContainer; if (root.nodeType === 3) root = root.parentNode;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), nodes = [];
    while (walker.nextNode()) { var n = walker.currentNode; if (n.nodeValue && range.intersectsNode(n)) nodes.push(n); }
    var wrapped = [];
    nodes.forEach(function (n) {
      var start = n === range.startContainer ? range.startOffset : 0;
      var end = n === range.endContainer ? range.endOffset : n.nodeValue.length;
      if (start >= end || !n.nodeValue.slice(start, end).trim()) return;      // nothing, or whitespace only
      var target = n;
      if (end < n.nodeValue.length) n.splitText(end);
      if (start > 0) target = n.splitText(start);
      var p = target.parentNode, span;
      if (p !== editing.el && p.tagName === 'SPAN' && !p.hasAttribute('data-nbg-orig') && p.childNodes.length === 1 && isFormatSpan(p)) span = p;
      else { span = document.createElement('span'); p.insertBefore(span, target); span.appendChild(target); }
      styler(span);
      if (!span.getAttribute('style')) { while (span.firstChild) span.parentNode.insertBefore(span.firstChild, span); span.parentNode.removeChild(span); wrapped.push(target); }
      else wrapped.push(span);
    });
    if (wrapped.length) {
      var sel = window.getSelection(), r = document.createRange();
      r.setStartBefore(wrapped[0]); r.setEndAfter(wrapped[wrapped.length - 1]);
      sel.removeAllRanges(); sel.addRange(r);
    }
    return wrapped.length > 0;
  }
  function unwrapSelectionSpans() {
    var range = currentRange(); if (!range) return;
    Array.prototype.slice.call(editing.el.querySelectorAll('span[style], b, i, u, s, strong, em, strike')).forEach(function (s) {
      if (s.hasAttribute('data-nbg-orig') || !range.intersectsNode(s)) return;
      while (s.firstChild) s.parentNode.insertBefore(s.firstChild, s);
      s.parentNode.removeChild(s);
    });
  }
  function format(action, value) {
    if (!editing) return formatBlocks(action, value);
    restoreSelection();
    var range = currentRange(), ranged = !!(range && !range.collapsed), el = editing.el;
    var f = action === 'bigger' ? 1.1 : 1 / 1.1;
    switch (action) {
      case 'bold': if (ranged) document.execCommand('bold'); else toggleBlock('font-weight', '700', '400'); break;
      case 'italic': if (ranged) document.execCommand('italic'); else toggleBlock('font-style', 'italic', 'normal'); break;
      case 'underline': if (ranged) document.execCommand('underline'); else toggleDecoration('underline'); break;
      case 'strike': if (ranged) document.execCommand('strikeThrough'); else toggleDecoration('line-through'); break;
      case 'bigger': case 'smaller':
        if (ranged) wrapSelection(function (span) { span.style.fontSize = Math.max(8, Math.round(fontSizePx(span) * f)) + 'px'; });
        else setBlockFontSize(fontSizePx(el) * f);
        break;
      case 'size':
        if (!value) break;
        if (ranged) wrapSelection(function (span) { span.style.fontSize = Math.max(8, Math.round(parseFloat(value))) + 'px'; });
        else setBlockFontSize(parseFloat(value));
        break;
      case 'family':
        if (ranged) wrapSelection(function (span) { if (value) span.style.fontFamily = value; else span.style.removeProperty('font-family'); });
        else setTextStyle('font-family', value || '');
        break;
      case 'color':
        if (ranged) wrapSelection(function (span) { if (value) span.style.color = value; else span.style.removeProperty('color'); });
        else setTextStyle('color', value || '');
        break;
      case 'align': setTextStyle('text-align', value || ''); break;
      case 'clear': {
        // selection: drop its tags and styled spans; no selection: the block returns to the inline
        // style it had before any formatting (this session's or an earlier saved one)
        if (ranged) { document.execCommand('removeFormat'); unwrapSelectionSpans(); }
        else { var rec = findEdit(el, 'style'); apply(el, 'style', rec ? rec.original : editing.preStyle); }
        break;
      }
      default: return false;
    }
    layoutTools(); saveSelection();
    return true;
  }
  function buildTools() {
    tools = document.createElement('div');
    tools.id = 'nbg-text-tools'; tools.className = 'nbg-panel nbg-inrow';
    tools.setAttribute('role', 'toolbar');
    var h = '';
    h += '<button type="button" data-f="bold" title="Bold (Ctrl/Cmd+B) — the selection, or the whole text when nothing is selected"><b>B</b></button>';
    h += '<button type="button" data-f="italic" title="Italic (Ctrl/Cmd+I)"><i>I</i></button>';
    h += '<button type="button" data-f="underline" title="Underline (Ctrl/Cmd+U)"><u>U</u></button>';
    h += '<button type="button" data-f="strike" title="Strikethrough"><s>S</s></button>';
    h += '<i class="nbg-tsep"></i>';
    h += '<button type="button" data-f="smaller" title="Smaller (Ctrl/Cmd+Shift+&lt;) — the selection, or the whole text">A−</button>';
    h += '<input type="number" data-f="size" min="8" max="400" step="1" title="Font size in px — the selection, or the whole text" aria-label="Font size">';
    h += '<button type="button" data-f="bigger" title="Larger (Ctrl/Cmd+Shift+&gt;) — the selection, or the whole text">A+</button>';
    h += '<i class="nbg-tsep"></i>';
    h += '<select data-f="family" title="Font family — the selection, or the whole text" aria-label="Font family">' + FONTS.map(function (f) { return '<option value="' + f[0].replace(/"/g, '&quot;') + '">' + f[1] + '</option>'; }).join('') + '</select>';
    h += '<i class="nbg-tsep"></i>';
    h += swatches('f="color" data-v', COLORS).replace('<span class="nbg-swatches">', '<span class="nbg-swatches" title="Text colour (' + PALETTE_NAME + ') — the selection, or the whole text">');
    h += '<i class="nbg-tsep"></i>';
    h += '<button type="button" data-f="align" data-v="left" title="Align left">⇤</button><button type="button" data-f="align" data-v="center" title="Centre">☰</button><button type="button" data-f="align" data-v="right" title="Align right">⇥</button>';
    h += '<i class="nbg-tsep"></i>';
    h += '<button type="button" data-f="clear" class="nbg-tquiet" title="Clear formatting — the selection, or the whole text back to its design">Clear</button>';
    h += '<button type="button" data-f="done" class="nbg-tdone" title="Apply (Enter) — or finish with the selected text blocks">Done</button>';
    h += '<button type="button" data-f="close" class="nbg-tquiet nbg-tclose" title="Hide this toolbar (right-click → Toolbars shows it again)">✕</button>';
    tools.innerHTML = '<span class="nbg-tlabel nbg-tnote"></span>' + h;
    // keep the editable focused and its selection intact while using the buttons
    tools.addEventListener('pointerdown', function (e) { if (!e.target.closest('input, select')) e.preventDefault(); saveSelection(); });
    tools.addEventListener('click', function (e) {
      e.stopPropagation();
      var b = e.target.closest('button'); if (!b) return;
      e.preventDefault();
      var f = b.getAttribute('data-f');
      if (f === 'close') { setToolbarMode('text', 'off'); return; }
      if (f === 'done') { if (editing) commitEdit(); else deselectShape(); return; }
      format(f, b.getAttribute('data-v'));
    });
    tools.querySelector('[data-f=size]').addEventListener('change', function (e) { format('size', e.target.value); restoreSelection(); });
    tools.querySelector('[data-f=size]').addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); format('size', e.target.value); restoreSelection(); } if (e.key === 'Escape') { e.preventDefault(); restoreSelection(); } });
    tools.querySelector('[data-f=family]').addEventListener('change', function (e) { format('family', e.target.value); restoreSelection(); });
    tools.querySelector('[data-f=family]').addEventListener('keydown', function (e) { e.stopPropagation(); });
    var rows = ensureTbar().querySelector('.nbg-tbrows'); rows.insertBefore(tools, rows.firstChild);   // the text row sits above the shape rows
  }
  function showTools() { syncToolbars(); }
  function hideTools() { toolsSel = null; syncToolbars(); }
  function inlineUp(node, prop, root) {      // nearest inline value of prop from node up to the block
    var el = node && node.nodeType === 3 ? node.parentElement : node;
    while (el && root && (el === root || root.contains(el))) { var v = styleProp(el, prop); if (v) return v; if (el === root) break; el = el.parentElement; }
    return '';
  }
  function layoutTools() {
    if (!tools || tools.hidden) return;
    var els = textTargets(), el = editing ? editing.el : els[0], note = tools.querySelector('.nbg-tnote');
    tools.classList.toggle('nbg-idle', !el);
    note.textContent = editing ? '' : el ? (els.length > 1 ? els.length + ' text blocks' : 'Text block') : 'Select text, or double-click to edit';
    if (!el) { placeTbar(); return; }
    var range = editing ? currentRange() : null;
    var probe = range ? (range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer) : el;
    if (!probe || !(probe === el || el.contains(probe))) probe = el;
    var cs = getComputedStyle(probe);
    placeTbar();
    tools.querySelector('[data-f=size]').value = Math.round(fontSizePx(probe));
    var fam = inlineUp(probe, 'font-family', el), famSel = tools.querySelector('[data-f=family]');
    famSel.value = fam; if (famSel.value !== fam) famSel.value = '';
    tools.querySelector('[data-f=bold]').classList.toggle('nbg-on', parseInt(cs.fontWeight, 10) >= 600);
    tools.querySelector('[data-f=italic]').classList.toggle('nbg-on', cs.fontStyle === 'italic');
    tools.querySelector('[data-f=underline]').classList.toggle('nbg-on', /underline/.test(cs.textDecorationLine));
    tools.querySelector('[data-f=strike]').classList.toggle('nbg-on', /line-through/.test(cs.textDecorationLine));
    Array.prototype.forEach.call(tools.querySelectorAll('[data-f=align]'), function (b) { b.classList.toggle('nbg-on', styleProp(el, 'text-align') === b.getAttribute('data-v')); });
    var col = normColor(inlineUp(probe, 'color', el));
    Array.prototype.forEach.call(tools.querySelectorAll('[data-f=color]'), function (b) { b.classList.toggle('nbg-on', col === normColor(b.getAttribute('data-v'))); });
  }
  document.addEventListener('selectionchange', function () { if (editing && tools && !tools.hidden) layoutTools(); });

  /* ---------- shapes: selection (one or many), resize / move ---------- */
  var shape = null;        // { el } — the primary shape (the last one selected); `sel` holds every selected element
  var sel = [];
  var box = null, chip = null, marks = null, rubber = null, drag = null, marquee = null, swallowClick = false;
  var HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  var CURSORS = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };
  var MIN = 16;

  function slideOf(el) { return rootOf(el); }
  function slideScale(el) {
    var slide = slideOf(el) || el;
    return slide.offsetWidth ? slide.getBoundingClientRect().width / slide.offsetWidth : 1;
  }
  function isPositioned(el) { var p = getComputedStyle(el).position; return p === 'absolute' || p === 'fixed'; }
  function geom(el) {
    var cs = getComputedStyle(el);
    return {
      positioned: isPositioned(el), relative: cs.position === 'relative',
      left: el.offsetLeft - (parseFloat(cs.marginLeft) || 0), top: el.offsetTop - (parseFloat(cs.marginTop) || 0),
      width: el.offsetWidth, height: el.offsetHeight,
      rleft: parseFloat(cs.left) || 0, rtop: parseFloat(cs.top) || 0,
      padX: (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) + (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0),
      padY: (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0) + (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0),
      contentBox: cs.boxSizing !== 'border-box',
    };
  }
  function setSize(el, g, w, h) {
    if (w !== null) el.style.setProperty('width', Math.round(g.contentBox ? w - g.padX : w) + 'px');
    if (h !== null) el.style.setProperty('height', Math.round(g.contentBox ? h - g.padY : h) + 'px');
  }
  function setPos(el, g, l, t) {
    if (g.positioned) {
      el.style.setProperty('left', Math.round(l) + 'px'); el.style.setProperty('top', Math.round(t) + 'px');
      el.style.setProperty('right', 'auto'); el.style.setProperty('bottom', 'auto');
      // an element sized by its right/bottom anchors (inset, or a shrink-to-fit text block) keeps its size
      if (!el.style.width && el.offsetWidth !== g.width) setSize(el, g, g.width, null);
      if (!el.style.height && el.offsetHeight !== g.height) setSize(el, g, null, g.height);
    } else {
      if (!g.relative) el.style.setProperty('position', 'relative');
      el.style.setProperty('left', Math.round(l) + 'px'); el.style.setProperty('top', Math.round(t) + 'px');
    }
  }
  // move by (dx, dy) artboard px: absolute geometry for positioned elements, relative offsets for flow ones
  function shift(el, g, dx, dy) { if (g.positioned) setPos(el, g, g.left + dx, g.top + dy); else setPos(el, g, g.rleft + dx, g.rtop + dy); }
  // record the element's `kind` value as an edit when it differs from `pre` (the first original is kept)
  function track(el, kind, pre) {
    var now = current(el, kind); if (now === pre) return false;
    var ed = findEdit(el, kind);
    recordEdit(el, kind, ed ? ed.original : pre, now);
    return true;
  }
  // run fn, then record every listed element whose inline style changed; returns how many did
  function withRecords(els, fn) {
    var pre = els.map(function (el) { return attrStyle(el); }), n = 0;
    fn();
    els.forEach(function (el, i) { if (track(el, 'style', pre[i])) n++; });
    layoutBox();
    return n;
  }
  function unionRect(els) {
    var u = null;
    els.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (!u) u = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      else { u.left = Math.min(u.left, r.left); u.top = Math.min(u.top, r.top); u.right = Math.max(u.right, r.right); u.bottom = Math.max(u.bottom, r.bottom); }
    });
    if (u) { u.width = u.right - u.left; u.height = u.bottom - u.top; }
    return u;
  }
  function underPoint(x, y) { return document.elementsFromPoint(x, y).filter(function (n) { return !n.closest(OURS); })[0] || null; }
  // the selected shape that is (or contains) t — a click on a nested part of a selected shape means that shape
  function ownerOf(t) { var o = null; if (t) sel.forEach(function (m) { if (!o && (m === t || m.contains(t))) o = m; }); return o; }
  // the outermost shape containing t (backdrops excluded) — what the selection box and Select all work with;
  // Shift+click takes the smallest shape under the pointer, Ctrl/Cmd+click (everything inside it) and the menu the precise element
  function topShape(t) {
    if (!t) return null;
    var slide = slideOf(t), best = null, el = t;
    while (slide && el && el !== slide) { if (isShapeEl(el) && !isBackdrop(el, slide)) best = el; el = el.parentElement; }
    return best || t;
  }
  function pick(t, precise) { return ownerOf(t) || (precise ? t : topShape(t)); }
  // Shift+click: inside a selected shape it removes that shape; elsewhere it adds the smallest shape under the point (as in the
  // SVG editor; backdrops excluded)
  function shiftPick(x, y, t) { var st = shapeStack(x, y).filter(function (el) { return !isBackdrop(el, slideOf(el)); }); return st[0] || pick(t, true); }
  function shiftToggle(x, y, t) { var st = shiftPick(x, y, t); if (!st) return false; var own = ownerOf(st); return own ? removeFromSelection(own) : addToSelection(st); }

  /* selection model — groups are logical: members carry data-nbg-group="<id>" (a 'group' edit record) */
  function groupId(el) { return el.getAttribute('data-nbg-group') || null; }
  function groupMembers(el) {
    var id = groupId(el); if (!id) return [el];
    return Array.prototype.slice.call((slideOf(el) || document).querySelectorAll('[data-nbg-group="' + id + '"]'));
  }
  function docOrder(a, b) { return a === b ? 0 : (a.compareDocumentPosition(b) & 4) ? -1 : 1; }   // 4 = DOCUMENT_POSITION_FOLLOWING
  function expandGroups(els) {   // whole groups, no duplicates, document order
    var out = [];
    els.forEach(function (el) { if (el) groupMembers(el).forEach(function (m) { if (out.indexOf(m) < 0) out.push(m); }); });
    return out.sort(docOrder);
  }
  function isShapeEl(el) { return offW(el) > 0 && offH(el) > 0 && resolveShapeTarget(el) === el; }
  // a layer that fills the slide is its backdrop, not a shape (it can still be picked by right-click)
  function isBackdrop(el, slide) { return offW(el) >= slide.offsetWidth * 0.98 && offH(el) >= slide.offsetHeight * 0.98; }
  function slideShapes(slide) {   // the top-level shapes of a slide: shapes with no shape ancestor, backdrops excluded
    var all = Array.prototype.filter.call(slide.querySelectorAll('*'), function (el) { return isShapeEl(el) && !isBackdrop(el, slide); });
    return all.filter(function (el) { var p = el.parentElement; while (p && p !== slide) { if (all.indexOf(p) >= 0) return false; p = p.parentElement; } return true; });
  }
  function sameGroup() { var id = groupId(shape.el); return !!id && sel.every(function (m) { return groupId(m) === id; }); }
  function selectionToast() {
    var n = sel.length;
    if (n === 1) toast('Shape selected — drag the handles to resize (Shift keeps proportions), drag inside to move, arrows nudge, Tab selects the enclosing shape; Shift+click adds another shape, Shift+drag on the ' + AREA + ' draws a selection box. The toolbar sets size and style, orders, aligns, distributes and groups. Esc when done.', 5000);
    else toast((sameGroup() ? 'Group of ' : '') + n + ' shapes selected — drag to move them together, handles scale them; the toolbar orders, aligns, distributes and groups them. Shift+click adds or removes a shape, Ctrl/Cmd+click picks one shape alone, Shift+drag draws a selection box. Esc when done.', 5000);
  }
  function setSelection(els, primary, opts) {
    opts = opts || {};
    var list = [];
    els = els.map(function (el) { return el && el.namespaceURI === SVG_NS && svgTag(el) !== 'svg' ? svgOwner(el) : el; });   // a part of an SVG stands for its SVG here
    (opts.raw ? els : expandGroups(els)).forEach(function (el) { if (el && list.indexOf(el) < 0) list.push(el); });
    // a container and something inside it never travel together (a move would apply twice): keep the outer one
    var nested = list.filter(function (el) { return list.some(function (o) { return o !== el && o.contains(el); }); });
    if (nested.length) { list = list.filter(function (el) { return nested.indexOf(el) < 0; }); if (opts.toast !== false || nested.length) toast(nested.length + ' inner shape' + (nested.length === 1 ? '' : 's') + ' left out — its container is selected. Ctrl/Cmd+click the container to select everything inside it; the menu’s Select at this point picks one inner shape.', 3000); }
    if (!list.length) { deselectShape(); return false; }
    if (busy) return false;
    if (editing) commitEdit();
    if (svgEd) svgEnd();
    closeMenu();
    ensureBox();
    sel = list;
    shape = { el: primary && list.indexOf(primary) >= 0 ? primary : list[list.length - 1] };
    box.hidden = false;
    layoutBox();
    showShapeTools();
    if (opts.toast !== false) selectionToast();
    codeFollow();
    return true;
  }
  function selectShape(el) { return !!el && setSelection([el], el); }
  function selectShapes(els) { return setSelection(els || [], null); }
  function selectSolo(el, quiet) {   // one element on its own, even when it belongs to a group
    if (!el) return false;
    if (el.namespaceURI === SVG_NS && svgTag(el) !== 'svg') { var own = svgOwner(el); return !!own && svgEdit(own, el); }   // a part of an SVG is edited inside its SVG, never framed as a shape
    var ok = setSelection([el], el, { raw: true, toast: false });
    if (ok && !quiet) toast(groupId(el) ? 'One member of the group selected on its own — Shift+click adds shapes, Esc when done.' : 'Shape selected — Shift+click adds another shape, Esc when done.', 3000);
    return ok;
  }
  // Ctrl/Cmd+click: the innermost shape under the point; clicking the same spot again goes one
  // level out (nested or behind), wrapping round — the toolbar's Stack list shows the same choices
  function pickAtPoint(x, y, fallback) {
    var st = shapeStack(x, y);
    if (!st.length) return selectSolo(fallback);
    var i = sel.length === 1 ? st.indexOf(shape.el) : -1;
    var el = st[i >= 0 ? (i + 1) % st.length : 0], pos = st.indexOf(el);
    var ok = selectSolo(el, true);
    if (ok) toast(describe(el) + ' selected' + (st.length > 1 ? ' — ' + (pos + 1) + ' of ' + st.length + ' at this point; Ctrl/Cmd+click again for the next one, Tab / Shift+Tab move out / in, or pick from the toolbar’s Stack list.' : '.'), 3500);
    return ok;
  }
  // Ctrl/Cmd+click: everything inside the shape under the point — its child shapes (whole groups); a shape with nothing
  // inside is picked alone (Ctrl/Cmd+click again at the same spot: the next one out)
  function selectInside(x, y, t) {
    var el = t || shapeStack(x, y)[0] || null, kids = el ? childShapes(el) : [];
    if (!kids.length) return pickAtPoint(x, y, el);
    var ok = setSelection(kids, kids[kids.length - 1], { toast: false });
    if (ok) toast(sel.length + ' shape' + (sel.length === 1 ? '' : 's') + ' inside ' + describe(el) + ' selected — Shift+click adds or removes one, Tab selects the container.', 3000);
    return ok;
  }
  function addToSelection(el) {
    if (!el) return false;
    if (!shape) return selectShape(el);
    if (sel.indexOf(el) >= 0) return true;
    var ok = setSelection(sel.concat([el]), el, { toast: false });
    if (ok) toast(sel.length + ' shapes selected.', 1500);
    return ok;
  }
  function removeFromSelection(el) {
    if (!el || !shape) return false;
    var gone = groupMembers(el), rest = sel.filter(function (m) { return gone.indexOf(m) < 0; });
    if (!rest.length) return deselectShape();
    var ok = setSelection(rest, null, { toast: false });
    if (ok) toast(sel.length + ' shape' + (sel.length === 1 ? '' : 's') + ' selected.', 1500);
    return ok;
  }
  function toggleSelection(el) { return sel.indexOf(el) >= 0 ? removeFromSelection(el) : addToSelection(el); }
  function selectAllIn(slide) {
    slide = slide || (shape ? slideOf(shape.el) : null); if (!slide) return false;
    var all = slideShapes(slide);
    if (!all.length) { toast('No shapes found on this ' + AREA + '.', 2000); return false; }
    var ok = setSelection(all, null, { toast: false });
    if (ok) toast(sel.length + ' shape' + (sel.length === 1 ? '' : 's') + ' selected — the toolbar aligns, distributes, orders and groups them.', 3000);
    return ok;
  }
  function deselectShape() {
    if (!shape) return false;
    shape = null; sel = []; drag = null; marquee = null;
    if (box) box.hidden = true;
    if (marks) marks.hidden = true;
    if (rubber) rubber.hidden = true;
    hideShapeTools();
    codeRefresh();
    return true;
  }

  /* frame + per-shape marks + rubber band */
  function ensureBox() {
    if (box) return;
    marks = document.createElement('div'); marks.id = 'nbg-sel-marks'; marks.hidden = true; document.body.appendChild(marks);
    rubber = document.createElement('div'); rubber.id = 'nbg-marquee'; rubber.hidden = true; document.body.appendChild(rubber);
    box = document.createElement('div'); box.id = 'nbg-shape-box'; box.hidden = true;
    HANDLES.forEach(function (h) { var d = document.createElement('div'); d.className = 'nbg-h nbg-h-' + h; d.setAttribute('data-h', h); d.style.cursor = CURSORS[h]; box.appendChild(d); });
    chip = document.createElement('div'); chip.className = 'nbg-chip'; box.appendChild(chip);
    box.addEventListener('pointerdown', onShapePointerDown);
    box.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); });     // the deck's own click handlers stay out of it
    box.addEventListener('dblclick', function (e) {
      // double-click on the frame: hand over to text editing of what is underneath — or, on a selected SVG, to its parts
      var under = underPoint(e.clientX, e.clientY), t = resolveTextTarget(under), sv = svgOwner(under);
      if (sv && sel.length === 1 && shape && shape.el === sv) { e.preventDefault(); e.stopPropagation(); svgEdit(sv, svgLeafAt(e.clientX, e.clientY, sv)); return; }
      if (t) { e.preventDefault(); e.stopPropagation(); deselectShape(); startEdit(t, false); }
    });
    box.addEventListener('contextmenu', function (e) {
      e.preventDefault(); e.stopPropagation();
      // the menu refers to the selected shape under the pointer (a descendant counts as its shape), else to what is there
      // the menu refers to the selected shape under the pointer; with several selected, an unselected
      // shape inside the frame is offered as itself (Add to selection); with one, the frame IS the shape
      var under = underPoint(e.clientX, e.clientY), t = resolveShapeTarget(under);
      openMenu(e.clientX, e.clientY, resolveTextTarget(under), ownerOf(t) || (sel.length > 1 && t) || (shape ? shape.el : t));
    });
    document.body.appendChild(box);
  }
  function layoutMarks() {
    if (!marks) return;
    marks.hidden = sel.length < 2;
    if (marks.hidden) return;
    while (marks.children.length > sel.length) marks.removeChild(marks.lastChild);
    while (marks.children.length < sel.length) marks.appendChild(document.createElement('div'));
    sel.forEach(function (m, i) {
      var r = m.getBoundingClientRect(), d = marks.children[i];
      d.style.left = r.left + 'px'; d.style.top = r.top + 'px'; d.style.width = r.width + 'px'; d.style.height = r.height + 'px';
      d.classList.toggle('nbg-primary', m === shape.el);
    });
  }
  function layoutBox() {
    if (!shape || !box || box.hidden) return;
    var multi = sel.length > 1, el = shape.el, g = geom(el), u = unionRect(sel), scale = slideScale(el) || 1;
    box.style.left = u.left + 'px'; box.style.top = u.top + 'px'; box.style.width = u.width + 'px'; box.style.height = u.height + 'px';
    box.classList.toggle('nbg-flow', !multi && !g.positioned);
    box.classList.toggle('nbg-multi', multi);
    if (multi) chip.textContent = (sameGroup() ? 'Group · ' : '') + sel.length + ' shapes · ' + Math.round(u.width / scale) + ' × ' + Math.round(u.height / scale);
    else chip.textContent = Math.round(g.width) + ' × ' + Math.round(g.height) + (g.positioned ? ' · L ' + Math.round(g.left) + ' T ' + Math.round(g.top) : g.relative || el.style.position === 'relative' ? ' · Δ ' + Math.round(g.rleft) + ', ' + Math.round(g.rtop) : '');
    chip.classList.toggle('nbg-chip-below', u.top < 40);
    layoutMarks();
    if (!drag) layoutShapeTools();
  }

  /* dragging: move every selected shape; handles resize one shape or scale the whole selection */
  function members() { return sel.map(function (m) { return { el: m, g: geom(m), r: m.getBoundingClientRect(), preStyle: attrStyle(m), moved: false }; }); }
  // scale the members proportionally from the union box u (screen px) to U1
  function scaleMembers(ms, u, U1, touchW, touchH, scale) {
    var sx = u.width ? U1.width / u.width : 1, sy = u.height ? U1.height / u.height : 1;
    ms.forEach(function (m) {
      var fx = u.width ? (m.r.left - u.left) / u.width : 0, fy = u.height ? (m.r.top - u.top) / u.height : 0;
      var ddx = (U1.left + fx * U1.width - m.r.left) / scale, ddy = (U1.top + fy * U1.height - m.r.top) / scale;
      if (Math.round(ddx) || Math.round(ddy) || m.moved || m.g.positioned) { shift(m.el, m.g, ddx, ddy); m.moved = true; }
      setSize(m.el, m.g, touchW ? Math.max(MIN, m.g.width * sx) : null, touchH ? Math.max(MIN, m.g.height * sy) : null);
    });
  }
  // the new box for a handle drag by (dx, dy) from box u; MIN scaled to screen px
  function resizedBox(u, h, dx, dy, keepRatio, min) {
    var L = u.left, T = u.top, W = u.width, H = u.height;
    if (h.indexOf('e') >= 0) W = u.width + dx;
    if (h.indexOf('s') >= 0) H = u.height + dy;
    if (h.indexOf('w') >= 0) W = u.width - dx;
    if (h.indexOf('n') >= 0) H = u.height - dy;
    if (keepRatio && h.length === 2 && u.height && u.width) {
      var ratio = u.width / u.height;
      if (Math.abs(W - u.width) / u.width >= Math.abs(H - u.height) / u.height) H = W / ratio; else W = H * ratio;
    }
    W = Math.max(min, W); H = Math.max(min, H);
    if (h.indexOf('w') >= 0) L = u.left + (u.width - W);
    if (h.indexOf('n') >= 0) T = u.top + (u.height - H);
    return { left: L, top: T, width: W, height: H };
  }
  function finishDrag(cancel) {
    if (!drag) return;
    var d = drag; drag = null;
    if (cancel) { d.members.forEach(function (m) { apply(m.el, 'style', m.preStyle); }); layoutBox(); return; }
    var n = 0;
    d.members.forEach(function (m) { if (track(m.el, 'style', m.preStyle)) n++; });
    if (n) toast((d.members.length > 1 ? d.members.length + ' shapes' : 'Shape') + ' updated — ' + changesLabel() + '. Right-click → “Save edited copy” to download the ' + WHOLE + ' with your changes.', 4000);
    layoutBox();
  }
  function onShapePointerDown(e) {
    if (!shape || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    if (e.shiftKey || e.metaKey || e.ctrlKey) {                     // adjust the selection through the frame
      var under = resolveShapeTarget(underPoint(e.clientX, e.clientY));
      if (e.shiftKey) shiftToggle(e.clientX, e.clientY, under); else selectInside(e.clientX, e.clientY, pick(under, true));
      swallowClick = true;
      return;
    }
    var ms = members(), h = e.target.getAttribute && e.target.getAttribute('data-h');
    if (h && ms.length === 1 && !ms[0].g.positioned && !/^(e|s|se)$/.test(h)) return;   // a flow element only grows right/down
    drag = { members: ms, mode: h ? 'resize' : 'move', h: h, startX: e.clientX, startY: e.clientY, scale: slideScale(shape.el) || 1, union: unionRect(sel), pointerId: e.pointerId };
    try { box.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
  }
  function onShapePointerMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    e.preventDefault();
    var d = drag, dx = (e.clientX - d.startX) / d.scale, dy = (e.clientY - d.startY) / d.scale;
    if (d.mode === 'move') d.members.forEach(function (m) { shift(m.el, m.g, dx, dy); });
    else if (d.members.length === 1) {
      var m = d.members[0], g = m.g, h = d.h;
      var nb = resizedBox({ left: g.left, top: g.top, width: g.width, height: g.height }, h, dx, dy, e.shiftKey, MIN);
      var touchW = /e|w/.test(h) || (e.shiftKey && h.length === 2), touchH = /n|s/.test(h) || (e.shiftKey && h.length === 2);
      // pin the top-left corner first: a right/bottom-anchored element would otherwise slide when
      // its width/height changes (the anchor stays, the opposite edge moves)
      if (g.positioned) setPos(m.el, g, nb.left, nb.top);
      setSize(m.el, g, touchW ? nb.width : null, touchH ? nb.height : null);
    } else {
      var U1 = resizedBox(d.union, d.h, e.clientX - d.startX, e.clientY - d.startY, e.shiftKey, MIN * d.scale);
      var tw = /e|w/.test(d.h) || (e.shiftKey && d.h.length === 2), th = /n|s/.test(d.h) || (e.shiftKey && d.h.length === 2);
      scaleMembers(d.members, d.union, U1, tw, th, d.scale);
    }
    layoutBox();
  }
  function nudge(dx, dy, resize) {
    if (!shape) return;
    withRecords(sel, function () {
      sel.forEach(function (el) {
        var g = geom(el);
        if (resize) { if (g.positioned) setPos(el, g, g.left, g.top); setSize(el, g, dx ? Math.max(MIN, g.width + dx) : null, dy ? Math.max(MIN, g.height + dy) : null); }
        else shift(el, g, dx, dy);
      });
    });
  }
  function resetShape(el) {
    var ed = findEdit(el, 'style'); if (!ed) return false;
    apply(el, 'style', ed.original);
    edits = edits.filter(function (e) { return e !== ed; }); store();
    layoutBox();
    toast('Shape reset to its original geometry and style.', 2500);
    return true;
  }
  function resetSelection() {
    var n = 0; sel.forEach(function (el) { if (resetShape(el)) n++; });
    if (!n) toast('Nothing to reset.', 1500); else if (n > 1) toast(n + ' shapes reset to their original geometry and style.', 2500);
    return n > 0;
  }

  /* rubber-band selection (Shift+drag on a slide) and modifier clicks */
  function startSelectGesture(e) {
    var t = e.target; if (!t || !t.closest || t.closest(OURS)) return false;
    if (t.closest('a[href], input, textarea, select, button, [contenteditable="true"]')) return false;
    var slide = rootOf(t); if (!slide) return false;
    if (!shape && !e.shiftKey && !resolveShapeTarget(t)) return false;   // without a selection, Ctrl/Cmd+click needs a shape under the pointer (Shift+drag may start on empty ground)
    e.preventDefault(); e.stopPropagation();
    marquee = { x: e.clientX, y: e.clientY, slide: slide, target: resolveShapeTarget(t), shift: e.shiftKey, pointerId: e.pointerId, moved: false };
    swallowClick = true;
    return true;
  }
  function marqueeRect(m, e) {
    return { left: Math.min(m.x, e.clientX), top: Math.min(m.y, e.clientY), right: Math.max(m.x, e.clientX), bottom: Math.max(m.y, e.clientY) };
  }
  function moveMarquee(e) {
    var m = marquee;
    if (!m.moved && Math.abs(e.clientX - m.x) < 4 && Math.abs(e.clientY - m.y) < 4) return;
    m.moved = true;
    var r = marqueeRect(m, e); ensureBox();
    rubber.hidden = false; rubber.style.left = r.left + 'px'; rubber.style.top = r.top + 'px'; rubber.style.width = (r.right - r.left) + 'px'; rubber.style.height = (r.bottom - r.top) + 'px';
  }
  function finishMarquee(e, cancel) {
    var m = marquee; marquee = null;
    if (rubber) rubber.hidden = true;
    if (cancel) return;
    if (!m.moved) { if (m.shift) shiftToggle(m.x, m.y, m.target); else selectInside(m.x, m.y, pick(m.target, true)); return; }
    var r = marqueeRect(m, e);
    var hits = slideShapes(m.slide).filter(function (el) { var b = el.getBoundingClientRect(); return b.left >= r.left - 1 && b.right <= r.right + 1 && b.top >= r.top - 1 && b.bottom <= r.bottom + 1; });
    if (!hits.length) { toast('No shape lies fully inside the box — drag around whole shapes.', 2000); return; }
    var keep = shape && slideOf(shape.el) === m.slide ? sel : [];
    setSelection(keep.concat(hits), hits[hits.length - 1], { toast: false });
    toast(sel.length + ' shape' + (sel.length === 1 ? '' : 's') + ' selected.', 2000);
  }
  window.addEventListener('pointermove', function (e) {
    if (marquee && e.pointerId === marquee.pointerId) { e.preventDefault(); moveMarquee(e); return; }
    if (gdrag && e.pointerId === gdrag.pointerId) { e.preventDefault(); onSvgPointerMove(e); return; }
    onShapePointerMove(e);
  }, true);
  window.addEventListener('pointerup', function (e) {
    if (marquee && e.pointerId === marquee.pointerId) { finishMarquee(e, false); return; }
    if (gdrag && e.pointerId === gdrag.pointerId) { finishSvgDrag(false); return; }
    if (drag && e.pointerId === drag.pointerId) finishDrag(false);
  }, true);
  window.addEventListener('pointercancel', function (e) { if (marquee) finishMarquee(e, true); finishDrag(true); finishSvgDrag(true); }, true);
  document.addEventListener('click', function (e) { if (swallowClick) { swallowClick = false; e.stopPropagation(); e.preventDefault(); } }, true);
  window.addEventListener('resize', function () { requestAnimationFrame(layoutBox); requestAnimationFrame(layoutGbox); });
  window.addEventListener('scroll', function () { requestAnimationFrame(layoutBox); requestAnimationFrame(layoutGbox); }, true);

  /* ---------- arrange: align, distribute, order, group ---------- */
  function refRectFor(mode) {
    if (mode !== 'slide' && sel.length > 1) return unionRect(sel);
    return slideOf(shape.el).getBoundingClientRect();
  }
  function alignSelection(kind, mode) {
    if (!shape) return false;
    var ref = refRectFor(mode), scale = slideScale(shape.el) || 1;
    var n = withRecords(sel, function () {
      sel.forEach(function (el) {
        var r = el.getBoundingClientRect(), dx = 0, dy = 0;
        if (kind === 'left') dx = ref.left - r.left;
        else if (kind === 'center') dx = (ref.left + ref.width / 2) - (r.left + r.width / 2);
        else if (kind === 'right') dx = ref.right - r.right;
        else if (kind === 'top') dy = ref.top - r.top;
        else if (kind === 'middle') dy = (ref.top + ref.height / 2) - (r.top + r.height / 2);
        else if (kind === 'bottom') dy = ref.bottom - r.bottom;
        if (Math.round(dx / scale) || Math.round(dy / scale)) shift(el, geom(el), dx / scale, dy / scale);
      });
    });
    toast(n ? 'Aligned ' + kind + (mode === 'slide' || sel.length < 2 ? ' to the ' + AREA : ' within the selection') + ' — ' + changesLabel() + '.' : 'Already aligned ' + kind + '.', 2500);
    return n > 0;
  }
  function distributeSelection(axis, mode) {
    if (!shape) return false;
    var horiz = axis === 'h', toSlide = mode === 'slide';
    if (sel.length < (toSlide ? 2 : 3)) { toast('Select at least ' + (toSlide ? 'two' : 'three') + ' shapes to distribute them' + (toSlide ? '' : ' (or choose “to ' + AREA + '” for two)') + '.', 3000); return false; }
    var items = sel.map(function (el) { return { el: el, r: el.getBoundingClientRect() }; });
    // along the axis, ties by the other axis, then document order (sel is in document order)
    items.sort(function (a, b) { return (horiz ? a.r.left - b.r.left || a.r.top - b.r.top : a.r.top - b.r.top || a.r.left - b.r.left); });
    var sum = 0; items.forEach(function (it) { sum += horiz ? it.r.width : it.r.height; });
    var ref = refRectFor(mode), scale = slideScale(shape.el) || 1, start, gap;
    if (toSlide) { gap = ((horiz ? ref.width : ref.height) - sum) / (items.length + 1); start = (horiz ? ref.left : ref.top) + gap; }
    else {
      var first = items[0].r, last = items[items.length - 1].r;
      gap = ((horiz ? last.right - first.left : last.bottom - first.top) - sum) / (items.length - 1);
      start = horiz ? first.left : first.top;
    }
    var n = withRecords(sel, function () {
      var pos = start;
      items.forEach(function (it) {
        var d = (pos - (horiz ? it.r.left : it.r.top)) / scale;
        if (Math.round(d)) shift(it.el, geom(it.el), horiz ? d : 0, horiz ? 0 : d);
        pos += (horiz ? it.r.width : it.r.height) + gap;
      });
    });
    toast(n ? 'Distributed ' + (horiz ? 'horizontally' : 'vertically') + ' with equal gaps of ' + Math.round(gap / scale) + ' px — ' + changesLabel() + '.' : 'Already evenly distributed.', 2500);
    return n > 0;
  }
  // z-order: effective layer of an element among its siblings — negative z-index < in-flow content (0)
  // < positioned with z-index auto/0 (0.5) < positive z-index; ties are painted in document order
  var SKIP_TAGS = /^(script|style|template|link|meta|noscript)$/i;
  function zKey(el) {
    var cs = getComputedStyle(el), pos = cs.position !== 'static';
    if (cs.zIndex !== 'auto') { var n = parseInt(cs.zIndex, 10) || 0; return n === 0 ? (pos ? 0.5 : 0) : n; }
    return pos ? 0.5 : 0;
  }
  function tierAbove(k) { return k < -1 ? k + 1 : k < 0.5 ? 0.5 : k < 1 ? 1 : Math.floor(k) + 1; }
  function tierBelow(k) { return k > 1 ? Math.ceil(k) - 1 : k > 0.5 ? 0.5 : k >= 0 ? -1 : k - 1; }
  function stackOrder(parent) {   // visible element siblings, bottom to top
    return Array.prototype.filter.call(parent.children, function (c) { return !SKIP_TAGS.test(c.tagName) && !c.closest(OURS) && getComputedStyle(c).display !== 'none'; })
      .map(function (c, i) { return { el: c, z: zKey(c), i: i }; })
      .sort(function (a, b) { return a.z - b.z || a.i - b.i; });
  }
  function isStackingContext(el) {
    var cs = getComputedStyle(el);
    return cs.isolation === 'isolate' || (cs.position !== 'static' && cs.zIndex !== 'auto') || cs.position === 'fixed' || cs.position === 'sticky' ||
      parseFloat(cs.opacity) < 1 || cs.transform !== 'none' || (cs.filter || 'none') !== 'none' || (cs.backdropFilter || 'none') !== 'none' ||
      cs.mixBlendMode !== 'normal' || (cs.clipPath || 'none') !== 'none' || (cs.maskImage || 'none') !== 'none' || cs.perspective !== 'none' ||
      /transform|opacity|filter/.test(cs.willChange) || /paint|layout|strict|content/.test(cs.contain || '');
  }
  function setZ(el, z) {
    if (getComputedStyle(el).position === 'static') el.style.setProperty('position', 'relative');
    el.style.setProperty('z-index', String(z === 0.5 ? 0 : z));
    // a negative z-index sinks below the parent's background unless the parent is a stacking context
    if (z < 0 && el.parentElement && !isStackingContext(el.parentElement)) el.parentElement.style.setProperty('isolation', 'isolate');
  }
  function orderOne(el, action) {
    var order = stackOrder(el.parentElement), idx = -1, j, z;
    order.forEach(function (o, i) { if (o.el === el) idx = i; });
    if (idx < 0) return;
    var top = order.length - 1;
    if (action === 'front') { if (idx < top) setZ(el, tierAbove(order[top].z)); }
    else if (action === 'back') { if (idx > 0) setZ(el, tierBelow(order[0].z)); }
    else if (action === 'forward') {
      if (idx === top) return;
      var A = order[idx + 1], cand = tierAbove(A.z);
      for (j = idx + 2, z = cand; j < order.length && order[j].z <= z; j++) { z = tierAbove(z); setZ(order[j].el, z); }   // make room above
      setZ(el, cand);
    } else if (action === 'backward') {
      if (idx === 0) return;
      var B = order[idx - 1], cand2 = tierBelow(B.z);
      for (j = idx - 2, z = cand2; j >= 0 && order[j].z >= z; j--) { z = tierBelow(z); setZ(order[j].el, z); }      // make room below
      setZ(el, cand2);
    }
  }
  var ORDER_LABEL = { front: 'Brought to the front', back: 'Sent to the back', forward: 'Brought forward', backward: 'Sent backward' };
  function reorder(action) {
    if (!shape || !ORDER_LABEL[action]) return false;
    // bottom-most first when raising, top-most first when lowering, so the selection keeps its own order
    var list = sel.slice().sort(function (a, b) { return (zKey(a) - zKey(b)) || docOrder(a, b); });
    if (action === 'back' || action === 'backward') list.reverse();
    var touched = sel.slice();
    sel.forEach(function (el) { var p = el.parentElement; if (p && touched.indexOf(p) < 0) touched.push(p); Array.prototype.forEach.call(p ? p.children : [], function (c) { if (touched.indexOf(c) < 0) touched.push(c); }); });
    var n = withRecords(touched, function () { list.forEach(function (el) { orderOne(el, action); }); });
    toast(n ? ORDER_LABEL[action] + ' — ' + changesLabel() + '.' : 'Already at the ' + (action === 'front' || action === 'forward' ? 'front' : 'back') + '.', 2500);
    return n > 0;
  }
  function groupSelection() {
    if (!shape) return false;
    if (sel.length < 2) { toast('Select at least two shapes to group them (Shift+click adds a shape).', 2500); return false; }
    var id = 'g' + Date.now().toString(36);
    sel.forEach(function (el) { var pre = groupId(el); apply(el, 'group', id); track(el, 'group', pre); });
    setSelection(sel, shape.el, { toast: false });
    toast('Grouped ' + sel.length + ' shapes — they now select, move, resize and align together. The menu’s Select at this point or the toolbar’s Stack list picks one member; Ungroup separates them. ' + changesLabel() + '.', 4000);
    return true;
  }
  function ungroupSelection() {
    if (!shape) return false;
    var n = 0;
    sel.forEach(function (el) { var pre = groupId(el); if (!pre) return; apply(el, 'group', null); track(el, 'group', pre); n++; });
    if (!n) { toast('No group in the selection.', 1500); return false; }
    setSelection(sel, shape.el, { toast: false });
    toast('Ungrouped ' + n + ' shapes — they are still selected; Esc when done. ' + changesLabel() + '.', 3000);
    return true;
  }

  /* ---------- shape toolbar (shown while shapes are selected) ---------- */
  var stools = null;
  var FILLS = [['', 'Default'], ['transparent', 'Transparent']].concat(PALETTE);
  var BORDERS = [['', 'Border: default'], ['0', 'No border'], ['1', 'Border 1 px'], ['2', 'Border 2 px'], ['3', 'Border 3 px'], ['4', 'Border 4 px'], ['6', 'Border 6 px']];
  var SHADOWS = [['', 'Shadow: default'], ['none', 'No shadow'], ['0 12px 32px rgba(10,20,22,.18)', 'Soft shadow'], ['0 24px 56px rgba(10,20,22,.30)', 'Strong shadow']];
  var ICONS = {
    front: '<rect x="2.5" y="6.5" width="7" height="7"/><rect class="nbg-fill" x="6.5" y="2.5" width="7" height="7"/>',
    forward: '<rect x="2.5" y="6.5" width="7" height="7"/><path d="M11 12V4M8 7l3-3 3 3"/>',
    backward: '<rect x="6.5" y="2.5" width="7" height="7"/><path d="M5 4v8M2 9l3 3 3-3"/>',
    back: '<rect x="6.5" y="2.5" width="7" height="7"/><rect class="nbg-fill" x="2.5" y="6.5" width="7" height="7"/>',
    left: '<path d="M2 1.5v13"/><rect x="4" y="3" width="9" height="4"/><rect x="4" y="9" width="6" height="4"/>',
    center: '<path d="M8 1.5v13"/><rect x="3.5" y="3" width="9" height="4"/><rect x="5" y="9" width="6" height="4"/>',
    right: '<path d="M14 1.5v13"/><rect x="3" y="3" width="9" height="4"/><rect x="6" y="9" width="6" height="4"/>',
    top: '<path d="M1.5 2h13"/><rect x="3" y="4" width="4" height="9"/><rect x="9" y="4" width="4" height="6"/>',
    middle: '<path d="M1.5 8h13"/><rect x="3" y="3.5" width="4" height="9"/><rect x="9" y="5" width="4" height="6"/>',
    bottom: '<path d="M1.5 14h13"/><rect x="3" y="3" width="4" height="9"/><rect x="9" y="6" width="4" height="6"/>',
    h: '<path d="M1.5 2v12M14.5 2v12"/><rect x="4" y="5" width="3" height="6"/><rect x="9" y="5" width="3" height="6"/>',
    v: '<path d="M2 1.5h12M2 14.5h12"/><rect x="5" y="4" width="6" height="3"/><rect x="5" y="9" width="6" height="3"/>',
  };
  function icon(k) { return '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">' + ICONS[k] + '</svg>'; }
  function abtn(action, value, title, label) { return '<button type="button" data-a="' + action + '"' + (value ? ' data-v="' + value + '"' : '') + ' title="' + title + '">' + (label || icon(value || action)) + '</button>'; }
  function inShapeTools(t) { return !!(tbar && t && tbar.contains(t)); }   // anywhere on the one toolbar
  function tidyStyle(el) { if (el.getAttribute('style') === '') el.removeAttribute('style'); }
  function shapeStyle(prop, value) {
    if (!shape) return;
    withRecords(sel, function () {
      sel.forEach(function (el) { if (value === '' || value === null) el.style.removeProperty(prop); else el.style.setProperty(prop, value); tidyStyle(el); });
    });
  }
  function shapeBorder(v) {
    if (!shape) return;
    withRecords(sel, function () {
      sel.forEach(function (el) {
        if (v === '') ['border', 'border-width', 'border-style', 'border-color'].forEach(function (p) { el.style.removeProperty(p); });
        else if (v === '0') el.style.setProperty('border', '0');
        else {
          el.style.setProperty('border-width', v + 'px'); el.style.setProperty('border-style', 'solid');
          if (!el.style.borderColor && /^(rgba\(0, 0, 0, 0\)|transparent)$/.test(getComputedStyle(el).borderTopColor)) el.style.setProperty('border-color', ACCENT);
        }
        tidyStyle(el);
      });
    });
  }
  function unionArt() {   // the selection's union box in artboard px, relative to the slide
    var u = unionRect(sel), scale = slideScale(shape.el) || 1, sr = slideOf(shape.el).getBoundingClientRect();
    return { u: u, scale: scale, left: (u.left - sr.left) / scale, top: (u.top - sr.top) / scale, width: u.width / scale, height: u.height / scale };
  }
  function shapeGeom(prop, v) {
    if (!shape || isNaN(v)) return;
    if (sel.length > 1) {
      var a = unionArt();
      withRecords(sel, function () {
        if (prop === 'left' || prop === 'top') { var dx = prop === 'left' ? v - a.left : 0, dy = prop === 'top' ? v - a.top : 0; sel.forEach(function (el) { shift(el, geom(el), dx, dy); }); }
        else {
          var U1 = { left: a.u.left, top: a.u.top, width: prop === 'width' ? Math.max(MIN, v) * a.scale : a.u.width, height: prop === 'height' ? Math.max(MIN, v) * a.scale : a.u.height };
          scaleMembers(members(), a.u, U1, prop === 'width', prop === 'height', a.scale);
        }
      });
      return;
    }
    var el = shape.el;
    withRecords(sel, function () {
      var g = geom(el);
      if (prop === 'width' || prop === 'height') {
        if (g.positioned) setPos(el, g, g.left, g.top);
        setSize(el, g, prop === 'width' ? Math.max(MIN, v) : null, prop === 'height' ? Math.max(MIN, v) : null);
      } else if (g.positioned) setPos(el, g, prop === 'left' ? v : g.left, prop === 'top' ? v : g.top);
      else setPos(el, g, prop === 'left' ? v : g.rleft, prop === 'top' ? v : g.rtop);
    });
  }
  function refMode() { var s = stools && stools.querySelector('[data-a=ref]'); return s && sel.length > 1 ? s.value : 'slide'; }
  function arrange(a, v) {
    if (a === 'order') return reorder(v);
    if (a === 'align') return alignSelection(v, refMode());
    if (a === 'dist') return distributeSelection(v, refMode());
    if (a === 'group') return groupSelection();
    if (a === 'ungroup') return ungroupSelection();
    if (a === 'all') return selectAllIn(null);
    if (a === 'code') return openCode(shape ? shape.el : null);
    return false;
  }
  function buildShapeTools() {
    stools = document.createElement('div');
    stools.id = 'nbg-shape-tools'; stools.className = 'nbg-panel nbg-rows nbg-inrow';
    stools.setAttribute('role', 'toolbar');
    var h = '<div class="nbg-row">';
    h += '<label title="Left (px on the artboard; offset for elements in normal flow; the selection box for several shapes)">X<input type="number" data-s="left" step="1"></label>';
    h += '<label title="Top">Y<input type="number" data-s="top" step="1"></label>';
    h += '<label title="Width (several shapes: scales the selection from its top-left corner)">W<input type="number" data-s="width" min="16" step="1"></label>';
    h += '<label title="Height">H<input type="number" data-s="height" min="16" step="1"></label>';
    h += '<i class="nbg-tsep"></i>';
    h += swatches('s="fill" data-v', FILLS).replace('<span class="nbg-swatches">', '<span class="nbg-swatches" title="Fill (' + PALETTE_NAME + ')">');
    h += '<i class="nbg-tsep"></i>';
    h += '<select data-s="border" title="Border">' + BORDERS.map(function (b) { return '<option value="' + b[0] + '">' + b[1] + '</option>'; }).join('') + '</select>';
    h += swatches('s="bordercolor" data-v', COLORS).replace('<span class="nbg-swatches">', '<span class="nbg-swatches" title="Border colour (' + PALETTE_NAME + ')">');
    h += '<i class="nbg-tsep"></i>';
    h += '<label title="Corner radius (px)">◜<input type="number" data-s="radius" min="0" step="1"></label>';
    h += '<label title="Opacity (%)">◐<input type="number" data-s="opacity" min="0" max="100" step="5"></label>';
    h += '<select data-s="shadow" title="Shadow">' + SHADOWS.map(function (b) { return '<option value="' + b[0] + '">' + b[1] + '</option>'; }).join('') + '</select>';
    h += '<i class="nbg-tsep"></i>';
    h += '<button type="button" data-s="reset" class="nbg-tquiet" title="Restore the selected shapes’ original size, position and style">Reset</button>';
    h += '<button type="button" data-s="done" class="nbg-tdone" title="Finish (Esc)">Done</button>';
    h += '<button type="button" data-s="close" class="nbg-tquiet nbg-tclose" title="Hide this toolbar (right-click → Toolbars shows it again)">✕</button>';
    // second row: arrange
    h += '</div><div class="nbg-row">';
    h += '<span class="nbg-tlabel" data-count>1 shape</span>';
    h += '<select data-a="stack" title="Stack: the shapes enclosing the selected one and the shapes inside it — pick the one you want (Tab / Shift+Tab step out / in)"></select>';
    h += '<button type="button" data-a="all" class="nbg-tquiet" title="Select every shape on this ' + AREA + ' (Ctrl/Cmd+A) — Shift+click adds one, Shift+drag draws a selection box, Ctrl/Cmd+click selects everything inside a shape">All</button>';
    h += '<i class="nbg-tsep"></i><span class="nbg-tlabel">Order</span>';
    h += abtn('order', 'front', 'Bring to front (Ctrl/Cmd+Shift+])') + abtn('order', 'forward', 'Bring forward one step (Ctrl/Cmd+])') + abtn('order', 'backward', 'Send backward one step (Ctrl/Cmd+[)') + abtn('order', 'back', 'Send to back (Ctrl/Cmd+Shift+[)');
    h += '<i class="nbg-tsep"></i><span class="nbg-tlabel">Align</span>';
    h += abtn('align', 'left', 'Align left edges') + abtn('align', 'center', 'Align horizontal centres') + abtn('align', 'right', 'Align right edges') + abtn('align', 'top', 'Align top edges') + abtn('align', 'middle', 'Align vertical middles') + abtn('align', 'bottom', 'Align bottom edges');
    h += '<i class="nbg-tsep"></i><span class="nbg-tlabel">Distribute</span>';
    h += abtn('dist', 'h', 'Distribute horizontally — equal gaps between the shapes (three or more; the first and last stay put — or across the ' + AREA + ')') + abtn('dist', 'v', 'Distribute vertically — equal gaps between the shapes');
    h += '<select data-a="ref" title="Align and distribute relative to the selection’s own box, or to the ' + AREA + '"><option value="selection">to selection</option><option value="slide">to ' + AREA + '</option></select>';
    h += '<i class="nbg-tsep"></i>';
    h += '<button type="button" data-a="code" title="Show the ' + AREA + '’s structure and HTML: an outline with checkboxes for selecting several shapes (Ctrl/Cmd+Shift+O), the element tree (Ctrl/Cmd+Shift+H), and the selected element’s editable source">&lt;/&gt;</button>';
    h += '<i class="nbg-tsep"></i>';
    h += '<button type="button" data-a="group" title="Group the selected shapes so they select, move, resize and align together (Ctrl/Cmd+G)">Group</button>';
    h += '<button type="button" data-a="ungroup" title="Ungroup (Ctrl/Cmd+Shift+G)">Ungroup</button>';
    h += '</div>';
    stools.innerHTML = h;
    stools.addEventListener('click', function (e) {
      e.stopPropagation();
      var b = e.target.closest('button'); if (!b) return;
      e.preventDefault();
      var a = b.getAttribute('data-s'), ar = b.getAttribute('data-a');
      if (a === 'close') { setToolbarMode('shape', 'off'); return; }
      if (a === 'detach') { detachPanel('tools'); return; }
      if (!shape) return;
      if (ar) arrange(ar, b.getAttribute('data-v'));
      else if (a === 'done') deselectShape();
      else if (a === 'reset') resetSelection();
      else if (a === 'fill') shapeStyle('background-color', b.getAttribute('data-v'));
      else if (a === 'bordercolor') shapeStyle('border-color', b.getAttribute('data-v'));
    });
    stools.addEventListener('change', function (e) {
      var t = e.target, a = t.getAttribute('data-s');
      if (t.getAttribute('data-a') === 'ref') { t.setAttribute('data-user', ''); return; }
      if (t.getAttribute('data-a') === 'stack') { var pickEl = stackList[parseInt(t.value, 10)]; if (pickEl && pickEl !== shape.el) selectSolo(pickEl); return; }
      if (!a || !shape) return;
      if (/^(left|top|width|height)$/.test(a)) shapeGeom(a, parseFloat(t.value));
      else if (a === 'border') shapeBorder(t.value);
      else if (a === 'radius') shapeStyle('border-radius', t.value === '' ? '' : Math.max(0, parseFloat(t.value)) + 'px');
      else if (a === 'opacity') shapeStyle('opacity', t.value === '' ? '' : String(Math.max(0, Math.min(100, parseFloat(t.value))) / 100));
      else if (a === 'shadow') shapeStyle('box-shadow', t.value);
    });
    stools.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); e.target.dispatchEvent(new Event('change', { bubbles: true })); }
      if (e.key === 'Escape') { e.preventDefault(); deselectShape(); }
    });
    ensureTbar().querySelector('.nbg-tbrows').appendChild(stools);
  }
  var stackList = [];   // what the toolbar's Stack select offers: enclosing shapes, the selected one, its child shapes
  function layoutStackList() {
    var sl = stools.querySelector('[data-a=stack]'), el = shape.el, up = ancestorShapes(el), down = childShapes(el);
    stackList = up.concat([el], down);
    sl.hidden = sel.length > 1 || stackList.length < 2;
    if (sl.hidden) return;
    var esc = function (t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
    sl.innerHTML = stackList.map(function (x, i) {
      var depth = i < up.length ? i : i === up.length ? up.length : up.length + 1;
      var tag = i < up.length ? 'encloses · ' : i === up.length ? 'selected · ' : 'inside · ';
      return '<option value="' + i + '"' + (x === el ? ' selected' : '') + '>' + new Array(depth + 1).join('› ') + esc(tag + describe(x)) + '</option>';
    }).join('');
  }
  function showShapeTools() { syncToolbars(); }
  function hideShapeTools() { syncToolbars(); }
  function layoutShapeTools() {
    if (!stools || stools.hidden) return;
    stools.classList.toggle('nbg-idle', !shape);
    if (!shape) { stools.querySelector('[data-count]').textContent = 'No shape selected'; var sl0 = stools.querySelector('[data-a=stack]'); sl0.hidden = true; placeTbar(); return; }
    var el = shape.el, g = geom(el), st = el.style, multi = sel.length > 1;
    placeTbar();
    var set = function (k, v) { var i = stools.querySelector('[data-s=' + k + ']'); if (stools.ownerDocument.activeElement !== i) i.value = v; };
    if (multi) { var a = unionArt(); set('left', Math.round(a.left)); set('top', Math.round(a.top)); set('width', Math.round(a.width)); set('height', Math.round(a.height)); }
    else {
      set('left', Math.round(g.positioned ? g.left : g.rleft)); set('top', Math.round(g.positioned ? g.top : g.rtop));
      set('width', Math.round(g.width)); set('height', Math.round(g.height));
    }
    var fill = normColor(st.backgroundColor);
    Array.prototype.forEach.call(stools.querySelectorAll('[data-s=fill]'), function (b) { b.classList.toggle('nbg-on', !!fill && fill === normColor(b.getAttribute('data-v'))); });
    var bw = st.border === '0px' || st.borderWidth === '0px' ? '0' : st.borderWidth ? String(parseInt(st.borderWidth, 10)) : '';
    var bsel = stools.querySelector('[data-s=border]'); bsel.value = bw; if (bsel.value !== bw) bsel.value = '';
    var bc = normColor(st.borderColor);
    Array.prototype.forEach.call(stools.querySelectorAll('[data-s=bordercolor]'), function (b) { b.classList.toggle('nbg-on', !!bc && bc === normColor(b.getAttribute('data-v'))); });
    set('radius', st.borderRadius ? parseInt(st.borderRadius, 10) : ''); set('opacity', st.opacity ? Math.round(parseFloat(st.opacity) * 100) : '');
    var ssel = stools.querySelector('[data-s=shadow]'); ssel.value = st.boxShadow || ''; if (ssel.value !== (st.boxShadow || '')) ssel.value = '';
    // arrange row
    stools.querySelector('[data-count]').textContent = multi ? (sameGroup() ? 'Group · ' : '') + sel.length + ' shapes' : '1 shape';
    layoutStackList();
    var ref = stools.querySelector('[data-a=ref]'); ref.disabled = !multi; if (!multi) ref.value = 'slide'; else if (ref.value === 'slide' && !ref.hasAttribute('data-user')) ref.value = 'selection';
    var grouped = sel.some(function (m) { return !!groupId(m); });
    Array.prototype.forEach.call(stools.querySelectorAll('[data-a=dist], [data-a=group]'), function (b) { b.classList.toggle('nbg-off', !multi); });
    stools.querySelector('[data-a=ungroup]').classList.toggle('nbg-off', !grouped);
  }

  /* ---------- SVG editing: the parts of an inline <svg> (paths, shapes, text, groups) ---------- */
  var svgEd = null;                    // { svg, parts, part } — the SVG in editing, its selected parts (document order) and the primary one (the last picked)
  var gtools = null, gbox = null, gchip = null, gmarks = null, gdrag = null, ghoverRaf = 0, svgPartsList = [];
  var SVG_PART = /^(path|rect|circle|ellipse|line|polyline|polygon|text|image|use|g)$/;
  var SVG_SKIP = /^(defs|clipPath|mask|symbol|pattern|marker|linearGradient|radialGradient|filter|metadata|title|desc|style|script)$/;
  var SVG_GEOM_ATTRS = ['transform', 'x', 'y', 'width', 'height', 'cx', 'cy', 'x1', 'y1', 'x2', 'y2'];
  var SVG_PAINTS = [['', 'Default'], ['none', 'None']].concat(PALETTE);
  function svgTag(el) { return el && el.nodeType === 1 && el.namespaceURI === SVG_NS ? el.tagName : ''; }   // SVG tag names keep their case (clipPath)
  // the outermost inline <svg> that holds t (inside a root, none of ours)
  function svgOwner(t) {
    if (t && t.nodeType === 3) t = t.parentElement;
    if (!t || !t.closest || t.closest(OURS)) return null;
    var slide = rootOf(t); if (!slide) return null;
    var out = null, p = t;
    while (p && p !== slide) { if (svgTag(p) === 'svg') out = p; p = p.parentElement; }
    return out;
  }
  function svgInDefs(el, svg) { var p = el.parentElement; while (p && p !== svg) { if (SVG_SKIP.test(svgTag(p))) return true; p = p.parentElement; } return false; }
  function isSvgPart(el, svg) { return !!el && !!svg && el !== svg && svg.contains(el) && SVG_PART.test(svgTag(el)) && !svgInDefs(el, svg); }
  function svgParts(svg) { return Array.prototype.filter.call(svg.querySelectorAll('*'), function (el) { return isSvgPart(el, svg); }); }   // drawing order, back to front
  function svgLeafAt(x, y, svg) {   // the innermost part (not a group) under a point
    var hit = null;
    document.elementsFromPoint(x, y).some(function (el) {
      if (el === svg || !svg.contains(el) || el.closest(OURS)) return false;
      var p = el; while (p && p !== svg && !(SVG_PART.test(svgTag(p)) && svgTag(p) !== 'g')) p = p.parentElement;
      if (p && p !== svg && isSvgPart(p, svg)) { hit = p; return true; }
      return false;
    });
    return hit;
  }
  function svgParentPart(p) { var q = p.parentElement; while (q && q !== svgEd.svg) { if (svgTag(q) === 'g') return q; q = q.parentElement; } return null; }
  function svgChildParts(p) { return Array.prototype.filter.call(p.children, function (c) { return SVG_PART.test(svgTag(c)); }); }
  function svgDepth(x) { var d = 0, q = x.parentElement; while (q && q !== svgEd.svg) { if (svgTag(q) === 'g') d++; q = q.parentElement; } return d; }
  function svgPartLabel(x) {
    var tag = svgTag(x), t = tag === 'text' ? x.textContent.replace(/\s+/g, ' ').trim() : '', cls = (x.getAttribute('class') || '').trim().split(/\s+/)[0];
    return tag + (x.id ? '#' + x.id : cls ? '.' + cls : '') + (t ? ' “' + (t.length > 24 ? t.slice(0, 21) + '…' : t) + '”' : '');
  }
  /* geometry: the part's screen box mapped into its parent's user space (decks do not rotate whole SVGs, so the box stays a box) */
  function svgParentEl(part) { var p = part.parentNode; return p && typeof p.getScreenCTM === 'function' ? p : svgEd.svg; }
  function svgToParent(part, x, y) {
    var m = svgParentEl(part).getScreenCTM(); if (!m) return null;
    var pt = new DOMPoint(x, y).matrixTransform(m.inverse());
    return { x: pt.x, y: pt.y };
  }
  function svgFromParent(part, x, y) {   // the other way: a point of the parent's user space on screen
    var m = svgParentEl(part).getScreenCTM(); if (!m) return null;
    var pt = new DOMPoint(x, y).matrixTransform(m);
    return { x: pt.x, y: pt.y };
  }
  function svgBoxToParent(part, R) {   // a screen rect → the parent's user space
    var a = svgToParent(part, R.left, R.top), b = svgToParent(part, R.left + R.width, R.top + R.height);
    if (!a || !b) return null;
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
  }
  function svgParentRect(part) { return svgBoxToParent(part, part.getBoundingClientRect()); }
  function svgSnap(part) { var s = {}; SVG_GEOM_ATTRS.forEach(function (a) { s[a] = part.hasAttribute(a) ? part.getAttribute(a) : null; }); return s; }
  function svgRestore(part, s) { Object.keys(s).forEach(function (a) { if (s[a] === null) part.removeAttribute(a); else part.setAttribute(a, s[a]); }); }
  function r3(n) { return String(Math.round(n * 1000) / 1000); }
  function svgNum(part, a) { var v = part.getAttribute(a); return v !== null && /^\s*-?(\d+\.?\d*|\.\d+)\s*$/.test(v) ? parseFloat(v) : null; }   // a plain number (not a list, not a percentage)
  function svgMatrixOf(part) { var l = part.transform && part.transform.baseVal, c = l && l.numberOfItems ? l.consolidate() : null; return c ? c.matrix : null; }
  // place the part so that its box in the parent's space goes from b0 to b1: plain attributes where the element has them and
  // carries no transform (x / y / width / height of a rect or image; x / y, cx / cy, x1… on a pure move), a matrix otherwise
  function svgPlace(part, b0, b1) {
    var tag = svgTag(part), dx = b1.x - b0.x, dy = b1.y - b0.y, sx = b0.w > 1e-6 ? b1.w / b0.w : 1, sy = b0.h > 1e-6 ? b1.h / b0.h : 1;
    var moveOnly = Math.abs(sx - 1) < 1e-9 && Math.abs(sy - 1) < 1e-9, plain = !part.hasAttribute('transform') && !(part.style && part.style.transform);
    function shiftAttrs(pairs) { pairs.forEach(function (p) { var v = svgNum(part, p[0]); part.setAttribute(p[0], r3((v === null ? 0 : v) + p[1])); }); }
    if (plain && (tag === 'rect' || tag === 'image') && svgNum(part, 'width') !== null && svgNum(part, 'height') !== null) {
      shiftAttrs([['x', dx], ['y', dy]]);
      if (!moveOnly) { part.setAttribute('width', r3(svgNum(part, 'width') * sx)); part.setAttribute('height', r3(svgNum(part, 'height') * sy)); }
      return;
    }
    if (plain && moveOnly) {
      if ((tag === 'text' || tag === 'use' || tag === 'image') && (part.getAttribute('x') === null || svgNum(part, 'x') !== null) && (part.getAttribute('y') === null || svgNum(part, 'y') !== null)) { shiftAttrs([['x', dx], ['y', dy]]); return; }
      if ((tag === 'circle' || tag === 'ellipse') && (part.getAttribute('cx') === null || svgNum(part, 'cx') !== null) && (part.getAttribute('cy') === null || svgNum(part, 'cy') !== null)) { shiftAttrs([['cx', dx], ['cy', dy]]); return; }
      if (tag === 'line' && ['x1', 'y1', 'x2', 'y2'].every(function (a) { return part.getAttribute(a) === null || svgNum(part, a) !== null; })) { shiftAttrs([['x1', dx], ['y1', dy], ['x2', dx], ['y2', dy]]); return; }
    }
    // M = translate(b1 − s·b0) · scale(s), applied in the parent's space before the part's own transform
    var M = new DOMMatrix([sx, 0, 0, sy, b1.x - sx * b0.x, b1.y - sy * b0.y]), old = svgMatrixOf(part), R = old ? M.multiply(old) : M;
    part.setAttribute('transform', 'matrix(' + [R.a, R.b, R.c, R.d, R.e, R.f].map(r3).join(' ') + ')');
  }
  // the selected parts as drag members: their screen box, parent-space box and attribute snapshot at the start
  function svgMembers() { return svgSel().map(function (m) { return { el: m, r0: m.getBoundingClientRect(), b0: svgParentRect(m), snap: svgSnap(m) }; }).filter(function (m) { return !!m.b0; }); }
  // move / scale every member so that the selection's screen box goes from U0 to U1 (each member keeps its place within the box)
  function svgPlaceMembers(ms, U0, U1) {
    var sx = U0.width > 1e-6 ? U1.width / U0.width : 1, sy = U0.height > 1e-6 ? U1.height / U0.height : 1;
    ms.forEach(function (m) {
      var fx = U0.width > 1e-6 ? (m.r0.left - U0.left) / U0.width : 0, fy = U0.height > 1e-6 ? (m.r0.top - U0.top) / U0.height : 0;
      var R1 = { left: U1.left + fx * U1.width, top: U1.top + fy * U1.height, width: m.r0.width * sx, height: m.r0.height * sy };
      svgRestore(m.el, m.snap);   // always from the start: no accumulated rounding
      var b1 = svgBoxToParent(m.el, R1); if (b1) svgPlace(m.el, m.b0, b1);
    });
  }
  // run fn on the SVG in editing, then record the SVG's innerHTML as its one 'html' edit; returns 1 when it changed
  function svgOp(fn) {
    if (!svgEd) return 0;
    var svg = svgEd.svg, pre = svg.innerHTML;
    fn();
    var n = track(svg, 'html', pre) ? 1 : 0;
    layoutGbox(); layoutSvgTools(); codeRefresh();
    return n;
  }
  /* the session and its selection */
  function svgSel() { return svgEd ? svgEd.parts.filter(function (p) { return p.isConnected; }) : []; }
  function svgPrimary() { var ms = svgSel(); return ms.length ? (svgEd.part && ms.indexOf(svgEd.part) >= 0 ? svgEd.part : ms[ms.length - 1]) : null; }
  function svgEdit(svg, part) {
    if (!svg || svgTag(svg) !== 'svg' || busy) return false;
    if (svgEd && svgEd.svg === svg) { if (part) svgSelectPart(part, true); return true; }
    if (svgEd) svgEnd();
    if (editing) commitEdit();
    deselectShape();
    closeMenu();
    ensureGbox();
    svgEd = { svg: svg, parts: [], part: null };
    svg.classList.add('nbg-svg-editing');
    document.addEventListener('pointermove', onSvgHover, true);
    if (part && isSvgPart(part, svg)) { svgEd.parts = [part]; svgEd.part = part; }
    syncToolbars(); layoutGbox(); codeFollow();
    var np = svgParts(svg).length;
    toast('SVG editing — ' + np + ' part' + (np === 1 ? '' : 's') + ': click a part (a path, shape or text) to select it, drag it to move, handles resize (Shift keeps proportions), arrows nudge, Shift+click selects several, Tab selects the enclosing group. The toolbar sets fill, stroke, opacity and text, orders, duplicates and deletes. Esc or Done when finished.', 6000);
    return true;
  }
  function svgEnd() {
    if (!svgEd) return false;
    if (gdrag) finishSvgDrag(true);
    var s = svgEd; svgEd = null;
    s.svg.classList.remove('nbg-svg-editing'); if (s.svg.getAttribute('class') === '') s.svg.removeAttribute('class');
    document.removeEventListener('pointermove', onSvgHover, true);
    cancelAnimationFrame(ghoverRaf); hoverEl(null);
    if (gbox) gbox.hidden = true;
    if (gmarks) gmarks.hidden = true;
    syncToolbars(); codeRefresh();
    return true;
  }
  // the selection: whole parts, document order; a group and something inside it never travel together (the group stays)
  function svgSetSelection(list, primary, quiet) {
    if (!svgEd) return false;
    var svg = svgEd.svg, out = [];
    (list || []).forEach(function (p) { if (p && isSvgPart(p, svg) && out.indexOf(p) < 0) out.push(p); });
    var nested = out.filter(function (p) { return out.some(function (o) { return o !== p && o.contains(p); }); });
    if (nested.length) { out = out.filter(function (p) { return nested.indexOf(p) < 0; }); toast(nested.length + ' inner part' + (nested.length === 1 ? '' : 's') + ' left out — its group is selected. Click a member alone to pick it.', 2500); }
    out.sort(docOrder);
    svgEd.parts = out;
    svgEd.part = primary && out.indexOf(primary) >= 0 ? primary : out[out.length - 1] || null;
    layoutGbox(); layoutSvgTools(); codeFollow();
    if (!quiet && out.length > 1) toast(out.length + ' parts selected — drag to move them together, handles scale them; the toolbar styles, orders, duplicates and deletes them all. Shift+click adds or removes a part, a plain click picks one alone.', 3000);
    return out.length > 0;
  }
  function svgSelectPart(part, quiet) {
    if (!svgEd) return false;
    var ok = svgSetSelection(part ? [part] : [], part, true);
    if (ok && !quiet) toast(describe(svgEd.part) + ' selected — drag to move, handles resize, arrows nudge, Shift+click adds another part, Tab selects the enclosing group, Delete removes it.', 2500);
    return ok;
  }
  function svgSelectMany(list) { return svgSetSelection(list, null, false); }
  function svgAddPart(part) { if (!part || !svgEd) return false; var cur = svgSel(); return cur.indexOf(part) >= 0 ? true : svgSetSelection(cur.concat([part]), part, cur.length === 0); }
  function svgRemoveFromSelection(part) { if (!part || !svgEd) return false; return svgSetSelection(svgSel().filter(function (p) { return p !== part; }), null, true); }
  function svgTogglePart(part) {   // inside a selected part (a group's member included) it removes that part; elsewhere it adds the part
    if (!part || !svgEd) return false;
    var own = null; svgSel().forEach(function (m) { if (!own && (m === part || m.contains(part))) own = m; });
    return own ? svgRemoveFromSelection(own) : svgAddPart(part);
  }
  // Ctrl/Cmd+click: what is inside the smallest part under the pointer — the part a plain click would pick — or, when a
  // selected group encloses that spot (Tab selected it, or its frame was clicked), the parts inside that group; a part
  // with nothing inside is picked alone
  function svgSelectInside(leaf) {
    if (!svgEd || !leaf) return false;
    var holder = null;
    svgSel().forEach(function (m) { if (svgTag(m) === 'g' && m !== leaf && m.contains(leaf) && (!holder || holder.contains(m))) holder = m; });   // the innermost selected group around the spot
    var target = holder || leaf, kids = svgChildParts(target);
    if (!kids.length) return svgSelectPart(target, false);
    var ok = svgSetSelection(kids, kids.indexOf(leaf) >= 0 ? leaf : null, true);
    if (ok) toast(svgSel().length + ' part' + (svgSel().length === 1 ? '' : 's') + ' inside ' + svgPartLabel(target) + ' selected — Shift+click adds or removes one, a plain click picks one alone.', 2500);
    return ok;
  }
  function svgSelectAll() {   // every top-level part of the SVG (a group counts as one)
    if (!svgEd) return false;
    var all = svgChildParts(svgEd.svg);
    if (!all.length) { toast('No parts in this SVG.', 1500); return false; }
    var ok = svgSetSelection(all, null, true);
    if (ok) toast(svgSel().length + ' part' + (svgSel().length === 1 ? '' : 's') + ' selected — every top-level part of the SVG.', 2500);
    return ok;
  }
  function onSvgHover(e) {
    if (!svgEd || gdrag) return;
    var x = e.clientX, y = e.clientY, t = e.target;
    cancelAnimationFrame(ghoverRaf);
    ghoverRaf = requestAnimationFrame(function () {
      if (!svgEd) return;
      var inBox = !!(gbox && t && gbox.contains(t));   // over the selection's frame: the parts underneath still count
      if (!t || !t.closest || (!inBox && (t.closest(OURS) || !svgEd.svg.contains(t)))) { hoverEl(null); return; }
      var p = svgLeafAt(x, y, svgEd.svg); hoverEl(p && svgSel().indexOf(p) < 0 ? p : null);
    });
  }
  /* the selection's frame and the per-part marks */
  function ensureGbox() {
    if (gbox) return;
    gmarks = document.createElement('div'); gmarks.id = 'nbg-svg-marks'; gmarks.hidden = true; document.body.appendChild(gmarks);
    gbox = document.createElement('div'); gbox.id = 'nbg-svg-box'; gbox.hidden = true;
    HANDLES.forEach(function (h) { var d = document.createElement('div'); d.className = 'nbg-h nbg-h-' + h; d.setAttribute('data-h', h); d.style.cursor = CURSORS[h]; gbox.appendChild(d); });
    gchip = document.createElement('div'); gchip.className = 'nbg-chip'; gbox.appendChild(gchip);
    gbox.addEventListener('pointerdown', onSvgPointerDown);
    gbox.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); });
    gbox.addEventListener('dblclick', function (e) { e.preventDefault(); e.stopPropagation(); svgFocusText(); });
    gbox.addEventListener('contextmenu', function (e) {
      e.preventDefault(); e.stopPropagation();
      var under = underPoint(e.clientX, e.clientY);
      openMenu(e.clientX, e.clientY, resolveTextTarget(under), resolveShapeTarget(under));
    });
    document.body.appendChild(gbox);
  }
  function svgFocusText() {   // a double-click on a <text> part: straight to its text field
    var p = svgSel().length === 1 ? svgPrimary() : null; if (!p || !svgTextNode(p) || !gtools || gtools.hidden) return false;
    var ti = gtools.querySelector('[data-g=text]'); ti.focus({ preventScroll: true }); ti.select();
    return true;
  }
  function layoutGmarks(ms) {
    if (!gmarks) return;
    gmarks.hidden = ms.length < 2;
    if (gmarks.hidden) return;
    while (gmarks.children.length > ms.length) gmarks.removeChild(gmarks.lastChild);
    while (gmarks.children.length < ms.length) gmarks.appendChild(document.createElement('div'));
    var prim = svgPrimary();
    ms.forEach(function (m, i) {
      var r = m.getBoundingClientRect(), d = gmarks.children[i];
      d.style.left = r.left + 'px'; d.style.top = r.top + 'px'; d.style.width = r.width + 'px'; d.style.height = r.height + 'px';
      d.classList.toggle('nbg-primary', m === prim);
    });
  }
  function svgUnionParent(ms) { var p = svgPrimary(); return p ? svgBoxToParent(p, unionRect(ms)) : null; }   // the selection's box in the primary part's parent units
  function layoutGbox() {
    if (!gbox) return;
    var ms = svgSel(), p = svgPrimary();
    gbox.hidden = !p; layoutGmarks(ms); if (!p) return;
    var multi = ms.length > 1, r = multi ? unionRect(ms) : p.getBoundingClientRect(), b = multi ? svgUnionParent(ms) : svgParentRect(p);
    gbox.style.left = r.left + 'px'; gbox.style.top = r.top + 'px'; gbox.style.width = r.width + 'px'; gbox.style.height = r.height + 'px';
    gbox.classList.toggle('nbg-multi', multi);
    gchip.textContent = (multi ? ms.length + ' parts' : svgPartLabel(p)) + (b ? ' · ' + r3(Math.round(b.w * 10) / 10) + ' × ' + r3(Math.round(b.h * 10) / 10) : '');
    gchip.classList.toggle('nbg-chip-below', r.top < 40);
    if (!gdrag) layoutSvgTools();
  }
  function onSvgPointerDown(e) {
    if (!svgEd || !svgSel().length || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    var h = e.target.getAttribute && e.target.getAttribute('data-h');
    if ((e.shiftKey || e.metaKey || e.ctrlKey) && !h) { var lf = svgLeafAt(e.clientX, e.clientY, svgEd.svg); if (e.shiftKey) { if (lf) svgTogglePart(lf); } else svgSelectInside(lf); return; }   // through the frame: Shift+click adds / removes the part underneath, Ctrl/Cmd+click the parts inside the selected group around it
    startSvgDrag(e, h);
    try { gbox.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
  }
  function startSvgDrag(e, h) {
    var ms = svgMembers(); if (!ms.length) return false;
    // hit: the part under the pointer when it is not the one selected part (a member of a selected group, a part overlapping the
    // frame, or one member of several) — a click without a drag picks it alone
    var hit = h ? null : svgLeafAt(e.clientX, e.clientY, svgEd.svg), one = ms.length === 1 ? ms[0].el : null;
    gdrag = { members: ms, mode: h ? 'resize' : 'move', h: h, startX: e.clientX, startY: e.clientY, U0: unionRect(ms.map(function (m) { return m.el; })), pre: svgEd.svg.innerHTML, pointerId: e.pointerId, moved: false, hit: hit && hit !== one ? hit : null };
    return true;
  }
  function onSvgPointerMove(e) {
    var d = gdrag, dx = e.clientX - d.startX, dy = e.clientY - d.startY, U0 = d.U0, U1;
    if (!d.moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    d.moved = true;
    if (d.mode === 'move') U1 = { left: U0.left + dx, top: U0.top + dy, width: U0.width, height: U0.height };
    else U1 = resizedBox({ left: U0.left, top: U0.top, width: U0.width, height: U0.height }, d.h, dx, dy, e.shiftKey, 2);
    svgPlaceMembers(d.members, U0, U1);
    layoutGbox();
  }
  function finishSvgDrag(cancel) {
    if (!gdrag) return;
    var d = gdrag; gdrag = null;
    if (cancel || !d.moved) {
      if (d.moved) d.members.forEach(function (m) { svgRestore(m.el, m.snap); });
      if (!cancel && d.hit && d.hit.isConnected && svgEd) { svgSelectPart(d.hit, true); return; }   // a click (no drag) on a part inside or over the frame picks that part alone
      layoutGbox(); layoutSvgTools(); return;
    }
    if (svgEd && track(svgEd.svg, 'html', d.pre)) toast((d.members.length > 1 ? d.members.length + ' parts ' : 'Part ') + (d.mode === 'move' ? 'moved' : 'resized') + ' — ' + changesLabel() + '. Right-click → “Save edited copy” to download the ' + WHOLE + ' with your changes.', 3500);
    layoutGbox(); layoutSvgTools(); codeRefresh();
  }
  /* operations on the selected parts */
  function svgNudge(dx, dy, resize) {   // dx / dy in SVG units of each part's parent
    var ms = svgMembers(); if (!ms.length) return false;
    return svgOp(function () { ms.forEach(function (m) { var b0 = m.b0; svgPlace(m.el, b0, resize ? { x: b0.x, y: b0.y, w: Math.max(0.5, b0.w + dx), h: Math.max(0.5, b0.h + dy) } : { x: b0.x + dx, y: b0.y + dy, w: b0.w, h: b0.h }); }); }) > 0;
  }
  function svgGeom(prop, v) {   // 'x' | 'y' | 'w' | 'h' in the parent's units (several parts: the selection's box, scaled from its top-left corner)
    var ms = svgMembers(), p = svgPrimary(); if (!ms.length || !p || isNaN(v)) return false;
    if (ms.length === 1) {
      var b0 = ms[0].b0, b1 = { x: b0.x, y: b0.y, w: b0.w, h: b0.h }; b1[prop] = prop === 'w' || prop === 'h' ? Math.max(0.5, v) : v;
      return svgOp(function () { svgPlace(ms[0].el, b0, b1); }) > 0;
    }
    var U0 = unionRect(ms.map(function (m) { return m.el; })), ub = svgBoxToParent(p, U0); if (!ub) return false;
    var nb = { x: ub.x, y: ub.y, w: ub.w, h: ub.h }; nb[prop] = prop === 'w' || prop === 'h' ? Math.max(0.5, v) : v;
    var a = svgFromParent(p, nb.x, nb.y), c = svgFromParent(p, nb.x + nb.w, nb.y + nb.h); if (!a || !c) return false;
    return svgOp(function () { svgPlaceMembers(ms, U0, { left: Math.min(a.x, c.x), top: Math.min(a.y, c.y), width: Math.abs(c.x - a.x), height: Math.abs(c.y - a.y) }); }) > 0;
  }
  function svgPaint(part, name, value) {   // fill / stroke / stroke-width / opacity: the presentation attribute, unless an inline style sets it (then that)
    var st = part.style;
    if (value === '' || value === null) { part.removeAttribute(name); if (st && st.getPropertyValue(name)) st.removeProperty(name); }
    else if (st && st.getPropertyValue(name)) st.setProperty(name, value);
    else part.setAttribute(name, value);
    if (part.getAttribute('style') === '') part.removeAttribute('style');
  }
  function svgPaintOf(part, name) { return (part.style && part.style.getPropertyValue(name)) || part.getAttribute(name) || ''; }
  function svgSet(name, value) {
    var ms = svgSel(); if (!ms.length || !/^(fill|stroke|stroke-width|opacity)$/.test(name)) return false;
    return svgOp(function () { ms.forEach(function (p) { svgPaint(p, name, value); }); }) > 0;
  }
  function svgTextNode(part) {   // the single text run of a <text> (direct, or inside one tspan), else null
    if (svgTag(part) !== 'text') return null;
    var runs = [];
    (function walk(n) { for (var c = n.firstChild; c; c = c.nextSibling) { if (c.nodeType === 3 && c.nodeValue.trim()) runs.push(c); else if (c.nodeType === 1) walk(c); } })(part);
    return runs.length === 1 ? runs[0] : null;
  }
  function svgSetText(value) {
    var ms = svgSel(), p = ms.length === 1 ? ms[0] : null, n = p && svgTextNode(p); if (!n || typeof value !== 'string') return false;
    return svgOp(function () { n.nodeValue = value; }) > 0;
  }
  function svgOrder(action) {
    var ms = svgSel(); if (!ms.length || !ORDER_LABEL[action]) return false;
    var n = svgOp(function () {
      var list = action === 'front' || action === 'backward' ? ms.slice() : ms.slice().reverse();   // keep the members' own order: front / backward from the first, back / forward from the last
      list.forEach(function (p) {
        var par = p.parentNode, sib = Array.prototype.filter.call(par.children, function (c) { return SVG_PART.test(svgTag(c)); }), i = sib.indexOf(p);
        if (action === 'front') par.appendChild(p);
        else if (action === 'back') par.insertBefore(p, par.firstChild);
        else if (action === 'forward') { var nx = i + 1; while (nx < sib.length && ms.indexOf(sib[nx]) >= 0) nx++; if (nx < sib.length) par.insertBefore(p, sib[nx].nextSibling); }
        else if (action === 'backward') { var pv = i - 1; while (pv >= 0 && ms.indexOf(sib[pv]) >= 0) pv--; if (pv >= 0) par.insertBefore(p, sib[pv]); }
      });
    });
    toast(n ? ORDER_LABEL[action] + ' — ' + changesLabel() + '.' : 'Already at the ' + (action === 'front' || action === 'forward' ? 'front' : 'back') + '.', 2500);
    return n > 0;
  }
  function svgRemovePart() {
    var ms = svgSel(); if (!ms.length) return false;
    svgOp(function () { ms.forEach(function (p) { if (p.parentNode) p.parentNode.removeChild(p); }); });
    svgEd.parts = []; svgEd.part = null; layoutGbox(); layoutSvgTools(); codeFollow();
    toast((ms.length > 1 ? ms.length + ' parts' : 'Part') + ' removed — ' + changesLabel() + '. Reset SVG brings every part back.', 3000);
    return true;
  }
  function svgDuplicatePart() {
    var ms = svgSel(); if (!ms.length) return false;
    var clones = [];
    svgOp(function () {
      ms.forEach(function (p) {
        var c = p.cloneNode(true);
        [c].concat(Array.prototype.slice.call(c.querySelectorAll('[id]'))).forEach(function (x) { if (x.hasAttribute('id')) x.removeAttribute('id'); });   // ids stay unique
        p.parentNode.insertBefore(c, p.nextSibling);
        clones.push(c);
      });
    });
    svgSetSelection(clones, clones[clones.length - 1], true);
    toast((clones.length > 1 ? clones.length + ' parts duplicated' : 'Part duplicated') + ', on top of the original' + (clones.length > 1 ? 's' : '') + ' — drag the cop' + (clones.length > 1 ? 'ies' : 'y') + ' where ' + (clones.length > 1 ? 'they belong' : 'it belongs') + '. ' + changesLabel() + '.', 3000);
    return true;
  }
  function svgReset(svg) {
    svg = svg || (svgEd && svgEd.svg);
    var ed = svg && findEdit(svg, 'html'); if (!ed) { toast('Nothing to reset.', 1500); return false; }
    apply(svg, 'html', ed.original);
    edits = edits.filter(function (e) { return e !== ed; }); store();
    if (svgEd && svgEd.svg === svg) { svgEd.parts = []; svgEd.part = null; layoutGbox(); layoutSvgTools(); codeFollow(); }
    toast('SVG reset — every part as designed.', 2500);
    return true;
  }
  /* the SVG row of the floating toolbar */
  function buildSvgTools() {
    gtools = document.createElement('div');
    gtools.id = 'nbg-svg-tools'; gtools.className = 'nbg-panel nbg-inrow';
    gtools.setAttribute('role', 'toolbar');
    var h = '<span class="nbg-tlabel" data-gnote>SVG</span>';
    h += '<select data-g="part" title="The parts of this SVG — paths, shapes, text, groups — in drawing order (back to front); pick one to select it alone (Shift+click on the SVG adds more; Tab / Shift+Tab step out / in)"></select>';
    h += '<button type="button" data-g="all" class="nbg-tquiet" title="Select every top-level part of the SVG (Ctrl/Cmd+A) — Shift+click adds or removes one">All</button>';
    h += '<i class="nbg-tsep"></i>';
    h += '<label title="Left, in the SVG’s own units (several parts: the selection’s box)">X<input type="number" data-g="x" step="1"></label>';
    h += '<label title="Top">Y<input type="number" data-g="y" step="1"></label>';
    h += '<label title="Width (several parts: scales the selection from its top-left corner)">W<input type="number" data-g="w" min="0" step="1"></label>';
    h += '<label title="Height">H<input type="number" data-g="h" min="0" step="1"></label>';
    h += '<i class="nbg-tsep"></i>';
    h += swatches('g="fill" data-v', SVG_PAINTS).replace('<span class="nbg-swatches">', '<span class="nbg-swatches" title="Fill (' + PALETTE_NAME + '; None = no fill; Default = as designed) — every selected part">');
    h += '<i class="nbg-tsep"></i>';
    h += swatches('g="stroke" data-v', SVG_PAINTS).replace('<span class="nbg-swatches">', '<span class="nbg-swatches" title="Stroke colour (' + PALETTE_NAME + '; None = no stroke; Default = as designed) — every selected part">');
    h += '<label title="Stroke width (SVG units)">╱<input type="number" data-g="sw" min="0" step="0.5"></label>';
    h += '<label title="Opacity (%)">◐<input type="number" data-g="opacity" min="0" max="100" step="5"></label>';
    h += '<i class="nbg-tsep"></i>';
    h += '<input type="text" data-g="text" placeholder="Text" title="The text of the selected <text> part — Enter applies" aria-label="SVG text">';
    h += '<i class="nbg-tsep"></i><span class="nbg-tlabel">Order</span>';
    h += '<button type="button" data-go="front" title="Bring to front (Ctrl/Cmd+Shift+])">' + icon('front') + '</button><button type="button" data-go="forward" title="Bring forward one step (Ctrl/Cmd+])">' + icon('forward') + '</button><button type="button" data-go="backward" title="Send backward one step (Ctrl/Cmd+[)">' + icon('backward') + '</button><button type="button" data-go="back" title="Send to back (Ctrl/Cmd+Shift+[)">' + icon('back') + '</button>';
    h += '<i class="nbg-tsep"></i>';
    h += '<button type="button" data-g="dup" title="Duplicate the selected parts (Ctrl/Cmd+D) — the copies sit on the originals">Duplicate</button>';
    h += '<button type="button" data-g="del" class="nbg-tquiet" title="Remove the selected parts (Delete)">Delete</button>';
    h += '<i class="nbg-tsep"></i>';
    h += '<button type="button" data-g="reset" class="nbg-tquiet" title="Restore the SVG as designed — every part">Reset SVG</button>';
    h += '<button type="button" data-g="done" class="nbg-tdone" title="Finish (Enter)">Done</button>';
    h += '<button type="button" data-g="close" class="nbg-tquiet nbg-tclose" title="Hide this toolbar (right-click → Toolbars shows it again)">✕</button>';
    gtools.innerHTML = h;
    gtools.addEventListener('click', function (e) {
      e.stopPropagation();
      var b = e.target.closest('button'); if (!b) return;
      e.preventDefault();
      var g = b.getAttribute('data-g'), go = b.getAttribute('data-go');
      if (g === 'close') { setToolbarMode('svg', 'off'); return; }
      if (!svgEd) return;
      if (go) svgOrder(go);
      else if (g === 'done') svgEnd();
      else if (g === 'reset') svgReset();
      else if (g === 'all') svgSelectAll();
      else if (g === 'dup') svgDuplicatePart();
      else if (g === 'del') svgRemovePart();
      else if (g === 'fill' || g === 'stroke') svgSet(g, b.getAttribute('data-v'));
    });
    gtools.addEventListener('change', function (e) {
      var t = e.target, g = t.getAttribute('data-g');
      if (!g || !svgEd) return;
      if (g === 'part') { var pk = svgPartsList[parseInt(t.value, 10)]; if (pk) svgSelectPart(pk, true); return; }
      if (/^[xywh]$/.test(g)) svgGeom(g, parseFloat(t.value));
      else if (g === 'sw') svgSet('stroke-width', t.value === '' ? '' : String(Math.max(0, parseFloat(t.value))));
      else if (g === 'opacity') svgSet('opacity', t.value === '' ? '' : String(Math.max(0, Math.min(100, parseFloat(t.value))) / 100));
      else if (g === 'text') svgSetText(t.value);
    });
    gtools.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); e.target.dispatchEvent(new Event('change', { bubbles: true })); }
      if (e.key === 'Escape') { e.preventDefault(); if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') { e.target.blur(); layoutSvgTools(); } else svgEnd(); }
    });
    ensureTbar().querySelector('.nbg-tbrows').appendChild(gtools);
  }
  function layoutSvgTools() {
    if (!gtools || gtools.hidden) return;
    gtools.classList.toggle('nbg-idle', !svgEd);
    var note = gtools.querySelector('[data-gnote]');
    if (!svgEd) { note.textContent = 'No SVG in editing'; gtools.classList.remove('nbg-nopart'); placeTbar(); return; }
    var ms = svgSel(), p = svgPrimary(), multi = ms.length > 1;
    placeTbar();
    gtools.classList.toggle('nbg-nopart', !p);
    svgPartsList = svgParts(svgEd.svg);
    note.textContent = 'SVG · ' + svgPartsList.length + ' part' + (svgPartsList.length === 1 ? '' : 's') + (multi ? ' · ' + ms.length + ' selected' : '');
    var sl = gtools.querySelector('[data-g=part]');
    if (gtools.ownerDocument.activeElement !== sl) {
      sl.innerHTML = '<option value="-1">' + (multi ? ms.length + ' parts selected…' : p ? 'Parts…' : 'Pick a part…') + '</option>' + svgPartsList.map(function (x, i) { return '<option value="' + i + '"' + (!multi && x === p ? ' selected' : '') + '>' + (ms.indexOf(x) >= 0 ? '✓ ' : '') + new Array(svgDepth(x) + 1).join('› ') + esc(svgPartLabel(x)) + '</option>'; }).join('');
      if (!p || multi) sl.value = '-1';
    }
    var set = function (k, v) { var i = gtools.querySelector('[data-g=' + k + ']'); if (gtools.ownerDocument.activeElement !== i) i.value = v; };
    var ti = gtools.querySelector('[data-g=text]');
    if (!p) { ['x', 'y', 'w', 'h', 'sw', 'opacity'].forEach(function (k) { set(k, ''); }); set('text', ''); ti.disabled = true; Array.prototype.forEach.call(gtools.querySelectorAll('.nbg-swatches button'), function (b) { b.classList.remove('nbg-on'); }); return; }
    var b = multi ? svgUnionParent(ms) : svgParentRect(p);
    if (b) { set('x', Math.round(b.x * 10) / 10); set('y', Math.round(b.y * 10) / 10); set('w', Math.round(b.w * 10) / 10); set('h', Math.round(b.h * 10) / 10); }
    ['fill', 'stroke'].forEach(function (k) {   // a swatch is on when every selected part carries that value
      var cur = svgPaintOf(p, k), norm = cur === 'none' ? 'none' : normColor(cur), same = ms.every(function (m) { var v = svgPaintOf(m, k); return (v === 'none' ? 'none' : normColor(v)) === norm; });
      Array.prototype.forEach.call(gtools.querySelectorAll('[data-g=' + k + ']'), function (bt) { var v = bt.getAttribute('data-v'); bt.classList.toggle('nbg-on', same && !!cur && (v === 'none' ? norm === 'none' : norm === normColor(v))); });
    });
    var sw = svgPaintOf(p, 'stroke-width'); set('sw', sw === '' ? '' : parseFloat(sw));
    var op = svgPaintOf(p, 'opacity'); set('opacity', op === '' ? '' : Math.round(parseFloat(op) * 100));
    var tn = multi ? null : svgTextNode(p);
    ti.disabled = !tn; if (gtools.ownerDocument.activeElement !== ti) ti.value = tn ? tn.nodeValue : '';
    ti.title = tn ? 'The text of the selected <text> part — Enter applies' : multi ? 'Select one <text> part alone to edit its text' : svgTag(p) === 'text' ? 'This text has several runs — edit its source in the Tree tab' : 'Select a <text> part to edit its text';
  }

  /* ---------- HTML panel: navigable tree + editable source, synced with the visual selection ---------- */
  var code = null, codeTree = null, codeOut = null, codeRaw = null, codeStatus = null, codeTab = 'outline', codeEl = null, codeSlideEl = null, outFilter = '';
  var codeOpen = new Set(), codeClosed = new Set(), rawDirty = false, rawFor = null, hover = null, codeRaf = 0, codeObserver = null;
  var TRANSIENT_ATTR = /^(contenteditable|spellcheck|data-nbg-orig)$/;
  function inCode(t) { return !!(code && t && code.contains(t)); }
  function pathKey(el) { var p = pathOf(el); return p ? p.join('/') : ''; }
  function elByKey(key) { return key ? elAt(document, key.split('/').map(Number)) : null; }
  function cleanClass(el) { return (el.getAttribute('class') || '').split(/\s+/).filter(function (c) { return c && c !== 'nbg-editing' && c !== 'nbg-svg-editing'; }).join(' '); }
  // the element's markup as the viewer should see it: without our transient editing attributes
  function cleanOuterHtml(el) {
    var c = el.cloneNode(true), all = [c].concat(Array.prototype.slice.call(c.querySelectorAll('*')));
    all.forEach(function (n) {
      Array.prototype.slice.call(n.attributes).forEach(function (a) { if (TRANSIENT_ATTR.test(a.name)) n.removeAttribute(a.name); });
      if (n.classList.contains('nbg-editing') || n.classList.contains('nbg-svg-editing')) { n.classList.remove('nbg-editing'); n.classList.remove('nbg-svg-editing'); if (!n.getAttribute('class')) n.removeAttribute('class'); }
    });
    return c.outerHTML;
  }
  // the source the assistant receives: like the Code tab's, minus scripts (this editor's own block included
  // when the root is the body), our style element and our runtime elements — never useful to a model
  function aiSourceHtml(el) {
    var c = el.cloneNode(true);
    Array.prototype.slice.call(c.querySelectorAll('script, style#nbg-deck-menu-style, ' + OURS)).forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    return cleanOuterHtml(c);
  }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function isEdited(el) { return !!(findEdit(el, 'html') || findEdit(el, 'style') || findEdit(el, 'group') || findEdit(el, 'attrs')); }
  function codeSlide() {   // the slide on screen wins: a followed element whose slide left the screen is dropped
    var el = codeEl && codeEl.isConnected ? codeEl : (shape ? shape.el : editing ? editing.el : svgEd ? svgEd.svg : null);
    if (el && slideOffscreen(el)) { if (!shape && !editing && !svgEd) codeEl = null; el = null; }
    var s = el ? slideOf(el) : null;
    return s || slideAtPoint(window.innerWidth / 2, window.innerHeight / 2);
  }
  function selectedKeys() {
    var keys = {};
    sel.forEach(function (m) { keys[pathKey(m)] = true; });
    if (editing) keys[pathKey(editing.el)] = true;
    if (svgEd) { var gs = svgSel(); if (gs.length) gs.forEach(function (m) { keys[pathKey(m)] = true; }); else keys[pathKey(svgEd.svg)] = true; }
    return keys;
  }
  function contentNodes(el) {
    return Array.prototype.filter.call(el.childNodes, function (n) { return n.nodeType === 1 ? !n.closest(OURS) : n.nodeType === 3 && n.nodeValue.trim(); });
  }
  function renderNode(node, depth, out, keys, openKeys) {
    if (node.nodeType === 3) {
      var t = node.nodeValue.replace(/\s+/g, ' ').trim(); if (t.length > 80) t = t.slice(0, 77) + '…';
      out.push('<div class="nbg-tr nbg-tr-text" data-path="' + esc(pathKey(node.parentElement)) + '" data-text="1" style="padding-left:' + (depth * 14 + 18) + 'px">' + esc(t) + '</div>');
      return;
    }
    if (node.nodeType !== 1 || node.closest(OURS) || /^(script|style|template)$/i.test(node.tagName)) return;
    var key = pathKey(node), kids = contentNodes(node);
    var open = kids.length && !codeClosed.has(key) && (codeOpen.has(key) || openKeys[key] || depth < 2);
    var attrs = '';
    Array.prototype.forEach.call(node.attributes, function (a) {
      if (TRANSIENT_ATTR.test(a.name)) return;
      var v = a.name === 'class' ? cleanClass(node) : a.value; if (a.name === 'class' && !v) return;
      if (a.name === 'src' && /^data:/.test(v)) v = 'data:…';
      if (v.length > 48) v = v.slice(0, 45) + '…';
      attrs += ' <span class="nbg-an">' + esc(a.name) + '</span>=<span class="nbg-av">"' + esc(v) + '"</span>';
    });
    var inline = !open && kids.length === 1 && kids[0].nodeType === 3 ? ' <span class="nbg-tx">' + esc(kids[0].nodeValue.replace(/\s+/g, ' ').trim().slice(0, 60)) + '</span>' : '';
    out.push('<div class="nbg-tr' + (keys[key] ? ' nbg-on' : '') + (isEdited(node) ? ' nbg-ed' : '') + '" data-path="' + esc(key) + '" style="padding-left:' + (depth * 14 + 4) + 'px">' +
      '<span class="nbg-tw' + (kids.length ? '' : ' nbg-tw-none') + '">' + (kids.length ? (open ? '▾' : '▸') : '·') + '</span>' +
      '<span class="nbg-tag">&lt;' + node.tagName.toLowerCase() + '</span>' + attrs + '<span class="nbg-tag">&gt;</span>' + inline + (isEdited(node) ? ' <span class="nbg-dot" title="edited in this browser">●</span>' : '') + '</div>');
    if (open) kids.forEach(function (k) { renderNode(k, depth + 1, out, keys, openKeys); });
  }
  function renderTree() {
    if (!code || code.hidden) return;
    var slide = codeSlide(); codeSlideEl = slide;
    code.querySelector('.nbg-ct').textContent = slide ? unitLabel(slide) : UNIT;
    if (!slide) { codeTree.innerHTML = '<div class="nbg-tr">No ' + AREA + ' found.</div>'; return; }
    var keys = selectedKeys(), openKeys = {};
    Object.keys(keys).forEach(function (k) { var el = elByKey(k); while (el && el !== slide) { el = el.parentElement; if (el) openKeys[pathKey(el)] = true; } });
    if (codeEl && codeEl.isConnected) { var e2 = codeEl; while (e2 && e2 !== slide) { e2 = e2.parentElement; if (e2) openKeys[pathKey(e2)] = true; } }
    var out = [];
    renderNode(slide, 0, out, keys, openKeys);
    codeTree.innerHTML = out.join('');
    var on = codeTree.querySelector('.nbg-on'); if (on && codeTab === 'tree') on.scrollIntoView({ block: 'nearest' });
  }
  /* outline: only the shapes (cards, text blocks, images), nested by containment, with checkboxes */
  var KIND_ICON = { img: '▨', text: 'T', box: '▭' };
  function shapeKind(el) { return /^(img|svg|video|canvas|picture)$/i.test(el.tagName) ? 'img' : hasOwnText(el) && !isBoxy(el) ? 'text' : 'box'; }
  function shapeLabel(el) {
    if (svgTag(el) === 'svg') { var np = svgParts(el).length; return (el.getAttribute('aria-label') || 'SVG') + ' · ' + np + ' part' + (np === 1 ? '' : 's'); }
    if (/^(img|svg|video|canvas|picture)$/i.test(el.tagName)) return el.getAttribute('alt') || el.getAttribute('aria-label') || 'Image';
    var t = hasOwnText(el) ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    if (t) return t.length > 56 ? t.slice(0, 53) + '…' : t;
    var cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(function (c) { return c && !/^nbg-/.test(c) && c !== 'active'; })[0];
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : cls ? '.' + cls : '');
  }
  function groupBadges(slide) {   // group id -> G1, G2 … per slide
    var ids = [], map = {};
    Array.prototype.forEach.call(slide.querySelectorAll('[data-nbg-group]'), function (m) { var g = m.getAttribute('data-nbg-group'); if (ids.indexOf(g) < 0) ids.push(g); });
    ids.forEach(function (g, i) { map[g] = 'G' + (i + 1); });
    return map;
  }
  function renderOutlineNode(el, depth, out, keys, badges, slide, filter) {
    var kids = childShapes(el), key = pathKey(el), label = shapeLabel(el), kind = shapeKind(el);
    var kidRows = [];
    kids.forEach(function (k) { renderOutlineNode(k, depth + 1, kidRows, keys, badges, slide, filter); });
    if (filter && label.toLowerCase().indexOf(filter) < 0 && !kidRows.length) return;
    var open = kids.length && !codeClosed.has(key);
    var g = groupId(el), backdrop = isBackdrop(el, slide);
    out.push('<div class="nbg-tr nbg-or' + (keys[key] ? ' nbg-on' : '') + (isEdited(el) ? ' nbg-ed' : '') + '" data-path="' + esc(key) + '" style="padding-left:' + (depth * 14 + 4) + 'px">' +
      '<span class="nbg-tw' + (kids.length ? '' : ' nbg-tw-none') + '">' + (kids.length ? (open ? '▾' : '▸') : '·') + '</span>' +
      '<input type="checkbox" class="nbg-ock" ' + (keys[key] ? 'checked ' : '') + 'aria-label="select" title="Tick to add this shape to the selection, untick to remove it">' +
      '<span class="nbg-ok nbg-ok-' + kind + '" title="' + (kind === 'img' ? 'image' : kind === 'text' ? 'text block' : 'card / panel / block') + '">' + KIND_ICON[kind] + '</span>' +
      '<span class="nbg-ol">' + esc(label) + '</span>' +
      '<span class="nbg-os">' + Math.round(offW(el)) + '×' + Math.round(offH(el)) + '</span>' +
      (g && badges[g] ? '<span class="nbg-og" title="group ' + esc(g) + '">' + badges[g] + '</span>' : '') +
      (backdrop ? '<span class="nbg-og nbg-ob" title="fills the ' + AREA + ' — not part of Select all">backdrop</span>' : '') +
      (isEdited(el) ? ' <span class="nbg-dot" title="edited in this browser">●</span>' : '') + '</div>');
    if (open || filter) kidRows.forEach(function (r) { out.push(r); });
  }
  function renderOutline() {
    if (!code || code.hidden) return;
    var slide = codeSlide(); codeSlideEl = slide;
    code.querySelector('.nbg-ct').textContent = slide ? unitLabel(slide) : UNIT;
    if (!slide) { codeOut.innerHTML = '<div class="nbg-tr">No ' + AREA + ' found.</div>'; return; }
    var keys = selectedKeys(), out = [], badges = groupBadges(slide), filter = outFilter.trim().toLowerCase();
    childShapes(slide).forEach(function (el) { renderOutlineNode(el, 0, out, keys, badges, slide, filter); });
    codeOut.innerHTML = out.length ? out.join('') : '<div class="nbg-tr nbg-tr-text">' + (filter ? 'Nothing matches “' + esc(outFilter) + '”.' : 'No shapes on this ' + AREA + '.') + '</div>';
    var cnt = code.querySelector('.nbg-oc'); cnt.textContent = sel.length ? sel.length + ' selected' : '';
    var on = codeOut.querySelector('.nbg-on'); if (on && codeTab === 'outline') on.scrollIntoView({ block: 'nearest' });
  }
  function renderRaw() {
    if (!code || code.hidden) return;
    var target = codeEl && codeEl.isConnected ? codeEl : null;
    var lock = rawDirty && rawFor && rawFor.isConnected;
    if (lock) target = rawFor;
    code.querySelector('.nbg-cw').textContent = target ? describe(target) + (lock ? ' · unapplied changes' : '') : 'nothing selected';
    if (!target) { codeRaw.value = ''; codeRaw.disabled = true; return; }
    codeRaw.disabled = false;
    if (!lock) { rawFor = target; codeRaw.value = cleanOuterHtml(target); rawDirty = false; setRawStatus(''); }
  }
  function setRawStatus(msg, bad) { codeStatus.textContent = msg; codeStatus.classList.toggle('nbg-bad', !!bad); }
  function codeRefresh() {
    if (!code || code.hidden) return;
    cancelAnimationFrame(codeRaf);
    codeRaf = requestAnimationFrame(function () {
      renderOutline(); renderTree(); renderRaw();   // both lists stay consistent whichever tab is shown
      var ms = menu && menu.querySelector('.nbg-mslide'); if (ms) ms.textContent = codeSlideEl ? unitLabel(codeSlideEl) : '';
    });
  }
  function codeFollow() {   // the element the panel follows: the primary selection, the text being edited, or the SVG part
    var el = shape ? shape.el : editing ? editing.el : svgEd ? (svgPrimary() || svgEd.svg) : null;
    if (el) codeEl = el;
    codeRefresh();
  }
  /* attributes other than style / group as a fourth edit kind: JSON of sorted [name, value] pairs */
  function attrsOf(el) {
    var list = [];
    Array.prototype.forEach.call(el.attributes, function (a) {
      if (a.name === 'style' || a.name === 'data-nbg-group' || TRANSIENT_ATTR.test(a.name)) return;
      var v = a.name === 'class' ? cleanClass(el) : a.value; if (a.name === 'class' && !v) return;
      list.push([a.name, v]);
    });
    list.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
    return JSON.stringify(list);
  }
  function applyAttrs(el, value) {
    var want = {}; try { JSON.parse(value).forEach(function (p) { want[p[0]] = p[1]; }); } catch (e) { return; }
    Array.prototype.slice.call(el.attributes).forEach(function (a) {
      if (a.name === 'style' || a.name === 'data-nbg-group' || TRANSIENT_ATTR.test(a.name)) return;
      if (!(a.name in want)) el.removeAttribute(a.name);
    });
    Object.keys(want).forEach(function (k) { if (el.getAttribute(k) !== want[k]) el.setAttribute(k, want[k]); });
  }
  function sanitise(root) {   // the deck is self-contained: no scripts, event handlers or javascript: URLs come in through the editor
    var n = 0;
    Array.prototype.slice.call(root.querySelectorAll('script, iframe, object, embed')).forEach(function (x) { x.parentNode.removeChild(x); n++; });
    [root].concat(Array.prototype.slice.call(root.querySelectorAll('*'))).forEach(function (x) {
      Array.prototype.slice.call(x.attributes).forEach(function (a) {
        if (/^on/i.test(a.name) || (/^(href|src|xlink:href|action|formaction)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) { x.removeAttribute(a.name); n++; }
      });
    });
    return n;
  }
  // apply a source string to an element (the Code tab's Apply and the assistant's "replace the selected
  // element"): exactly one root element of the same tag; scripts / handlers stripped; style / group /
  // attrs / html recorded. Returns { n, dropped } or { error }.
  function applySource(el, html) {
    if (!el || !el.isConnected) return { error: 'Nothing to apply to.' };
    var tpl = document.createElement('template'); tpl.innerHTML = html;
    var roots = Array.prototype.filter.call(tpl.content.childNodes, function (n) { return n.nodeType === 1 || (n.nodeType === 3 && n.nodeValue.trim()); });
    if (roots.length !== 1 || roots[0].nodeType !== 1) return { error: 'The source must be exactly one element (the ' + el.tagName.toLowerCase() + ' and its contents).' };
    var neu = roots[0];
    if (neu.tagName !== el.tagName) return { error: 'Keep the element a <' + el.tagName.toLowerCase() + '> — its type cannot change (use its parent to replace it).' };
    var dropped = sanitise(neu);
    if (editing && editing.el === el) commitEdit();
    if (svgEd) svgEnd();   // never let the session's outline class into a record
    var preStyle = attrStyle(el), preGroup = groupId(el), preAttrs = attrsOf(el), preHtml = el.innerHTML;
    if (neu.hasAttribute('style')) el.setAttribute('style', neu.getAttribute('style')); else el.removeAttribute('style');
    if (neu.hasAttribute('data-nbg-group')) el.setAttribute('data-nbg-group', neu.getAttribute('data-nbg-group')); else el.removeAttribute('data-nbg-group');
    applyAttrs(el, attrsOf(neu));
    if (el.innerHTML !== neu.innerHTML) el.innerHTML = neu.innerHTML;
    var n = 0;
    if (track(el, 'style', preStyle)) n++;
    if (track(el, 'group', preGroup)) n++;
    if (track(el, 'attrs', preAttrs)) n++;
    if (track(el, 'html', preHtml)) n++;
    if (shape && sel.indexOf(el) >= 0) layoutBox();
    codeRefresh();
    return { n: n, dropped: dropped };
  }
  function applyRaw() {
    var el = rawFor && rawFor.isConnected ? rawFor : codeEl;
    var r = applySource(el, codeRaw.value);
    if (r.error) { setRawStatus(r.error, true); return false; }
    rawDirty = false; rawFor = null; codeEl = el;
    setRawStatus(r.n ? 'Applied — ' + changesLabel() + '.' + (r.dropped ? ' Removed ' + r.dropped + ' script / event-handler item' + (r.dropped === 1 ? '' : 's') + '.' : '') : 'No change.');
    if (r.n) toast('HTML applied to ' + describe(el) + ' — ' + changesLabel() + '. Right-click → “Save edited copy” to download the ' + WHOLE + ' with your changes.', 4000);
    codeRefresh();
    return r.n > 0;
  }
  function revertRaw() { rawDirty = false; rawFor = null; setRawStatus(''); renderRaw(); }
  function ensureHover() {
    if (hover) return;
    hover = document.createElement('div'); hover.id = 'nbg-hover'; hover.hidden = true; document.body.appendChild(hover);
  }
  function hoverEl(el) {
    ensureHover();
    if (!el || !el.isConnected) { hover.hidden = true; return; }
    var r = el.getBoundingClientRect();
    hover.hidden = false; hover.style.left = r.left + 'px'; hover.style.top = r.top + 'px'; hover.style.width = r.width + 'px'; hover.style.height = r.height + 'px';
  }
  function placeCode() {
    if (detachedPanel(code)) return;
    var pos = panelPos[code.id];
    if (pos) { code.style.left = Math.max(0, Math.min(pos.left, window.innerWidth - code.offsetWidth)) + 'px'; code.style.top = Math.max(0, Math.min(pos.top, window.innerHeight - code.offsetHeight)) + 'px'; return; }
    code.style.left = Math.max(8, window.innerWidth - code.offsetWidth - 8) + 'px'; code.style.top = '8px';   // docked to the right
  }
  // Tree tab = the element tree above, the selected element's editable source below, a draggable
  // splitter between them; its position (the tree's share) is remembered per deck (ui.split)
  var codeSplit = null;
  function applySplit() {
    if (!code || code.hidden || codeTab !== 'tree' || ui.fold.code) return;
    var total = code.clientHeight - code.querySelector('.nbg-ch').offsetHeight - codeSplit.offsetHeight;
    if (total <= 0) return;
    codeTree.style.flex = '0 0 ' + Math.round(Math.max(48, Math.min(total - 96, total * ui.split))) + 'px';
  }
  function setTab(tab) {
    if (tab === 'code') { tab = 'tree'; codeTab = tab; setTimeout(function () { if (codeRaw && !code.hidden) codeRaw.focus({ preventScroll: true }); }, 0); }   // the former Code tab: the source editor under the tree
    codeTab = tab; hoverEl(null);
    Array.prototype.forEach.call(code.querySelectorAll('[data-tab]'), function (b) { b.classList.toggle('nbg-on', b.getAttribute('data-tab') === tab); });
    codeTree.hidden = tab !== 'tree';
    code.querySelector('.nbg-cout').hidden = tab !== 'outline';
    code.querySelector('.nbg-craw').hidden = tab !== 'tree';
    codeSplit.hidden = tab !== 'tree';
    if (tab === 'tree') applySplit(); else codeTree.style.flex = '';
    codeRefresh();
  }
  function buildCode() {
    code = document.createElement('div');
    code.id = 'nbg-code'; code.className = 'nbg-panel nbg-code'; code.hidden = true;   // shown (and placed) by syncToolbars
    code.setAttribute('role', 'dialog'); code.setAttribute('aria-label', 'Structure and HTML of the ' + AREA);
    code.innerHTML =
      '<div class="nbg-row nbg-ch"><span class="nbg-ct">' + UNIT + '</span>' +
      '<button type="button" data-tab="outline" class="nbg-on" title="The ' + AREA + '’s shapes — cards, text blocks, images — nested by containment: tick the boxes to select several, click a name to select it alone, Shift+click adds, double-click edits its text">Outline</button>' +
      '<button type="button" data-tab="tree" title="The ' + AREA + '’s HTML elements — click selects one on the ' + AREA + ', Shift+click adds it, double-click edits its text, ▸ expands; the selected element’s source is editable below the tree (Apply: Ctrl/Cmd+Enter)">Tree</button>' +
      '<span class="nbg-cfill"></span>' +
      '<button type="button" data-c="refresh" class="nbg-tquiet" title="Re-read the ' + AREA + '">↻</button>' +
      '<button type="button" data-c="detach" class="nbg-tquiet nbg-detach" title="Detach into its own window — in Chrome / Edge an always-on-top window you can move anywhere, even off the browser; close it to bring the panel back">⧉</button>' +
      '<button type="button" data-c="fold" class="nbg-tquiet nbg-fold" title="Collapse this panel to its header — click again to expand">▾</button>' +
      '<button type="button" data-c="close" class="nbg-tquiet" title="Close (Esc)">✕</button></div>' +
      '<div class="nbg-cb nbg-cout"><div class="nbg-of"><input type="search" class="nbg-oq" placeholder="Filter by text…" aria-label="Filter shapes">' +
      '<button type="button" data-o="all" class="nbg-tquiet" title="Select every top-level shape of the ' + AREA + ' (Ctrl/Cmd+A)">All</button>' +
      '<button type="button" data-o="none" class="nbg-tquiet" title="Clear the selection">None</button><span class="nbg-oc"></span></div><div class="nbg-olist" role="tree"></div></div>' +
      '<div class="nbg-cb nbg-ctree" hidden role="tree"></div>' +
      '<div class="nbg-csplit" hidden role="separator" aria-orientation="horizontal" aria-label="Resize the tree and the source editor" title="Drag to resize the tree and the source editor — double-click to reset"></div>' +
      '<div class="nbg-cb nbg-craw" hidden><div class="nbg-cw"></div><textarea class="nbg-raw" spellcheck="false" wrap="off" aria-label="HTML source of the selected element"></textarea>' +
      '<div class="nbg-cf"><button type="button" data-c="apply" class="nbg-tdone" title="Apply the source to the element (Ctrl/Cmd+Enter) — recorded like every other edit">Apply</button>' +
      '<button type="button" data-c="revert" class="nbg-tquiet" title="Drop the unapplied changes">Revert</button>' +
      '<button type="button" data-c="copy" class="nbg-tquiet" title="Copy the source">Copy</button><span class="nbg-cs"></span></div></div>';
    codeTree = code.querySelector('.nbg-ctree'); codeOut = code.querySelector('.nbg-olist'); codeRaw = code.querySelector('.nbg-raw'); codeStatus = code.querySelector('.nbg-cs');
    codeSplit = code.querySelector('.nbg-csplit');
    codeSplit.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      var total = code.clientHeight - code.querySelector('.nbg-ch').offsetHeight - codeSplit.offsetHeight, top = codeTree.getBoundingClientRect().top;
      if (total <= 0) return;
      var drag = { id: e.pointerId };
      try { codeSplit.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      function move(ev) { if (ev.pointerId !== drag.id) return; var h = Math.max(48, Math.min(total - 96, ev.clientY - top)); ui.split = h / total; codeTree.style.flex = '0 0 ' + Math.round(h) + 'px'; }
      function up(ev) { if (ev.pointerId !== drag.id) return; codeSplit.removeEventListener('pointermove', move); codeSplit.removeEventListener('pointerup', up); codeSplit.removeEventListener('pointercancel', up); uiSave(); }
      codeSplit.addEventListener('pointermove', move); codeSplit.addEventListener('pointerup', up); codeSplit.addEventListener('pointercancel', up);
    });
    codeSplit.addEventListener('dblclick', function (e) { e.preventDefault(); e.stopPropagation(); ui.split = 0.55; uiSave(); applySplit(); });
    if (typeof ResizeObserver === 'function') new ResizeObserver(function () { applySplit(); }).observe(code);   // the panel's own resize handle, a detached window
    code.querySelector('.nbg-oq').addEventListener('input', function (e) { outFilter = e.target.value; renderOutline(); });
    code.addEventListener('click', function (e) {
      e.stopPropagation();
      var b = e.target.closest('button');
      if (b && b.hasAttribute('data-tab')) { setTab(b.getAttribute('data-tab')); return; }
      if (b && b.hasAttribute('data-c')) {
        var c = b.getAttribute('data-c');
        if (c === 'close') closeCode(); else if (c === 'refresh') codeRefresh(); else if (c === 'detach') detachPanel('code'); else if (c === 'fold') setFold('code', !ui.fold.code); else if (c === 'apply') applyRaw(); else if (c === 'revert') revertRaw();
        else if (c === 'copy') { try { navigator.clipboard.writeText(codeRaw.value); setRawStatus('Copied.'); } catch (x) { codeRaw.select(); document.execCommand('copy'); setRawStatus('Copied.'); } }
        return;
      }
      if (b && b.hasAttribute('data-o')) { if (b.getAttribute('data-o') === 'all') selectAllIn(codeSlide()); else deselectShape(); return; }
      var row = e.target.closest('.nbg-tr'); if (!row) return;
      var el = elByKey(row.getAttribute('data-path')); if (!el) return;
      var outline = row.classList.contains('nbg-or');
      if (e.target.classList.contains('nbg-tw') && !e.target.classList.contains('nbg-tw-none')) {   // twisty
        var key = row.getAttribute('data-path');
        if (row.querySelector('.nbg-tw').textContent === '▾') { codeOpen.delete(key); codeClosed.add(key); } else { codeClosed.delete(key); codeOpen.add(key); }
        if (outline) renderOutline(); else renderTree();
        return;
      }
      if (isRoot(el)) return;
      codeEl = el;
      var svo = svgOwner(el);
      if (svo && svo !== el) { var pp = el; while (pp && pp !== svo && !SVG_PART.test(svgTag(pp))) pp = pp.parentElement; svgEdit(svo, pp !== svo ? pp : null); codeRefresh(); return; }   // a part of an SVG: edit the SVG with that part selected
      if (e.target.classList.contains('nbg-ock')) { toggleSelection(el); codeRefresh(); return; }            // checkbox: add / remove
      if (e.shiftKey && shape) addToSelection(el); else if ((e.metaKey || e.ctrlKey) && shape) toggleSelection(el); else selectSolo(el, true);
      codeRefresh();
    });
    code.addEventListener('dblclick', function (e) {
      var row = e.target.closest('.nbg-tr'); if (!row) return;
      e.preventDefault(); e.stopPropagation();
      var el = elByKey(row.getAttribute('data-path')), t = el && resolveTextTarget(el);
      if (t) { deselectShape(); startEdit(t, false); }
    });
    code.addEventListener('pointerover', function (e) { var row = e.target.closest('.nbg-tr'); hoverEl(row ? elByKey(row.getAttribute('data-path')) : null); });
    code.addEventListener('pointerleave', function () { hoverEl(null); });
    code.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    code.addEventListener('contextmenu', function (e) {   // a row in the Outline or Tree: ask the assistant about that element, or have it changed
      if (e.target.closest('textarea, input')) return;
      e.preventDefault(); e.stopPropagation();
      var row = e.target.closest('.nbg-tr'); if (!row) return;
      var el = elByKey(row.getAttribute('data-path')); if (!el) return;
      openAiPop(e.clientX, e.clientY, el);
    });
    codeRaw.addEventListener('input', function () { rawDirty = true; rawFor = rawFor || codeEl; setRawStatus('Modified — Apply (Ctrl/Cmd+Enter) or Revert.'); });
    code.addEventListener('keydown', function (e) {
      e.stopPropagation();
      var mod = e.ctrlKey || e.metaKey;
      if (e.target === codeRaw) { if (mod && e.key === 'Enter') { e.preventDefault(); applyRaw(); } else if (e.key === 'Escape') { e.preventDefault(); if (rawDirty) revertRaw(); else closeCode(); } return; }
      if (e.key === 'Escape') { e.preventDefault(); closeCode(); return; }
      // tree keyboard: arrows move, Right / Left expand / collapse, Enter selects, Shift+Enter adds
      var list = codeTab === 'outline' ? codeOut : codeTree;
      var rows = Array.prototype.slice.call(list.querySelectorAll('.nbg-tr')), cur = list.querySelector('.nbg-cur') || list.querySelector('.nbg-on') || rows[0];
      if (!rows.length || !cur) return;
      var i = rows.indexOf(cur), key = cur.getAttribute('data-path'), el = elByKey(key);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); var nx = rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]; rows.forEach(function (r) { r.classList.remove('nbg-cur'); }); nx.classList.add('nbg-cur'); nx.scrollIntoView({ block: 'nearest' }); hoverEl(elByKey(nx.getAttribute('data-path'))); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); codeClosed.delete(key); codeOpen.add(key); if (codeTab === 'outline') renderOutline(); else renderTree(); markCur(key); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); codeOpen.delete(key); codeClosed.add(key); if (codeTab === 'outline') renderOutline(); else renderTree(); markCur(key); }
      else if (e.key === ' ' && codeTab === 'outline' && el && !isRoot(el)) { e.preventDefault(); codeEl = el; toggleSelection(el); codeRefresh(); markCur(key); }
      else if (e.key === 'Enter' && el && !isRoot(el)) { e.preventDefault(); codeEl = el; if (e.shiftKey && shape) addToSelection(el); else selectSolo(el, true); codeRefresh(); }
    });
    codeTree.setAttribute('tabindex', '0'); codeOut.setAttribute('tabindex', '0');
    document.body.appendChild(code);
    applyFold('code');
  }
  function markCur(key) { var r = (codeTab === 'outline' ? codeOut : codeTree).querySelector('.nbg-tr[data-path="' + key + '"]'); if (r) r.classList.add('nbg-cur'); }
  function openCode(el, tab) {
    ensureMenu();
    if (el && el.nodeType === 1 && !el.closest(OURS)) codeEl = el;
    else if (!codeEl || !codeEl.isConnected) codeEl = shape ? shape.el : editing ? editing.el : null;
    var t = tab === 'code' ? 'tree' : tab || (codeTab === 'outline' ? 'outline' : 'tree');
    openMenuTab(t);
    if (tab === 'code') setTab('code');
    // "Show structure / HTML" on an element selects it (a part of an SVG: SVG editing with that part); opening the panel on its own selects nothing
    if (el && el === codeEl && !shape && !editing && !(svgEd && svgEd.svg.contains(el)) && codeEl.isConnected && !isRoot(codeEl)) selectSolo(codeEl, true);
    toast('Structure — Outline: tick boxes to select several shapes, click a name to select one; Tree: the HTML elements, with the selected element’s source editable below them (drag the bar between them). The selection is highlighted on the ' + AREA + ' and here. The menu stays pinned while a structure tab is shown.', 5000);
    return true;
  }
  // the structure panel is a tab of the menu: shown when the menu is on the Outline / Tree tab
  function openCodePanel() {
    ensureMenu();
    code.hidden = false;
    applySplit();
    codeRefresh();
    if (!codeObserver) {
      // deck-driven changes (slide switches, animations) and edits made elsewhere keep the tree current
      codeObserver = new MutationObserver(function (list) {
        for (var i = 0; i < list.length; i++) { var t = list[i].target; if (!(t.nodeType === 1 ? t.closest(OURS) : t.parentElement && t.parentElement.closest(OURS))) { codeRefresh(); return; } }
      });
    }
    codeObserver.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true, attributeFilter: ['class', 'style', 'hidden', 'data-nbg-group'] });
  }
  function closeCodePanel() { code.hidden = true; hoverEl(null); if (codeObserver) codeObserver.disconnect(); }
  function closeCode() {
    if (!codeIsOpen()) return false;
    closeMenu(true);
    return true;
  }
  function codeIsOpen() { return !!(menu && !menu.hidden && menuTab !== 'menu' && code && !code.hidden); }
  window.addEventListener('resize', function () { if (code && !code.hidden) { applySplit(); codeRefresh(); } });

  /* ---------- AI assistant panel: a request to an LLM with the slide's screenshot / source, the selection's source and a clipboard image ---------- */
  var AI_SETTINGS_KEY = 'nbg-deck-ai-settings', AI_PROMPTS_KEY = 'nbg-deck-ai-prompts', AI_KEY_KEY = 'nbg-deck-ai-key';
  var AI_PROVIDERS = {
    'anthropic': { name: 'Anthropic', api: 'messages', auth: 'x-api-key', url: 'https://api.anthropic.com', model: 'claude-opus-5', urlHint: 'https://api.anthropic.com', modelHint: 'claude-opus-5' },
    'azure-anthropic': { name: 'Azure — Anthropic (Microsoft Foundry)', api: 'messages', auth: 'api-key', urlHint: 'https://<resource>.services.ai.azure.com/anthropic', modelHint: 'the deployment name, e.g. claude-opus-5' },
    'openai': { name: 'OpenAI-compatible', api: 'chat', auth: 'bearer', url: 'https://api.openai.com/v1', urlHint: 'https://api.openai.com/v1 — or any server with the same chat/completions API', modelHint: 'e.g. gpt-5' },
    'azure-openai': { name: 'Azure OpenAI', api: 'chat', auth: 'api-key', azure: true, urlHint: 'https://<resource>.openai.azure.com', modelHint: 'the deployment name' },
    'deepseek': { name: 'DeepSeek', api: 'chat', auth: 'bearer', url: 'https://api.deepseek.com', model: 'deepseek-v4-flash-vision-exp', urlHint: 'https://api.deepseek.com', modelHint: 'deepseek-v4-flash-vision-exp (the only DeepSeek model that accepts images)' },
  };
  var AI_PROVIDER_ORDER = ['anthropic', 'azure-anthropic', 'openai', 'azure-openai', 'deepseek'];
  // built-in prompts (read-only; "Copy to mine" makes an editable copy). mode: the reply option the prompt pre-selects.
  var AI_BUILTIN = PAGE_MODE ? [
    { id: 'b:free', name: 'Free request', mode: '', text: '' },
    { id: 'b:review', name: 'Review the page', mode: 'answer', text: 'Review this page as an experienced web and content designer. Judge the visual hierarchy, the amount and order of content, alignment and spacing, the consistency of colours and type, readability, and the clarity of the message. Give at most eight findings as a numbered list, most important first; each finding names what to change and how. Do not restate what the page says.' },
    { id: 'b:proof', name: 'Proofread the text', mode: 'answer', text: 'Proofread every piece of text on this page: spelling, grammar, punctuation, capitalisation, inconsistent wording and terminology, numbers and dates. List each problem as “before → after” with a short reason. Say “No issues found” when there is nothing to fix. Keep the language of the page.' },
    { id: 'b:copy', name: 'Tighten the copy', mode: 'answer', text: 'Propose tighter, clearer wording for the texts on this page: headings of at most eight words, and body texts that keep every fact but drop filler. Show each text as “current → proposed”. Keep the language, the tone and the meaning.' },
    { id: 'b:summary', name: 'Summarise the page', mode: 'answer', text: 'Summarise this page in at most eight bullet points, in the language of the page, covering every section in order. End with one sentence naming the page’s purpose and audience.' },
    { id: 'b:restyle', name: 'Restyle the selection', mode: 'replace', text: 'Change the selected element as the viewer asks in the additional instructions (colours, fill, borders, spacing, size, typography, alignment). Keep its tag, its classes, its id, its images and its text unless the instructions say otherwise. Stay consistent with the page’s existing colours and fonts. Return the complete replacement HTML for the element.' },
    { id: 'b:rewrite', name: 'Rewrite the selection’s text', mode: 'replace', text: 'Rewrite the text inside the selected element as the viewer asks in the additional instructions (shorter, clearer, a different tone, another language…). Keep the element’s tag, attributes, inline markup structure (spans, line breaks, lists, links) and images; change only the words. Return the complete replacement HTML for the element.' },
  ] : [
    { id: 'b:free', name: 'Free request', mode: '', text: '' },
    { id: 'b:review', name: 'Review the slide', mode: 'answer', text: 'Review this slide as an experienced presentation designer who knows the ' + THEME_NAME + ' design system. Judge the visual hierarchy, the amount of content, alignment and spacing, the consistency of colours and type with the ' + THEME_NAME + ' palette and font stacks, and the clarity of the message. Give at most eight findings as a numbered list, most important first; each finding names what to change and how. Do not restate what the slide says.' },
    { id: 'b:proof', name: 'Proofread the text', mode: 'answer', text: 'Proofread every piece of text on this slide: spelling, grammar, punctuation, capitalisation, inconsistent wording and terminology, numbers and dates. List each problem as “before → after” with a short reason. Say “No issues found” when there is nothing to fix. Keep the language of the slide.' },
    { id: 'b:copy', name: 'Tighten the copy', mode: 'answer', text: 'Propose tighter, clearer wording for the texts on this slide: a title of at most eight words, and body texts that keep every fact but drop filler. Show each text as “current → proposed”. Keep the language, the tone of a bank’s executive presentation, and the meaning.' },
    { id: 'b:notes', name: 'Speaker notes', mode: 'answer', text: 'Write speaker notes for this slide: what the presenter should say in about 90 seconds, in plain spoken language, in the language of the slide, covering every element on it in a sensible order. End with one sentence that leads to the next slide.' },
    { id: 'b:restyle', name: 'Restyle the selection', mode: 'replace', text: 'Change the selected element as the viewer asks in the additional instructions (colours, fill, borders, spacing, size, typography, alignment). Keep its tag, its classes, its id, its images and its text unless the instructions say otherwise. Use the ' + THEME_NAME + ' palette and font stacks. Return the complete replacement HTML for the element.' },
    { id: 'b:rewrite', name: 'Rewrite the selection’s text', mode: 'replace', text: 'Rewrite the text inside the selected element as the viewer asks in the additional instructions (shorter, clearer, a different tone, another language…). Keep the element’s tag, attributes, inline markup structure (spans, line breaks, lists) and images; change only the words. Return the complete replacement HTML for the element.' },
  ];
  var AI_SYSTEM_PAGE = 'You are assisting a viewer who edits an HTML web page in place in the browser. ' +
    'The viewer’s message may carry, as the viewer chose: a screenshot of the page (or of the current section), the page’s full HTML source with its stylesheet, the HTML source of the element(s) the viewer selected, and an image taken from the viewer’s clipboard. Work with what is attached and do not ask for what is missing. ' +
    'In the sources, embedded images appear as src="nbg-image:N" (or url(nbg-image:N)) placeholders standing for the original image data — keep such placeholders exactly as they are. Stay consistent with the page’s existing colours, fonts and layout when you propose visual changes.';
  var AI_SYSTEM = cfgStr('aiSystem') ? cfgStr('aiSystem') : PAGE_MODE ? AI_SYSTEM_PAGE : (BIKS
    ? 'You are assisting a viewer of an HTML slide deck built with the BikS2013 personal presentation design system (the personal theme of the nbg-design skill): 1920×1080 slides, the Avenir Next font stack (Avenir Next, Inter, Helvetica, Arial), and the BikS2013 palette — ink #1B1D21, copper #C8623A, copper light #E08A5E, amber #E3A64A, black #111316, grey #6E7379, paper #F6F3EC, white #FFFFFF. '
    : 'You are assisting a viewer of an HTML slide deck built with the National Bank of Greece (NBG) presentation design system: 1920×1080 slides, the Aptos font stack (Aptos, Inter, Helvetica, Arial), and the NBG palette — deep teal #003841, teal #007B85, bright cyan #00ADBF, electric cyan #00CFE7, black #0A1416, grey #5B6B6D, cream #F5F8F6, white #FFFFFF. ') +
    'The viewer’s message may carry, as the viewer chose: a screenshot of the current slide, the slide’s full HTML source with the deck’s stylesheet, the HTML source of the element(s) the viewer selected, and an image taken from the viewer’s clipboard. Work with what is attached and do not ask for what is missing. ' +
    'In the sources, embedded images appear as src="nbg-image:N" (or url(nbg-image:N)) placeholders standing for the original image data — keep such placeholders exactly as they are. Stay within the ' + THEME_NAME + ' palette and font stacks when you propose visual changes.';
  var AI_MODE_TEXT = {
    answer: 'Reply in plain text; Markdown is fine. Be concise and concrete.',
    replace: 'Your entire reply must be the replacement HTML for the selected element: exactly one root element with the same tag name as the selected element, with its attributes, inline styles and contents changed as requested, and nothing else — no explanation, no Markdown code fence. Do not add scripts, event handlers or external resources. Keep image placeholders unchanged.',
  };
  var ai = null, aiView = 'ask', aiBusy = false, aiClip = null, aiLast = null, aiLastStore = null, aiLastReplace = null, aiPrompts = [], aiEditing = null;
  var aiHooks = { capture: null, fetch: null };
  // everything the viewer chose is remembered per browser: provider / endpoint / model / key scope, prompt, attachments,
  // reply choice, the view, the request text, and the panel's position and size
  // url / model / apiVersion / keyScope are the active provider's; every provider keeps its own copy in `profiles`
  // (and its own key under nbg-deck-ai-key:<provider>), so switching providers brings the earlier entries back
  var aiSettings = { provider: '', url: '', model: '', apiVersion: '', keyScope: 'browser', profiles: {}, promptId: 'b:free', output: 'answer', include: { shot: true, slide: true, sel: true, clip: true }, view: 'ask', request: '', pos: null, size: null, structure: { askPrompt: 'b:free', changePrompt: 'b:restyle', include: { shot: false, slide: true, sel: true, clip: false } } };
  function aiProfileOf(o) { if (!o || typeof o !== 'object') return null; var p = { url: '', model: '', apiVersion: '', keyScope: 'browser' }; ['url', 'model', 'apiVersion'].forEach(function (k) { if (typeof o[k] === 'string') p[k] = o[k]; }); if (o.keyScope === 'tab' || o.keyScope === 'browser') p.keyScope = o.keyScope; return p; }
  function aiSyncProfile() { if (AI_PROVIDERS[aiSettings.provider]) aiSettings.profiles[aiSettings.provider] = { url: aiSettings.url, model: aiSettings.model, apiVersion: aiSettings.apiVersion, keyScope: aiSettings.keyScope }; }
  function aiSwitchProvider(p) {   // the current provider's fields stay in its profile; the target's come back (blank when never entered)
    if (p === aiSettings.provider) return false;
    aiSyncProfile();
    aiSettings.provider = AI_PROVIDERS[p] ? p : '';
    var prof = aiSettings.profiles[aiSettings.provider] || { url: '', model: '', apiVersion: '', keyScope: 'browser' };
    aiSettings.url = prof.url; aiSettings.model = prof.model; aiSettings.apiVersion = prof.apiVersion; aiSettings.keyScope = prof.keyScope;
    return true;
  }
  function aiPosOf(o) { return o && typeof o === 'object' && isFinite(o.left) && isFinite(o.top) ? { left: +o.left, top: +o.top } : null; }
  function aiSizeOf(o) { return o && typeof o === 'object' && +o.w >= 320 && +o.h >= 240 ? { w: Math.round(+o.w), h: Math.round(+o.h) } : null; }
  function aiMergeSettings(s) {
    if (s.profiles && typeof s.profiles === 'object') Object.keys(AI_PROVIDERS).forEach(function (k) { var pr = aiProfileOf(s.profiles[k]); if (pr) aiSettings.profiles[k] = pr; });
    if (typeof s.provider === 'string' && s.provider !== aiSettings.provider) aiSwitchProvider(s.provider);
    ['url', 'model', 'apiVersion', 'promptId', 'output', 'request'].forEach(function (k) { if (typeof s[k] === 'string') aiSettings[k] = s[k]; });
    if (s.keyScope === 'tab' || s.keyScope === 'browser') aiSettings.keyScope = s.keyScope;
    if (/^(ask|prompts|structure|settings)$/.test(s.view)) aiSettings.view = s.view;
    if (s.structure && typeof s.structure === 'object') { ['askPrompt', 'changePrompt'].forEach(function (k) { if (typeof s.structure[k] === 'string') aiSettings.structure[k] = s.structure[k]; }); if (s.structure.include && typeof s.structure.include === 'object') ['shot', 'slide', 'sel', 'clip'].forEach(function (k) { if (typeof s.structure.include[k] === 'boolean') aiSettings.structure.include[k] = s.structure.include[k]; }); }
    if (s.include && typeof s.include === 'object') ['shot', 'slide', 'sel', 'clip'].forEach(function (k) { if (typeof s.include[k] === 'boolean') aiSettings.include[k] = s.include[k]; });
    if ('pos' in s) aiSettings.pos = aiPosOf(s.pos);
    if ('size' in s) aiSettings.size = aiSizeOf(s.size);
  }
  (function loadAi() {
    try { var s = JSON.parse(localStorage.getItem(AI_SETTINGS_KEY) || 'null'); if (s && typeof s === 'object') aiMergeSettings(s); } catch (e) { /* storage unavailable */ }
    aiSyncProfile();
    // a key stored before the per-provider keys existed belongs to the provider that was active
    try { var legacy = localStorage.getItem(AI_KEY_KEY) || sessionStorage.getItem(AI_KEY_KEY); if (legacy) { if (AI_PROVIDERS[aiSettings.provider] && !aiKey()) (aiSettings.keyScope === 'tab' ? sessionStorage : localStorage).setItem(aiKeyName(aiSettings.provider), legacy); localStorage.removeItem(AI_KEY_KEY); sessionStorage.removeItem(AI_KEY_KEY); } } catch (e) { /* ignore */ }
    try { var p = JSON.parse(localStorage.getItem(AI_PROMPTS_KEY) || 'null'); if (Array.isArray(p)) aiPrompts = p.filter(function (x) { return x && typeof x.id === 'string' && /^u:/.test(x.id) && typeof x.name === 'string' && typeof x.text === 'string'; }).map(function (x) { return { id: x.id, name: x.name, text: x.text, mode: /^(answer|replace)$/.test(x.mode) ? x.mode : '' }; }); } catch (e) { /* ignore */ }
  })();
  function aiKeyName(p) { return AI_KEY_KEY + ':' + p; }
  function aiKey() { if (!AI_PROVIDERS[aiSettings.provider]) return ''; try { return (aiSettings.keyScope === 'tab' ? sessionStorage : localStorage).getItem(aiKeyName(aiSettings.provider)) || ''; } catch (e) { return ''; } }
  function aiSaveSettings(key) {
    aiSyncProfile();
    try { localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(aiSettings)); } catch (e) { /* ignore */ }
    if (key !== undefined && AI_PROVIDERS[aiSettings.provider]) {
      var name = aiKeyName(aiSettings.provider);
      try { localStorage.removeItem(name); sessionStorage.removeItem(name); if (key) (aiSettings.keyScope === 'tab' ? sessionStorage : localStorage).setItem(name, key); } catch (e) { /* ignore */ }
    }
  }
  function aiSavePrompts() { try { localStorage.setItem(AI_PROMPTS_KEY, JSON.stringify(aiPrompts)); } catch (e) { /* ignore */ } }
  function aiAllPrompts() { return AI_BUILTIN.concat(aiPrompts); }
  function aiPromptById(id) { var all = aiAllPrompts(); for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; return null; }
  function aiCurrentPrompt() { return aiPromptById(aiSettings.promptId) || AI_BUILTIN[0]; }
  // no fallbacks: a missing endpoint, model or key blocks the request with a message (nothing is substituted)
  function aiCheckSettings() {
    var p = AI_PROVIDERS[aiSettings.provider];
    if (!p) return 'Choose a provider in Settings.';
    if (!/^https?:\/\/\S+$/.test(aiSettings.url)) return 'Enter the endpoint URL in Settings (' + p.urlHint + ').';
    if (!aiSettings.model.trim()) return 'Enter the model' + (p.modelHint ? ' (' + p.modelHint + ')' : '') + ' in Settings.';
    if (!aiKey()) return 'Enter the API key in Settings.';
    return '';
  }
  function inAi(t) { return !!(ai && t && ai.contains(t)); }
  function aiTargets() { return sel.length ? sel.slice() : editing ? [editing.el] : svgEd ? (svgSel().length ? svgSel() : [svgEd.svg]) : []; }   // what "selected element source" and "replace" work on
  function aiSlide() { var t = aiTargets()[0]; return (t && slideOf(t)) || slideAtPoint(window.innerWidth / 2, window.innerHeight / 2); }
  /* image data URIs are large: the sources go out with numbered placeholders, restored when a reply is applied */
  // every data URI of some size — base64 or not, with or without parameters, in HTML attributes or CSS url() — becomes a placeholder
  var AI_DATA_RE = /data:[a-z0-9.+\/-]+(?:;[a-z0-9=.+-]+)*,[^"'()\s<>]{64,}/gi;
  function aiStripData(text, store) {
    return text.replace(AI_DATA_RE, function (m) { var i = store.indexOf(m); if (i < 0) { store.push(m); i = store.length - 1; } return 'nbg-image:' + (i + 1); });
  }
  function aiRestoreData(html, store) { return store && store.length ? html.replace(/nbg-image:(\d+)/g, function (m, i) { return store[+i - 1] || m; }) : html; }
  // the stylesheet rules the slide actually uses (root / body rules for the variables, style rules matching the slide or
  // something inside it, the same inside @media / @supports; @font-face and @keyframes are named, not copied), else — when
  // the sheets cannot be read — the deck's <style> text; data URIs are stripped either way
  function aiDeckCss(slide, store) {
    var out = [], faces = [], frames = [], readable = false;
    function want(sel) {
      var parts = sel.split(',');
      for (var i = 0; i < parts.length; i++) {
        var s = parts[i].trim(); if (!s) continue;
        try { if (document.documentElement.matches(s) || document.body.matches(s) || (slide && (slide.matches(s) || slide.querySelector(s)))) return true; } catch (e) { if (/^(:root|html|body)\b/.test(s)) return true; }
      }
      return false;
    }
    function walk(rules, into) {
      for (var i = 0; i < rules.length; i++) {
        var r = rules[i];
        if (r.type === 1) { if (want(r.selectorText)) into.push(r.cssText); }
        else if (r.type === 5) faces.push((r.style.getPropertyValue('font-family') || '').trim());
        else if (r.type === 7) frames.push(r.name);
        else if (r.cssRules && (r.type === 4 || r.type === 12)) { var inner = []; walk(r.cssRules, inner); if (inner.length) into.push((r.type === 4 ? '@media ' + r.conditionText : '@supports ' + r.conditionText) + ' {\n' + inner.join('\n') + '\n}'); }
        else if (r.type === 8 || r.type === 15) into.push(r.cssText);   // @page, @property-like small rules
      }
    }
    try {
      for (var i = 0; i < document.styleSheets.length; i++) {
        var sh = document.styleSheets[i], node = sh.ownerNode;
        if (node && (node.id === 'nbg-deck-menu-style' || (node.closest && node.closest(OURS)))) continue;
        var rules = null; try { rules = sh.cssRules; } catch (e) { rules = null; }
        if (!rules) continue;
        readable = true; walk(rules, out);
      }
    } catch (e) { readable = false; }
    var css;
    if (readable) {
      css = out.join('\n');
      if (faces.length) css += '\n/* @font-face declared (files omitted): ' + faces.filter(function (f, k) { return f && faces.indexOf(f) === k; }).join(', ') + ' */';
      if (frames.length) css += '\n/* @keyframes declared (omitted): ' + frames.join(', ') + ' */';
    } else {
      var texts = [];
      Array.prototype.forEach.call(document.querySelectorAll('style'), function (s) { if (s.id === 'nbg-deck-menu-style' || s.closest(OURS)) return; if (s.textContent.trim()) texts.push(s.textContent.trim()); });
      css = texts.join('\n\n');
    }
    return aiStripData(css, store || []);
  }
  var AI_MAX_TEXT = 300 * 1024;   // a request's text (prompt + sources) above this is refused with the breakdown — a provider error would be opaque
  function aiKb(s) { return Math.round(s.length / 1024); }
  function aiFence(lang, s) { return '```' + lang + '\n' + s + '\n```'; }
  /* images: data URL helpers; every image goes out as PNG (kept) or JPEG (photos, downscaled) within the providers' limits */
  function aiSplitDataUrl(u) { var m = /^data:([^;,]+);base64,(.*)$/s.exec(u); return m ? { mime: m[1], b64: m[2] } : null; }
  function aiLoadImage(url) { return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { rej(new Error('The image could not be decoded.')); }; im.src = url; }); }
  async function aiNormaliseImage(url, maxSide) {
    var im = await aiLoadImage(url);
    var w = im.naturalWidth, h = im.naturalHeight, f = Math.min(1, maxSide / Math.max(w, h));
    var parts = aiSplitDataUrl(url);
    if (f === 1 && parts && /^image\/(png|jpeg|gif|webp)$/.test(parts.mime) && url.length < 3500000) return url;
    var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * f)); c.height = Math.max(1, Math.round(h * f));
    var ctx = c.getContext('2d'); ctx.drawImage(im, 0, 0, c.width, c.height);
    var png = c.toDataURL('image/png');
    return png.length < 3500000 ? png : c.toDataURL('image/jpeg', 0.9);
  }
  function aiBlobToDataUrl(blob) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result)); }; r.onerror = function () { rej(new Error('The image could not be read.')); }; r.readAsDataURL(blob); }); }
  // the slide's screenshot: tab capture (the browser asks once which tab; the current tab is preferred), our UI hidden, cropped to the slide
  async function aiCaptureSlide(slide) {
    if (aiHooks.capture) return aiHooks.capture(slide);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) throw new Error('Screen capture is not available in this browser — untick “Screenshot of the ' + AREA + '”.');
    var stream, video = document.createElement('video'), track = null;
    // our UI goes away before the picker opens, so no frame ever shows it; two paints make sure the hidden state is on screen
    document.documentElement.classList.add('nbg-capturing');
    try {
      await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });
      var hiddenAt = performance.now();
      var capWin = isDetached('menu') ? detached.menu : window;   // the click came from the menu's window: that window holds the user activation
      try { stream = await capWin.navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' }, audio: false, preferCurrentTab: capWin === window, selfBrowserSurface: 'include', surfaceSwitching: 'exclude', monitorTypeSurfaces: 'exclude' }); }
      catch (e) { throw new Error('The screenshot was not allowed (' + (e && e.message ? e.message : e) + ') — allow the capture of this tab, or untick “Screenshot of the ' + AREA + '”.'); }
      track = stream.getVideoTracks()[0];
      video.srcObject = stream; video.muted = true; video.playsInline = true;
      await video.play();
      // use a frame captured after the hide: the stream may still deliver frames rendered before it
      await new Promise(function (r) {
        var left = 6, done = false, timer = setTimeout(function () { if (!done) { done = true; r(); } }, 2000);
        function next(now, meta) {
          if (done) return;
          var t = meta && (meta.captureTime || meta.receiveTime || meta.presentationTime) || 0;
          if ((t && t > hiddenAt + 60) || --left <= 0) { done = true; clearTimeout(timer); setTimeout(r, 120); return; }
          video.requestVideoFrameCallback(next);
        }
        if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(next); else setTimeout(function () { if (!done) { done = true; clearTimeout(timer); r(); } }, 600);
      });
      var vw = video.videoWidth, vh = video.videoHeight; if (!vw || !vh) throw new Error('The capture produced no frame.');
      var sx = vw / window.innerWidth, sy = vh / window.innerHeight, r = slide ? slide.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
      var c = document.createElement('canvas');
      var cx = Math.max(0, Math.round(r.left * sx)), cy = Math.max(0, Math.round(r.top * sy)), cw = Math.min(vw - cx, Math.round(r.width * sx)), ch = Math.min(vh - cy, Math.round(r.height * sy));
      if (cw < 8 || ch < 8) { cx = 0; cy = 0; cw = vw; ch = vh; }
      c.width = cw; c.height = ch;
      c.getContext('2d').drawImage(video, cx, cy, cw, ch, 0, 0, cw, ch);
      return c.toDataURL('image/png');
    } finally {
      document.documentElement.classList.remove('nbg-capturing');
      try { video.pause(); video.srcObject = null; } catch (x) { /* ignore */ }
      try { if (track) track.stop(); if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); } catch (x) { /* ignore */ }
    }
  }
  /* request shapes per provider */
  function aiBuildRequest(s, key, payload) {
    var p = AI_PROVIDERS[s.provider], base = s.url.replace(/\/+$/, ''), url, headers = { 'content-type': 'application/json' }, body;
    if (p.api === 'messages') {
      url = base + '/v1/messages';
      headers['anthropic-version'] = '2023-06-01';
      if (p.auth === 'x-api-key') { headers['x-api-key'] = key; headers['anthropic-dangerous-direct-browser-access'] = 'true'; } else headers['api-key'] = key;
      body = { model: s.model, max_tokens: 16000, system: payload.system, messages: [{ role: 'user', content: payload.parts.map(function (part) { return part.text !== undefined ? { type: 'text', text: part.text } : { type: 'image', source: { type: 'base64', media_type: part.mime, data: part.b64 } }; }) }] };
    } else {
      if (p.azure) url = s.apiVersion.trim() ? base + '/openai/deployments/' + encodeURIComponent(s.model) + '/chat/completions?api-version=' + encodeURIComponent(s.apiVersion.trim()) : base + '/openai/v1/chat/completions';
      else url = base + '/chat/completions';
      if (p.auth === 'bearer') headers.authorization = 'Bearer ' + key; else headers['api-key'] = key;
      body = { model: s.model, messages: [{ role: 'system', content: payload.system }, { role: 'user', content: payload.parts.map(function (part) { return part.text !== undefined ? { type: 'text', text: part.text } : { type: 'image_url', image_url: { url: part.dataUrl } }; }) }] };
    }
    return { url: url, headers: headers, body: body };
  }
  function aiParseReply(s, json) {
    var p = AI_PROVIDERS[s.provider];
    if (p.api === 'messages') {
      if (json.type === 'error') throw new Error(json.error && json.error.message ? json.error.message : 'The endpoint returned an error.');
      if (json.stop_reason === 'refusal') throw new Error('The model declined this request' + (json.stop_details && json.stop_details.explanation ? ': ' + json.stop_details.explanation : '.'));
      var t = (json.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n');
      if (json.stop_reason === 'max_tokens') t += '\n\n[The reply was cut at the output limit.]';
      return t;
    }
    if (json.error) throw new Error(json.error.message || String(json.error));
    var m = json.choices && json.choices[0] && json.choices[0].message, c = m && m.content;
    if (Array.isArray(c)) c = c.map(function (x) { return x.text || ''; }).join('');
    return c || '';
  }
  function aiFriendlyError(e) {
    var m = e && e.message ? e.message : String(e);
    if (/failed to fetch|networkerror|load failed/i.test(m)) return 'The request did not reach the endpoint (network, or the provider does not allow calls from a browser — CORS). Check the URL; if the provider blocks browser calls, route it through a gateway that allows them.';
    return m;
  }
  async function aiCall(payload) {   // one request → the reply text; aiLast keeps what was sent
    var missing = aiCheckSettings(); if (missing) throw new Error(missing);
    var s = aiSettings, key = aiKey(), r = aiBuildRequest(s, key, payload);
    aiLast = { provider: s.provider, url: r.url, headers: r.headers, body: r.body };
    var f = aiHooks.fetch || function (u, init) { return window.fetch(u, init); };
    var res = await f(r.url, { method: 'POST', headers: r.headers, body: JSON.stringify(r.body) });
    var txt = await res.text(), json = null;
    try { json = JSON.parse(txt); } catch (x) { /* not JSON */ }
    if (!res.ok) {
      var msg = json && json.error ? (json.error.message || JSON.stringify(json.error)) : txt.slice(0, 300);
      throw new Error('HTTP ' + res.status + (msg ? ' — ' + msg : ''));
    }
    if (!json) throw new Error('The endpoint did not return JSON.');
    return aiParseReply(s, json);
  }
  function aiUnfence(t) { var m = /```(?:html)?\s*([\s\S]*?)```/i.exec(t); return (m ? m[1] : t).trim(); }
  // "replace the selected element": the reply is applied like the Code tab's Apply (same tag, sanitised, recorded)
  function aiApplyReply(target, text, store) {
    if (!target || !target.isConnected) return { error: 'Select one element first.' };
    var before = cleanOuterHtml(target);
    var r = applySource(target, aiRestoreData(aiUnfence(text), store || aiLastStore));
    if (r.error) return r;
    aiLastReplace = { el: target, before: before };
    if (!shape || sel.indexOf(target) < 0) { if (!editing) selectSolo(target, true); }
    layoutAi();
    toast('Applied to ' + describe(target) + ' — ' + changesLabel() + '. Undo is in the assistant panel; right-click → “Save edited copy” to download the ' + WHOLE + ' with your changes.', 5000);
    return r;
  }
  function aiUndo() {
    if (!aiLastReplace || !aiLastReplace.el.isConnected) return false;
    var r = applySource(aiLastReplace.el, aiLastReplace.before);
    aiLastReplace = null; layoutAi();
    return !r.error;
  }
  async function aiSend(opts) {
    if (!ai || aiBusy) return false;
    opts = opts || {};
    var pop = !!opts.pop;
    var st = function (m, bad) { aiStatus(m, bad); if (pop) aiPopStatus(m, bad); };
    var missing = aiCheckSettings(); if (missing) { st(missing, true); if (pop) openAi('settings'); else setAiView('settings'); return false; }
    var prompt = (opts.promptId && aiPromptById(opts.promptId)) || aiCurrentPrompt(), req = typeof opts.request === 'string' ? opts.request.trim() : ai.querySelector('[data-ai=req]').value.trim();
    if (!prompt.text && !req) { st('Type a request, or choose a prompt.', true); return false; }
    var mode = opts.output || aiSettings.output, targets = opts.target ? [opts.target] : aiTargets(), inc = opts.include || aiSettings.include, slide = opts.target ? (slideOf(opts.target) || aiSlide()) : aiSlide();
    var asked = ai.querySelector('[data-ai=asked]');
    if (opts.target) { asked.hidden = false; asked.textContent = (mode === 'replace' ? 'Change requested for ' : 'Asked about ') + describe(opts.target) + ' with “' + prompt.name + '”' + (req ? ': ' + req : ''); } else asked.hidden = true;
    if (mode === 'replace' && targets.length !== 1) { st('“Replace the selected element” needs exactly one selected element — select it (right-click → Resize / move shape, or tick it in the Outline).', true); return false; }
    aiBusy = true; ai.classList.add('nbg-abusy'); aiSetReply(''); aiLastStore = null; if (pop) aiPopBusy(true);
    try {
      var store = [], text = '', sizes = [];
      if (prompt.text) text += prompt.text + '\n\n';
      if (req) text += (prompt.text ? 'Additional instructions from the viewer:\n' : '') + req + '\n\n';
      if (targets.length) text += 'The viewer selected ' + (targets.length === 1 ? describe(targets[0]) : targets.length + ' elements') + (mode === 'replace' ? ' and wants it replaced by your reply.' : '.') + '\n\n';
      if (inc.slide && slide) {
        var src = aiStripData(aiSourceHtml(slide), store), css = aiDeckCss(slide, store);
        text += unitOf(slide) + ' — full HTML source:\n' + aiFence('html', src) + '\n\n';
        if (css) text += (PAGE_MODE ? 'Page' : 'Deck') + ' stylesheet (the rules this ' + AREA + ' uses):\n' + aiFence('css', css) + '\n\n';
        sizes.push(AREA + ' source ' + aiKb(src) + ' KB', 'stylesheet ' + aiKb(css) + ' KB');
      }
      if (inc.sel && targets.length) targets.forEach(function (el, i) { var s2 = aiStripData(aiSourceHtml(el), store); text += 'Selected element' + (targets.length > 1 ? ' ' + (i + 1) : '') + ' (' + describe(el) + ') — HTML source:\n' + aiFence('html', s2) + '\n\n'; sizes.push('selection ' + aiKb(s2) + ' KB'); });
      if (text.length > AI_MAX_TEXT) { st('Not sent — the text alone is ' + aiKb(text) + ' KB (' + sizes.join(', ') + '), above the ' + Math.round(AI_MAX_TEXT / 1024) + ' KB limit. Untick “' + AREA_CAP + ' source” or select a smaller element; the sources carry image placeholders already, so this is markup or CSS text.', true); return false; }
      var parts = [];
      if (inc.shot) {
        st('Capturing the ' + AREA + '…');
        var shot = await aiNormaliseImage(await aiCaptureSlide(slide), 1600), sp = aiSplitDataUrl(shot);
        parts.push({ text: 'Screenshot of the current ' + AREA + (slide ? ' (' + unitPhrase(slide) + ')' : '') + ':' }); parts.push({ dataUrl: shot, mime: sp.mime, b64: sp.b64 });
        sizes.push('screenshot ' + aiKb(shot) + ' KB');
      }
      if (inc.clip && aiClip) { var cp = aiSplitDataUrl(aiClip); parts.push({ text: 'Image from the viewer’s clipboard:' }); parts.push({ dataUrl: aiClip, mime: cp.mime, b64: cp.b64 }); sizes.push('clipboard image ' + aiKb(aiClip) + ' KB'); }
      parts.push({ text: text.trim() });
      var system = AI_SYSTEM + ' ' + AI_MODE_TEXT[mode === 'replace' ? 'replace' : 'answer'];
      st('Waiting for ' + AI_PROVIDERS[aiSettings.provider].name + ' (' + aiSettings.model + ')' + (sizes.length ? ' — ' + sizes.join(', ') : '') + '…');
      var reply = await aiCall({ system: system, parts: parts });
      aiLastStore = store;
      aiSetReply(reply);
      if (mode === 'replace') {
        var r = aiApplyReply(targets[0], reply, store);
        if (pop) aiPopReply(reply, !r.error);
        if (r.error) { st('The reply could not be applied: ' + r.error + ' It is shown below — edit the element by hand, or ask again.', true); return false; }
        else st('Applied to ' + describe(targets[0]) + ' — ' + changesLabel() + '.' + (r.dropped ? ' Removed ' + r.dropped + ' script / event-handler item' + (r.dropped === 1 ? '' : 's') + '.' : ''));
      } else { if (pop) aiPopReply(reply, false); st(reply ? 'Answer received.' : 'The reply was empty.', !reply); }
      return true;
    } catch (e) { st(aiFriendlyError(e) + (sizes.length ? ' (sent: ' + sizes.join(', ') + ')' : ''), true); return false; }
    finally { aiBusy = false; if (ai) ai.classList.remove('nbg-abusy'); if (pop) aiPopBusy(false); layoutAi(); }
  }
  async function aiTest() {
    var st = function (m, bad) { var el = ai.querySelector('[data-ai=sstatus]'); el.textContent = m; el.classList.toggle('nbg-bad', !!bad); };
    aiReadSettingsForm(); var missing = aiCheckSettings(); if (missing) { st(missing, true); return false; }
    st('Testing…');
    try { var t = await aiCall({ system: 'Reply with the single word OK.', parts: [{ text: 'Connection test from the ' + TITLE + ' assistant.' }] }); st('Connected — the model replied: ' + (t.trim().slice(0, 40) || '(empty)')); return true; }
    catch (e) { st(aiFriendlyError(e), true); return false; }
  }
  function aiStatus(m, bad) { if (!ai) return; var el = ai.querySelector('[data-ai=status]'); el.textContent = m || ''; el.classList.toggle('nbg-bad', !!bad); }
  var aiReplyText = '';
  function aiMd(t) {   // a light, safe rendering of the reply: escaped first, then fences, inline code, bold, italic, headings
    var h = esc(t);
    h = h.replace(/```[a-zA-Z]*\n([\s\S]*?)```/g, function (m, c) { return '<pre>' + c.replace(/\n$/, '') + '</pre>'; });
    h = h.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    h = h.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
    h = h.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, '$1<i>$2</i>');
    h = h.replace(/^#{1,4} (.+)$/gm, '<b class="nbg-mh">$1</b>');
    return h;
  }
  function aiSetReply(t) { aiReplyText = t || ''; if (!ai) return; var el = ai.querySelector('[data-ai=reply]'); el.innerHTML = aiMd(aiReplyText); el.hidden = !t; ai.querySelector('.nbg-arh').hidden = !t; }
  async function aiAttach(dataUrl, from) {
    try { aiClip = await aiNormaliseImage(dataUrl, 2000); }
    catch (e) { aiStatus(e.message, true); return false; }
    aiSettings.include.clip = true; aiSaveSettings();
    layoutAi();
    aiStatus('Image attached' + (from ? ' from ' + from : '') + ' — sent with the request while “Clipboard image” is ticked.');
    return true;
  }
  async function aiReadClipboard() {
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) throw new Error('unsupported');
      var items = await navigator.clipboard.read();
      for (var i = 0; i < items.length; i++) { var t = items[i].types.filter(function (x) { return /^image\//.test(x); })[0]; if (t) { var blob = await items[i].getType(t); return aiAttach(await aiBlobToDataUrl(blob), 'the clipboard'); } }
      aiStatus('The clipboard holds no image — copy a screenshot or picture first, or paste it (Ctrl/Cmd+V) into the request box.', true);
    } catch (e) { aiStatus('The clipboard could not be read (' + (e && e.message ? e.message : e) + ') — paste the image (Ctrl/Cmd+V) into the request box instead.', true); }
    return false;
  }
  function aiFilesFrom(dt) { var out = []; if (!dt) return out; var fl = dt.files || []; for (var i = 0; i < fl.length; i++) if (/^image\//.test(fl[i].type)) out.push(fl[i]); if (!out.length && dt.items) for (var j = 0; j < dt.items.length; j++) if (dt.items[j].kind === 'file' && /^image\//.test(dt.items[j].type)) { var f = dt.items[j].getAsFile(); if (f) out.push(f); } return out; }
  /* the panel */
  function aiOpt(v, label, cur) { return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(label) + '</option>'; }
  function buildAi() {
    ai = document.createElement('div');
    ai.id = 'nbg-ai'; ai.className = 'nbg-panel nbg-code nbg-ai'; ai.hidden = true;   // shown (and placed) by syncToolbars
    ai.setAttribute('role', 'dialog'); ai.setAttribute('aria-label', 'AI assistant');
    ai.innerHTML =
      '<div class="nbg-row nbg-ch"><span class="nbg-ct">Assistant</span>' +
      '<button type="button" data-tab="ask" class="nbg-on" title="Ask: a prompt, your instructions, what to attach, and how the reply is used">Ask</button>' +
      '<button type="button" data-tab="prompts" title="Prompts: the built-in ones and your own (add, edit, delete)">Prompts</button>' +
      '<button type="button" data-tab="structure" title="Structure: how a right-click on a row of the structure panel’s Outline or Tree asks the assistant">Structure</button>' +
      '<button type="button" data-tab="settings" title="Settings: provider, endpoint, model and API key — kept in this browser only">Settings</button>' +
      '<span class="nbg-cfill"></span><button type="button" data-c="detach" class="nbg-tquiet nbg-detach" title="Detach into its own window — in Chrome / Edge an always-on-top window you can move anywhere, even off the browser; close it to bring the panel back">⧉</button><button type="button" data-c="fold" class="nbg-tquiet nbg-fold" title="Collapse this panel to its header — click again to expand">▾</button><button type="button" data-c="close" class="nbg-tquiet" title="Close (Esc) — right-click → Toolbars shows it again">✕</button></div>' +
      // Ask
      '<div class="nbg-ab nbg-aask">' +
      '<div class="nbg-af"><span class="nbg-al">Prompt</span><select data-ai="prompt" title="The prompt sent with your request — built-in ones and yours (Prompts tab)"></select></div>' +
      '<div class="nbg-ahint" data-ai="phint"></div>' +
      '<textarea data-ai="req" rows="4" placeholder="Your request or extra instructions — paste an image here too (Ctrl/Cmd+V)" aria-label="Request"></textarea>' +
      '<div class="nbg-af nbg-ainc"><span class="nbg-al">Attach</span>' +
      '<label title="A screenshot of the current ' + AREA + ' (the browser asks which tab to capture — choose this one; toolbars are hidden and the picture is cropped to the ' + AREA + ')"><input type="checkbox" data-inc="shot">Screenshot of the ' + AREA + '</label>' +
      '<label title="The ' + AREA + '’s complete HTML source plus the ' + WHOLE + '’s stylesheet (embedded images replaced by placeholders)"><input type="checkbox" data-inc="slide">' + AREA_CAP + ' source</label>' +
      '<label title="The HTML source of the selected element(s)"><input type="checkbox" data-inc="sel">Selected element source</label>' +
      '<label title="An image from your clipboard: paste it (Ctrl/Cmd+V) into the request box, drop a file here, or use “Read clipboard”"><input type="checkbox" data-inc="clip">Clipboard image</label>' +
      '<span class="nbg-aclip"><span class="nbg-athumb" data-ai="thumb"></span><button type="button" data-c="paste" class="nbg-tquiet" title="Read an image from the clipboard (the browser may ask for permission)">Read clipboard</button><button type="button" data-c="clearclip" class="nbg-tquiet" title="Drop the attached image" hidden>✕</button></span></div>' +
      '<div class="nbg-af nbg-aout"><span class="nbg-al">Reply</span>' +
      '<label title="The answer appears below"><input type="radio" name="nbg-aout" value="answer" data-out>Show the answer</label>' +
      '<label title="The reply must be the replacement HTML of the selected element — it is applied like the Code tab’s Apply (same tag, scripts stripped, recorded as an edit; Undo here, Discard in the menu)"><input type="radio" name="nbg-aout" value="replace" data-out>Replace the selected element</label>' +
      '<span class="nbg-asel" data-ai="selinfo"></span></div>' +
      '<div class="nbg-af"><button type="button" data-c="send" class="nbg-tdone" title="Send (Ctrl/Cmd+Enter in the request box)">Send</button><span class="nbg-as" data-ai="status"></span></div>' +
      '<div class="nbg-ahint" data-ai="asked" hidden></div>' +
      '<div class="nbg-arh" hidden><span class="nbg-al">Answer</span><span class="nbg-cfill"></span><button type="button" data-c="copy" class="nbg-tquiet" title="Copy the answer">Copy</button><button type="button" data-c="applyreply" class="nbg-tquiet" title="Apply the answer as the replacement HTML of the selected element">Apply to selection</button><button type="button" data-c="undo" class="nbg-tquiet" title="Restore the element as it was before the last replacement" hidden>Undo</button></div>' +
      '<div class="nbg-ar" data-ai="reply" hidden></div></div>' +
      // Prompts
      '<div class="nbg-ab nbg-aprompts" hidden><div class="nbg-aplist" data-ai="plist"></div>' +
      '<div class="nbg-af"><button type="button" data-c="pnew" class="nbg-tdone">New prompt</button><span class="nbg-as" data-ai="pstatus"></span></div>' +
      '<div class="nbg-aped" hidden><span class="nbg-al">Short name</span><input type="text" data-p="name" maxlength="40" placeholder="e.g. Greek translation">' +
      '<span class="nbg-al">Prompt</span><textarea data-p="text" rows="6" placeholder="What the assistant should do. Your typed request is added as “additional instructions”."></textarea>' +
      '<span class="nbg-al">Reply</span><select data-p="mode"><option value="">Keep the current choice</option><option value="answer">Show the answer</option><option value="replace">Replace the selected element</option></select>' +
      '<div class="nbg-af"><button type="button" data-c="psave" class="nbg-tdone">Save</button><button type="button" data-c="pcancel" class="nbg-tquiet">Cancel</button></div></div></div>' +
      // Structure: what a right-click on an Outline / Tree row starts with
      '<div class="nbg-ab nbg-astructure" hidden>' +
      '<div class="nbg-ahint">Right-click a row in the structure panel’s <b>Outline</b> or <b>Tree</b> to ask the assistant about that element, or to have it changed. The popup starts with these choices; you can change them there each time.</div>' +
      '<span class="nbg-al">Prompt for “Answer me”</span><select data-st="askPrompt" title="The prompt used when the popup asks a question about the element"></select>' +
      '<span class="nbg-al">Prompt for “Replace this element”</span><select data-st="changePrompt" title="The prompt used when the popup requests a change — its reply replaces the element"></select>' +
      '<span class="nbg-al">Attach by default</span><div class="nbg-af">' +
      '<label><input type="checkbox" data-stinc="shot">Screenshot of the ' + AREA + '</label><label><input type="checkbox" data-stinc="slide">' + AREA_CAP + ' source</label>' +
      '<label><input type="checkbox" data-stinc="sel">The element’s source</label><label><input type="checkbox" data-stinc="clip">Clipboard image</label></div>' +
      '<div class="nbg-ahint">A request from the popup does not change the choices on the Ask view; its answer appears there, or replaces the element like “Replace the selected element” (Undo in the Ask view).</div></div>' +
      // Settings
      '<div class="nbg-ab nbg-asettings" hidden>' +
      '<span class="nbg-al">Provider</span><select data-set="provider"><option value="">Choose…</option>' + AI_PROVIDER_ORDER.map(function (k) { return aiOpt(k, AI_PROVIDERS[k].name, ''); }).join('') + '</select>' +
      '<span class="nbg-al">Endpoint URL</span><input type="url" data-set="url" spellcheck="false"><div class="nbg-ahint" data-ai="urlhint"></div>' +
      '<span class="nbg-al">Model / deployment</span><input type="text" data-set="model" spellcheck="false"><div class="nbg-ahint" data-ai="modelhint"></div>' +
      '<div data-ai="azv" hidden><span class="nbg-al">API version (Azure OpenAI — only for the classic deployments route)</span><input type="text" data-set="apiVersion" spellcheck="false" placeholder="empty = the /openai/v1 route"></div>' +
      '<span class="nbg-al">API key</span><div class="nbg-af"><input type="password" data-set="key" spellcheck="false" autocomplete="off"><button type="button" data-c="showkey" class="nbg-tquiet">Show</button></div>' +
      '<span class="nbg-al">Remember the key</span><select data-set="keyScope"><option value="browser">In this browser (until you change it)</option><option value="tab">For this tab only</option></select>' +
      '<div class="nbg-af"><button type="button" data-c="std" class="nbg-tquiet" title="Fill in the provider’s standard endpoint and model where there is one">Standard values</button><button type="button" data-c="ssave" class="nbg-tdone">Save</button><button type="button" data-c="test" class="nbg-tquiet" title="Send a one-line test request">Test</button><span class="nbg-as" data-ai="sstatus"></span></div>' +
      '<div class="nbg-ahint">The key stays in this browser’s storage and is never written into the ' + WHOLE + ' file; the ' + WHOLE + ' talks to the endpoint directly from this page. Providers that do not allow calls from a browser need a gateway that does.</div></div>';
    ai.querySelector('[data-ai=req]').value = aiSettings.request || '';
    var aiTypeTimer = 0;
    ai.addEventListener('input', function (e) {   // typing is remembered without Save: the request box and the settings fields
      var t = e.target;
      if (t.getAttribute('data-ai') !== 'req' && !t.hasAttribute('data-set') && !t.hasAttribute('data-p')) return;
      clearTimeout(aiTypeTimer);
      aiTypeTimer = setTimeout(function () { if (t.getAttribute('data-ai') === 'req') { aiSettings.request = t.value; aiSaveSettings(); } else if (t.hasAttribute('data-set')) aiReadSettingsForm(); }, 300);
    });
    ai.addEventListener('click', function (e) {
      e.stopPropagation();
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-tab')) { setAiView(b.getAttribute('data-tab')); return; }
      var c = b.getAttribute('data-c'); if (!c) return;
      if (c === 'close') closeAi();
      else if (c === 'detach') detachPanel('ai');
      else if (c === 'fold') setFold('ai', !ui.fold.ai);
      else if (c === 'send') aiSend();
      else if (c === 'paste') aiReadClipboard();
      else if (c === 'clearclip') { aiClip = null; layoutAi(); aiStatus('Image dropped.'); }
      else if (c === 'copy') { var t = aiReplyText; try { navigator.clipboard.writeText(t); aiStatus('Copied.'); } catch (x) { aiStatus('Select the answer and copy it.', true); } }
      else if (c === 'applyreply') { var tg = aiTargets(); if (tg.length !== 1) { aiStatus('Select exactly one element first.', true); return; } var r = aiApplyReply(tg[0], aiReplyText); aiStatus(r.error ? 'Not applied: ' + r.error : 'Applied to ' + describe(tg[0]) + ' — ' + changesLabel() + '.', !!r.error); }
      else if (c === 'undo') { aiStatus(aiUndo() ? 'Restored.' : 'Nothing to undo.'); }
      else if (c === 'pnew') aiEditPrompt(null);
      else if (c === 'psave') aiSavePromptForm();
      else if (c === 'pcancel') { aiEditing = null; renderAiPrompts(); }
      else if (b.hasAttribute('data-pa')) { var pid = b.getAttribute('data-pid'), pa = b.getAttribute('data-pa'), pr = aiPromptById(pid); if (!pr) return; if (pa === 'use') { aiSelectPrompt(pid); setAiView('ask'); } else if (pa === 'edit') aiEditPrompt(pr); else if (pa === 'copy') aiEditPrompt({ id: '', name: pr.name, text: pr.text, mode: pr.mode }); else if (pa === 'del') { aiPrompts = aiPrompts.filter(function (x) { return x.id !== pid; }); aiSavePrompts(); if (aiSettings.promptId === pid) aiSelectPrompt('b:free'); renderAiPrompts(); } }
      else if (c === 'showkey') { var k = ai.querySelector('[data-set=key]'); k.type = k.type === 'password' ? 'text' : 'password'; b.textContent = k.type === 'password' ? 'Show' : 'Hide'; }
      else if (c === 'std') { var pv = ai.querySelector('[data-set=provider]').value, pp = AI_PROVIDERS[pv]; if (!pp) { aiSStatus('Choose a provider first.', true); return; } if (pp.url) ai.querySelector('[data-set=url]').value = pp.url; if (pp.model) ai.querySelector('[data-set=model]').value = pp.model; aiSStatus(pp.url ? 'Standard endpoint' + (pp.model ? ' and model' : '') + ' filled in — Save to keep them.' : 'No standard endpoint for ' + pp.name + ' — enter your resource URL (' + pp.urlHint + ').', !pp.url); }
      else if (c === 'ssave') { aiReadSettingsForm(); var miss = aiCheckSettings(); aiSStatus(miss ? 'Saved — but ' + miss.charAt(0).toLowerCase() + miss.slice(1) : 'Saved — every field is also remembered as you type.', !!miss); layoutAi(); }
      else if (c === 'test') aiTest();
    });
    ai.addEventListener('change', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-inc')) { aiSettings.include[t.getAttribute('data-inc')] = t.checked; aiSaveSettings(); }
      else if (t.hasAttribute('data-out')) { aiSettings.output = t.value; aiSaveSettings(); layoutAi(); }
      else if (t.getAttribute('data-ai') === 'prompt') aiSelectPrompt(t.value);
      else if (t.hasAttribute('data-st')) { if (aiPromptById(t.value)) aiSettings.structure[t.getAttribute('data-st')] = t.value; aiSaveSettings(); }
      else if (t.hasAttribute('data-stinc')) { aiSettings.structure.include[t.getAttribute('data-stinc')] = t.checked; aiSaveSettings(); }
      else if (t.getAttribute('data-set') === 'provider') { var np = t.value, had = !!(aiSettings.profiles[np] && aiSettings.profiles[np].url); aiSwitchProvider(np); aiSaveSettings(); aiFillSettingsForm(); aiSStatus(AI_PROVIDERS[np] ? (had ? 'Your earlier settings for ' + AI_PROVIDERS[np].name + ' are back.' : 'New provider — enter its endpoint, model and key (they are remembered per provider).') : ''); }
      else if (t.hasAttribute('data-set')) aiReadSettingsForm();
    });
    ai.addEventListener('paste', function (e) {
      var files = aiFilesFrom(e.clipboardData);
      if (!files.length) return;
      e.preventDefault(); e.stopPropagation();
      aiBlobToDataUrl(files[0]).then(function (u) { aiAttach(u, 'the clipboard'); }, function (x) { aiStatus(x.message, true); });
    });
    ai.addEventListener('dragover', function (e) { if (aiFilesFrom(e.dataTransfer).length || (e.dataTransfer && Array.prototype.some.call(e.dataTransfer.types || [], function (t) { return t === 'Files'; }))) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    ai.addEventListener('drop', function (e) { var files = aiFilesFrom(e.dataTransfer); if (!files.length) return; e.preventDefault(); e.stopPropagation(); aiBlobToDataUrl(files[0]).then(function (u) { aiAttach(u, 'the dropped file'); }, function (x) { aiStatus(x.message, true); }); });
    ai.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    ai.addEventListener('contextmenu', function (e) { if (!e.target.closest('textarea, input')) { e.preventDefault(); e.stopPropagation(); } });
    ai.addEventListener('keydown', function (e) {
      e.stopPropagation();
      var mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'Enter' && e.target.getAttribute('data-ai') === 'req') { e.preventDefault(); aiSend(); return; }
      if (e.key === 'Escape') { e.preventDefault(); if (aiEditing) { aiEditing = null; renderAiPrompts(); } else closeAi(); }
    });
    document.body.appendChild(ai);
    applyFold('ai');
    aiApplySize();
    if (window.ResizeObserver) new ResizeObserver(function () {   // the corner resize sets inline width / height: remember them
      if (!ai || ai.hidden || !(ai.style.width || ai.style.height)) return;
      var s = aiSizeOf({ w: ai.offsetWidth, h: ai.offsetHeight });
      if (s && !(aiSettings.size && aiSettings.size.w === s.w && aiSettings.size.h === s.h)) { aiSettings.size = s; aiSaveSettings(); }
    }).observe(ai);
    renderAiPromptSelect(); renderAiPrompts(); aiFillSettingsForm();
  }
  function aiApplySize() {
    if (!ai || !aiSettings.size || ai.classList.contains('nbg-embedded')) return;   // embedded: the menu's size applies
    ai.style.width = Math.min(aiSettings.size.w, window.innerWidth - 16) + 'px'; ai.style.height = Math.min(aiSettings.size.h, window.innerHeight - 16) + 'px';
  }
  function aiSStatus(m, bad) { var el = ai.querySelector('[data-ai=sstatus]'); el.textContent = m || ''; el.classList.toggle('nbg-bad', !!bad); }
  function setAiView(v) {
    aiView = v; if (aiSettings.view !== v) { aiSettings.view = v; aiSaveSettings(); }
    Array.prototype.forEach.call(ai.querySelectorAll('[data-tab]'), function (b) { b.classList.toggle('nbg-on', b.getAttribute('data-tab') === v); });
    ai.querySelector('.nbg-aask').hidden = v !== 'ask'; ai.querySelector('.nbg-aprompts').hidden = v !== 'prompts'; ai.querySelector('.nbg-astructure').hidden = v !== 'structure'; ai.querySelector('.nbg-asettings').hidden = v !== 'settings';
    if (v === 'prompts') renderAiPrompts(); else if (v === 'settings') aiFillSettingsForm(); else if (v === 'structure') renderAiStructure();
    else { var req = ai.querySelector('[data-ai=req]'); if (ai.ownerDocument.activeElement !== req) req.focus({ preventScroll: true }); }
  }
  function aiPromptOptions(cur) { return '<optgroup label="Built-in">' + AI_BUILTIN.map(function (p) { return aiOpt(p.id, p.name, cur); }).join('') + '</optgroup>' + (aiPrompts.length ? '<optgroup label="Mine">' + aiPrompts.map(function (p) { return aiOpt(p.id, p.name, cur); }).join('') + '</optgroup>' : ''); }
  function renderAiStructure() {
    var s = aiSettings.structure;
    ai.querySelector('[data-st=askPrompt]').innerHTML = aiPromptOptions(aiPromptById(s.askPrompt) ? s.askPrompt : 'b:free');
    ai.querySelector('[data-st=changePrompt]').innerHTML = aiPromptOptions(aiPromptById(s.changePrompt) ? s.changePrompt : 'b:restyle');
    ['shot', 'slide', 'sel', 'clip'].forEach(function (k) { ai.querySelector('[data-stinc=' + k + ']').checked = !!s.include[k]; });
  }
  /* the popup behind a right-click on an Outline / Tree row: the request, answer or replace, the prompt, the attachments */
  var aiPop = null, aiPopEl = null;
  function inAiPop(t) { return !!(aiPop && t && aiPop.contains(t)); }
  function buildAiPop() {
    aiPop = document.createElement('div');
    aiPop.id = 'nbg-ai-pop'; aiPop.className = 'nbg-panel nbg-code nbg-ai nbg-aipop'; aiPop.hidden = true;
    aiPop.setAttribute('role', 'dialog'); aiPop.setAttribute('aria-label', 'Ask the assistant about this element');
    aiPop.innerHTML =
      '<div class="nbg-row nbg-ch"><span class="nbg-ct" data-pop="title">Ask the assistant</span><span class="nbg-cfill"></span><button type="button" data-pop="cancel" class="nbg-tquiet" title="Close (Esc)">✕</button></div>' +
      '<div class="nbg-ab"><div class="nbg-ahint" data-pop="desc"></div>' +
      '<textarea data-pop="req" rows="3" placeholder="What do you want to know about it — or what should change? (Ctrl/Cmd+Enter sends)" aria-label="Request"></textarea>' +
      '<div class="nbg-af"><span class="nbg-al">Reply</span><label><input type="radio" name="nbg-pop-out" value="answer" data-pop="out">Answer me</label><label><input type="radio" name="nbg-pop-out" value="replace" data-pop="out">Replace this element</label></div>' +
      '<div class="nbg-af"><span class="nbg-al">Prompt</span><select data-pop="prompt"></select></div>' +
      '<div class="nbg-af"><span class="nbg-al">Attach</span><label><input type="checkbox" data-popinc="shot">Screenshot</label><label><input type="checkbox" data-popinc="slide">' + AREA_CAP + ' source</label><label><input type="checkbox" data-popinc="sel">This element’s source</label><label><input type="checkbox" data-popinc="clip">Clipboard image</label></div>' +
      '<div class="nbg-af"><button type="button" data-pop="send" class="nbg-tdone">Send</button><button type="button" data-pop="cancel" class="nbg-tquiet">Cancel</button><span class="nbg-as" data-pop="status"></span></div>' +
      '<div class="nbg-arh" data-pop="rh" hidden><span class="nbg-al">Answer</span><span class="nbg-cfill"></span><button type="button" data-pop="copy" class="nbg-tquiet" title="Copy the answer">Copy</button><button type="button" data-pop="undo" class="nbg-tquiet" title="Restore the element as it was before the replacement" hidden>Undo</button><button type="button" data-pop="open" class="nbg-tquiet" title="Open the assistant panel with this request and answer">Open in the assistant panel</button></div>' +
      '<div class="nbg-ar" data-pop="reply" hidden></div></div>';
    aiPop.addEventListener('click', function (e) {
      e.stopPropagation();
      var b = e.target.closest('button'); if (!b) return;
      var c = b.getAttribute('data-pop');
      if (c === 'cancel') closeAiPop(); else if (c === 'send') aiPopSend();
      else if (c === 'copy') { try { navigator.clipboard.writeText(aiReplyText); aiPopStatus('Answer copied.'); } catch (x) { aiPopStatus('Copy failed — select the text and copy it.', true); } }
      else if (c === 'undo') { if (aiUndo()) { aiPop.querySelector('[data-pop=undo]').hidden = true; aiPopStatus('Restored — the element is as it was before the replacement.'); } }
      else if (c === 'open') openAi('ask');
    });
    makeMovable(aiPop, function () {}, '.nbg-ch');   // stays where the viewer drags it; the header is the drag surface
    aiPop.addEventListener('change', function (e) {
      var t = e.target;
      if (t.getAttribute('data-pop') === 'out') { var s = aiSettings.structure, want = t.value === 'replace' ? s.changePrompt : s.askPrompt; aiPop.querySelector('[data-pop=prompt]').value = aiPromptById(want) ? want : (t.value === 'replace' ? 'b:restyle' : 'b:free'); }
    });
    aiPop.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    aiPop.addEventListener('contextmenu', function (e) { if (!e.target.closest('textarea')) { e.preventDefault(); e.stopPropagation(); } });
    aiPop.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); closeAiPop(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); aiPopSend(); }
    });
    document.body.appendChild(aiPop);
  }
  function aiPopWindow() { return aiPop ? aiPop.ownerDocument.defaultView : window; }
  function openAiPop(x, y, el) {
    if (!el || !el.isConnected) return false;
    if (!aiPop) buildAiPop();
    // the popup lives where the structure panel is: in its detached window when there is one (the
    // viewer is looking there), else in the deck's document
    var host = code && detachedPanel(code) ? code.ownerDocument : document;
    if (aiPop.ownerDocument !== host) {
      if (host !== document && !host.getElementById('nbg-deck-menu-style')) host.head.appendChild(host.importNode(style, true));
      host.body.appendChild(aiPop);
    }
    var win = host.defaultView;
    aiPopEl = el;
    var s = aiSettings.structure;
    aiPop.querySelector('[data-pop=title]').textContent = isRoot(el) ? 'Ask about ' + unitPhrase(el) : 'Ask about ' + describe(el);
    var t = hasOwnText(el) ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    aiPop.querySelector('[data-pop=desc]').textContent = (t ? '“' + (t.length > 90 ? t.slice(0, 87) + '…' : t) + '” — ' : '') + 'the reply appears here, or replaces this element.';
    aiPop.querySelector('[data-pop=req]').value = '';
    Array.prototype.forEach.call(aiPop.querySelectorAll('[data-pop=out]'), function (r) { r.checked = r.value === 'answer'; });
    aiPop.querySelector('[data-pop=prompt]').innerHTML = aiPromptOptions(aiPromptById(s.askPrompt) ? s.askPrompt : 'b:free');
    ['shot', 'slide', 'sel', 'clip'].forEach(function (k) { aiPop.querySelector('[data-popinc=' + k + ']').checked = !!s.include[k]; });
    aiPopStatus(''); aiPopReply('');
    aiPop.querySelector('[data-pop=undo]').hidden = true;
    aiPop.hidden = false;
    aiPop.style.left = '0px'; aiPop.style.top = '0px';
    var r = aiPop.getBoundingClientRect();
    aiPop.style.left = Math.max(8, Math.min(x, win.innerWidth - r.width - 8)) + 'px';
    aiPop.style.top = Math.max(8, Math.min(y, win.innerHeight - r.height - 8)) + 'px';
    delete panelPos[aiPop.id];   // a new popup opens at the pointer, wherever the previous one was dragged
    hoverEl(el);
    aiPop.querySelector('[data-pop=req]').focus({ preventScroll: true });
    return true;
  }
  function closeAiPop() { if (!aiPop || aiPop.hidden) return false; aiPop.hidden = true; aiPopEl = null; hoverEl(null); return true; }
  function aiPopStatus(m, bad) { if (!aiPop) return; var el = aiPop.querySelector('[data-pop=status]'); el.textContent = m || ''; el.classList.toggle('nbg-bad', !!bad); }
  function aiPopReply(t, undoable) {   // the answer inside the popup (the assistant panel gets it too, for later)
    if (!aiPop) return;
    var el = aiPop.querySelector('[data-pop=reply]'); el.innerHTML = aiMd(t || ''); el.hidden = !t;
    aiPop.querySelector('[data-pop=rh]').hidden = !t;
    aiPop.querySelector('[data-pop=undo]').hidden = !undoable;
    if (t && !aiPop.hidden) {   // keep the popup inside its window now that it is taller
      var r = aiPop.getBoundingClientRect(), win = aiPopWindow();
      if (r.bottom > win.innerHeight - 8) aiPop.style.top = Math.max(8, win.innerHeight - r.height - 8) + 'px';
    }
  }
  function aiPopBusy(on) { if (!aiPop) return; aiPop.classList.toggle('nbg-abusy', !!on); aiPop.querySelector('[data-pop=send]').disabled = !!on; }
  function aiPopSend() {
    var el = aiPopEl; if (!el || !el.isConnected) { aiPopStatus('This element is no longer on the ' + AREA + '.', true); return false; }
    var req = aiPop.querySelector('[data-pop=req]').value.trim(), mode = aiPop.querySelector('[data-pop=out]:checked').value, promptId = aiPop.querySelector('[data-pop=prompt]').value, p = aiPromptById(promptId);
    var inc = {}; ['shot', 'slide', 'sel', 'clip'].forEach(function (k) { inc[k] = aiPop.querySelector('[data-popinc=' + k + ']').checked; });
    var st = aiPop.querySelector('[data-pop=status]');
    if (!req && !(p && p.text)) { st.textContent = 'Type a request, or choose a prompt with text.'; st.classList.add('nbg-bad'); return false; }
    if (aiBusy) { aiPopStatus('The assistant is still answering the previous request.', true); return false; }
    // the popup stays open and shows the status and the reply itself; the assistant panel is built (it
    // keeps the request and the answer for "Open in the assistant panel") but never shown on its own
    if (!ai) buildAi();
    if (!isRoot(el)) selectSolo(el, true);
    aiPopReply('');
    return aiSend({ target: el, promptId: promptId, output: mode, include: inc, request: req, pop: true });
  }
  function renderAiPromptSelect() {
    var s = ai.querySelector('[data-ai=prompt]'), cur = aiCurrentPrompt().id;
    s.innerHTML = aiPromptOptions(cur);
    var p = aiCurrentPrompt(), hint = ai.querySelector('[data-ai=phint]');
    hint.textContent = p.text ? (p.text.length > 160 ? p.text.slice(0, 157) + '…' : p.text) : 'No preset text — only what you type is sent (with the attachments).';
  }
  function aiSelectPrompt(id) {
    var p = aiPromptById(id); if (!p) return false;
    aiSettings.promptId = id;
    if (p.mode) aiSettings.output = p.mode;
    aiSaveSettings();
    if (ai) { renderAiPromptSelect(); layoutAi(); }
    return true;
  }
  function renderAiPrompts() {
    var list = ai.querySelector('[data-ai=plist]'), ed = ai.querySelector('.nbg-aped');
    list.innerHTML = aiAllPrompts().map(function (p) {
      var mine = /^u:/.test(p.id);
      return '<div class="nbg-ap' + (p.id === aiSettings.promptId ? ' nbg-on' : '') + '"><span class="nbg-apn" title="' + esc(p.text || 'No preset text') + '">' + esc(p.name) + '</span>' +
        (p.mode ? '<span class="nbg-og">' + (p.mode === 'replace' ? 'replaces' : 'answers') + '</span>' : '') + (mine ? '' : '<span class="nbg-og nbg-ob">built-in</span>') + '<span class="nbg-cfill"></span>' +
        '<button type="button" data-pa="use" data-pid="' + esc(p.id) + '" class="nbg-tquiet" title="Use this prompt">Use</button>' +
        (mine ? '<button type="button" data-pa="edit" data-pid="' + esc(p.id) + '" class="nbg-tquiet">Edit</button><button type="button" data-pa="del" data-pid="' + esc(p.id) + '" class="nbg-tquiet" title="Delete this prompt">Delete</button>' : '<button type="button" data-pa="copy" data-pid="' + esc(p.id) + '" class="nbg-tquiet" title="Make an editable copy of this prompt">Copy to mine</button>') + '</div>';
    }).join('');
    ed.hidden = !aiEditing;
    if (aiEditing) { ed.querySelector('[data-p=name]').value = aiEditing.name || ''; ed.querySelector('[data-p=text]').value = aiEditing.text || ''; ed.querySelector('[data-p=mode]').value = aiEditing.mode || ''; }
    ai.querySelector('[data-ai=pstatus]').textContent = aiEditing ? (aiEditing.id ? 'Editing “' + aiEditing.name + '”' : 'New prompt') : aiPrompts.length + ' of yours, ' + AI_BUILTIN.length + ' built-in.';
  }
  function aiEditPrompt(p) { aiEditing = p ? { id: p.id, name: p.name, text: p.text, mode: p.mode || '' } : { id: '', name: '', text: '', mode: '' }; renderAiPrompts(); ai.querySelector('[data-p=name]').focus(); }
  function aiSavePromptForm() {
    var ed = ai.querySelector('.nbg-aped'), name = ed.querySelector('[data-p=name]').value.trim(), text = ed.querySelector('[data-p=text]').value.trim(), mode = ed.querySelector('[data-p=mode]').value;
    var st = ai.querySelector('[data-ai=pstatus]');
    if (!name) { st.textContent = 'Give the prompt a short name.'; st.classList.add('nbg-bad'); return false; }
    if (!text) { st.textContent = 'The prompt text is empty.'; st.classList.add('nbg-bad'); return false; }
    st.classList.remove('nbg-bad');
    var r = aiUpsertPrompt({ id: aiEditing && aiEditing.id, name: name, text: text, mode: mode });
    aiEditing = null; renderAiPrompts(); renderAiPromptSelect(); aiSelectPrompt(r.id);
    return true;
  }
  function aiUpsertPrompt(p) {   // (the Structure view re-renders its selects when shown)
    var id = p.id && /^u:/.test(p.id) ? p.id : 'u:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    var rec = { id: id, name: String(p.name || '').trim().slice(0, 40) || 'Prompt', text: String(p.text || ''), mode: /^(answer|replace)$/.test(p.mode) ? p.mode : '' };
    var i = -1; aiPrompts.forEach(function (x, k) { if (x.id === id) i = k; });
    if (i >= 0) aiPrompts[i] = rec; else aiPrompts.push(rec);
    aiSavePrompts();
    if (ai) { renderAiPromptSelect(); renderAiPrompts(); }
    return rec;
  }
  function aiRemovePrompt(id) { var n = aiPrompts.length; aiPrompts = aiPrompts.filter(function (x) { return x.id !== id; }); if (aiPrompts.length === n) return false; aiSavePrompts(); if (aiSettings.promptId === id) aiSelectPrompt('b:free'); if (ai) { renderAiPromptSelect(); renderAiPrompts(); } return true; }
  function aiFillSettingsForm() {
    ai.querySelector('[data-set=provider]').value = aiSettings.provider;
    ai.querySelector('[data-set=url]').value = aiSettings.url; ai.querySelector('[data-set=model]').value = aiSettings.model; ai.querySelector('[data-set=apiVersion]').value = aiSettings.apiVersion;
    ai.querySelector('[data-set=key]').value = aiKey(); ai.querySelector('[data-set=keyScope]').value = aiSettings.keyScope;
    aiSettingsHints();
  }
  function aiSettingsHints() {
    var pv = ai.querySelector('[data-set=provider]').value, p = AI_PROVIDERS[pv];
    ai.querySelector('[data-ai=urlhint]').textContent = p ? p.urlHint : ''; ai.querySelector('[data-ai=modelhint]').textContent = p ? p.modelHint : '';
    ai.querySelector('[data-set=url]').placeholder = p && p.url ? p.url : ''; ai.querySelector('[data-set=model]').placeholder = p && p.model ? p.model : '';
    ai.querySelector('[data-ai=azv]').hidden = !(p && p.azure);
  }
  function aiReadSettingsForm() {
    var pv = ai.querySelector('[data-set=provider]').value; if (pv !== aiSettings.provider) aiSwitchProvider(pv);
    aiSettings.url = ai.querySelector('[data-set=url]').value.trim(); aiSettings.model = ai.querySelector('[data-set=model]').value.trim();
    aiSettings.apiVersion = ai.querySelector('[data-set=apiVersion]').value.trim(); aiSettings.keyScope = ai.querySelector('[data-set=keyScope]').value === 'tab' ? 'tab' : 'browser';
    aiSaveSettings(ai.querySelector('[data-set=key]').value.trim());
  }
  function aiConfigure(o) {   // API: merge settings (key included) and save
    if (!o || typeof o !== 'object') return aiSettingsSnapshot();
    aiMergeSettings(o);
    aiSaveSettings(typeof o.key === 'string' ? o.key : undefined);
    if (ai) { aiFillSettingsForm(); renderAiPromptSelect(); if (typeof o.request === 'string') ai.querySelector('[data-ai=req]').value = o.request; if (o.size) aiApplySize(); if ('pos' in o) { if (aiSettings.pos) panelPos[ai.id] = { left: aiSettings.pos.left, top: aiSettings.pos.top }; else delete panelPos[ai.id]; if (!ai.hidden) placeAi(); } layoutAi(); }
    return aiSettingsSnapshot();
  }
  function aiSettingsSnapshot() { var s = JSON.parse(JSON.stringify(aiSettings)); s.hasKey = !!aiKey(); return s; }
  function layoutAi() {
    if (!ai || ai.hidden) return;
    var targets = aiTargets(), inc = aiSettings.include;
    ['shot', 'slide', 'sel', 'clip'].forEach(function (k) { ai.querySelector('[data-inc=' + k + ']').checked = !!inc[k]; });
    Array.prototype.forEach.call(ai.querySelectorAll('[data-out]'), function (r) { r.checked = r.value === aiSettings.output; });
    var info = ai.querySelector('[data-ai=selinfo]');
    info.textContent = targets.length === 1 ? 'Selected: ' + describe(targets[0]) : targets.length > 1 ? targets.length + ' elements selected — replace needs one' : 'Nothing selected — select an element to send its source or replace it';
    var thumb = ai.querySelector('[data-ai=thumb]'); thumb.innerHTML = aiClip ? '<img alt="attached image" src="' + aiClip + '">' : ''; ai.querySelector('[data-c=clearclip]').hidden = !aiClip;
    ai.querySelector('[data-c=applyreply]').hidden = targets.length !== 1 || !aiReplyText;
    ai.querySelector('[data-c=undo]').hidden = !(aiLastReplace && aiLastReplace.el.isConnected);
    ai.querySelector('[data-c=send]').disabled = aiBusy;
  }
  function placeAi() {
    if (detachedPanel(ai)) return;
    var pos = panelPos[ai.id];
    if (pos) { ai.style.left = Math.max(0, Math.min(pos.left, window.innerWidth - ai.offsetWidth)) + 'px'; ai.style.top = Math.max(0, Math.min(pos.top, window.innerHeight - ai.offsetHeight)) + 'px'; return; }
    var left = window.innerWidth - ai.offsetWidth - 8;
    if (code && !code.hidden) { var cr = code.getBoundingClientRect(); if (cr.left - ai.offsetWidth - 8 >= 8) left = cr.left - ai.offsetWidth - 8; else left = 8; }   // beside the structure panel, not under it
    ai.style.left = Math.max(8, left) + 'px'; ai.style.top = '8px';
  }
  // the assistant is the menu's Assistant tab
  function openAi(view) {
    ensureMenu();
    openMenuTab('ai');
    setAiView(view || aiSettings.view || 'ask');
    return true;
  }
  function openAiPanel() { ai.hidden = false; layoutAi(); }
  function closeAiPanel() { ai.hidden = true; }
  function closeAi() { if (!aiIsOpen()) return false; closeMenu(true); return true; }
  function aiIsOpen() { return !!(menu && !menu.hidden && menuTab === 'ai' && ai && !ai.hidden); }

  /* ---------- detachable panels ---------- */
  var detached = { tools: null, menu: null };   // k -> the Window holding the panel ('text' / 'shape' map to 'tools', 'code' / 'ai' to 'menu')
  function detachedPanel(panel) { return !!(panel && panel.ownerDocument !== document); }
  function isDetached(k) { if (k === 'code' || k === 'ai') k = 'menu'; if (k === 'text' || k === 'shape') k = 'tools'; var w = detached[k]; return !!(w && !w.closed); }
  var DETACHED_CSS = 'html,body{margin:0;height:100%;background:#fff;overflow:hidden;font:13px ' + FONT + '}' +
    '.nbg-panel.nbg-detached{position:static!important;left:auto!important;top:auto!important;width:auto!important;max-width:none!important;height:100vh!important;min-height:0!important;min-width:0!important;box-shadow:none;border:0;border-radius:0;resize:none;box-sizing:border-box;overflow:auto}' +
    '.nbg-panel.nbg-detached .nbg-grip,.nbg-panel.nbg-detached .nbg-detach,.nbg-panel.nbg-detached .nbg-fold{display:none}' +
    '#nbg-deck-menu.nbg-detached{position:static!important;left:auto!important;top:auto!important;width:100%!important;min-width:0!important;max-width:none!important;height:100vh!important;max-height:none!important;box-shadow:none;border:0;border-radius:0;resize:none;box-sizing:border-box;display:flex;flex-direction:column}' +
    '#nbg-deck-menu.nbg-detached .nbg-mdetach,#nbg-deck-menu.nbg-detached .nbg-pin{display:none}#nbg-deck-menu.nbg-detached .nbg-mbody{flex:1;min-height:0;overflow-y:auto}' +
    '#nbg-tools.nbg-detached{height:auto!important;align-items:flex-start}#nbg-tools.nbg-detached .nbg-row{flex-wrap:wrap}#nbg-tools.nbg-detached .nbg-tbside{display:none}' +
    '.nbg-panel.nbg-detached .nbg-dragsurface{cursor:default}';
  // move the panel into its own window: a Document Picture-in-Picture window (Chrome / Edge), else a pop-up; `target` = a window to use instead (tests)
  async function detachPanel(k, target) {
    if (k === 'code' || k === 'ai') k = 'menu';   // the structure panel and the assistant travel with the menu
    if (k === 'text' || k === 'shape') k = 'tools';   // both rows travel as the one toolbar
    if (k !== 'tools' && k !== 'menu') return false;
    if (isDetached(k)) { try { detached[k].focus(); } catch (e) { /* ignore */ } return true; }
    if (k === 'tools') { ensureTbar(); if (!tools) buildTools(); if (!stools) buildShapeTools(); } else ensureMenu();
    var panel = toolbarPanel(k), w = target || null;
    var size = k === 'tools' ? { width: 800, height: 240 } : { width: Math.max(420, panel.offsetWidth || 480), height: Math.max(520, panel.offsetHeight || 720) };
    if (!w) {
      if (window.documentPictureInPicture && window.documentPictureInPicture.requestWindow) { try { w = await window.documentPictureInPicture.requestWindow(size); } catch (e) { w = null; } }
      if (!w) { try { w = window.open('', 'nbg-deck-' + k, 'popup=yes,width=' + size.width + ',height=' + size.height); } catch (e) { w = null; } }
      if (!w) { toast('The browser did not open a window — allow pop-ups for this file, or keep the ' + TOOLBAR_NAMES[k] + ' toolbar here.', 4500); return false; }
    }
    var d = w.document;
    if (!d.body) { d.open(); d.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>'); d.close(); d = w.document; }
    d.title = TITLE + ' — ' + TOOLBAR_NAMES[k];
    if (!d.getElementById('nbg-deck-menu-style')) d.head.appendChild(d.importNode(style, true));
    if (!d.getElementById('nbg-detached-style')) { var x = d.createElement('style'); x.id = 'nbg-detached-style'; x.textContent = DETACHED_CSS; d.head.appendChild(x); }
    panel.style.left = ''; panel.style.top = ''; panel.style.width = ''; panel.style.height = '';
    panel.classList.add('nbg-detached');
    d.body.appendChild(panel);   // adopted into the other document; its listeners travel with it
    detached[k] = w;
    if (k === 'menu') { menu.hidden = false; renderMenu(); if (menuTab !== 'menu') showTab(menuTab); }
    else tbar.hidden = false;   // both rows show in the window (idle when nothing applies); the modes are untouched
    w.addEventListener('pagehide', function () { if (detached[k] === w) reattachPanel(k); });
    w.addEventListener('resize', function () { if (k === 'tools') { layoutTools(); layoutShapeTools(); } else if (k === 'menu') applySplit(); });
    syncToolbars();
    toast(TOOLBAR_NAMES[k] + ' detached into its own window — close that window (or ✕ / Esc in the panel) to bring it back.', 3500);
    return true;
  }
  function reattachPanel(k) {
    if (k === 'code' || k === 'ai') k = 'menu';
    if (k === 'text' || k === 'shape') k = 'tools';
    var panel = toolbarPanel(k), w = detached[k];
    detached[k] = null;
    if (!panel) return false;
    if (panel.ownerDocument !== document) document.body.appendChild(panel);
    if (k === 'menu' && aiPop && aiPop.ownerDocument !== document) { aiPop.hidden = true; aiPopEl = null; document.body.appendChild(aiPop); }   // the row popup came along
    panel.classList.remove('nbg-detached');
    if (w && !w.closed) { try { w.close(); } catch (e) { /* ignore */ } }
    if (k === 'menu' && !menu.hidden) { placeMenuDocked(); refreshMenu(); if (menuTab !== 'menu') applySplit(); }
    syncToolbars();
    return true;
  }
  window.addEventListener('pagehide', function () { ['tools', 'menu'].forEach(function (k) { var w = detached[k]; if (w && !w.closed) { try { w.close(); } catch (e) { /* ignore */ } } }); });

  /* ---------- discard / save ---------- */
  function discardEdits() {
    if (editing) cancelEdit();
    if (svgEd) svgEnd();
    deselectShape();
    for (var i = edits.length - 1; i >= 0; i--) { var el = elAt(document, edits[i].path); if (el) apply(el, edits[i].kind, edits[i].original); }
    edits = []; store();
    toast('All edits discarded.', 2500);
  }
  // per-slide discard: the records whose element lives inside that slide
  function slideIndex(slide) { return allRoots().indexOf(slide); }
  function editsIn(slide) { return edits.filter(function (ed) { var el = elAt(document, ed.path); return !!el && slide.contains(el); }); }
  function slideAtPoint(x, y) {   // the slide under a point, else the one at the viewport centre, else the first visible one
    var hit = null;
    document.elementsFromPoint(x, y).forEach(function (n) { if (!hit && !n.closest(OURS)) hit = rootOf(n); });
    if (!hit) { var c = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2); hit = c ? rootOf(c) : null; }
    return hit || allRoots().filter(function (sl) { return sl.offsetWidth > 0; })[0] || null;
  }
  function discardSlideEdits(slide) {
    if (!slide) return 0;
    if (editing && slide.contains(editing.el)) cancelEdit();
    if (svgEd && slide.contains(svgEd.svg)) svgEnd();
    if (shape && slide.contains(shape.el)) deselectShape();
    var mine = editsIn(slide);
    for (var i = mine.length - 1; i >= 0; i--) { var el = elAt(document, mine[i].path); if (el) apply(el, mine[i].kind, mine[i].original); }
    edits = edits.filter(function (ed) { return mine.indexOf(ed) < 0; }); store();
    toast(mine.length ? unitLabel(slide) + ': ' + mine.length + ' change' + (mine.length === 1 ? '' : 's') + ' discarded' + (edits.length ? ' — ' + changesLabel() + ' left on other ' + UNIT.toLowerCase() + 's.' : '.') : 'No changes on ' + unitPhrase(slide) + '.', 3000);
    return mine.length;
  }
  /* the deck's own navigation: a selection that left the screen is dropped and the toolbars adapt */
  var deckRaf = 0, lastSlide = null;
  function slideOffscreen(el) {
    var sl = el && slideOf(el); if (!sl) return false;
    var cs = getComputedStyle(sl), r = sl.getBoundingClientRect();
    return !sl.offsetWidth || cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0 || r.right <= 0 || r.bottom <= 0 || r.left >= window.innerWidth || r.top >= window.innerHeight;
  }
  function onDeckChange() {
    if (busy) return;
    if (editing && slideOffscreen(editing.el)) commitEdit();
    if (svgEd && slideOffscreen(svgEd.svg)) svgEnd();
    if (shape && slideOffscreen(shape.el)) { deselectShape(); toast('The ' + AREA + ' changed — selection cleared.', 1500); }
    var vis = slideAtPoint(window.innerWidth / 2, window.innerHeight / 2);
    if (vis !== lastSlide) { lastSlide = vis; syncToolbars(); codeRefresh(); }
  }
  function scheduleDeckChange() { cancelAnimationFrame(deckRaf); deckRaf = requestAnimationFrame(onDeckChange); }
  new MutationObserver(function (list) {
    for (var i = 0; i < list.length; i++) { var t = list[i].target; if (t.nodeType === 1 && !t.closest(OURS)) { scheduleDeckChange(); return; } }
  }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
  // decks that navigate by scrolling, by the URL hash, or with a transition on a wrapper
  ['hashchange', 'popstate', 'resize'].forEach(function (t) { window.addEventListener(t, scheduleDeckChange); });
  window.addEventListener('scroll', scheduleDeckChange, true);
  document.addEventListener('transitionend', function (e) { if (e.target && e.target.nodeType === 1 && !e.target.closest(OURS)) scheduleDeckChange(); }, true);
  function buildEditedHtml() {
    if (editing) commitEdit();
    var doc = new DOMParser().parseFromString(PRISTINE, 'text/html');
    var applied = 0, skipped = 0;
    edits.forEach(function (ed) {
      var el = elAt(doc, ed.path);
      if (!el || current(el, ed.kind) !== ed.original) {
        // fallback: a unique element with the same tag and original markup
        var same = Array.prototype.filter.call(doc.querySelectorAll(rootScoped(el ? el.tagName : '*')), function (c) { return current(c, ed.kind) === ed.original && (ed.kind === 'style' ? c.innerHTML === (el ? el.innerHTML : c.innerHTML) : true); });
        el = same.length === 1 ? same[0] : null;
      }
      if (el) { apply(el, ed.kind, ed.value); applied++; } else skipped++;
    });
    return { html: DOCTYPE + '\n' + doc.documentElement.outerHTML + '\n', applied: applied, skipped: skipped };
  }
  function saveEditedCopy() {
    var r = buildEditedHtml();
    var name = decodeURIComponent((location.pathname.split('/').pop() || WHOLE + '.html')).replace(/\.html?$/i, '') + '-edited.html';
    var blob = new Blob([r.html], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    toast('Saved “' + name + '” with ' + r.applied + ' change' + (r.applied === 1 ? '' : 's') + (r.skipped ? ' (' + r.skipped + ' could not be located)' : '') + '. The copy carries this menu too.', 6000);
    return r;
  }

  /* ---------- print orchestration ---------- */
  var busy = false, preparedByMenu = false;
  // page mode: no artboard layout — the browser paginates the page itself; backgrounds are kept and
  // animations frozen (our panels are already hidden by the @media print rule)
  var pageStyle = null;
  function preparePagePrint() {
    var diag = { slides: allRoots().length, page: null, forcedDisplay: 0, hiddenElements: 0, ancestors: 0, sizeMismatch: [], notes: ['page mode: the browser paginates'] };
    if (!pageStyle) {
      pageStyle = document.createElement('style'); pageStyle.id = 'nbg-pdf-style';
      pageStyle.textContent = '*, *::before, *::after { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important;' +
        ' animation-duration:0s !important; animation-delay:0s !important; animation-fill-mode:forwards !important; transition-duration:0s !important; transition-delay:0s !important; }\n';
      document.head.appendChild(pageStyle);
    }
    return Promise.resolve(diag);
  }
  function restorePagePrint() { if (!pageStyle) return false; if (pageStyle.parentNode) pageStyle.parentNode.removeChild(pageStyle); pageStyle = null; return true; }
  function prepare(opts) {
    if (editing) commitEdit(); if (svgEd) svgEnd(); deselectShape();
    if (PAGE_MODE) return preparePagePrint();
    opts = opts || {}; if (!opts.selector) opts.selector = ROOT_SEL;
    // block v13: blurred box-shadows are printed as images (macOS Preview mis-positions Chrome's
    // shadow masks and a PDF saved from the print dialog cannot be repaired afterwards);
    // window.nbgDeckMenuConfig.rasterShadows === false keeps the CSS shadows.
    if (opts.rasterShadows === undefined) opts.rasterShadows = CFG.rasterShadows !== false;
    return nbgPreparePrintLayout(opts);
  }
  function restore() { return PAGE_MODE ? restorePagePrint() : nbgRestorePrintLayout(); }
  function external() { return !!window.__nbgPdfExternal; }

  async function exportPdf() {
    if (busy) return;
    busy = true; preparedByMenu = true;
    closeMenu();
    try {
      var diag = await prepare();
      if (!diag.slides) { toast('No ' + UNIT.toLowerCase() + 's found — nothing to export.', 4000); preparedByMenu = false; busy = false; restore(); return; }
      window.print();
    } catch (e) {
      preparedByMenu = false; busy = false; restore();
      toast('PDF export failed: ' + (e && e.message ? e.message : e), 6000);
      return;
    }
    finishPrint();
  }
  function finishPrint() {
    if (!busy) return;
    busy = false; preparedByMenu = false;
    restore();
  }
  // Native print (Ctrl/Cmd+P, menu > Print): beforeprint runs synchronously before the preview is
  // laid out, and the DOM part of prepare() is synchronous, so the preview already sees the layout.
  // (Chrome also fires both events around DevTools Page.printToPDF — see __nbgPdfExternal.)
  window.addEventListener('beforeprint', function () {
    if (preparedByMenu || external()) return;
    busy = true;
    prepare();
  });
  window.addEventListener('afterprint', function () { if (!external()) finishPrint(); });

  /* ---------- UI ---------- */
  var style = document.createElement('style');
  style.id = 'nbg-deck-menu-style';
  style.textContent =
    '#nbg-deck-menu{position:fixed;z-index:2147483647;min-width:300px;max-width:400px;max-height:calc(100vh - 16px);overflow-y:auto;padding:0;background:#fff;color:' + INK + ';' +
    'border:1px solid rgba(0,56,65,.14);border-radius:12px;box-shadow:0 12px 32px rgba(10,20,22,.18),0 2px 6px rgba(10,20,22,.10);' +
    'font:14px/1.35 ' + FONT + ';user-select:none;-webkit-user-select:none}' +
    '#nbg-deck-menu .nbg-head{display:flex;align-items:center;gap:8px;padding:8px 10px 6px;font-size:11px;letter-spacing:.12em;' +
    'text-transform:uppercase;color:' + ACCENT + ';opacity:.85}' +
    '#nbg-deck-menu .nbg-head i{display:inline-block;width:18px;height:3px;background:' + CYAN + ';border-radius:2px;flex:none}' +
    '#nbg-deck-menu.nbg-pinned .nbg-head{cursor:move;touch-action:none}' +
    '#nbg-deck-menu .nbg-head{padding:8px 8px 6px 12px;flex-wrap:nowrap;border-bottom:1px solid rgba(0,56,65,.10)}#nbg-deck-menu .nbg-mtitle{white-space:nowrap}' +
    '#nbg-deck-menu .nbg-head button{border:0;background:transparent;color:inherit;font:inherit;cursor:pointer}#nbg-deck-menu .nbg-head button:focus-visible{outline:2px solid ' + CYAN + ';outline-offset:1px}#nbg-deck-menu .nbg-mbody{padding:6px}#nbg-deck-menu .nbg-mbody[hidden]{display:none!important}' +
    '#nbg-deck-menu .nbg-mtabs{display:inline-flex;gap:2px;margin-left:8px}#nbg-deck-menu .nbg-head button.nbg-mtab{display:inline-block;width:auto;margin:0;padding:3px 9px;font-size:12px;line-height:1.3;letter-spacing:0;text-transform:none;border-radius:6px;color:' + INK + '}' +
    '#nbg-deck-menu .nbg-head button.nbg-mtab.nbg-on{background:' + ACCENT + ';color:#fff}#nbg-deck-menu .nbg-head button.nbg-mtab:hover{background:' + CREAM + '}#nbg-deck-menu .nbg-head button.nbg-mtab.nbg-on:hover{background:' + ACCENT + '}' +
    '#nbg-deck-menu .nbg-mslide{margin-left:8px;font-size:11px;letter-spacing:.06em;color:' + MUTED + ';white-space:nowrap}#nbg-deck-menu .nbg-mfill{flex:1}' +
    '#nbg-deck-menu .nbg-head button.nbg-mquiet{display:inline-block;width:auto;margin:0 0 0 2px;padding:2px 6px;font-size:13px;line-height:1.2;letter-spacing:0;text-transform:none;border-radius:6px;color:' + MUTED + '}#nbg-deck-menu .nbg-head button.nbg-mquiet:hover{color:' + ACCENT + ';background:' + CREAM + '}' +
    '#nbg-deck-menu button.nbg-pin{margin-left:2px}' +
    '#nbg-deck-menu.nbg-tabbed{display:flex;flex-direction:column;width:480px;max-width:none;height:min(78vh,720px);min-height:240px;resize:both;overflow:hidden}' +
    '#nbg-deck-menu .nbg-code.nbg-embedded{position:static!important;left:auto!important;top:auto!important;width:auto!important;min-width:0!important;max-width:none!important;height:auto!important;min-height:0!important;max-height:none!important;flex:1 1 auto;margin:0;padding:0;box-shadow:none;border:0;border-radius:0;resize:none}' +
    '#nbg-deck-menu .nbg-code.nbg-embedded:not(.nbg-ai) .nbg-ch{display:none!important}#nbg-deck-menu .nbg-code.nbg-embedded[hidden]{display:none!important}' +
    '#nbg-deck-menu .nbg-ai.nbg-embedded .nbg-ch .nbg-ct,#nbg-deck-menu .nbg-ai.nbg-embedded .nbg-grip,#nbg-deck-menu .nbg-ai.nbg-embedded .nbg-detach,#nbg-deck-menu .nbg-ai.nbg-embedded .nbg-fold,#nbg-deck-menu .nbg-ai.nbg-embedded .nbg-ch [data-c=close]{display:none!important}' +
    '#nbg-deck-menu button.nbg-pin{display:inline-block;width:auto;margin-left:auto;padding:2px 7px;font-size:13px;line-height:1.2;opacity:.5;border-radius:6px;filter:grayscale(1)}#nbg-deck-menu button.nbg-pin:hover{opacity:.85}#nbg-deck-menu button.nbg-pin.nbg-pin-on{opacity:1;filter:none;background:rgba(0,173,191,.18)}' +
    '#nbg-deck-menu button.nbg-subbtn{padding:8px 10px 2px;border-radius:0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:' + MUTED + '}#nbg-deck-menu button.nbg-subbtn:hover{background:transparent;color:' + ACCENT + '}#nbg-deck-menu button.nbg-subbtn span{display:inline;margin:0 0 0 8px;font-size:11px;letter-spacing:0;text-transform:none;color:' + MUTED + '}' +
    '#nbg-deck-menu .nbg-mbody button{display:block;width:100%;text-align:left;border:0;background:transparent;color:inherit;' +
    'font:inherit;padding:9px 10px;border-radius:8px;cursor:pointer}' +
    '#nbg-deck-menu .nbg-mbody button:hover,#nbg-deck-menu .nbg-mbody button:focus-visible{background:' + CREAM + ';outline:none}' +
    '#nbg-deck-menu .nbg-mbody button b{display:block;font-weight:600;color:' + INK + '}' +
    '#nbg-deck-menu .nbg-mbody button span{display:block;font-size:12px;color:' + MUTED + ';margin-top:2px}' +
    '#nbg-deck-menu .nbg-sep{height:1px;margin:4px 8px;background:rgba(0,56,65,.10)}' +
    '#nbg-stack-pop{position:fixed;z-index:2147483647;min-width:260px;max-width:360px;max-height:calc(100vh - 16px);overflow-y:auto;padding:6px;background:#fff;color:' + INK + ';border:1px solid rgba(0,56,65,.14);border-radius:12px;box-shadow:0 12px 32px rgba(10,20,22,.18),0 2px 6px rgba(10,20,22,.10);font:14px/1.35 ' + FONT + ';user-select:none;-webkit-user-select:none}' +
    '#nbg-stack-pop[hidden]{display:none!important}#nbg-stack-pop .nbg-sub{padding:4px 10px 6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:' + MUTED + '}#nbg-stack-pop .nbg-sep{height:1px;margin:4px 8px;background:rgba(0,56,65,.10)}' +
    '#nbg-stack-pop button{display:block;width:100%;text-align:left;border:0;background:transparent;color:inherit;padding:6px 10px;border-radius:8px;cursor:pointer;font:inherit}#nbg-stack-pop button:hover,#nbg-stack-pop button:focus-visible{background:' + CREAM + ';outline:none}' +
    '#nbg-stack-pop button b{display:block;font-weight:600;color:' + INK + '}#nbg-stack-pop button span{display:block;font-size:12px;color:' + MUTED + ';margin-top:2px}#nbg-stack-pop button.nbg-pick{padding:6px 10px 6px 14px}#nbg-stack-pop button.nbg-pick b{font-weight:500;font-size:13px}#nbg-stack-pop button.nbg-pick-on b{font-weight:600;color:' + ACCENT + '}#nbg-stack-pop button.nbg-pick span{font-size:11px}#nbg-stack-pop .nbg-quiet{color:' + MUTED + '}' +
    '#nbg-deck-menu .nbg-quiet{color:' + MUTED + '}' +
    '#nbg-deck-menu .nbg-sub{padding:8px 10px 2px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:' + MUTED + ';border-top:1px solid rgba(0,56,65,.10);margin-top:4px}' +
    '#nbg-deck-menu button.nbg-pick{padding:6px 10px 6px 14px}#nbg-deck-menu button.nbg-pick b{font-weight:500;font-size:13px}#nbg-deck-menu button.nbg-pick-on b{font-weight:600;color:' + ACCENT + '}' +
    '#nbg-deck-menu button.nbg-pick span{font-size:11px}' +
    '#nbg-deck-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483647;max-width:min(640px,90vw);' +
    'padding:12px 16px;background:' + INK + ';color:#fff;border-radius:10px;font:14px/1.4 ' + FONT + ';box-shadow:0 8px 24px rgba(0,0,0,.25)}' +
    '.nbg-editing{outline:2px solid ' + CYAN + ' !important;outline-offset:4px;box-shadow:0 0 0 6px rgba(0,173,191,.15) !important;cursor:text;border-radius:3px}' +
    '#nbg-shape-box{position:fixed;z-index:2147483646;box-sizing:border-box;outline:1.5px solid ' + CYAN + ';outline-offset:-1px;cursor:move;' +
    'box-shadow:0 0 0 4px rgba(0,173,191,.14);touch-action:none}' +
    '#nbg-shape-box .nbg-h{position:absolute;width:11px;height:11px;margin:-6px;background:#fff;border:1.5px solid ' + CYAN + ';border-radius:2px;box-sizing:border-box;box-shadow:0 1px 3px rgba(10,20,22,.25)}' +
    '#nbg-shape-box .nbg-h-nw{left:0;top:0}#nbg-shape-box .nbg-h-n{left:50%;top:0}#nbg-shape-box .nbg-h-ne{left:100%;top:0}' +
    '#nbg-shape-box .nbg-h-e{left:100%;top:50%}#nbg-shape-box .nbg-h-se{left:100%;top:100%}#nbg-shape-box .nbg-h-s{left:50%;top:100%}' +
    '#nbg-shape-box .nbg-h-sw{left:0;top:100%}#nbg-shape-box .nbg-h-w{left:0;top:50%}' +
    '#nbg-shape-box.nbg-flow .nbg-h-nw,#nbg-shape-box.nbg-flow .nbg-h-n,#nbg-shape-box.nbg-flow .nbg-h-ne,#nbg-shape-box.nbg-flow .nbg-h-sw,#nbg-shape-box.nbg-flow .nbg-h-w{display:none}' +
    '#nbg-shape-box .nbg-chip{position:absolute;left:0;top:-30px;white-space:nowrap;padding:3px 8px;border-radius:6px;background:' + INK + ';color:#fff;' +
    'font:12px/1.4 ' + FONT + ';pointer-events:none}' +
    '#nbg-shape-box .nbg-chip.nbg-chip-below{top:auto;bottom:-30px}' +
    '#nbg-shape-box.nbg-multi{outline-style:dashed}' +
    '.nbg-svg-editing{outline:2px dashed ' + CYAN + ' !important;outline-offset:4px}' +
    '#nbg-svg-box{position:fixed;z-index:2147483646;box-sizing:border-box;outline:1.5px solid ' + ACCENT + ';outline-offset:-1px;cursor:move;box-shadow:0 0 0 3px rgba(0,56,65,.12);touch-action:none}' +
    '#nbg-svg-box .nbg-h{position:absolute;width:9px;height:9px;margin:-5px;background:#fff;border:1.5px solid ' + ACCENT + ';border-radius:2px;box-sizing:border-box;box-shadow:0 1px 3px rgba(10,20,22,.25)}' +
    '#nbg-svg-box .nbg-h-nw{left:0;top:0}#nbg-svg-box .nbg-h-n{left:50%;top:0}#nbg-svg-box .nbg-h-ne{left:100%;top:0}#nbg-svg-box .nbg-h-e{left:100%;top:50%}' +
    '#nbg-svg-box .nbg-h-se{left:100%;top:100%}#nbg-svg-box .nbg-h-s{left:50%;top:100%}#nbg-svg-box .nbg-h-sw{left:0;top:100%}#nbg-svg-box .nbg-h-w{left:0;top:50%}' +
    '#nbg-svg-box .nbg-chip{position:absolute;left:0;top:-30px;white-space:nowrap;padding:3px 8px;border-radius:6px;background:' + ACCENT + ';color:#fff;font:12px/1.4 ' + FONT + ';pointer-events:none}#nbg-svg-box .nbg-chip.nbg-chip-below{top:auto;bottom:-30px}' +
    '#nbg-svg-box.nbg-multi{outline-style:dashed}#nbg-svg-marks{position:fixed;left:0;top:0;width:0;height:0;z-index:2147483645;pointer-events:none}#nbg-svg-marks[hidden]{display:none!important}' +
    '#nbg-svg-marks div{position:fixed;box-sizing:border-box;outline:1.5px dashed ' + ACCENT + ';outline-offset:-1px}#nbg-svg-marks div.nbg-primary{outline-style:solid}' +
    '#nbg-svg-tools input[type=text]{width:130px;height:26px;border:1px solid rgba(0,56,65,.25);border-radius:6px;font:inherit;padding:0 6px;color:inherit;background:#fff}#nbg-svg-tools input[type=text]:disabled{opacity:.4}' +
    '#nbg-svg-tools select[data-g=part]{max-width:220px}' +
    '#nbg-svg-tools.nbg-nopart [data-g]:not([data-g=part]):not([data-g=reset]):not([data-g=done]):not([data-g=close]),#nbg-svg-tools.nbg-nopart [data-go]{opacity:.35;pointer-events:none}' +
    '#nbg-sel-marks{position:fixed;left:0;top:0;width:0;height:0;z-index:2147483645;pointer-events:none}' +
    '#nbg-sel-marks div{position:fixed;box-sizing:border-box;outline:1.5px dashed ' + CYAN + ';outline-offset:-1px}' +
    '#nbg-sel-marks div.nbg-primary{outline-style:solid}' +
    '#nbg-marquee{position:fixed;z-index:2147483645;box-sizing:border-box;border:1.5px dashed ' + CYAN + ';background:rgba(0,173,191,.08);pointer-events:none}' +
    '#nbg-hover{position:fixed;z-index:2147483645;box-sizing:border-box;outline:2px dashed ' + CYAN + ';outline-offset:1px;background:rgba(0,173,191,.06);pointer-events:none}' +
    '.nbg-panel.nbg-code{flex-direction:column;flex-wrap:nowrap;align-items:stretch;gap:0;padding:0;width:460px;height:min(72vh,680px);min-width:300px;min-height:180px;resize:both;overflow:hidden;font-size:12px}' +
    '.nbg-code .nbg-ch{padding:4px 6px;border-bottom:1px solid rgba(0,56,65,.12);flex-wrap:nowrap}.nbg-code .nbg-ct{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:' + ACCENT + ';margin:0 6px 0 2px;white-space:nowrap}' +
    '.nbg-code .nbg-dragsurface{cursor:move}.nbg-code .nbg-dragsurface button,.nbg-code .nbg-dragsurface input{cursor:pointer}' +
    '.nbg-code .nbg-cfill{flex:1}.nbg-code .nbg-cb{flex:1;min-height:0;overflow:auto;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}' +
    '.nbg-code .nbg-cb[hidden]{display:none!important}.nbg-code .nbg-ctree{padding:4px 0;outline:none}' +
    '.nbg-code .nbg-csplit{flex:0 0 9px;position:relative;cursor:row-resize;touch-action:none;background:' + CREAM + ';border-top:1px solid rgba(0,56,65,.12);border-bottom:1px solid rgba(0,56,65,.12)}' +
    '.nbg-code .nbg-csplit::after{content:"";position:absolute;left:50%;top:3px;width:32px;height:2px;margin-left:-16px;border-radius:1px;background:rgba(0,56,65,.35)}.nbg-code .nbg-csplit:hover{background:rgba(0,173,191,.14)}.nbg-code .nbg-csplit[hidden]{display:none!important}' +
    '.nbg-code .nbg-tr{white-space:nowrap;padding:1px 8px 1px 4px;cursor:default;color:' + INK + ';width:max-content;min-width:100%;box-sizing:border-box}.nbg-code .nbg-tr:hover{background:' + CREAM + '}' +
    '.nbg-code .nbg-tr.nbg-on{background:' + ACCENT + ';color:#fff}.nbg-code .nbg-tr.nbg-on .nbg-tag,.nbg-code .nbg-tr.nbg-on .nbg-an,.nbg-code .nbg-tr.nbg-on .nbg-av,.nbg-code .nbg-tr.nbg-on .nbg-tx{color:#fff}' +
    '.nbg-code .nbg-tr.nbg-cur{box-shadow:inset 0 0 0 1.5px ' + CYAN + '}.nbg-code .nbg-tr-text{color:' + MUTED + ';font-style:italic}' +
    '.nbg-code .nbg-of{display:flex;align-items:center;gap:4px;padding:4px 6px;border-bottom:1px solid rgba(0,56,65,.10);font:12px ' + FONT + '}.nbg-code .nbg-oq{flex:1;min-width:60px;height:24px;border:1px solid rgba(0,56,65,.25);border-radius:6px;font:inherit;padding:0 6px}' +
    '.nbg-code .nbg-oc{color:' + MUTED + ';white-space:nowrap;margin-left:2px}.nbg-code .nbg-olist{padding:4px 0;outline:none}' +
    '.nbg-code .nbg-or{font:13px/1.6 ' + FONT + ';display:flex;align-items:center;gap:4px}.nbg-code .nbg-or .nbg-ol{overflow:hidden;text-overflow:ellipsis;min-width:0}' +
    '.nbg-code .nbg-ock{margin:0 2px 0 0;accent-color:' + ACCENT + ';cursor:pointer}.nbg-code .nbg-ok{display:inline-block;width:14px;text-align:center;font-size:11px;color:' + MUTED + '}.nbg-code .nbg-ok-text{font-weight:700}' +
    '.nbg-code .nbg-os{color:' + MUTED + ';font-size:11px;margin-left:auto;padding-left:6px;white-space:nowrap}.nbg-code .nbg-og{font-size:10px;padding:0 5px;border-radius:8px;background:rgba(0,173,191,.18);color:' + ACCENT + ';white-space:nowrap}.nbg-code .nbg-ob{background:rgba(91,107,109,.15);color:' + MUTED + '}' +
    '.nbg-code .nbg-tr.nbg-on .nbg-os,.nbg-code .nbg-tr.nbg-on .nbg-ok{color:#fff}.nbg-code .nbg-tr.nbg-on .nbg-og{background:rgba(255,255,255,.25);color:#fff}' +
    '.nbg-code .nbg-tw{display:inline-block;width:14px;color:' + MUTED + ';cursor:pointer}.nbg-code .nbg-tw-none{cursor:default;opacity:.4}' +
    '.nbg-code .nbg-tag{color:#8b2d8b}.nbg-code .nbg-an{color:#9a4b00}.nbg-code .nbg-av{color:#0b5fa5}.nbg-code .nbg-tx{color:' + MUTED + '}.nbg-code .nbg-dot{color:' + CYAN + ';font-size:9px}' +
    '.nbg-code .nbg-craw{display:flex;flex-direction:column}.nbg-code .nbg-cw{padding:4px 8px;font:12px ' + FONT + ';color:' + MUTED + ';border-bottom:1px solid rgba(0,56,65,.10);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.nbg-code .nbg-raw{flex:1;min-height:0;width:100%;box-sizing:border-box;border:0;outline:none;resize:none;padding:8px;font:inherit;color:' + INK + ';background:#fff;white-space:pre;overflow:auto;tab-size:2}' +
    '.nbg-code .nbg-cf{display:flex;align-items:center;gap:4px;padding:4px 6px;border-top:1px solid rgba(0,56,65,.12);font:12px ' + FONT + '}.nbg-code .nbg-cs{flex:1;color:' + MUTED + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-left:4px}.nbg-code .nbg-cs.nbg-bad{color:#b3261e}' +
    '.nbg-panel.nbg-ai{width:480px;height:min(82vh,780px);flex-wrap:nowrap}' +
    '.nbg-ai .nbg-ab{display:flex;flex-direction:column;gap:6px;padding:8px;flex:1;min-height:0;overflow:auto;font:12px/1.4 ' + FONT + ';user-select:text;-webkit-user-select:text}' +
    '.nbg-ai .nbg-ab > *{flex:none}.nbg-ai textarea[data-ai=req]{min-height:64px}' +
    '.nbg-ai .nbg-af{display:flex;align-items:center;gap:6px;flex-wrap:wrap}' +
    '.nbg-ai .nbg-al{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:' + MUTED + ';white-space:nowrap}' +
    '.nbg-ai .nbg-ahint{font-size:11px;color:' + MUTED + ';white-space:normal}' +
    '.nbg-ai textarea,.nbg-ai input[type=text],.nbg-ai input[type=url],.nbg-ai input[type=password]{width:100%;box-sizing:border-box;border:1px solid rgba(0,56,65,.25);border-radius:6px;font:inherit;padding:5px 7px;color:' + INK + ';background:#fff;resize:vertical;min-height:0}' +
    '.nbg-ai .nbg-af input[type=password],.nbg-ai .nbg-af input[type=text]{flex:1;width:auto}' +
    '.nbg-panel.nbg-ai select{max-width:none;flex:1;min-width:120px;height:26px}.nbg-panel.nbg-ai .nbg-ab > select{flex:none;width:100%}' +
    '.nbg-panel.nbg-ai label{display:inline-flex;align-items:center;gap:4px;color:' + INK + ';font-size:12px;margin:0;cursor:pointer}.nbg-panel.nbg-ai label input{width:auto;min-width:0;height:auto;margin:0;accent-color:' + ACCENT + '}' +
    '.nbg-ai .nbg-aclip{display:inline-flex;align-items:center;gap:4px}.nbg-ai .nbg-athumb:empty{display:none}.nbg-ai .nbg-athumb img{display:block;max-height:44px;max-width:88px;border:1px solid rgba(0,56,65,.25);border-radius:4px}' +
    '.nbg-ai .nbg-asel{font-size:11px;color:' + MUTED + ';flex-basis:100%}' +
    '.nbg-ai .nbg-as{flex:1;min-width:0;color:' + MUTED + ';white-space:normal}.nbg-ai .nbg-as.nbg-bad{color:#b3261e}' +
    '.nbg-ai .nbg-arh{display:flex;align-items:center;gap:4px}.nbg-ai .nbg-ar{white-space:pre-wrap;word-break:break-word;border:1px solid rgba(0,56,65,.14);border-radius:6px;padding:8px;background:' + CREAM + ';font:12px/1.5 ' + FONT + ';color:' + INK + '}' +
    '.nbg-ai .nbg-ar code{font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:rgba(0,56,65,.08);border-radius:3px;padding:0 3px}.nbg-ai .nbg-ar pre{margin:4px 0;padding:6px 8px;background:#fff;border:1px solid rgba(0,56,65,.14);border-radius:4px;overflow:auto;white-space:pre;font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.nbg-ai .nbg-ar .nbg-mh{display:block;color:' + ACCENT + '}' +
    '.nbg-ai .nbg-ap{display:flex;align-items:center;gap:4px;padding:3px 4px;border-radius:6px}.nbg-ai .nbg-ap.nbg-on{background:' + CREAM + '}.nbg-ai .nbg-apn{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}' +
    '.nbg-ai .nbg-aped{display:flex;flex-direction:column;gap:4px;border-top:1px solid rgba(0,56,65,.12);padding-top:6px}' +
    '.nbg-ai [hidden]{display:none!important}' +
    '.nbg-capturing #nbg-tools,.nbg-capturing #nbg-stack-pop,.nbg-capturing #nbg-deck-menu,.nbg-capturing #nbg-deck-toast,.nbg-capturing #nbg-shape-box,.nbg-capturing #nbg-svg-box,.nbg-capturing #nbg-svg-marks,.nbg-capturing #nbg-sel-marks,.nbg-capturing #nbg-marquee,.nbg-capturing #nbg-hover,.nbg-capturing .nbg-panel{visibility:hidden!important}.nbg-capturing .nbg-editing,.nbg-capturing .nbg-svg-editing{outline:none!important;box-shadow:none!important}' +
    '.nbg-panel{position:fixed;z-index:2147483647;display:flex;align-items:center;gap:2px;padding:4px 6px;background:#fff;color:' + INK + ';' +
    'border:1px solid rgba(0,56,65,.14);border-radius:10px;box-shadow:0 10px 28px rgba(10,20,22,.18),0 2px 6px rgba(10,20,22,.10);font:13px/1 ' + FONT + ';user-select:none;-webkit-user-select:none;max-width:calc(100vw - 16px);flex-wrap:wrap}' +
    '.nbg-panel[hidden]{display:none!important}' +
    '.nbg-panel.nbg-tbar{flex-wrap:nowrap;align-items:stretch;gap:4px;padding:4px 6px 4px 4px}.nbg-tbar .nbg-tbside{display:flex;flex-direction:column;align-items:center;gap:2px;padding:2px 0;border-right:1px solid rgba(0,56,65,.10)}' +
    '.nbg-tbar .nbg-tbmain{display:flex;flex-direction:column;align-items:stretch;min-width:0}.nbg-tbar .nbg-tbtabs{display:flex;gap:2px;padding:0 2px 3px;margin-bottom:2px;border-bottom:1px solid rgba(0,56,65,.10)}' +
    '.nbg-tbar .nbg-tbtab{min-width:0;height:22px;line-height:22px;padding:0 10px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:' + MUTED + ';border-radius:6px}.nbg-tbar .nbg-tbtab.nbg-on{background:' + ACCENT + ';color:#fff}.nbg-tbar .nbg-tbtab.nbg-tbidle:not(.nbg-on){opacity:.45}.nbg-tbar .nbg-tbtab[hidden]{display:none!important}' +
    '.nbg-tbar .nbg-tbrows{display:flex;flex-direction:column;align-items:stretch;gap:2px;min-width:0}.nbg-panel.nbg-inrow{position:static;box-shadow:none;border:0;border-radius:0;max-width:none;padding:2px 2px}' +
    '.nbg-tbar .nbg-tbside .nbg-grip{line-height:20px;padding:0 2px}.nbg-tbar .nbg-tbside .nbg-anchor{margin:0;padding:0 3px;line-height:20px;font-size:12px}.nbg-tbar .nbg-tbside .nbg-detach{padding:0 3px;line-height:20px}' +
    '.nbg-code .nbg-cb::-webkit-scrollbar,.nbg-ai .nbg-ar pre::-webkit-scrollbar{width:10px;height:10px}.nbg-code .nbg-cb::-webkit-scrollbar-track,.nbg-ai .nbg-ar pre::-webkit-scrollbar-track{background:transparent}' +
    '.nbg-code .nbg-cb::-webkit-scrollbar-thumb,.nbg-ai .nbg-ar pre::-webkit-scrollbar-thumb{background:rgba(0,56,65,.28);border-radius:5px;border:2px solid #fff}.nbg-code .nbg-cb::-webkit-scrollbar-thumb:hover{background:rgba(0,56,65,.45)}' +
    '.nbg-code .nbg-cb{scrollbar-width:thin;scrollbar-color:rgba(0,56,65,.35) transparent}' +
    '.nbg-panel.nbg-folded{height:auto!important;min-height:0!important;resize:none}.nbg-panel.nbg-folded .nbg-cb,.nbg-panel.nbg-folded .nbg-ab{display:none!important}.nbg-panel .nbg-fold{min-width:24px}' +
    '.nbg-panel.nbg-aipop{width:380px;height:auto;min-height:0;resize:none;z-index:2147483647}.nbg-aipop .nbg-ab{overflow:visible}.nbg-aipop textarea{min-height:56px}.nbg-aipop .nbg-ar{max-height:40vh;overflow:auto}.nbg-aipop.nbg-abusy [data-pop=send]{opacity:.5}' +
    '.nbg-panel .nbg-grip{cursor:grab;color:' + MUTED + ';padding:0 4px;letter-spacing:-2px;font-size:14px;line-height:28px;touch-action:none}.nbg-panel .nbg-grip:active{cursor:grabbing}' +
    '.nbg-panel.nbg-anchored .nbg-grip{color:' + CYAN + '}.nbg-panel .nbg-anchor{display:inline-block;width:auto;min-width:0;margin:0 2px 0 -2px;padding:0 4px;border:0;border-radius:6px;background:rgba(0,173,191,.16);color:' + ACCENT + ';font:13px/24px ' + FONT + ';cursor:pointer}.nbg-panel .nbg-anchor:hover{background:rgba(0,173,191,.32)}.nbg-panel .nbg-anchor[hidden]{display:none!important}' +
    '.nbg-panel button{border:0;background:transparent;color:inherit;font:inherit;min-width:28px;height:28px;padding:0 6px;border-radius:6px;cursor:pointer;line-height:28px}' +
    '.nbg-panel button:hover{background:' + CREAM + '}.nbg-panel button.nbg-on{background:' + ACCENT + ';color:#fff}' +
    '.nbg-panel button.nbg-tquiet{color:' + MUTED + '}.nbg-panel button.nbg-tdone{background:' + CYAN + ';color:' + INK + ';font-weight:600;margin-left:4px}' +
    '.nbg-panel input[type=number]{width:52px;height:26px;border:1px solid rgba(0,56,65,.25);border-radius:6px;font:inherit;padding:0 4px;text-align:center;color:inherit;background:#fff}' +
    '.nbg-panel label{display:inline-flex;align-items:center;gap:3px;color:' + MUTED + ';font-size:12px;margin:0 2px}.nbg-panel label input{width:56px}' +
    '.nbg-panel select{height:26px;max-width:150px;border:1px solid rgba(0,56,65,.25);border-radius:6px;font:inherit;padding:0 4px;color:inherit;background:#fff}' +
    '.nbg-panel .nbg-tsep{width:1px;height:20px;margin:0 4px;background:rgba(0,56,65,.14)}' +
    '.nbg-panel .nbg-swatches{display:inline-flex;gap:3px;align-items:center}' +
    '.nbg-panel .nbg-swatches button{min-width:16px;width:16px;height:16px;padding:0;border-radius:50%;border:1px solid rgba(0,56,65,.3)}' +
    '.nbg-panel .nbg-swatches button.nbg-on{box-shadow:0 0 0 2px #fff,0 0 0 4px ' + CYAN + '}' +
    '.nbg-panel.nbg-rows{flex-direction:column;align-items:stretch;gap:3px}' +
    '.nbg-panel .nbg-row{display:flex;align-items:center;gap:2px;flex-wrap:wrap}' +
    '.nbg-panel .nbg-tlabel{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:' + MUTED + ';margin:0 4px 0 2px;white-space:nowrap}' +
    '.nbg-panel button.nbg-off{opacity:.35}' +
    '.nbg-panel.nbg-idle button:not(.nbg-tclose),.nbg-panel.nbg-idle input,.nbg-panel.nbg-idle select{opacity:.35;pointer-events:none}' +
    '.nbg-panel .nbg-tclose{margin-left:2px;min-width:24px}.nbg-panel .nbg-tnote:empty{display:none}' +
    '.nbg-panel button svg{display:block;fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}' +
    '.nbg-panel button svg .nbg-fill{fill:currentColor;stroke:none}' +
    '@media print{#nbg-stack-pop,#nbg-deck-menu,#nbg-deck-toast,#nbg-shape-box,#nbg-svg-box,#nbg-svg-marks,#nbg-sel-marks,#nbg-marquee,#nbg-hover,.nbg-panel{display:none!important}.nbg-editing,.nbg-svg-editing{outline:none!important;box-shadow:none!important}}';
  document.head.appendChild(style);

  var menu = null, menuTarget = null, menuShape = null, menuSvg = null, menuStack = [], menuSlide = null, menuPinned = false;   // menuSvg: the inline SVG under the pointer   // pinned: stays open after a choice or a click elsewhere, movable by its header, keeps its place
  var menuDrag = null, menuTab = 'menu', menuPos = null;   // menuTab: 'menu' (the items) | 'outline' | 'tree' (the structure panel, embedded); menuPos: where a pinned menu was dragged
  var MENU_TABS = [['menu', 'Menu', 'The actions for what is under the pointer, the toolbars, printing and saving'], ['outline', 'Outline', 'The ' + AREA + '’s shapes — tick boxes to select several, click a name to select one'], ['tree', 'Tree', 'The ' + AREA + '’s HTML elements, with the selected element’s source editable below them'], ['ai', 'Assistant', 'Ask an AI model about the ' + AREA + ' or the selection — with a screenshot, the source and a clipboard image, each optional']];
  function inEmbedded(t) { return !!t && ((code && code.contains(t)) || (ai && ai.contains(t))); }   // inside a panel embedded in the menu
  function menuHeld() { return menuPinned || menuTab !== 'menu' || (menu && detachedPanel(menu)); }   // stays open: pinned, showing a structure tab, or in its own window
  var menuSize = null;   // the size the viewer gave the tabbed menu (its corner handle), kept across tab switches
  function ensureMenu() {   // the menu with the structure panel (Outline / Tree tabs) and the assistant (Assistant tab) embedded
    if (!menu) buildMenu();
    if (!code) buildCode();
    if (code.parentNode !== menu) { code.classList.add('nbg-embedded'); menu.appendChild(code); }
    if (!ai) buildAi();
    if (ai.parentNode !== menu) { ai.classList.add('nbg-embedded'); ai.style.width = ''; ai.style.height = ''; menu.appendChild(ai); }
  }
  function showTab(tab) {   // a tabbed view: the menu takes the panel's size, the items give way to the panel
    ensureMenu(); menuTab = tab;
    menu.classList.add('nbg-tabbed'); menu.querySelector('.nbg-mbody').hidden = true;
    if (menuSize && !detachedPanel(menu)) { menu.style.width = menuSize.w + 'px'; menu.style.height = menuSize.h + 'px'; }
    if (tab === 'ai') { if (code && !code.hidden) closeCodePanel(); if (ai.hidden) openAiPanel(); else layoutAi(); }
    else { if (ai && !ai.hidden) closeAiPanel(); setTab(tab); openCodePanel(); }
  }
  function hideTabbed() {
    if (menu && menu.classList.contains('nbg-tabbed')) {
      if (!detachedPanel(menu) && menu.offsetWidth) menuSize = { w: menu.offsetWidth, h: menu.offsetHeight };
      menu.classList.remove('nbg-tabbed'); menu.style.width = ''; menu.style.height = '';
      menu.querySelector('.nbg-mbody').hidden = false;
    }
    if (code && !code.hidden) closeCodePanel();
    if (ai && !ai.hidden) closeAiPanel();
  }
  function setMenuTab(tab) {
    if (tab === 'code') tab = 'tree';
    if (tab !== 'menu' && tab !== 'outline' && tab !== 'tree' && tab !== 'ai') return false;
    if (!menu || menu.hidden) { if (tab === 'menu') return false; openMenuTab(tab); return true; }
    if (tab === 'menu') { menuTab = 'menu'; hideTabbed(); refreshMenu(); }
    else { showTab(tab); refreshMenu(); }   // a panel tab holds the menu open: the viewer works in it
    return true;
  }
  function placeMenuDocked() {   // a pinned / programmatic open: where the viewer dragged it, else docked top-right
    if (detachedPanel(menu)) return;
    menu.style.left = '0px'; menu.style.top = '0px';
    var r = menu.getBoundingClientRect();
    if (menuPos) { menu.style.left = Math.max(8, Math.min(menuPos.left, window.innerWidth - r.width - 8)) + 'px'; menu.style.top = Math.max(8, Math.min(menuPos.top, window.innerHeight - r.height - 8)) + 'px'; }
    else { menu.style.left = Math.max(8, window.innerWidth - r.width - 8) + 'px'; menu.style.top = '8px'; }
  }
  function openMenuTab(tab) {   // open (or keep) the menu on a panel tab (held open by the tab)
    ensureMenu();
    var wasOpen = !menu.hidden;
    menu.hidden = false;
    if (!wasOpen) { menuTarget = null; menuShape = null; menuStack = []; menuSlide = slideAtPoint(window.innerWidth / 2, window.innerHeight / 2); }
    showTab(tab);
    renderMenu();
    if (!wasOpen) placeMenuDocked(); else if (!detachedPanel(menu)) clampMenu();
    if (tab !== 'ai') applySplit();
  }
  function item(action, label, hint, cls) {
    return '<button type="button" role="menuitem" data-action="' + action + '"' + (cls ? ' class="' + cls + '"' : '') + '><b>' + label + '</b>' + (hint ? '<span>' + hint + '</span>' : '') + '</button>';
  }
  function renderMenu() {
    var head = menu.querySelector('.nbg-head'), body = menu.querySelector('.nbg-mbody');
    var hh = '<i></i><span class="nbg-mtitle">' + esc(TITLE) + '</span><span class="nbg-mtabs">';
    MENU_TABS.forEach(function (t) { hh += '<button type="button" data-action="mtab" data-mtab="' + t[0] + '" class="nbg-mtab' + (menuTab === t[0] ? ' nbg-on' : '') + '" title="' + t[2] + '">' + t[1] + '</button>'; });
    hh += '</span><span class="nbg-mslide">' + (menuTab !== 'menu' && codeSlideEl ? esc(unitLabel(codeSlideEl)) : '') + '</span><span class="nbg-mfill"></span>';
    if (menuTab === 'outline' || menuTab === 'tree') hh += '<button type="button" data-action="mrefresh" class="nbg-mquiet" title="Re-read the ' + AREA + '">↻</button>';
    hh += '<button type="button" data-action="mdetach" class="nbg-mquiet nbg-mdetach" title="Detach the menu into its own window — in Chrome / Edge an always-on-top window you can move anywhere, even off the browser; close it (or ✕ here) to bring it back">⧉</button>';
    if (menuTab === 'menu') hh += '<button type="button" data-action="pin" class="nbg-pin' + (menuPinned ? ' nbg-pin-on' : '') + '" title="' + (menuPinned ? 'Pinned — the menu stays open after a choice or a click elsewhere and keeps its place; drag this header to move it. Click to unpin; Esc or Cancel closes it.' : 'Pin the menu: keep it open after a choice or a click elsewhere, and drag it by its header (Esc or Cancel still closes it).') + '">📌</button>';
    hh += '<button type="button" data-action="close" class="nbg-mquiet" title="Close (Esc)">✕</button>';
    head.innerHTML = hh;
    menu.classList.toggle('nbg-pinned', menuHeld());
    menu.classList.toggle('nbg-tabbed', menuTab !== 'menu');
    body.hidden = menuTab !== 'menu';
    if (menuTab !== 'menu') { body.innerHTML = ''; return; }
    var h = '';
    if (menuTarget) h += item('edit', 'Edit text', 'Edit this text in place — Enter applies, Esc cancels. Or double-click any text.');
    if (menuShape) {
      var inSel = sel.indexOf(menuShape) >= 0;
      h += item('shape', 'Resize / move shape', describe(menuShape) + ' — handles resize (Shift keeps proportions), drag moves, arrows nudge, Esc finishes. Or double-click a shape or image.' + (shape ? '' : ' Shift+click adds more shapes.'));
      if (shape && !inSel) h += item('addsel', 'Add to selection', 'Select this shape together with the ' + sel.length + ' already selected (Shift+click does the same).');
      else if (shape && inSel && sel.length > 1) h += item('rmsel', 'Remove from selection', 'Keep the other ' + (sel.length - 1) + ' selected (Shift+click does the same).', 'nbg-quiet');
      if (shape) h += item('selall', 'Select all shapes on this ' + AREA + '', 'Ctrl/Cmd+A while a shape is selected; Shift+drag draws a selection box.', 'nbg-quiet');
      h += item('front', 'Bring to front', (inSel && sel.length > 1 ? 'The ' + sel.length + ' selected shapes' : 'This shape') + ' above everything else here (Ctrl/Cmd+Shift+]). The toolbar also steps forward / backward, aligns, distributes and groups.', 'nbg-quiet');
      h += item('back', 'Send to back', (inSel && sel.length > 1 ? 'The ' + sel.length + ' selected shapes' : 'This shape') + ' behind everything else here (Ctrl/Cmd+Shift+[).', 'nbg-quiet');
      if (findEdit(menuShape, 'style')) h += item('reset', 'Reset shape', 'Restore this element’s original size, position, order and text formatting.', 'nbg-quiet');
    }
    if (menuSvg) {
      var svgOn = !!(svgEd && svgEd.svg === menuSvg), np = svgParts(menuSvg).length;
      h += item('svg', svgOn ? 'Finish SVG editing' : 'Edit SVG', svgOn ? 'Done with the parts of this SVG (Esc or Enter do the same).' : describe(menuSvg) + ' · ' + np + ' part' + (np === 1 ? '' : 's') + ' — click a part to move, resize, recolour, reorder, duplicate or delete it, or edit its text. Or double-click the selected SVG.');
      if (findEdit(menuSvg, 'html')) h += item('svgreset', 'Reset SVG', 'Restore every part of this SVG as designed.', 'nbg-quiet');
    }
    if (menuStack.length > 1) {
      // every shape under the pointer, front-most first: nested parts, their containers, shapes behind
      h += '<div class="nbg-sub">Select at this point · ' + menuStack.length + ' stacked</div>';
      menuStack.forEach(function (el, i) {
        var rel = i === 0 ? 'front-most' : el.contains(menuStack[i - 1]) ? 'encloses the one above' : 'behind the one above';
        h += item('pick', (el === menuShape ? '● ' : '○ ') + describe(el), rel + (i === menuStack.length - 1 ? ' · outermost' : '') + ' — click selects it alone, Shift+click adds it', 'nbg-pick' + (el === menuShape ? ' nbg-pick-on' : ''));
      });
    }
    var shown = ['text', 'shape', 'svg'].filter(toolbarVisible).map(function (k) { return TOOLBAR_NAMES[k]; });
    h += '<button type="button" data-action="tbfold" class="nbg-sub nbg-subbtn" title="' + (ui.menuFold ? 'Expand the Toolbars section' : 'Collapse the Toolbars section') + '">' + (ui.menuFold ? '▸' : '▾') + ' Toolbars' + (ui.menuFold ? '<span>' + (shown.length ? shown.join(', ') + ' shown' : 'none shown') + '</span>' : '') + '</button>';
    if (!ui.menuFold) ['text', 'shape', 'svg'].forEach(function (k) {
      var on = toolbarVisible(k), mode = ui[k];
      h += item('tb-' + k, (on ? '☑ ' : '☐ ') + TOOLBAR_NAMES[k] + (on && tbTab === k ? ' · in front' : ''), on ? (tbTab !== k ? 'A tab of the toolbar. Click to bring it to the front.' : mode === 'on' ? 'The tab in front, pinned — follows the selection. Click to hide it.' : 'The tab in front, shown with the current selection. Click to hide it (it stays hidden until you show it again).') : (mode === 'off' ? 'Hidden by you. Click to show it and keep it visible.' : k === 'code' ? 'Opens on request (Show structure / Show HTML). Click to show it and keep it visible.' : k === 'ai' ? 'Opens on request (Ask the assistant). Click to show it and keep it visible.' : 'Appears with the selection. Click to show it now and keep it visible.'), 'nbg-pick' + (on ? ' nbg-pick-on' : ''));
    });
    if (!ui.menuFold && (ui.text !== 'auto' || ui.shape !== 'auto' || ui.svg !== 'auto')) h += item('tb-auto', 'Automatic toolbars', 'Show the text, shape and SVG toolbars with the selection again (the default).', 'nbg-quiet');
    if (PAGE_MODE) h += item('pdf', 'Print / Save as PDF', 'Opens the print dialog — choose “Save as PDF”. The browser paginates the page; backgrounds are kept and the editor’s panels are hidden.');
    else h += item('pdf', 'Export to PDF', 'Opens the print dialog — choose “Save as PDF”. One page per slide, 1920×1080, margins and backgrounds preset.');
    if (edits.length) {
      h += '<div class="nbg-sep"></div>';
      h += item('save', 'Save edited copy', 'Download this ' + WHOLE + ' with your ' + changesLabel().replace(' unsaved', '') + ' applied (…-edited.html).');
      var sc = menuSlide ? editsIn(menuSlide).length : 0;
      if (sc && allRoots().length > 1) h += item('discardslide', 'Discard changes on this ' + UNIT.toLowerCase(), unitLabel(menuSlide) + ': restore its ' + sc + ' change' + (sc === 1 ? '' : 's') + ' — text, formatting, size, position, order and groups. The other ' + UNIT.toLowerCase() + 's keep theirs.', 'nbg-quiet');
      h += item('discard', 'Discard edits', 'Restore every original text, size, position, order and group on ' + (allRoots().length > 1 ? 'every ' + UNIT.toLowerCase() : 'the ' + AREA) + '.', 'nbg-quiet');
    }
    h += '<div class="nbg-sep"></div>' + item('close', 'Cancel', '', 'nbg-quiet');
    body.innerHTML = h;
  }
  function buildMenu() {
    menu = document.createElement('div');
    menu.id = 'nbg-deck-menu';
    menu.setAttribute('role', 'dialog'); menu.setAttribute('aria-label', TITLE);
    menu.hidden = true;
    menu.innerHTML = '<div class="nbg-head"></div><div class="nbg-mbody" role="menu"></div>';
    menu.addEventListener('click', function (e) {
      if (inEmbedded(e.target)) return;   // the embedded panels handle their own clicks
      var b = e.target.closest('button'); if (!b) return;
      e.preventDefault(); e.stopPropagation();
      var action = b.getAttribute('data-action'), t = menuTarget, s = menuShape;
      if (action === 'mtab') { setMenuTab(b.getAttribute('data-mtab')); return; }
      if (action === 'mrefresh') { codeRefresh(); return; }
      if (action === 'mdetach') { detachPanel('menu'); return; }
      if (action === 'pin') { menuPinned = !menuPinned; refreshMenu('pin'); toast(menuPinned ? 'Menu pinned — it stays open after a choice or a click elsewhere and keeps its place; drag its header to move it. Esc or Cancel closes it.' : 'Menu unpinned — it follows the pointer again.', 3000); return; }
      if (action === 'tbfold') { ui.menuFold = !ui.menuFold; uiSave(); refreshMenu('tbfold'); return; }
      if (action === 'close') { closeMenu(true); return; }
      if (action === 'pdf') exportPdf();
      else if (action === 'edit') { closeMenu(); startEdit(t, false); }
      else if (action === 'shape') { closeMenu(); selectShape(s); }
      else if (action === 'addsel') { closeMenu(); addToSelection(s); }
      else if (action === 'rmsel') { closeMenu(); removeFromSelection(s); }
      else if (action === 'selall') { closeMenu(); selectAllIn(slideOf(s)); }
      else if (action === 'front' || action === 'back') { closeMenu(); if (sel.indexOf(s) < 0) setSelection([s], s, { toast: false }); reorder(action); }
      else if (action === 'reset') { closeMenu(); resetShape(s); }
      else if (action === 'svg') { var sv = menuSvg, lp = lastPoint; closeMenu(); if (svgEd && svgEd.svg === sv) svgEnd(); else svgEdit(sv, lp ? svgLeafAt(lp.x, lp.y, sv) : null); }
      else if (action === 'svgreset') { var sv2 = menuSvg; closeMenu(); svgReset(sv2); }
      else if (action === 'pick') {
        var el = menuStack[Array.prototype.indexOf.call(menu.querySelectorAll('[data-action=pick]'), b)];
        closeMenu();
        if (el) { if (e.shiftKey && shape) addToSelection(el); else { selectSolo(el, true); toast(describe(el) + ' selected — Tab / Shift+Tab step out / in, the toolbar’s Stack list shows the whole stack.', 3000); } }
      }
      else if (action === 'save') { closeMenu(); saveEditedCopy(); }
      else if (action === 'discard') { closeMenu(); discardEdits(); }
      else if (action === 'discardslide') { var sl = menuSlide; closeMenu(); discardSlideEdits(sl); }
      else if (/^tb-(text|shape|svg)$/.test(action)) {
        var k = action.slice(3); closeMenu();
        if (toolbarVisible(k) && tbTab === k) setToolbarMode(k, 'off');   // the tab in front: hide it
        else setToolbarMode(k, 'on');                                      // a tab at the back, or a hidden one: pin it and bring it to the front
      }
      else if (action === 'tb-auto') { closeMenu(); ui.text = 'auto'; ui.shape = 'auto'; ui.svg = 'auto'; uiSave(); syncToolbars(); toast('Toolbars appear with the selection again.', 2000); }
      else closeMenu();
    });
    menu.addEventListener('contextmenu', function (e) { if (!inEmbedded(e.target)) e.preventDefault(); });
    menu.addEventListener('keydown', function (e) {   // a detached menu has no deck-level key handling: Esc closes (and reattaches) it
      if (e.key === 'Escape' && detachedPanel(menu) && !inEmbedded(e.target)) { e.preventDefault(); e.stopPropagation(); closeMenu(true); }
    });
    // pinned: the header drags the menu (its buttons excluded); the header is re-rendered, so delegate from the menu
    menu.addEventListener('pointerdown', function (e) {
      if (!menuHeld() || detachedPanel(menu) || e.button !== 0 || !e.target.closest('.nbg-head') || e.target.closest('button')) return;
      e.preventDefault(); e.stopPropagation();
      var r = menu.getBoundingClientRect();
      menuDrag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top };
      try { menu.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    });
    menu.addEventListener('pointermove', function (e) {
      if (!menuDrag || e.pointerId !== menuDrag.id) return;
      var r = menu.getBoundingClientRect();
      menu.style.left = Math.max(8, Math.min(e.clientX - menuDrag.dx, window.innerWidth - r.width - 8)) + 'px';   // the same 8 px margin as clampMenu
      menu.style.top = Math.max(8, Math.min(e.clientY - menuDrag.dy, window.innerHeight - r.height - 8)) + 'px';
      menuPos = { left: parseFloat(menu.style.left), top: parseFloat(menu.style.top) };
    });
    ['pointerup', 'pointercancel'].forEach(function (t) { menu.addEventListener(t, function (e) { if (menuDrag && e.pointerId === menuDrag.id) menuDrag = null; }); });
    // hovering (or focusing) an item outlines the element it is about: the stacked shapes, the shape items, the text item
    function menuItemEl(b) {
      var a = b && b.getAttribute('data-action');
      if (a === 'pick') return menuStack[Array.prototype.indexOf.call(menu.querySelectorAll('[data-action=pick]'), b)] || null;
      if (/^(shape|front|back|reset|addsel|rmsel)$/.test(a)) return menuShape || menuTarget;
      if (a === 'edit') return menuTarget;
      if (a === 'svg' || a === 'svgreset') return menuSvg;
      return null;
    }
    // the embedded structure panel outlines its own rows; only the menu's items are handled here
    menu.addEventListener('pointerover', function (e) { if (inEmbedded(e.target)) return; hoverEl(menuItemEl(e.target.closest('button'))); });
    menu.addEventListener('focusin', function (e) { if (inEmbedded(e.target)) return; hoverEl(menuItemEl(e.target.closest('button'))); });
    menu.addEventListener('pointerleave', function () { hoverEl(null); });
    document.body.appendChild(menu);
  }
  /* ---------- the picker at the pointer: the menu's actions are not in front of the viewer (the menu is
     detached into its own window, or open on a panel tab), so a right-click on the deck opens this compact
     menu where the pointer is — the hierarchy under the pointer as the menu shows it, and Edit text ---------- */
  var stackPop = null;
  function openStackPop(x, y) {
    var stack = menuStack.slice();
    if (!stack.length && !menuTarget && !menuSvg) { closeStackPop(); return false; }
    if (!stackPop) {
      stackPop = document.createElement('div'); stackPop.id = 'nbg-stack-pop'; stackPop.setAttribute('role', 'menu'); stackPop.setAttribute('aria-label', 'Select at this point');
      stackPop.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        e.preventDefault(); e.stopPropagation();
        var a = b.getAttribute('data-action');
        if (a === 'edit') { var t = stackPop.__target; closeStackPop(); if (t) startEdit(t, false); return; }
        if (a === 'svg') { var sv = stackPop.__svg, pt = stackPop.__pt; closeStackPop(); if (sv) { if (svgEd && svgEd.svg === sv) svgEnd(); else svgEdit(sv, pt ? svgLeafAt(pt.x, pt.y, sv) : null); } return; }
        if (a === 'close') { closeStackPop(); return; }
        var el = stackPop.__stack[Number(b.getAttribute('data-i'))]; closeStackPop();
        if (!el || !el.isConnected) return;
        if (e.shiftKey && shape) addToSelection(el); else { selectSolo(el, true); toast(describe(el) + ' selected — Tab / Shift+Tab step out / in.', 2000); }
      });
      stackPop.addEventListener('pointerover', function (e) { var b = e.target.closest('button[data-i]'); hoverEl(b ? stackPop.__stack[Number(b.getAttribute('data-i'))] : null); });
      stackPop.addEventListener('pointerleave', function () { hoverEl(null); });
      stackPop.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      stackPop.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); });
      stackPop.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.key === 'Escape') { e.preventDefault(); closeStackPop(); }
        else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); var items = Array.prototype.slice.call(stackPop.querySelectorAll('button')), i = items.indexOf(document.activeElement); items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus({ preventScroll: true }); }
      });
      document.body.appendChild(stackPop);
    }
    stackPop.__stack = stack; stackPop.__target = menuTarget; stackPop.__svg = menuSvg; stackPop.__pt = { x: x, y: y };
    var h = '<div class="nbg-sub">' + (stack.length > 1 ? 'Select at this point · ' + stack.length + ' stacked' : 'At this point') + '</div>';
    if (menuTarget) h += '<button type="button" role="menuitem" data-action="edit"><b>Edit text</b><span>Edit this text in place — Enter applies, Esc cancels.</span></button>';
    if (menuSvg) h += '<button type="button" role="menuitem" data-action="svg"><b>' + (svgEd && svgEd.svg === menuSvg ? 'Finish SVG editing' : 'Edit SVG') + '</b><span>' + esc(describe(menuSvg)) + ' — its parts: move, resize, recolour, reorder, text.</span></button>';
    stack.forEach(function (el, i) {   // front-most first: nested parts, their containers, shapes behind — as in the menu
      var rel = i === 0 ? 'front-most' : el.contains(stack[i - 1]) ? 'encloses the one above' : 'behind the one above';
      h += '<button type="button" role="menuitem" data-i="' + i + '" class="nbg-pick' + (el === menuShape ? ' nbg-pick-on' : '') + '"><b>' + (el === menuShape ? '● ' : '○ ') + esc(describe(el)) + '</b><span>' + rel + (i === stack.length - 1 ? ' · outermost' : '') + ' — click selects it alone, Shift+click adds it</span></button>';
    });
    h += '<div class="nbg-sep"></div><button type="button" role="menuitem" data-action="close" class="nbg-quiet"><b>Cancel</b></button>';
    stackPop.innerHTML = h; stackPop.hidden = false;
    stackPop.style.left = '0px'; stackPop.style.top = '0px';
    var r = stackPop.getBoundingClientRect();
    stackPop.style.left = Math.max(8, Math.min(x, window.innerWidth - r.width - 8)) + 'px';
    stackPop.style.top = Math.max(8, Math.min(y, window.innerHeight - r.height - 8)) + 'px';
    var first = stackPop.querySelector('button'); if (first) first.focus({ preventScroll: true });
    return true;
  }
  function closeStackPop() { if (stackPop && !stackPop.hidden) { stackPop.hidden = true; stackPop.__stack = []; stackPop.__target = null; hoverEl(null); } }
  function stackPopOpen() { return !!(stackPop && !stackPop.hidden); }

  function openMenu(x, y, target, shapeTarget) {
    ensureMenu();
    closeStackPop();
    menuTarget = target || null; menuShape = shapeTarget || null;
    menuSvg = svgOwner(underPoint(x, y)) || (shapeTarget && svgTag(shapeTarget) === 'svg' ? shapeTarget : null);
    lastPoint = { x: x, y: y };
    menuSlide = slideAtPoint(x, y);
    menuStack = shapeStack(x, y);
    if (menuShape && menuStack.indexOf(menuShape) < 0) menuStack.unshift(menuShape);
    var keep = menuHeld() && !menu.hidden;   // a held menu (pinned, on a panel tab, detached) stays where it is, on its tab; its items follow the new target
    if (!keep) { menuTab = 'menu'; hideTabbed(); }
    renderMenu();
    menu.hidden = false;
    if (keep) {
      if (!detachedPanel(menu)) clampMenu();
      // the menu's actions are not at the pointer (another window, or a panel tab): a picker opens there instead
      if (detachedPanel(menu) || menuTab !== 'menu') { openStackPop(x, y); return; }
    }
    else {
      menu.style.left = '0px'; menu.style.top = '0px';
      var r = menu.getBoundingClientRect();
      menu.style.left = Math.max(8, Math.min(x, window.innerWidth - r.width - 8)) + 'px';
      menu.style.top = Math.max(8, Math.min(y, window.innerHeight - r.height - 8)) + 'px';
    }
    var first = menu.querySelector('button[data-action]:not([data-action=pin])'); if (first) first.focus({ preventScroll: true });
  }
  function clampMenu() {
    if (detachedPanel(menu)) return;
    var r = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - r.width - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(r.top, window.innerHeight - r.height - 8)) + 'px';
  }
  function refreshMenu(focusAction) {   // re-render in place (ticks, hints, the pin) and keep the keyboard focus where it was
    if (!menu || menu.hidden) return;
    var ae = menu.ownerDocument.activeElement, act = focusAction || (menu.contains(ae) && !inEmbedded(ae) && ae.getAttribute('data-action')) || null;
    renderMenu(); clampMenu();
    if (act) { var f = menu.querySelector('[data-action="' + act + '"]'); if (f) f.focus({ preventScroll: true }); }
  }
  // force: an explicit close (Cancel, Esc) — otherwise a pinned menu refreshes instead of closing
  function closeMenu(force) {
    if (!menu || menu.hidden) return;
    closeStackPop();
    if (menuHeld() && !force) { refreshMenu(); return; }
    hoverEl(null);
    hideTabbed(); menuTab = 'menu';
    if (detachedPanel(menu)) reattachPanel('menu');
    menu.hidden = true; menuTarget = null; menuShape = null; menuSvg = null; menuStack = []; menuSlide = null;
  }

  var toastTimer = null;
  function toast(msg, ms) {
    var t = document.getElementById('nbg-deck-toast');
    if (!t) { t = document.createElement('div'); t.id = 'nbg-deck-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, ms || 4000);
  }

  /* ---------- events ---------- */
  document.addEventListener('contextmenu', function (e) {
    if (busy) return;
    var t = e.target;
    if (t && t.closest && t.closest('#nbg-shape-box')) return;                                   // handled by the frame itself
    if (editing && editing.el.contains(t)) return;                                              // native menu while editing (spellcheck etc.)
    if (t && t.closest && t.closest('a[href], input, textarea, select, [contenteditable="true"]')) return;
    e.preventDefault();
    if (editing) commitEdit();
    openMenu(e.clientX, e.clientY, resolveTextTarget(t), resolveShapeTarget(t));
  });
  document.addEventListener('dblclick', function (e) {
    if (busy) return;
    if (menu && !menu.hidden) {   // an open menu: its own double-clicks are its business; on the deck it closes (unless held) and the double-click goes through
      if (menu.contains(e.target)) return;
      if (!menuHeld()) closeMenu();
    }
    if (editing && editing.el.contains(e.target)) return;
    if (e.target && e.target.closest && e.target.closest('#nbg-shape-box, #nbg-svg-box')) return;
    // an SVG in editing: the double-click picks the part under the pointer (a <text> part opens its text field)
    var dsv = svgOwner(e.target);
    if (dsv && svgEd && svgEd.svg === dsv) { e.preventDefault(); svgSelectPart(svgLeafAt(e.clientX, e.clientY, dsv), true); svgFocusText(); return; }
    var el = resolveTextTarget(e.target);
    if (!el) {   // not text: a shape or an image under the pointer is selected for resize / move
      var sh = resolveShapeTarget(e.target);
      if (!sh) return;
      e.preventDefault();
      if (!(shape && sel.length === 1 && shape.el === sh)) selectShape(sh);
      return;
    }
    e.preventDefault();
    startEdit(el, true);
  });
  function inTools(t) { return !!(tbar && t && tbar.contains(t)); }   // anywhere on the one toolbar (its grip and side strip included)
  document.addEventListener('pointerdown', function (e) {
    if (menu && !menu.hidden && !menu.contains(e.target) && !menuHeld()) closeMenu();
    if (stackPop && !stackPop.hidden && !stackPop.contains(e.target)) closeStackPop();
    if (editing && !editing.el.contains(e.target) && !inTools(e.target) && !(menu && menu.contains(e.target))) commitEdit();
    // Shift+click / Shift+drag (and Ctrl/Cmd+click with a selection) select shapes instead of deselecting
    lastPoint = { x: e.clientX, y: e.clientY };
    if (svgEd && !busy) {   // an SVG in editing: a click inside it picks (and starts moving) the part under the pointer; a plain click outside ends the session
      if (svgEd.svg.contains(e.target)) {
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation(); swallowClick = true;
        var leaf = svgLeafAt(e.clientX, e.clientY, svgEd.svg);
        if (e.shiftKey) { if (leaf) svgTogglePart(leaf); return; }   // Shift+click adds / removes a part
        if (e.metaKey || e.ctrlKey) { svgSelectInside(leaf); return; }   // Ctrl/Cmd+click: what is inside the smallest part there (a leaf alone)
        svgSelectPart(leaf, true);
        if (svgSel().length) startSvgDrag(e, null);
        return;
      }
      if (e.button !== 2 && !inTools(e.target) && !inCode(e.target) && !inAi(e.target) && !inAiPop(e.target) && !(gbox && gbox.contains(e.target)) && !(menu && menu.contains(e.target)) && !(stackPop && stackPop.contains(e.target))) svgEnd();
    }
    if (e.button === 0 && !busy && !editing && (e.shiftKey || e.metaKey || e.ctrlKey) && startSelectGesture(e)) return;
    // a right-click keeps the selection (the menu offers "Add to selection"); a plain click outside ends it
    if (shape && e.button !== 2 && !(box && box.contains(e.target)) && !inShapeTools(e.target) && !inCode(e.target) && !inAi(e.target) && !inAiPop(e.target) && !(menu && menu.contains(e.target))) deselectShape();
  }, true);
  document.addEventListener('focusout', function (e) {
    if (editing && e.target === editing.el && !inTools(e.relatedTarget)) {
      setTimeout(function () { if (editing && document.activeElement !== editing.el && !inTools(document.activeElement)) commitEdit(); }, 0);
    }
  }, true);
  document.addEventListener('beforeinput', function (e) {
    if (!editing || !editing.el.contains(e.target)) return;
    var t = e.inputType || '';
    if (t === 'insertParagraph') { e.preventDefault(); commitEdit(); return; }                   // Enter applies
    if (t === 'insertFromPaste' || t === 'insertFromDrop') {                                     // plain text only
      e.preventDefault();
      var txt = e.dataTransfer ? e.dataTransfer.getData('text/plain') : '';
      if (txt) document.execCommand('insertText', false, txt.replace(/\r?\n/g, ' '));
      return;
    }
    if (/^format(Bold|Italic|Underline|StrikeThrough|RemoveFormat)$/.test(t)) return;           // the toolbar's commands
    if (/^format/.test(t) || /^insert(OrderedList|UnorderedList|HorizontalRule|Link|FromYank)$/.test(t)) e.preventDefault();
  }, true);
  ['keydown', 'keyup', 'keypress'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      if (stackPop && stackPop.contains(e.target)) return;   // the picker handles its own keys
      if (editing) {
        if (inTools(e.target) || inCode(e.target) || inAi(e.target) || inAiPop(e.target)) return;   // the panels' inputs handle their own keys
        // keep the deck's shortcuts (arrows, space, Home/End…) from firing while typing
        e.stopPropagation();
        if (type !== 'keydown') return;
        var mod = e.ctrlKey || e.metaKey;
        if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
        else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
        else if (mod && e.shiftKey && (e.key === '>' || e.key === '.')) { e.preventDefault(); saveSelection(); format('bigger'); }
        else if (mod && e.shiftKey && (e.key === '<' || e.key === ',')) { e.preventDefault(); saveSelection(); format('smaller'); }
        else if (mod && !e.shiftKey && /^[biu]$/i.test(e.key)) {
          // Ctrl/Cmd+B/I/U: the browser formats a selection itself; with a collapsed caret apply to the whole text
          var tsel = window.getSelection();   // (not `sel`: that is the shape selection, and var hoists)
          if (tsel && tsel.isCollapsed) { e.preventDefault(); saveSelection(); format({ b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]); }
        }
        return;
      }
      if (svgEd && !(menu && !menu.hidden && menu.contains(document.activeElement))) {
        if (inTools(e.target) || inCode(e.target) || inAi(e.target) || inAiPop(e.target)) return;   // the panels' inputs handle their own keys
        e.stopPropagation();
        if (type !== 'keydown') return;
        var gs = e.shiftKey ? 10 : 1, gm = e.ctrlKey || e.metaKey, gp = svgPrimary(), gmulti = svgSel().length > 1;
        if (e.key === 'Escape') { e.preventDefault(); if (gdrag) finishSvgDrag(true); else if (gp) svgSelectPart(null, true); else svgEnd(); }
        else if (gm && (e.code === 'KeyA' || /^a$/i.test(e.key))) { e.preventDefault(); svgSelectAll(); }
        else if (e.key === 'Tab' && gmulti) { e.preventDefault(); toast('Tab / Shift+Tab step through the group of a single selected part.', 1500); }
        else if (e.key === 'Enter') { e.preventDefault(); svgEnd(); }
        else if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); var gg = gp && svgParentPart(gp); if (gg) { svgSelectPart(gg, true); toast('Enclosing group selected: ' + svgPartLabel(gg) + ' — Shift+Tab goes back in.', 2000); } else toast('No enclosing group.', 1500); }
        else if (e.key === 'Tab') { e.preventDefault(); var gk = gp ? svgChildParts(gp)[0] : svgParts(svgEd.svg)[0]; if (gk) { svgSelectPart(gk, true); toast('Inner part selected: ' + svgPartLabel(gk) + ' — Tab goes back out.', 2000); } else toast('No part inside this one.', 1500); }
        else if ((e.key === 'Delete' || e.key === 'Backspace') && gp) { e.preventDefault(); svgRemovePart(); }
        else if (gm && (e.code === 'KeyD' || /^d$/i.test(e.key)) && gp) { e.preventDefault(); svgDuplicatePart(); }
        else if (gm && (e.code === 'BracketRight' || e.key === ']' || e.key === '}')) { e.preventDefault(); svgOrder(e.shiftKey ? 'front' : 'forward'); }
        else if (gm && (e.code === 'BracketLeft' || e.key === '[' || e.key === '{')) { e.preventDefault(); svgOrder(e.shiftKey ? 'back' : 'backward'); }
        else if (gm && e.shiftKey && (e.code === 'KeyH' || /^h$/i.test(e.key))) { e.preventDefault(); if (codeIsOpen()) closeCode(); else openCode(gp || svgEd.svg); }
        else if (gm && e.shiftKey && (e.code === 'KeyO' || /^o$/i.test(e.key))) { e.preventDefault(); if (codeIsOpen() && codeTab === 'outline') closeCode(); else openCode(gp || svgEd.svg, 'outline'); }
        else if (gm && e.shiftKey && (e.code === 'KeyL' || /^l$/i.test(e.key))) { e.preventDefault(); if (aiIsOpen()) closeAi(); else openAi(); }
        else if (e.key === 'ArrowLeft' && gp) { e.preventDefault(); svgNudge(-gs, 0, e.altKey); }
        else if (e.key === 'ArrowRight' && gp) { e.preventDefault(); svgNudge(gs, 0, e.altKey); }
        else if (e.key === 'ArrowUp' && gp) { e.preventDefault(); svgNudge(0, -gs, e.altKey); }
        else if (e.key === 'ArrowDown' && gp) { e.preventDefault(); svgNudge(0, gs, e.altKey); }
        return;
      }
      if (shape && !(menu && !menu.hidden && menu.contains(document.activeElement))) {
        if (inShapeTools(e.target) || inCode(e.target) || inAi(e.target) || inAiPop(e.target)) return;   // the panels' inputs handle their own keys
        e.stopPropagation();
        if (type !== 'keydown') return;
        var step = e.shiftKey ? 10 : 1, mod2 = e.ctrlKey || e.metaKey;
        if (e.key === 'Escape') { e.preventDefault(); if (marquee) finishMarquee(e, true); else if (drag) finishDrag(true); else deselectShape(); }
        else if (e.key === 'Enter') { e.preventDefault(); deselectShape(); }
        else if (e.key === 'Tab' && sel.length > 1) { e.preventDefault(); toast('Tab / Shift+Tab step through the stack of a single selection.', 1500); }
        else if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); var p = parentShape(shape.el); if (p) { selectSolo(p, true); toast('Enclosing shape selected: ' + describe(p) + ' — Shift+Tab goes back in.', 2000); } else toast('No enclosing shape.', 1500); }
        else if (e.key === 'Tab') {
          // Shift+Tab: the child shape under the last pointer position, else the first child shape
          e.preventDefault();
          var kids = childShapes(shape.el), pt = lastPoint, hit = null;
          if (pt) shapeStack(pt.x, pt.y).forEach(function (x) { if (!hit && kids.indexOf(x) >= 0) hit = x; });
          var k = hit || kids[0];
          if (k) { selectSolo(k, true); toast('Inner shape selected: ' + describe(k) + (kids.length > 1 ? ' (one of ' + kids.length + ' — the toolbar’s Stack list has them all)' : '') + ' — Tab goes back out.', 2500); } else toast('No shape inside this one.', 1500);
        }
        else if (mod2 && (e.code === 'KeyA' || /^a$/i.test(e.key))) { e.preventDefault(); selectAllIn(null); }
        else if (mod2 && (e.code === 'KeyG' || /^g$/i.test(e.key))) { e.preventDefault(); if (e.shiftKey) ungroupSelection(); else groupSelection(); }
        else if (mod2 && (e.code === 'BracketRight' || e.key === ']' || e.key === '}')) { e.preventDefault(); reorder(e.shiftKey ? 'front' : 'forward'); }
        else if (mod2 && (e.code === 'BracketLeft' || e.key === '[' || e.key === '{')) { e.preventDefault(); reorder(e.shiftKey ? 'back' : 'backward'); }
        else if (mod2 && e.shiftKey && (e.code === 'KeyH' || /^h$/i.test(e.key))) { e.preventDefault(); if (codeIsOpen()) closeCode(); else openCode(shape.el); }
        else if (mod2 && e.shiftKey && (e.code === 'KeyO' || /^o$/i.test(e.key))) { e.preventDefault(); if (codeIsOpen() && codeTab === 'outline') closeCode(); else openCode(shape.el, 'outline'); }
        else if (mod2 && e.shiftKey && (e.code === 'KeyL' || /^l$/i.test(e.key))) { e.preventDefault(); if (aiIsOpen()) closeAi(); else openAi(); }
        else if (mod2 && !e.shiftKey && /^[biu]$/i.test(e.key) && textTargets().length) { e.preventDefault(); formatBlocks({ b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-step, 0, e.altKey); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); nudge(step, 0, e.altKey); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); nudge(0, -step, e.altKey); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); nudge(0, step, e.altKey); }
        return;
      }
      if (!menu || menu.hidden || !menu.contains(document.activeElement) || inEmbedded(document.activeElement)) return;
      e.stopPropagation();
      if (type !== 'keydown') return;
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        var items = Array.prototype.slice.call(menu.querySelectorAll('.nbg-head button, .nbg-mbody button'));
        var i = items.indexOf(document.activeElement);
        items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus({ preventScroll: true });
      }
    }, true);
  });
  window.addEventListener('resize', function () { if (menuHeld()) { if (menu && !menu.hidden) { clampMenu(); if (menuTab !== 'menu') applySplit(); } } else closeMenu(); });
  window.addEventListener('scroll', function () { if (!menuHeld()) closeMenu(); closeStackPop(); }, true);
  window.addEventListener('beforeunload', function () { if (editing) commitEdit(); });

  loadStored();
  syncToolbars();   // pinned toolbars (and a pinned structure / assistant panel) come back on load

  window.nbgDeck = {
    version: VERSION,
    pdf: { prepare: prepare, restore: restore, exportPdf: exportPdf },
    edit: {
      start: function (el) { return startEdit(el, false); }, commit: commitEdit, cancel: cancelEdit,
      isEditing: function () { return !!editing; }, list: function () { return edits.slice(); },
      format: format, buildEditedHtml: buildEditedHtml, save: saveEditedCopy, discard: discardEdits,
      discardSlide: discardSlideEdits, listFor: editsIn, slideAt: slideAtPoint,
    },
    shape: {
      select: selectShape, selectMany: selectShapes, add: addToSelection, remove: removeFromSelection, toggle: toggleSelection, solo: selectSolo,
      selectAll: function (slide) { return selectAllIn(slide || null); }, deselect: deselectShape,
      selected: function () { return shape ? shape.el : null; }, selection: function () { return sel.slice(); }, reset: resetShape,
      align: alignSelection, distribute: distributeSelection, order: reorder, group: groupSelection, ungroup: ungroupSelection,
      groupOf: groupId, shapesOf: slideShapes, stackAt: shapeStack, enclosing: ancestorShapes, inside: childShapes, selectInside: function (el) { return selectInside(0, 0, el); },
    },
    svg: {
      edit: svgEdit, end: svgEnd, isEditing: function () { return !!svgEd; }, target: function () { return svgEd ? svgEd.svg : null; },
      part: svgPrimary, selection: svgSel, select: function (p) { return svgSelectPart(p, true); }, selectMany: svgSelectMany, add: svgAddPart, remove: svgRemoveFromSelection, toggle: svgTogglePart, selectAll: svgSelectAll, selectInside: svgSelectInside,
      parts: svgParts, partAt: function (x, y) { return svgEd ? svgLeafAt(x, y, svgEd.svg) : null; },
      set: svgSet, text: svgSetText, geom: svgGeom, nudge: svgNudge, order: svgOrder, remove: svgRemovePart, duplicate: svgDuplicatePart, reset: svgReset,
      box: svgParentRect, ownerOf: svgOwner,
    },
    toolbars: { mode: function (k) { return ui[k]; }, set: setToolbarMode, visible: toolbarVisible, sync: syncToolbars, tab: function (k) { if (k !== undefined) setTbTab(k); return tbTab; }, applies: tbApplies, names: TOOLBAR_NAMES, fold: function (k, on) { if (on !== undefined) setFold(k, on); return !!ui.fold[k]; }, detach: detachPanel, reattach: reattachPanel, detached: function (k) { if (k === 'code' || k === 'ai') k = 'menu'; if (k === 'text' || k === 'shape') k = 'tools'; return isDetached(k) ? detached[k] : null; } },
    picker: { isOpen: stackPopOpen, close: closeStackPop },
    menu: { open: function (x, y) { openMenu(x === undefined ? window.innerWidth / 2 : x, y === undefined ? window.innerHeight / 2 : y, null, null); return true; }, close: function () { closeMenu(true); return true; }, isOpen: function () { return !!(menu && !menu.hidden); }, tab: function (t) { if (t !== undefined) setMenuTab(t); return menuTab; }, pinned: function (on) { if (on !== undefined && menu) { menuPinned = !!on; if (!menu.hidden) refreshMenu(); } return menuPinned; }, held: menuHeld, detach: function (w) { return detachPanel('menu', w); }, reattach: function () { return reattachPanel('menu'); } },
    ai: {
      open: openAi, close: closeAi, isOpen: aiIsOpen, view: function (v) { if (!ai) buildAi(); if (v) setAiView(v); return aiView; },
      send: aiSend, test: aiTest, settings: aiConfigure,
      prompts: { list: aiAllPrompts, get: aiPromptById, add: aiUpsertPrompt, update: aiUpsertPrompt, remove: aiRemovePrompt, select: aiSelectPrompt, selected: aiCurrentPrompt, builtin: function () { return AI_BUILTIN.slice(); } },
      attach: aiAttach, clearImage: function () { aiClip = null; layoutAi(); }, image: function () { return aiClip; },
      request: function (t) { if (!ai) buildAi(); if (typeof t === 'string') { ai.querySelector('[data-ai=req]').value = t; aiSettings.request = t; aiSaveSettings(); } return ai.querySelector('[data-ai=req]').value; },
      reply: function () { return aiReplyText; }, apply: function (text, el) { return aiApplyReply(el || aiTargets()[0], text); }, undo: aiUndo,
      capture: function (slide) { return aiCaptureSlide(slide || aiSlide()); }, hooks: function (h) { if (h && typeof h === 'object') { if ('capture' in h) aiHooks.capture = h.capture; if ('fetch' in h) aiHooks.fetch = h.fetch; } return aiHooks; },
      lastRequest: function () { return aiLast; }, providers: AI_PROVIDERS, system: function () { return AI_SYSTEM; }, modes: AI_MODE_TEXT,
      popup: { open: openAiPop, close: closeAiPop, isOpen: function () { return !!(aiPop && !aiPop.hidden); }, send: aiPopSend, target: function () { return aiPopEl; } },
    },
    code: {
      open: openCode, close: closeCode, isOpen: codeIsOpen, show: function (el) { return openCode(el, 'code'); }, tab: setTab, refresh: codeRefresh,
      target: function () { return codeEl; }, source: function () { return codeRaw ? codeRaw.value : ''; }, filter: function (q) { outFilter = q || ''; var i = code && code.querySelector('.nbg-oq'); if (i) i.value = outFilter; renderOutline(); },
      outlineRowOf: function (el) { return codeOut ? codeOut.querySelector('.nbg-tr[data-path="' + pathKey(el) + '"]') : null; },
      setSource: function (txt) { if (!code) return false; codeRaw.value = txt; rawDirty = true; rawFor = rawFor || codeEl; return true; },
      apply: applyRaw, revert: revertRaw, rowOf: function (el) { return codeTree ? codeTree.querySelector('.nbg-tr[data-path="' + pathKey(el) + '"]:not([data-text])') : null; },
    },
    config: { mode: PAGE_MODE ? 'page' : 'deck', root: ROOT_SEL, unit: UNIT, title: TITLE }, roots: allRoots,
    resolveTextTarget: resolveTextTarget, resolveShapeTarget: resolveShapeTarget,
  };
  window.nbgPdf = { prepare: prepare, restore: restore, exportPdf: exportPdf, version: VERSION };
})();
