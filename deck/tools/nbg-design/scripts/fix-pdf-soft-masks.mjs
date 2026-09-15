#!/usr/bin/env node
// NBG Design — make an already exported PDF render its shadows in macOS Preview.
//
// `export-pdf.mjs` applies this rewrite itself; use this script for PDFs exported before the
// skill did so (or with --keep-soft-masks). It re-anchors Chrome's luminosity soft masks (the
// blurred box-shadows) to page space so Quartz — Preview, Quick Look, Safari — stops clipping
// them to the top-left corner of the page and painting the rest as solid gray blocks. The drawn
// result is unchanged in every spec-compliant viewer (Chrome, Acrobat, Firefox, poppler); the
// rewritten mask forms are appended as an incremental update, the original bytes stay intact.
// Details and the analysis: scripts/lib/pdf-soft-masks.mjs. Zero dependencies, Node >= 18.
//
// Usage: node fix-pdf-soft-masks.mjs <deck.pdf> [-o <out.pdf>] [--check]
//   -o, --out   write here instead of rewriting <deck.pdf> in place
//   --check     report only; exit 0 = nothing to do, 1 = masks still need re-anchoring
//
// Exit: 0 = done (or nothing to do), 1 = error / --check found work, 2 = usage.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fixLuminosityMasks, scanLuminosityMasks, UnsupportedPdfError } from './lib/pdf-soft-masks.mjs';

const USAGE = `Re-anchor a PDF's luminosity soft masks for macOS Preview (shadows as gray blocks)
Usage: node fix-pdf-soft-masks.mjs <deck.pdf> [-o <out.pdf>] [--check]

  -o, --out   Write the result here (default: rewrite <deck.pdf> in place).
  --check     Report only; exit 0 when nothing needs re-anchoring, 1 when something does.

Exit: 0 = done or nothing to do, 1 = error / --check found work, 2 = usage.`;

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '-o' || x === '--out') a.out = argv[++i];
    else if (x === '--check') a.check = true;
    else if (x === '-h' || x === '--help') a.help = true;
    else a._.push(x);
  }
  return a;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args._.length !== 1) { console.log(USAGE); process.exit(args.help ? 0 : 2); }
  const src = resolve(process.cwd(), args._[0]);
  if (!existsSync(src)) { console.error('fix-pdf-soft-masks ERROR: not found: ' + src); process.exit(1); }
  const out = resolve(process.cwd(), args.out || src);
  const buf = readFileSync(src);

  let scan;
  try { scan = scanLuminosityMasks(buf); }
  catch (e) {
    if (e instanceof UnsupportedPdfError) { console.error(`fix-pdf-soft-masks ERROR: ${e.message} — only PDFs written by Chrome/Skia (as export-pdf.mjs does) are supported.`); process.exit(1); }
    throw e;
  }
  const todo = scan.masks.filter((m) => m.needsFix);
  const skipped = scan.masks.filter((m) => !m.needsFix);
  console.log(`${src}\n  pages: ${scan.pages} | luminosity soft masks: ${scan.masks.length} | to re-anchor: ${todo.length} | left as they are: ${skipped.length}`);
  for (const m of todo) console.log(`    page ${m.page}: ${m.gsName} (form ${m.formRef})`);
  for (const m of skipped) console.log(`    page ${m.page}: ${m.gsName ?? '(form ' + m.formRef + ')'} — ${m.reason}`);

  if (args.check) {
    console.log(todo.length ? '\nRESULT: masks need re-anchoring — run without --check.' : '\nRESULT: nothing to do — Preview renders this PDF\'s shadows correctly.');
    process.exit(todo.length ? 1 : 0);
  }
  if (!todo.length) { console.log('\nRESULT: nothing to do.'); if (out !== src) writeFileSync(out, buf); process.exit(0); }

  const r = fixLuminosityMasks(buf);
  writeFileSync(out, r.buf);
  console.log(`\nRESULT: ${r.rewritten} mask form(s) re-anchored → ${out} (+${r.buf.length - buf.length} bytes, incremental update).`);
  process.exit(0);
}

main();
