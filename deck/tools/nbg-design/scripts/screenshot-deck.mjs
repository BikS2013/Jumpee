#!/usr/bin/env node
// NBG Design — optional headless screenshot helper.
//
// Captures one PNG per slide at the skill's required viewports, for visual inspection
// before delivery. This is the OPTIONAL companion to verify-deck.mjs: it only runs when a
// Chrome/Chromium/Edge binary is available. On a display-less host with no browser it exits
// with code 3 (a soft signal) — in that case verify-deck.mjs --strict is the mandatory gate.
//
// It navigates slides generically by injecting a tiny shim into a temp copy of the deck:
// on load / hashchange it shows slide N via window.showSlide / window.gotoSlide if present,
// otherwise by toggling `.active` on the Nth `.slide` (and lifting a `.hidden` toggle when the
// deck uses one). So it works for hash-based, showSlide-based and class-toggle decks without
// the deck needing changes. The browser locator is shared with export-pdf.mjs (lib/find-browser.mjs).
//
// Zero dependencies. Any Node >= 16. The agent still must READ the PNGs and judge them —
// this script only produces the images.

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { findBrowser, NO_BROWSER_EXIT_CODE } from './lib/find-browser.mjs';

const USAGE = `NBG deck screenshot helper (optional, needs a browser)
Usage: node screenshot-deck.mjs <deck.html> [-o <dir>] [--viewports WxH,WxH] [--slides 1,2,5] [--browser <path>]

  -o, --out         Output directory (default: test_scripts/screenshots in the cwd).
  --viewports       Comma list of WxH (default: 1366x768,1440x900 — the skill's required sizes).
  --slides          Comma list of 1-based slide numbers (default: all detected slides).
  --browser <path>  Explicit browser binary (else auto-detect; or set env NBG_BROWSER / CHROME_BIN).

Exit: 0 = screenshots written, 1 = error, 3 = no browser found (use verify-deck.mjs instead).`;

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '-o' || x === '--out') a.out = argv[++i];
    else if (x === '--viewports') a.viewports = argv[++i];
    else if (x === '--slides') a.slides = argv[++i];
    else if (x === '--browser') a.browser = argv[++i];
    else if (x === '-h' || x === '--help') a.help = true;
    else a._.push(x);
  }
  return a;
}

const SHIM = `
<style>.nbg-shot-hidden{display:none!important}</style>
<script>/* nbg screenshot-deck shim */
(function(){
  function topSlides(){
    return Array.prototype.filter.call(document.querySelectorAll('.slide'), function(el){
      return !(el.parentElement && el.parentElement.closest('.slide'));
    });
  }
  function go(n){
    // 1. let the deck's own navigation run first, if it exposes one
    try { if (typeof window.showSlide === 'function') window.showSlide(n); } catch(e){}
    try { if (typeof window.gotoSlide === 'function') window.gotoSlide(n); } catch(e){}
    // 2. then force the Nth top-level slide to be the only visible one, IN PLACE, so the
    //    deck's own scaling/centering wrapper still applies (works for .active toggles,
    //    .hidden toggles, inline display toggles, and stacked scrolling decks alike)
    var s = topSlides();
    s.forEach(function(el,i){
      var on = (i === n-1);
      el.classList.toggle('nbg-shot-hidden', !on);
      el.classList.toggle('active', on);
      if (el.classList.contains('hidden') && on) el.classList.remove('hidden');
      if (on) { el.removeAttribute('hidden'); ['display','opacity','visibility'].forEach(function(p){ el.style.removeProperty(p); });
        if (getComputedStyle(el).display === 'none') el.style.setProperty('display','block','important'); }
    });
    if (typeof window.scaleSlide === 'function') { try { window.scaleSlide(); } catch(e){} }
    window.scrollTo(0,0);
  }
  function cur(){ var h=(location.hash||'').replace(/[^0-9]/g,''); return parseInt(h,10)||1; }
  // run after the deck's own load handlers (this script is appended last) and once more on the next frame
  window.addEventListener('load', function(){ go(cur()); requestAnimationFrame(function(){ go(cur()); }); });
  window.addEventListener('hashchange', function(){ go(cur()); });
})();
</script>`;

