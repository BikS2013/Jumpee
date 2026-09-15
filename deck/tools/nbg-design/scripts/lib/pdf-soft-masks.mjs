// NBG Design — re-anchor luminosity soft masks so macOS Preview renders them (zero dependencies).
//
// Why this exists. Chrome's PDF backend (Skia) writes every blurred CSS box-shadow as a
// luminosity soft mask: a grayscale image inside a transparency-group form XObject, attached to
// the graphics state (`/SMask << /S /Luminosity /G <form> >>`), through which the shadow colour
// is filled. The whole page content is authored in Skia's device units (300 dpi) under one
// transform at the top of the page, e.g. `.24 0 0 -.24 0 810 cm`, and the mask form has no
// /Matrix: its BBox and content are in those device units too. Per the PDF specification the
// mask is positioned with the transform in effect when the graphics state was set.
//
// macOS Quartz (Preview, Quick Look, Safari) clips the mask form to the page box in POINTS but
// applies that rectangle in the form's own coordinate space, without the transform — i.e. to
// the top-left 1440x810 device units of a 1440x810 pt page (24 % of each dimension). A shadow
// whose box lies entirely outside that corner gets an empty mask and Quartz then paints the
// fill UNMASKED: a solid rectangle of the shadow colour. A shadow that straddles the corner is
// masked only inside it and vanishes elsewhere. Chrome, Acrobat, Firefox and poppler render
// the same file correctly.
//
// The fix keeps the luminosity mask but expresses the form in page space, where Quartz's clip
// is right: the form gets `/Matrix` = inverse of the transform in effect at the `gs`, its
// content is prefixed with that transform (`a b c d e f cm`) and its BBox is transformed the
// same way. The drawn result is identical (verified pixel-identical in poppler); only the
// coordinate bookkeeping moves. Nothing else in the file changes: the rewritten form objects
// are appended as an incremental update (new xref section with /Prev), so the original bytes
// stay untouched and any PDF reader can open the result.
//
// Scope: classic cross-reference tables, uncompressed objects (streams may be FlateDecode
// without predictors) — exactly what Chrome/Skia produce. Anything else throws
// UnsupportedPdfError; callers keep the original PDF and say so.
//
// API:
//   scanLuminosityMasks(buf)            -> { pages, masks: [{ page, gsName, formRef, ctm, needsFix, reason }] }
//   fixLuminosityMasks(buf, { dryRun }) -> { buf, rewritten, skipped: [{ page, gsName, reason }], pages }
//   pdfPageCount(buf)                   -> number (walks the page tree; ignores superseded objects)

import { inflateSync, deflateSync } from 'node:zlib';

export class UnsupportedPdfError extends Error {}

const IDENTITY = [1, 0, 0, 1, 0, 0];
const WS = /[\0\t\n\f\r ]/;
const DELIM = /[()<>[\]{}/%]/;
const isRegular = (c) => c !== undefined && !WS.test(c) && !DELIM.test(c);

// ───────────────────────────── matrices ([a b c d e f], PDF row-vector convention)

export function mmul(A, B) { // apply A, then B
  const [a, b, c, d, e, f] = A; const [A2, B2, C2, D2, E2, F2] = B;
  return [a * A2 + b * C2, a * B2 + b * D2, c * A2 + d * C2, c * B2 + d * D2, e * A2 + f * C2 + E2, e * B2 + f * D2 + F2];
}
export function minv(M) {
  const [a, b, c, d, e, f] = M; const det = a * d - b * c;
  if (!det) throw new Error('singular matrix');
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}
export function mapply(M, x, y) { const [a, b, c, d, e, f] = M; return [a * x + c * y + e, b * x + d * y + f]; }
const isIdentity = (M) => M.every((v, i) => Math.abs(v - IDENTITY[i]) < 1e-9);
const fmt = (n) => { const s = Number(n.toFixed(6)).toString(); return s === '-0' ? '0' : s; };
const sameMatrix = (A, B) => A.every((v, i) => Math.abs(v - B[i]) < 1e-6);

// ───────────────────────────── object model & lexer

