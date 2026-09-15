#!/usr/bin/env node
// NBG Design — inline the in-deck right-click menu ("Edit text", "Export to PDF", "Save edited
// copy") into an HTML deck.
//
// Injects ONE <script id="nbg-deck-menu-script" data-nbg-deck-menu="<version>"> before the last
// </body>, containing lib/print-layout.js (the print-layout shim shared with export-pdf.mjs)
// followed by lib/deck-menu.js (the menu UI, in-place text editing, print orchestration). The
// deck stays fully self-contained. Idempotent: an existing block (including the v1
// "nbg-pdf-menu-script" block) is replaced, so re-running upgrades an older menu; the block's
// configuration (window.nbgDeckMenuConfig, if any) is carried over. Zero deps.
//
// Programmatic use: addMenu(html, config) / buildMenuBlock(config) accept an optional configuration
// object that the block writes as `window.nbgDeckMenuConfig = {...};` before the library, so the
// same editor works on documents that are not decks (see lib/deck-menu.js, "Configuration"):
// { mode: 'deck' | 'page', root: '<css selector>', unit: '<label>', title: '<label>', aiSystem: '…' }.
// The CLI has no flags for it — a deck gets the default ('.slide', deck mode); the html-editor skill
// in the development workspace is the CLI for pages.
//
// Exit: 0 = menu present (added / upgraded / already current), 1 = error.

import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const USAGE = `NBG deck — add the right-click menu (Edit text / Export to PDF / Save edited copy)
Usage: node add-deck-menu.mjs <deck.html> [-o <out.html>] [--theme <nbg|biks2013>] [--remove]

  -o, --out   Write to a new file (default: overwrite in place).
  --theme     The deck's theme (default nbg): the toolbars' swatches, the editor's accent colours, the
              assistant's prompts and the menu title follow it. Re-running keeps the theme recorded earlier.
  --remove    Strip the menu block instead of adding it.

Exit code 0 = done, 1 = error.`;

// The script block id must differ from the runtime elements the UI creates (#nbg-deck-menu, #nbg-deck-toast).
export const MENU_SCRIPT_ID = 'nbg-deck-menu-script';
export const BLOCK_RE = /<script id="nbg-(?:pdf|deck)-menu(?:-script)?" data-nbg-(?:pdf|deck)-menu="(\d+)">[\s\S]*?<\/script>\s*/;

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '-o' || x === '--out') a.out = argv[++i];
    else if (x === '--remove') a.remove = true;
    else if (x === '--theme') a.theme = argv[++i];
    else if (x === '-h' || x === '--help') a.help = true;
    else a._.push(x);
  }
  return a;
}

const CONFIG_KEYS = ['mode', 'root', 'unit', 'title', 'aiSystem', 'theme'];
export const THEMES = ['nbg', 'biks2013'];

// The configuration prelude: only the known string keys, or nothing at all (a deck keeps the defaults).
export function buildConfigPrelude(config) {
  if (config === undefined || config === null) return '';
  if (typeof config !== 'object' || Array.isArray(config)) throw new Error('menu config must be an object');
  const clean = {};
  for (const k of Object.keys(config)) {
    if (!CONFIG_KEYS.includes(k)) throw new Error(`unknown menu config key "${k}" (known: ${CONFIG_KEYS.join(', ')})`);
    const v = config[k];
    if (v === undefined || v === null || v === '') continue;
    if (typeof v !== 'string') throw new Error(`menu config "${k}" must be a string`);
    clean[k] = v;
  }
  if (clean.mode && clean.mode !== 'deck' && clean.mode !== 'page') throw new Error(`menu config mode must be "deck" or "page", not "${clean.mode}"`);
  if (clean.theme && !THEMES.includes(clean.theme)) throw new Error(`menu config theme must be one of , not ""`);
  if (!Object.keys(clean).length) return '';
  const json = JSON.stringify(clean).replace(/</g, '\\u003c');   // never a "</script" inside the block
  return `window.nbgDeckMenuConfig = ${json};\n`;
}

