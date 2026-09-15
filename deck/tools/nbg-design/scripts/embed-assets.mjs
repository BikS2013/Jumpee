#!/usr/bin/env node
// NBG Design — deterministic asset embedder.
//
// Replaces {{TOKEN}} placeholders in an HTML deck with the VERBATIM contents of the
// matching bundled data-URI asset (NBG-Design/assets/<token>.datauri.txt).
//
// Why this exists: pasting 200KB–860KB base64 blobs by hand is the step that fails in
// non-interactive runs (e.g. `claude -p` over SSH). The model "approximates" a photo
// with a gradient or substitutes a text/box logo. This script removes that judgement
// call: author the deck with tokens, run this, and every asset is embedded exactly.
//
// The assets directory is resolved RELATIVE TO THIS SCRIPT (the skill root), never the
// current working directory — so it works from any cwd and on any machine, including a
// headless Linux box reached over SSH.
//
// Zero dependencies. Runs on any Node >= 16.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, '..');                       // scripts/ -> skill root
const THEMES = { nbg: 'NBG-Design', biks2013: 'BikS2013-Design' };   // theme -> its folder in the skill (SKILL.md "Themes")
const DEFAULT_ASSETS = resolve(SKILL_ROOT, THEMES.nbg, 'assets');

const USAGE = `NBG asset embedder
Usage: node embed-assets.mjs <deck.html> [-o <out.html>] [--theme <nbg|biks2013>] [--assets <dir>]

  <deck.html>     HTML deck containing {{TOKEN}} placeholders
                  (e.g. {{LOGO_KNOCKOUT}}, {{LOGO_PRIMARY}}, {{LOGO_SMALL}}, {{PHOTO_STREET}}).
  -o, --out       Output path (default: overwrite the input file in place).
  --theme <name>  Take the assets of that theme: nbg (default, NBG-Design/assets) or biks2013
                  (BikS2013-Design/assets). The tokens are the same in every theme.
  --assets <dir>  Override the assets directory (default: the theme's assets).

Tokens map to files by lower-casing and turning '_' into '-', then adding '.datauri.txt':
  {{PHOTO_STREET}}  -> photo-street.datauri.txt
  {{LOGO_KNOCKOUT}} -> logo-knockout.datauri.txt`;

function fail(msg) { console.error('embed-assets ERROR: ' + msg); process.exit(1); }

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '-o' || x === '--out') a.out = argv[++i];
    else if (x === '--assets') a.assets = argv[++i];
    else if (x === '--theme') a.theme = argv[++i];
    else if (x === '-h' || x === '--help') a.help = true;
    else a._.push(x);
  }
  return a;
}

const tokenToFile = (name) => name.toLowerCase().replace(/_/g, '-') + '.datauri.txt';
const TOKEN_RE = /\{\{([A-Z0-9_]+)\}\}/g;

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args._.length !== 1) { console.log(USAGE); process.exit(args.help ? 0 : 2); }

  const input = resolve(process.cwd(), args._[0]);
  const out = args.out ? resolve(process.cwd(), args.out) : input;
  if (args.theme && !THEMES[args.theme]) fail(`unknown theme "${args.theme}" (known: ${Object.keys(THEMES).join(', ')})`);
  const assetsDir = args.assets ? resolve(process.cwd(), args.assets) : args.theme ? resolve(SKILL_ROOT, THEMES[args.theme], 'assets') : DEFAULT_ASSETS;

  if (!existsSync(input)) fail(`input not found: ${input}`);
  if (!existsSync(assetsDir)) {
    fail(`assets directory not found: ${assetsDir}\n` +
         `  The skill's NBG-Design/assets folder must travel with this script.\n` +
         `  If you moved the skill, copy the WHOLE skill folder, not just SKILL.md.`);
  }

  let html = readFileSync(input, 'utf8');
  const tokens = [...new Set([...html.matchAll(TOKEN_RE)].map((m) => m[1]))];
  if (tokens.length === 0) {
    fail('no {{TOKEN}} placeholders found in the deck.\n' +
         '  Author the deck with image tokens (e.g. background-image:url("{{PHOTO_STREET}}")),\n' +
         '  not hand-pasted data URIs. See SKILL.md "Deterministic embedding & verification".');
  }

  const report = [];
  for (const tok of tokens) {
    const file = resolve(assetsDir, tokenToFile(tok));
    if (!existsSync(file)) {
      fail(`no asset for token {{${tok}}} (looked for ${tokenToFile(tok)} in ${assetsDir}).\n` +
           `  Valid asset stems: ${availableStems(assetsDir).join(', ') || '(none found)'}`);
    }
    const uri = readFileSync(file, 'utf8').trim();
    if (!uri.startsWith('data:image/')) {
      fail(`${tokenToFile(tok)} does not start with "data:image/" (got ${JSON.stringify(uri.slice(0, 24))}).`);
    }
    const re = new RegExp(`\\{\\{${tok}\\}\\}`, 'g');
    const count = (html.match(re) || []).length;
    html = html.replace(re, uri);
    report.push(`  {{${tok}}} -> ${tokenToFile(tok)}  (${count}x, ${uri.length.toLocaleString()} chars)`);
  }

  const leftover = [...new Set([...html.matchAll(TOKEN_RE)].map((m) => m[0]))];
  if (leftover.length) fail(`unresolved tokens remain after embedding: ${leftover.join(', ')}`);

  writeFileSync(out, html, 'utf8');
  console.log(`Embedded ${tokens.length} asset(s) into ${out}`);
  console.log(report.join('\n'));
  console.log(`Output size: ${Buffer.byteLength(html, 'utf8').toLocaleString()} bytes`);
}

function availableStems(dir) {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.datauri.txt'))
      .map((f) => f.replace('.datauri.txt', ''));
  } catch { return []; }
}

main();