// Values: {t:'dict', map:Map} | {t:'arr', items} | {t:'name', v} | {t:'num', v, raw} | {t:'ref', num, gen}
//         {t:'str', raw} | {t:'bool', v} | {t:'null'}
class Lexer {
  constructor(src, pos = 0) { this.s = src; this.p = pos; }
  skipWs() {
    for (;;) {
      while (this.p < this.s.length && WS.test(this.s[this.p])) this.p++;
      if (this.s[this.p] === '%') { while (this.p < this.s.length && this.s[this.p] !== '\n' && this.s[this.p] !== '\r') this.p++; continue; }
      return;
    }
  }
  // Returns a token: {k:'delim', v} for << >> [ ] { }, {k:'name', v}, {k:'num', v, raw}, {k:'str', raw}, {k:'kw', v}, or null at EOF.
  next() {
    this.skipWs();
    if (this.p >= this.s.length) return null;
    const s = this.s; const c = s[this.p];
    if (c === '<') {
      if (s[this.p + 1] === '<') { this.p += 2; return { k: 'delim', v: '<<' }; }
      const end = s.indexOf('>', this.p); if (end < 0) throw new Error('unterminated hex string');
      const raw = s.slice(this.p, end + 1); this.p = end + 1; return { k: 'str', raw };
    }
    if (c === '>') {
      if (s[this.p + 1] === '>') { this.p += 2; return { k: 'delim', v: '>>' }; }
      throw new Error('stray >');
    }
    if (c === '[' || c === ']' || c === '{' || c === '}') { this.p++; return { k: 'delim', v: c }; }
    if (c === '(') {
      let depth = 0; let i = this.p;
      for (; i < s.length; i++) {
        const ch = s[i];
        if (ch === '\\') { i++; continue; }
        if (ch === '(') depth++;
        else if (ch === ')') { depth--; if (depth === 0) { i++; break; } }
      }
      const raw = s.slice(this.p, i); this.p = i; return { k: 'str', raw };
    }
    if (c === '/') {
      let i = this.p + 1; while (isRegular(s[i])) i++;
      const raw = s.slice(this.p + 1, i); this.p = i;
      return { k: 'name', v: raw.replace(/#([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))), raw };
    }
    let i = this.p; while (isRegular(s[i])) i++;
    if (i === this.p) throw new Error(`unexpected character ${JSON.stringify(c)} at ${this.p}`);
    const raw = s.slice(this.p, i); this.p = i;
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(raw)) return { k: 'num', v: parseFloat(raw), raw };
    return { k: 'kw', v: raw };
  }
  peek() { const p = this.p; const t = this.next(); this.p = p; return t; }
}

// Parses one PDF object value starting at the lexer position (handles `n g R` references).
function parseValue(lx, tok = lx.next()) {
  if (!tok) throw new Error('unexpected EOF');
  if (tok.k === 'delim') {
    if (tok.v === '<<') {
      const map = new Map();
      for (;;) {
        const t = lx.next(); if (!t) throw new Error('unterminated dict');
        if (t.k === 'delim' && t.v === '>>') break;
        if (t.k !== 'name') throw new Error('dict key expected at ' + lx.p);
        map.set(t.v, parseValue(lx));
      }
      return { t: 'dict', map };
    }
    if (tok.v === '[') {
      const items = [];
      for (;;) {
        const t = lx.next(); if (!t) throw new Error('unterminated array');
        if (t.k === 'delim' && t.v === ']') break;
        items.push(parseValue(lx, t));
      }
      return { t: 'arr', items };
    }
    throw new Error('unexpected delimiter ' + tok.v);
  }
  if (tok.k === 'name') return { t: 'name', v: tok.v, raw: tok.raw };
  if (tok.k === 'str') return { t: 'str', raw: tok.raw };
  if (tok.k === 'num') {
    // `num gen R` → reference
    if (Number.isInteger(tok.v) && tok.v >= 0) {
      const save = lx.p; const t2 = lx.next();
      if (t2 && t2.k === 'num' && Number.isInteger(t2.v)) {
        const save2 = lx.p; const t3 = lx.next();
        if (t3 && t3.k === 'kw' && t3.v === 'R') return { t: 'ref', num: tok.v, gen: t2.v };
        lx.p = save2; lx.p = save;
      } else lx.p = save;
    }
    return { t: 'num', v: tok.v, raw: tok.raw };
  }
  if (tok.k === 'kw') {
    if (tok.v === 'true') return { t: 'bool', v: true };
    if (tok.v === 'false') return { t: 'bool', v: false };
    if (tok.v === 'null') return { t: 'null' };
    throw new Error('unexpected keyword ' + tok.v + ' at ' + lx.p);
  }
  throw new Error('bad token');
}

function serialize(v) {
  switch (v.t) {
    case 'dict': { const parts = []; for (const [k, val] of v.map) parts.push('/' + k + ' ' + serialize(val)); return '<< ' + parts.join(' ') + ' >>'; }
    case 'arr': return '[' + v.items.map(serialize).join(' ') + ']';
    case 'name': return '/' + (v.raw ?? v.v);
    case 'num': return v.raw ?? fmt(v.v);
    case 'ref': return `${v.num} ${v.gen} R`;
    case 'str': return v.raw;
    case 'bool': return v.v ? 'true' : 'false';
    case 'null': return 'null';
    default: throw new Error('cannot serialize ' + v.t);
  }
}

// ───────────────────────────── document access (classic xref tables)

class Pdf {
  constructor(buf) {
    this.buf = buf;
    this.src = buf.toString('latin1'); // 1:1 byte ↔ char, so offsets are byte offsets
    this.xref = new Map(); // num -> { offset, gen }
    this.cache = new Map();
    this.trailer = new Map();
    this.readXref();
  }