export function buildMenuBlock(config) {
  const layout = readFileSync(new URL('./lib/print-layout.js', import.meta.url), 'utf8');
  const menu = readFileSync(new URL('./lib/deck-menu.js', import.meta.url), 'utf8');
  const version = (menu.match(/var VERSION = (\d+);/) || [])[1];
  if (!version) throw new Error('lib/deck-menu.js has no VERSION marker');
  for (const src of [layout, menu]) {
    if (/<\/script/i.test(src)) throw new Error('menu sources must not contain "</script"');
  }
  const prelude = buildConfigPrelude(config);
  const what = prelude && /"mode":"page"/.test(prelude) ? 'NBG page editor — right-click menu: Edit text / Print / Save edited copy' : 'NBG deck — right-click menu: Edit text / Export to PDF / Save edited copy';
  return {
    version,
    block: `<script id="${MENU_SCRIPT_ID}" data-nbg-deck-menu="${version}">\n/* ${what} (nbg-design skill, add-deck-menu.mjs). Do not edit by hand. */\n${prelude}${layout}\n${menu}\n</script>\n`,
  };
}

export function addMenu(html, config) {
  const { block, version } = buildMenuBlock(config);
  const existing = html.match(BLOCK_RE);
  let status;
  if (existing) {
    if (existing[1] === version && html.includes(block)) return { html, status: 'already current', version };
    html = html.replace(BLOCK_RE, '');
    status = existing[1] === version ? 'refreshed' : `upgraded from v${existing[1]}`;
  } else status = 'added';
  const bodyEnd = html.lastIndexOf('</body>');
  const out = bodyEnd >= 0 ? html.slice(0, bodyEnd) + block + html.slice(bodyEnd) : html + block;
  return { html: out, status, version };
}

// The configuration a block carries (null when it has none / is absent).
export function readMenuConfig(html) {
  const m = html.match(BLOCK_RE);
  if (!m) return null;
  const c = m[0].match(/\nwindow\.nbgDeckMenuConfig = (\{[^\n]*\});\n/);
  if (!c) return null;
  try { return JSON.parse(c[1]); } catch { return null; }
}

export function removeMenu(html) {
  const existing = html.match(BLOCK_RE);
  return { html: existing ? html.replace(BLOCK_RE, '') : html, status: existing ? 'removed' : 'not present' };
}

export function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args._.length !== 1) { console.log(USAGE); process.exit(args.help ? 0 : 2); }
  const file = resolve(process.cwd(), args._[0]);
  if (!existsSync(file)) { console.error('add-deck-menu ERROR: not found: ' + file); process.exit(1); }
  const out = args.out ? resolve(process.cwd(), args.out) : file;
  try {
    const html = readFileSync(file, 'utf8');
    // Re-running on a file that already carries a block keeps that block's configuration (page mode,
    // root, labels) — an update never turns a configured page back into a default deck.
    const carried = readMenuConfig(html);
    const config = args.theme ? { ...(carried || {}), theme: args.theme } : (carried || undefined);
    const r = args.remove ? removeMenu(html) : addMenu(html, config);
    writeFileSync(out, r.html, 'utf8');
    console.log(`${args.remove ? 'deck menu' : `deck menu v${r.version}`}: ${r.status} → ${out}`);
    process.exit(0);
  } catch (e) {
    console.error('add-deck-menu ERROR: ' + e.message);
    process.exit(1);
  }
}

// Run as a CLI only when invoked directly. Compare REAL paths: skills are commonly reached through a
// symlink (e.g. <project>/.claude/skills/nbg-design -> the plugin checkout), and then process.argv[1]
// is the symlinked path while import.meta.url is the resolved one — a plain comparison silently
// skips main() and the deck gets no menu.
function isMainModule() {
  if (!process.argv[1]) return false;
  const here = fileURLToPath(import.meta.url);
  const invoked = resolve(process.argv[1]);
  try { return realpathSync(invoked) === realpathSync(here); } catch { return invoked === here; }
}
if (isMainModule()) main();
