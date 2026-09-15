#!/usr/bin/env node
// NBG Design — export an HTML deck to PDF with no change in aesthetics.
//
// The deck is opened in headless Chrome/Chromium/Edge and printed through the DevTools
// protocol (talked over --remote-debugging-pipe, so there is no dependency to install).
// Before printing, the shared print-layout shim (lib/print-layout.js — the same code the
// in-deck right-click menu uses) is evaluated inside the page. It turns the interactive
// deck into a print layout WITHOUT touching its design:
//
//   - every top-level `.slide` becomes visible (the `.active` / `.hidden` toggles, inline
//     display/opacity/visibility and [hidden] attributes used by deck navigation are lifted);
//   - the viewport-fit machinery (scaled `#deck` / `.slide-wrap`, fixed `#stage`, flex
//     centering) is neutralised so each slide sits in normal flow at its native artboard
//     size — the slide's own CSS, fonts, colours and embedded images are left untouched;
//   - navigation chrome outside the slides (buttons, counters, menus) is hidden;
//   - CSS animations/transitions jump to their end state, background colours and images
//     are forced to print (`print-color-adjust: exact`), and web fonts/images are awaited;
//   - the PDF page size is set to the slide's own box (normally 1920x1080 px = 20 x 11.25 in
//     at 96 dpi) with zero margins and one slide per page, so text stays vector/selectable.
//
// Before writing the file, Chrome's luminosity soft masks (every blurred box-shadow) are
// re-anchored to page space (lib/pdf-soft-masks.mjs): macOS Preview / Quick Look / Safari
// otherwise clip them to the top-left corner of the page and paint the rest of each shadow
// as a solid gray block. The rewrite changes coordinate bookkeeping only — the rendering is
// pixel-identical in Chrome, Acrobat, Firefox and poppler — and is appended as an incremental
// update. `--keep-soft-masks` leaves the PDF exactly as Chrome wrote it.
//
// After writing the file the script verifies the PDF page count equals the slide count and
// exits non-zero on a mismatch (a slide taller than its page spills to an extra page; a
// slide that could not be detected is missing). Zero dependencies. Node >= 18.
//
// Exit: 0 = PDF written and verified, 1 = error / verification failure, 3 = no browser found.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findBrowser, NO_BROWSER_EXIT_CODE } from './lib/find-browser.mjs';
import { launchBrowser, openPage, navigate, evaluate, printToPdf, countPdfPages } from './lib/cdp.mjs';
import { fixLuminosityMasks, UnsupportedPdfError } from './lib/pdf-soft-masks.mjs';

const PRINT_LAYOUT_SRC = readFileSync(new URL('./lib/print-layout.js', import.meta.url), 'utf8');

const USAGE = `NBG deck PDF exporter (needs a browser; vector output, one page per slide)
Usage: node export-pdf.mjs <deck.html> [-o <out.pdf>] [--size WxH] [--selector <css>]
                                     [--settle <ms>] [--timeout <ms>] [--browser <path>]
                                     [--debug-html <path>] [--keep-soft-masks]

  -o, --out          Output PDF path (default: next to the deck, same name, .pdf).
  --size WxH         Force the page size in CSS px (default: the measured box of slide 1,
                     normally 1920x1080). Use only when the deck's slide box is wrong.
  --selector <css>   Slide selector (default ".slide"; nested matches are ignored).
  --settle <ms>      Extra wait after fonts/images are ready, before printing (default 400).
  --timeout <ms>     Overall timeout for the browser session (default 120000).
  --browser <path>   Explicit browser binary (else auto-detect; or env NBG_BROWSER / CHROME_BIN).
  --debug-html       Write the prepared (print-layout) DOM to this path for inspection.
  --keep-soft-masks  Do not re-anchor Chrome's soft masks (shadows) for macOS Preview; keep
                     the PDF byte for byte as Chrome wrote it.

Exit: 0 = PDF written and verified, 1 = error / verification failure, 3 = no browser found.`;

function parseArgs(argv) {
  const a = { _: [], settle: 400, timeout: 120000, selector: '.slide' };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '-o' || x === '--out') a.out = argv[++i];
    else if (x === '--size') a.size = argv[++i];
    else if (x === '--selector') a.selector = argv[++i];
    else if (x === '--settle') a.settle = parseInt(argv[++i], 10);
    else if (x === '--timeout') a.timeout = parseInt(argv[++i], 10);
    else if (x === '--browser') a.browser = argv[++i];
    else if (x === '--debug-html') a.debugHtml = argv[++i];
    else if (x === '--keep-soft-masks') a.keepSoftMasks = true;
    else if (x === '-h' || x === '--help') a.help = true;
    else a._.push(x);
  }
  return a;
}