  readXref() {
    const s = this.src;
    const tail = s.lastIndexOf('startxref');
    if (tail < 0) throw new UnsupportedPdfError('no startxref');
    const m = /startxref\s+(\d+)/.exec(s.slice(tail));
    if (!m) throw new UnsupportedPdfError('unreadable startxref');
    this.startxref = parseInt(m[1], 10);
    const seen = new Set();
    let offset = this.startxref;
    let first = true;
    while (offset !== undefined && !seen.has(offset)) {
      seen.add(offset);
      const lx = new Lexer(s, offset);
      const kw = lx.next();
      if (!kw || kw.k !== 'kw' || kw.v !== 'xref') throw new UnsupportedPdfError('cross-reference stream (PDF 1.5 object streams) — not the classic table Chrome writes');
      for (;;) {
        lx.skipWs();
        if (s.startsWith('trailer', lx.p)) { lx.p += 7; break; }
        const start = lx.next(); const count = lx.next();
        if (!start || !count || start.k !== 'num' || count.k !== 'num') throw new UnsupportedPdfError('malformed xref subsection');
        for (let i = 0; i < count.v; i++) {
          lx.skipWs();
          const e = /^(\d{10}) (\d{5}) ([nf])/.exec(s.slice(lx.p, lx.p + 20));
          if (!e) throw new UnsupportedPdfError('malformed xref entry at ' + lx.p);
          lx.p += 18;
          const num = start.v + i;
          if (e[3] === 'n' && !this.xref.has(num)) this.xref.set(num, { offset: parseInt(e[1], 10), gen: parseInt(e[2], 10) });
          else if (e[3] === 'f' && !this.xref.has(num)) this.xref.set(num, null); // free
        }
      }
      const tr = parseValue(lx);
      if (tr.t !== 'dict') throw new UnsupportedPdfError('malformed trailer');
      for (const [k, v] of tr.map) if (!this.trailer.has(k)) this.trailer.set(k, v);
      if (first) { this.latestTrailer = tr.map; first = false; }
      const prev = tr.map.get('Prev');
      offset = prev && prev.t === 'num' ? prev.v : undefined;
    }
    if (this.trailer.has('Encrypt')) throw new UnsupportedPdfError('encrypted PDF');
    const size = this.trailer.get('Size');
    this.size = size && size.t === 'num' ? size.v : Math.max(...[...this.xref.keys()]) + 1;
  }

  // Returns { num, gen, value, stream? (Buffer, raw/encoded), dict? } for an indirect object.
  getObject(num) {
    if (this.cache.has(num)) return this.cache.get(num);
    const ent = this.xref.get(num);
    if (!ent) return null;
    const lx = new Lexer(this.src, ent.offset);
    const n = lx.next(); const g = lx.next(); const kw = lx.next();
    if (!n || n.k !== 'num' || n.v !== num || !g || g.k !== 'num' || !kw || kw.k !== 'kw' || kw.v !== 'obj') throw new UnsupportedPdfError(`object ${num} not at its xref offset`);
    const value = parseValue(lx);
    const obj = { num, gen: g.v, value };
    lx.skipWs();
    if (this.src.startsWith('stream', lx.p)) {
      if (value.t !== 'dict') throw new UnsupportedPdfError(`stream ${num} without dictionary`);
      let p = lx.p + 6;
      if (this.src[p] === '\r') p++;
      if (this.src[p] === '\n') p++;
      const len = this.resolve(value.map.get('Length'));
      if (!len || len.t !== 'num') throw new UnsupportedPdfError(`stream ${num} without /Length`);
      obj.stream = this.buf.subarray(p, p + len.v);
      obj.dict = value.map;
    }
    this.cache.set(num, obj);
    return obj;
  }