function countSlides(html) {
  // exact class token `slide` only — `slide-title` / `slide-footer` must not count as slides
  const m = html.match(/class\s*=\s*["'](?:[^"']*\s)?slide(?:\s[^"']*)?["']/g);
  return m ? m.length : 1;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args._.length !== 1) { console.log(USAGE); process.exit(args.help ? 0 : 2); }

  const deck = resolve(process.cwd(), args._[0]);
  if (!existsSync(deck)) { console.error('screenshot ERROR: not found: ' + deck); process.exit(1); }

  const browser = findBrowser(args.browser);
  if (browser && browser.error) { console.error('screenshot ERROR: ' + browser.error); process.exit(1); }
  if (!browser) {
    console.error('No Chrome/Chromium/Edge binary found.');
    console.error('  This host appears to have no browser. Screenshot verification is skipped.');
    console.error('  Run the mandatory static gate instead: node verify-deck.mjs <deck>.html --strict');
    console.error('  (Or set NBG_BROWSER / CHROME_BIN, or pass --browser <path>.)');
    process.exit(NO_BROWSER_EXIT_CODE);
  }

  const outDir = resolve(process.cwd(), args.out || join('test_scripts', 'screenshots'));
  mkdirSync(outDir, { recursive: true });

  const viewports = (args.viewports || '1366x768,1440x900').split(',').map((s) => {
    const [w, h] = s.toLowerCase().split('x').map((n) => parseInt(n, 10));
    if (!w || !h) { console.error(`screenshot ERROR: bad viewport "${s}"`); process.exit(1); }
    return { w, h };
  });

  const html = readFileSync(deck, 'utf8');
  const total = countSlides(html);
  const slides = args.slides
    ? args.slides.split(',').map((n) => parseInt(n, 10)).filter(Boolean)
    : Array.from({ length: total }, (_, i) => i + 1);

  // temp copy with the navigation shim injected before the LAST </body> (a deck may mention
  // "</body>" earlier inside an HTML comment; injecting there would silently disable the shim)
  const bodyEnd = html.lastIndexOf('</body>');
  const shimmed = bodyEnd >= 0 ? html.slice(0, bodyEnd) + SHIM + '\n' + html.slice(bodyEnd) : html + SHIM;
  const tmp = join(tmpdir(), `nbg-shoot-${process.pid}-${Date.now()}-${basename(deck)}`);
  writeFileSync(tmp, shimmed, 'utf8');

  const base = basename(deck).replace(/\.html?$/i, '');
  const written = [];
  console.log(`Browser: ${browser}`);
  console.log(`Deck: ${deck} (${total} slide(s))`);
  console.log(`Capturing slides [${slides.join(', ')}] at ${viewports.map((v) => v.w + 'x' + v.h).join(', ')} -> ${outDir}\n`);

  try {
    for (const v of viewports) {
      for (const n of slides) {
        const out = join(outDir, `${base}-s${n}-${v.w}x${v.h}.png`);
        const r = spawnSync(browser, [
          '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
          '--virtual-time-budget=2500', `--window-size=${v.w},${v.h}`,
          `--screenshot=${out}`, `file://${tmp}#${n}`,
        ], { encoding: 'utf8', timeout: 60000 });
        if (r.status === 0 && existsSync(out)) { written.push(out); console.log('  ✓ ' + out); }
        else { console.log(`  ✗ slide ${n} @ ${v.w}x${v.h} failed (${r.status})`); }
      }
    }
  } finally {
    try { unlinkSync(tmp); } catch { /* ignore */ }
  }

  console.log(`\nWrote ${written.length}/${slides.length * viewports.length} screenshot(s).`);
  console.log('Now READ each PNG and inspect for clipping, overflow, element overlap, missing logo/photos, and brand alignment.');
  process.exit(written.length ? 0 : 1);
}

main();