async function exportPdf(args) {
  const deck = resolve(process.cwd(), args._[0]);
  if (!existsSync(deck)) throw new Error('not found: ' + deck);
  const out = resolve(process.cwd(), args.out || join(dirname(deck), basename(deck).replace(/\.html?$/i, '') + '.pdf'));

  let size = null;
  if (args.size) {
    const [w, h] = args.size.toLowerCase().split('x').map((n) => parseInt(n, 10));
    if (!w || !h) throw new Error(`bad --size "${args.size}" (expected WxH in px)`);
    size = [w, h];
  }

  const browser = findBrowser(args.browser);
  if (browser && browser.error) throw new Error(browser.error);
  if (!browser) return { noBrowser: true };

  const { cdp, exited, close } = launchBrowser(browser);
  const deadline = new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out after ${args.timeout} ms`)), args.timeout).unref());

  const work = (async () => {
    const { sessionId } = await openPage(cdp);
    await navigate(cdp, sessionId, pathToFileURL(deck).href, args.timeout);

    // The exporter always uses its own copy of the shim (deterministic, current version). If the
    // deck carries the in-deck menu, __nbgPdfExternal tells its beforeprint/afterprint hooks to
    // stay idle while we print.
    // rasterShadows:false — the exporter keeps Chrome's exact vector shadows and repairs their soft
    // masks in the PDF (lib/pdf-soft-masks.mjs); only the in-deck print path rasterises them.
    const expr = `(async () => { window.__nbgPdfExternal = true; ${PRINT_LAYOUT_SRC}\n return nbgPreparePrintLayout(${JSON.stringify({ selector: args.selector, size, rasterShadows: false })}); })()`;
    let diag;
    try { diag = await evaluate(cdp, sessionId, expr); }
    catch (e) { throw new Error('print shim failed: ' + e.message); }
    if (!diag.slides) throw new Error(`no slides detected (${diag.notes.join('; ')}) — pass --selector if the deck does not use .slide`);
    if (!diag.page) throw new Error(`could not size the page (${diag.notes.join('; ')})`);

    if (args.settle > 0) await new Promise((r) => setTimeout(r, args.settle));

    if (args.debugHtml) {
      const dump = await evaluate(cdp, sessionId, 'document.documentElement.outerHTML');
      writeFileSync(resolve(process.cwd(), args.debugHtml), dump, 'utf8');
    }

    const printed = await printToPdf(cdp, sessionId, diag.page);
    // Re-anchor the soft masks (shadows) so macOS Preview renders them; see lib/pdf-soft-masks.mjs.
    let buf = printed;
    const softMasks = { rewritten: 0, skipped: [], kept: !!args.keepSoftMasks, error: null };
    if (!args.keepSoftMasks) {
      try { const r = fixLuminosityMasks(printed); buf = r.buf; softMasks.rewritten = r.rewritten; softMasks.skipped = r.skipped; }
      catch (e) { if (!(e instanceof UnsupportedPdfError)) throw e; softMasks.error = e.message; }
    }
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, buf);
    try { await cdp.send('Browser.close'); } catch { /* already gone */ }
    return { out, buf, diag, softMasks };
  })();

  try {
    return await Promise.race([work, deadline, exited]);
  } finally {
    close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args._.length !== 1) { console.log(USAGE); process.exit(args.help ? 0 : 2); }

  let r;
  try { r = await exportPdf(args); }
  catch (e) { console.error('export-pdf ERROR: ' + e.message); process.exit(1); }

  if (r.noBrowser) {
    console.error('No Chrome/Chromium/Edge binary found — PDF export needs a browser engine.');
    console.error('  Install Chrome/Chromium on this host, or set NBG_BROWSER / CHROME_BIN, or pass --browser <path>.');
    console.error('  The HTML deck itself remains the deliverable; export the PDF on a host that has a browser.');
    process.exit(NO_BROWSER_EXIT_CODE);
  }

  const { out, buf, diag, softMasks } = r;
  const pages = countPdfPages(buf);
  const kb = Math.round(buf.length / 1024);
  console.log(`\nNBG deck PDF export — ${out}`);
  console.log(`  slides: ${diag.slides} | pages: ${pages} | page box: ${diag.page.width}x${diag.page.height} px (${(diag.page.width / 96).toFixed(2)} x ${(diag.page.height / 96).toFixed(2)} in) | size: ${kb.toLocaleString()} KB`);
  console.log(`  host layer neutralised: ${diag.ancestors} wrapper(s), ${diag.hiddenElements} non-slide element(s) hidden, ${diag.forcedDisplay} slide(s) force-shown`);
  if (softMasks.kept) console.log('  soft masks kept as Chrome wrote them (--keep-soft-masks): shadows may show as gray blocks in macOS Preview');
  else if (softMasks.error) console.log(`  ! Preview-compatibility rewrite skipped (${softMasks.error}) — the PDF is as Chrome wrote it; fine in Chrome/Acrobat, shadows may show as gray blocks in macOS Preview`);
  else console.log(`  soft masks re-anchored for macOS Preview: ${softMasks.rewritten}${softMasks.skipped.length ? ` (${softMasks.skipped.length} left as written: ${[...new Set(softMasks.skipped.map((s) => s.reason))].join('; ')})` : ''}`);

  const problems = [];
  if (diag.page.width !== 1920 || diag.page.height !== 1080) {
    console.log(`  ! page box is not the NBG 1920x1080 artboard — kept as authored (${diag.page.width}x${diag.page.height}).`);
  }
  if (diag.sizeMismatch.length) {
    problems.push(`slide box differs from the page box on slide(s) ${diag.sizeMismatch.map((m) => `${m.slide} (${m.width}x${m.height})`).join(', ')} — fix the slide sizing in the deck; slides are never resized by the exporter.`);
  }
  if (pages !== diag.slides) {
    problems.push(`PDF has ${pages} page(s) for ${diag.slides} slide(s) — a slide that overflows its box spills onto extra pages, an undetected slide is missing.`);
  }
  if (diag.notes.length) diag.notes.forEach((n) => console.log('  ! ' + n));

  if (problems.length) {
    console.log('\nProblems:'); problems.forEach((p) => console.log('  ✗ ' + p));
    console.log('\nRESULT: FAIL — the PDF was written but does not match the deck; fix the deck and re-export.\n');
    process.exit(1);
  }
  console.log('\nRESULT: PASS — one page per slide at the native artboard size, vector text, backgrounds and embedded images preserved.');
  console.log('Now rasterise and READ a few pages (e.g. `pdftoppm -r 72 -png <out.pdf> <prefix>`) and compare them with the browser screenshots before delivery.\n');
  process.exit(0);
}

main();