  resolve(v) {
    let guard = 0;
    while (v && v.t === 'ref' && guard++ < 32) { const o = this.getObject(v.num); v = o ? o.value : { t: 'null' }; }
    return v;
  }
  dictGet(dict, key) { return dict ? this.resolve(dict.map ? dict.map.get(key) : dict.get(key)) : undefined; }

  // Decoded stream bytes (FlateDecode without predictor, or unfiltered). Throws UnsupportedPdfError otherwise.
  decodeStream(obj) {
    const filter = this.resolve(obj.dict.get('Filter'));
    const names = !filter ? [] : filter.t === 'arr' ? filter.items.map((x) => this.resolve(x).v) : [filter.v];
    if (names.length === 0) return obj.stream;
    if (names.length === 1 && names[0] === 'FlateDecode') {
      const parms = this.resolve(obj.dict.get('DecodeParms'));
      const pred = parms && parms.t === 'dict' ? this.dictGet(parms, 'Predictor') : undefined;
      if (pred && pred.v > 1) throw new UnsupportedPdfError(`stream ${obj.num}: FlateDecode with predictor`);
      return inflateSync(obj.stream);
    }
    throw new UnsupportedPdfError(`stream ${obj.num}: filter ${names.join('+')}`);
  }

  pages() {
    const root = this.resolve(this.trailer.get('Root'));
    const pagesRoot = this.dictGet(root, 'Pages');
    const out = [];
    const walk = (node, inheritedResources, depth) => {
      if (!node || node.t !== 'dict' || depth > 64) return;
      const type = this.dictGet(node, 'Type');
      const resources = node.map.has('Resources') ? node.map.get('Resources') : inheritedResources;
      if (type && type.v === 'Pages') {
        const kids = this.dictGet(node, 'Kids');
        if (kids && kids.t === 'arr') for (const k of kids.items) walk(this.resolve(k), resources, depth + 1);
      } else if (type && type.v === 'Page') {
        out.push({ dict: node, resources: this.resolve(resources) });
      }
    };
    walk(pagesRoot, undefined, 0);
    return out;
  }

