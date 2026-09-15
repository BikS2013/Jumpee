#!/usr/bin/env node
// NBG Design — browser-free pre-delivery gate for HTML decks.
//
// This is the safety net that survives a headless / SSH / Linux run, where no browser
// or display is available to screenshot the deck. It is a static check of the HTML.
//
// HARD failures (always exit 1):
//   - unresolved {{TOKEN}} placeholders (embed step not run)
//   - any image reference (src= / url(...) / background-image) using file://, an absolute
//     path, a relative path, or http(s):// instead of an inline data: URI
//   - zero embedded data:image/ assets (logo + photography missing entirely)
//
// In --strict mode these ALSO fail (exit 1); otherwise they are reported as warnings:
//   - fewer than --min-images embedded images (default 2)
//   - file smaller than --min-bytes (default 200000) — a photo-less deck is the classic tell
//   - bare ">NBG<" / ">NPG<" / ">BikS2013<" text nodes (a likely text/box substitute for the logo lockup)
//
// Run with --strict before delivery. Zero dependencies; any Node >= 16.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const USAGE = `NBG deck verifier (browser-free)
Usage: node verify-deck.mjs <deck.html> [--strict] [--min-images N] [--min-bytes N]

  --strict          Promote warnings (image count, file size, bare NBG / BikS2013 text) to failures.
                    Use this before delivering any deck.
  --min-images N    Minimum embedded images expected (default 2).
  --min-bytes N     Minimum file size in bytes (default 200000).
  --no-deck-menu    Do not require the in-deck right-click menu (Edit text / Export to PDF /
                    Save edited copy) — only when the user explicitly declined it.

Exit code 0 = pass, 1 = fail.`;

function parseArgs(argv) {
  const a = { _: [], strict: false, minImages: 2, minBytes: 200000, noDeckMenu: false };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--strict') a.strict = true;
    else if (x === '--no-deck-menu' || x === '--no-pdf-menu') a.noDeckMenu = true;
    else if (x === '--min-images') a.minImages = parseInt(argv[++i], 10);
    else if (x === '--min-bytes') a.minBytes = parseInt(argv[++i], 10);
    else if (x === '-h' || x === '--help') a.help = true;
    else a._.push(x);
  }
  return a;
}

const TOKEN_RE = /\{\{([A-Z0-9_]+)\}\}/g;
// captures src="...", url(...), background-image:url(...) — quoted or unquoted
const REF_RE = /(?:src\s*=\s*|url\(\s*|background-image\s*:\s*url\(\s*)(["']?)([^"')]+)\1/gi;
const FORBIDDEN = /^(file:\/\/|https?:\/\/|\/|\.\.?\/|[A-Za-z]:\\)/;

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args._.length !== 1) { console.log(USAGE); process.exit(args.help ? 0 : 2); }

  const file = resolve(process.cwd(), args._[0]);
  if (!existsSync(file)) { console.error('verify ERROR: not found: ' + file); process.exit(1); }

  const html = readFileSync(file, 'utf8');
  const lines = html.split('\n');
  const hard = [];
  const warn = [];

  // 1 — unresolved tokens
  const toks = [...new Set([...html.matchAll(TOKEN_RE)].map((m) => m[0]))];
  if (toks.length) hard.push(`Unresolved placeholder tokens: ${toks.join(', ')} — run embed-assets.mjs first.`);

  // 2 — forbidden (non-embedded) image references
  const bad = new Set();
  let m;
  while ((m = REF_RE.exec(html))) {
    const val = m[2].trim();
    if (/^data:/i.test(val) || /^#/.test(val)) continue;            // data URI or in-page fragment — OK
    if (FORBIDDEN.test(val) || /(^|\/)assets\//i.test(val)) bad.add(val.slice(0, 80));
  }
  if (bad.size) {
    hard.push(`Non-embedded image reference(s) — must be inline data: URIs: ${[...bad].slice(0, 8).join('  |  ')}`);
  }

  // 3 — zero embedded images
  const imgCount = (html.match(/data:image\//g) || []).length;
  if (imgCount === 0) hard.push('No embedded data:image/ assets found — the logo and photography are missing.');

  // 4 / 5 / 6 — soft (or strict) signals
  if (imgCount < args.minImages) {
    warn.push(`Only ${imgCount} embedded image(s) (expected >= ${args.minImages}). A real deck embeds the logo plus photography.`);
  }
  const bytes = Buffer.byteLength(html, 'utf8');
  if (bytes < args.minBytes) {
    warn.push(`Deck is ${bytes.toLocaleString()} bytes (< ${args.minBytes.toLocaleString()}). A photo-less deck is the classic "assets not embedded" tell.`);
  }
  const nbgText = [];
  lines.forEach((ln, i) => { if (/>\s*(NBG|NPG|BikS2013|BikS)\s*</.test(ln)) nbgText.push(i + 1); });
  if (nbgText.length) {
    warn.push(`${nbgText.length} bare ">NBG/NPG/BikS2013<" text node(s) at line(s) ${nbgText.slice(0, 12).join(', ')}${nbgText.length > 12 ? '…' : ''} — verify none is a text/box substitute for the bundled logo lockup.`);
  }

  // 7 — in-deck right-click menu: Edit text / Export to PDF / Save edited copy (added by add-deck-menu.mjs)
  if (!args.noDeckMenu) {
    const current = (html.match(/<script id="nbg-deck-menu-script" data-nbg-deck-menu="(\d+)">/) || [])[1];
    const legacy = (html.match(/<script id="nbg-pdf-menu-script" data-nbg-pdf-menu="(\d+)">/) || [])[1];
    if (!current && !legacy) warn.push('Right-click deck menu (Edit text / Export to PDF) missing — run add-deck-menu.mjs on the deck (or pass --no-deck-menu if the user declined it).');
    else if (!current) warn.push(`Deck carries the older PDF-only menu (v${legacy}) — run add-deck-menu.mjs to upgrade to the menu with in-place text editing.`);
    else if (!html.includes('function nbgPreparePrintLayout') || !html.includes('window.nbgDeck')) {
      hard.push('The nbg-deck-menu block is present but incomplete — re-run add-deck-menu.mjs.');
    } else {
      // the skill's current menu version (read from the bundled source; absent when only verify-deck.mjs travelled)
      let latest = null;
      try { latest = (readFileSync(new URL('./lib/deck-menu.js', import.meta.url), 'utf8').match(/var VERSION = (\d+);/) || [])[1]; } catch { /* optional */ }
      if (latest && parseInt(current, 10) < parseInt(latest, 10)) {
        warn.push(`Deck menu block is v${current}; the skill ships v${latest} — run add-deck-menu.mjs to upgrade (it replaces the block in place).`);
      }
    }
  }

  // report
  console.log(`\nNBG deck verification — ${file}`);
  console.log(`  embedded images: ${imgCount} | size: ${bytes.toLocaleString()} bytes | strict: ${args.strict}`);

  if (hard.length) { console.log('\nHARD issues:'); hard.forEach((h) => console.log('  ✗ ' + h)); }

  if (warn.length) {
    if (args.strict) { console.log('\nStrict failures (warnings promoted):'); warn.forEach((w) => console.log('  ✗ ' + w)); }
    else { console.log('\nWarnings:'); warn.forEach((w) => console.log('  ! ' + w)); }
  }

  const failures = hard.length + (args.strict ? warn.length : 0);
  if (failures) { console.log(`\nRESULT: FAIL (${failures} issue(s))\n`); process.exit(1); }
  console.log(`\nRESULT: PASS${warn.length ? ` (${warn.length} warning(s))` : ''}\n`);
  process.exit(0);
}

main();