  contentOf(pageDict) {
    const c = pageDict.map.get('Contents');
    const refs = !c ? [] : c.t === 'arr' ? c.items : this.resolve(c).t === 'arr' ? this.resolve(c).items : [c];
    const parts = [];
    for (const r of refs) {
      if (r.t !== 'ref') throw new UnsupportedPdfError('direct content stream');
      const o = this.getObject(r.num);
      if (!o || !o.stream) throw new UnsupportedPdfError(`content ${r.num} is not a stream`);
      parts.push(this.decodeStream(o));
    }
    return Buffer.concat(parts.flatMap((p, i) => (i ? [Buffer.from('\n'), p] : [p]))).toString('latin1');
  }
}

// ───────────────────────────── content interpretation (q / Q / cm / gs / Do only)

// Walks a content stream, recursing into Form XObjects, and reports every `gs` that sets a
// luminosity soft mask together with the CTM in effect. `resources` is a resolved dict value.
function findMaskUses(pdf, content, resources, ctm0, out, depth, visiting) {
  const lx = new Lexer(content);
  const stack = [];
  let ctm = ctm0.slice();
  const operands = [];
  const extg = pdf.dictGet(resources, 'ExtGState');
  const xobj = pdf.dictGet(resources, 'XObject');
  for (;;) {
    let tok;
    try { tok = lx.next(); } catch { break; }
    if (!tok) break;
    if (tok.k === 'delim') {
      if (tok.v === '<<') { // inline dictionary operand (BDC properties, inline image) — skip balanced
        let d = 1; while (d > 0) { const t = lx.next(); if (!t) break; if (t.k === 'delim' && t.v === '<<') d++; else if (t.k === 'delim' && t.v === '>>') d--; }
      }
      continue;
    }
    if (tok.k === 'num' || tok.k === 'name' || tok.k === 'str') { operands.push(tok); if (operands.length > 8) operands.shift(); continue; }
    const op = tok.v;
    switch (op) {
      case 'q': stack.push(ctm.slice()); break;
      case 'Q': if (stack.length) ctm = stack.pop(); break;
      case 'cm': {
        const n = operands.slice(-6);
        if (n.length === 6 && n.every((t) => t.k === 'num')) ctm = mmul(n.map((t) => t.v), ctm);
        break;
      }
      case 'gs': {
        const nm = operands[operands.length - 1];
        if (nm && nm.k === 'name' && extg && extg.t === 'dict') {
          const gref = extg.map.get(nm.v);
          const g = pdf.resolve(gref);
          const sm = pdf.dictGet(g, 'SMask');
          if (sm && sm.t === 'dict') {
            const S = pdf.dictGet(sm, 'S'); const G = sm.map.get('G');
            if (S && S.v === 'Luminosity' && G && G.t === 'ref') out.push({ gsName: nm.v, gsRef: gref, formRef: G, ctm: ctm.slice() });
          }
        }
        break;
      }
      case 'Do': {
        const nm = operands[operands.length - 1];
        if (nm && nm.k === 'name' && xobj && xobj.t === 'dict') {
          const xr = xobj.map.get(nm.v); const x = pdf.resolve(xr);
          const st = pdf.dictGet(x, 'Subtype');
          if (x && st && st.v === 'Form' && xr.t === 'ref' && depth < 12) {
            const key = xr.num + '@' + ctm.map(fmt).join(',');
            if (!visiting.has(key)) {
              visiting.add(key);
              const o = pdf.getObject(xr.num);
              const mtx = pdf.dictGet(x, 'Matrix');
              const M = mtx && mtx.t === 'arr' && mtx.items.length === 6 ? mtx.items.map((i) => pdf.resolve(i).v) : IDENTITY;
              const res = x.map.has('Resources') ? pdf.resolve(x.map.get('Resources')) : resources;
              try { findMaskUses(pdf, pdf.decodeStream(o).toString('latin1'), res, mmul(M, ctm), out, depth + 1, visiting); }
              catch (e) { if (!(e instanceof UnsupportedPdfError)) throw e; out.push({ unreadableForm: xr.num, reason: e.message }); }
            }
          }
        }
        break;
      }
      case 'BI': { // inline image: skip to EI
        const idx = content.indexOf('ID', lx.p); if (idx < 0) { lx.p = content.length; break; }
        const m = /[\0\t\n\f\r ]EI(?=[\0\t\n\f\r ]|$)/.exec(content.slice(idx + 3));
        lx.p = m ? idx + 3 + m.index + m[0].length : content.length;
        break;
      }
      default: break;
    }
    operands.length = 0;
  }
}

// ───────────────────────────── public API

export function scanLuminosityMasks(buf) {
  const pdf = new Pdf(buf);
  const pages = pdf.pages();
  const masks = [];
  pages.forEach((pg, i) => {
    const uses = [];
    findMaskUses(pdf, pdf.contentOf(pg.dict), pg.resources, IDENTITY, uses, 0, new Set());
    // group by form object: one form must be set under one CTM to be re-anchored
    const byForm = new Map();
    for (const u of uses) {
      if (u.unreadableForm) { masks.push({ page: i + 1, gsName: null, formRef: u.unreadableForm, needsFix: false, reason: 'form XObject unreadable: ' + u.reason }); continue; }
      const k = u.formRef.num;
      if (!byForm.has(k)) byForm.set(k, { ...u, ctms: [u.ctm] });
      else byForm.get(k).ctms.push(u.ctm);
    }
    for (const u of byForm.values()) {
      const distinct = u.ctms.filter((c, j) => u.ctms.findIndex((d) => sameMatrix(c, d)) === j);
      let reason = null;
      if (distinct.length > 1) reason = 'set under different transforms';
      else if (isIdentity(u.ctm)) reason = 'already in page space';
      else {
        const form = pdf.getObject(u.formRef.num);
        if (!form || !form.stream) reason = 'mask form is not a stream';
        else {
          const bbox = pdf.dictGet(form.value, 'BBox');
          const mtx = pdf.dictGet(form.value, 'Matrix');
          const M = mtx && mtx.t === 'arr' && mtx.items.length === 6 ? mtx.items.map((i) => pdf.resolve(i).v) : null;
          if (!bbox || bbox.t !== 'arr' || bbox.items.length !== 4) reason = 'mask form without BBox';
          else if (M && sameMatrix(mmul(M, u.ctm), IDENTITY)) reason = 'already anchored to page space';
          else { try { pdf.decodeStream(form); } catch (e) { reason = 'mask form content: ' + e.message; } }
        }
      }
      masks.push({ page: i + 1, gsName: u.gsName, formRef: u.formRef.num, ctm: u.ctm, needsFix: !reason, reason });
    }
  });
  return { pdf, pages: pages.length, masks };
}

export function fixLuminosityMasks(buf, { dryRun = false } = {}) {
  const { pdf, pages, masks } = scanLuminosityMasks(buf);
  const todo = masks.filter((m) => m.needsFix);
  const skipped = masks.filter((m) => !m.needsFix).map(({ page, gsName, reason }) => ({ page, gsName, reason }));
  if (dryRun || todo.length === 0) return { buf, rewritten: todo.length, skipped, pages, dryRun };

  const updates = []; // { num, gen, body: Buffer }
  const done = new Set();
  for (const m of todo) {
    if (done.has(m.formRef)) continue; // the same form reached from several pages under the same CTM
    done.add(m.formRef);
    const form = pdf.getObject(m.formRef);
    const dict = new Map(form.value.map);
    const bbox = pdf.dictGet(form.value, 'BBox').items.map((i) => pdf.resolve(i).v);
    const mtx = pdf.dictGet(form.value, 'Matrix');
    const M = mtx && mtx.t === 'arr' && mtx.items.length === 6 ? mtx.items.map((i) => pdf.resolve(i).v) : IDENTITY;
    const total = mmul(M, m.ctm);            // old form space → page space
    const corners = [[bbox[0], bbox[1]], [bbox[2], bbox[1]], [bbox[2], bbox[3]], [bbox[0], bbox[3]]].map(([x, y]) => mapply(total, x, y));
    const xs = corners.map((c) => c[0]); const ys = corners.map((c) => c[1]);
    const newBBox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    const content = pdf.decodeStream(form);
    const newContent = Buffer.concat([Buffer.from(total.map(fmt).join(' ') + ' cm\n', 'latin1'), content]);
    const compress = newContent.length > 256;
    const data = compress ? deflateSync(newContent) : newContent;
    dict.set('BBox', { t: 'arr', items: newBBox.map((v) => ({ t: 'num', v })) });
    dict.set('Matrix', { t: 'arr', items: minv(m.ctm).map((v) => ({ t: 'num', v })) });
    dict.set('Length', { t: 'num', v: data.length });
    if (compress) dict.set('Filter', { t: 'name', v: 'FlateDecode' }); else dict.delete('Filter');
    dict.delete('DecodeParms');
    const head = Buffer.from(`${form.num} ${form.gen} obj\n${serialize({ t: 'dict', map: dict })}\nstream\n`, 'latin1');
    updates.push({ num: form.num, gen: form.gen, body: Buffer.concat([head, data, Buffer.from('\nendstream\nendobj\n', 'latin1')]) });
  }

  // Incremental update: appended objects, a new xref section (one subsection per object) and a trailer with /Prev.
  const parts = [buf];
  let offset = buf.length;
  if (buf[buf.length - 1] !== 0x0a) { parts.push(Buffer.from('\n')); offset++; }
  const entries = [];
  for (const u of updates.sort((a, b) => a.num - b.num)) { entries.push({ num: u.num, gen: u.gen, offset }); parts.push(u.body); offset += u.body.length; }
  const xrefOffset = offset;
  let xref = 'xref\n0 1\n0000000000 65535 f \n';
  for (const e of entries) xref += `${e.num} 1\n${String(e.offset).padStart(10, '0')} ${String(e.gen).padStart(5, '0')} n \n`;
  const trailer = new Map();
  trailer.set('Size', { t: 'num', v: pdf.size });
  for (const k of ['Root', 'Info', 'ID']) if (pdf.latestTrailer.has(k)) trailer.set(k, pdf.latestTrailer.get(k));
  trailer.set('Prev', { t: 'num', v: pdf.startxref });
  xref += `trailer\n${serialize({ t: 'dict', map: trailer })}\nstartxref\n${xrefOffset}\n%%EOF\n`;
  parts.push(Buffer.from(xref, 'latin1'));
  return { buf: Buffer.concat(parts), rewritten: updates.length, skipped, pages, dryRun: false };
}

export function pdfPageCount(buf) {
  return new Pdf(buf).pages().length;
}
