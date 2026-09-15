/* NBG Design — print-layout shim shared by export-pdf.mjs (evaluated in headless Chrome)
 * and by the in-deck right-click menu (add-deck-menu.mjs / lib/deck-menu.js). Plain browser
 * JavaScript, no module syntax: export-pdf.mjs reads this file as text and evaluates it in the
 * page, and add-deck-menu.mjs inlines it into the deck. Keep it dependency-free and ES2017-compatible.
 *
 * nbgPreparePrintLayout(opts) turns the interactive deck into a print layout WITHOUT
 * touching any slide's own design:
 *   - every top-level slide becomes visible in normal flow (navigation toggles lifted);
 *   - the viewport-fit host layer (scaled wrappers, fixed stages, flex centering) is
 *     neutralised; non-slide chrome (buttons, counters, menus) is hidden;
 *   - animations/transitions jump to their end state; backgrounds are forced to print;
 *   - the page box is the slide's own box (normally 1920x1080 px = 20 x 11.25 in), one
 *     slide per page, zero margins.
 * It returns a diagnostic object { slides, page, forcedDisplay, hiddenElements, ancestors,
 * sizeMismatch, rasterShadows, notes } and records every mutation so nbgRestorePrintLayout()
 * can put the deck back exactly as it was (used by the in-deck menu after the print dialog closes).
 *
 * Shadows (block v13). Chrome prints every blurred box-shadow as a luminosity soft mask that
 * macOS Preview / Quick Look / Safari mis-position: outside the top-left 24 % of the page the
 * shadow becomes a solid gray block, across it the shadow disappears. export-pdf.mjs repairs the
 * masks in the PDF file afterwards; a PDF saved from the browser's print dialog cannot be
 * post-processed, so by default (opts.rasterShadows !== false) the shim replaces each blurred,
 * non-inset box-shadow layer, for the duration of the print, by a pre-rendered shadow image
 * (a canvas drawing of the same shadow: same colour, offsets, blur — sigma = blur / 2, as CSS —
 * spread and corner radii, the element's own box cut out) placed right behind the element as an
 * absolutely positioned sibling with z-index -1; the parent is isolated so that layer sits above
 * the parent's background and below every sibling, as the CSS shadow does. Chrome prints such an
 * image with an alpha mask, which every viewer renders. The element itself (its text, borders,
 * fills) stays vector. Elements with a rotation / scale transform, inline boxes and inset or
 * unblurred layers are left as they are. export-pdf.mjs passes rasterShadows:false and keeps the
 * exact vector shadows, repaired in the file.
 */

var __nbgPrintRegistry = null;

// Split a computed box-shadow into layers at top-level commas (colours contain commas too).
function __nbgSplitShadow(v) {
  var out = [], depth = 0, cur = '';
  for (var i = 0; i < v.length; i++) {
    var c = v[i];
    if (c === '(') depth++; else if (c === ')') depth--;
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.map(function (s) {
    var inset = /\binset\b/.test(s);
    var color = (s.match(/rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-fA-F]{3,8}/) || [])[0] || null;
    var rest = color ? s.replace(color, ' ') : s;
    var nums = (rest.match(/-?\d*\.?\d+(?=px)/g) || []).map(parseFloat);
    if (!color) { var word = (rest.replace(/\binset\b/, '').match(/[a-zA-Z]+/) || [])[0]; color = word || 'rgba(0,0,0,0)'; }
    return { raw: s, inset: inset, color: color, x: nums[0] || 0, y: nums[1] || 0, blur: nums[2] || 0, spread: nums[3] || 0 };
  });
}

function __nbgRadius(v, W, H) {  // "28px", "28px 14px", "50%" → { x, y } in px
  var parts = (v || '0px').split(/\s+/);
  function one(p, ref) { if (!p) return 0; if (p.slice(-1) === '%') return parseFloat(p) * ref / 100; return parseFloat(p) || 0; }
  return { x: one(parts[0], W), y: one(parts[1] || parts[0], H) };
}

// Replace the blurred box-shadows inside the slides by pre-rendered images for the print (see header).
function __nbgRasterShadows(slides, reg, diag, opts) {
  var scale = opts.shadowScale || 2;
  var count = 0, skipped = 0;
  slides.forEach(function (slide) {
    var els = Array.prototype.slice.call(slide.querySelectorAll('*'));
    els.forEach(function (el) {
      if (!(el instanceof HTMLElement) || el.closest('.nbg-print-shadow')) return;
      var cs = getComputedStyle(el);
      if (!cs.boxShadow || cs.boxShadow === 'none') return;
      var layers = __nbgSplitShadow(cs.boxShadow);
      var blurred = layers.filter(function (l) { return !l.inset && l.blur > 0; });
      if (!blurred.length) return;
      var parent = el.parentElement;
      if (!parent || cs.display === 'inline' || cs.display === 'contents' || cs.display === 'none' || cs.visibility === 'hidden') { skipped++; return; }
      var pcs = getComputedStyle(parent);
      if (pcs.display === 'inline' || pcs.display === 'contents') { skipped++; return; }
      // only translations between the element and its slide keep a rectangular shadow
      var rotated = false, a = el;
      while (a && a !== slide) {
        var t = getComputedStyle(a).transform;
        if (t && t !== 'none' && !/^matrix\(1, 0, 0, 1, /.test(t)) { rotated = true; break; }
        a = a.parentElement;
      }
      if (rotated) { skipped++; return; }
      var r = el.getBoundingClientRect();
      var W = r.width, H = r.height;
      if (W < 1 || H < 1) { skipped++; return; }
      var L = 0, T = 0, R = 0, B = 0;
      blurred.forEach(function (l) {
        var e = l.blur + Math.max(l.spread, 0) + 1;
        L = Math.max(L, e - l.x); R = Math.max(R, e + l.x); T = Math.max(T, e - l.y); B = Math.max(B, e + l.y);
      });
      L = Math.ceil(L); T = Math.ceil(T); R = Math.ceil(R); B = Math.ceil(B);
      var cw = W + L + R, ch = H + T + B, s = scale;
      if (cw * ch * s * s > 24e6) s = 1;
      var canvas = document.createElement('canvas');
      canvas.width = Math.ceil(cw * s); canvas.height = Math.ceil(ch * s);
      var ctx = canvas.getContext('2d');
      if (!ctx || !ctx.roundRect) { skipped++; return; }
      var rad = [__nbgRadius(cs.borderTopLeftRadius, W, H), __nbgRadius(cs.borderTopRightRadius, W, H),
        __nbgRadius(cs.borderBottomRightRadius, W, H), __nbgRadius(cs.borderBottomLeftRadius, W, H)];
      function radii(grow) {
        return rad.map(function (p) { return new DOMPoint(Math.max(0, Math.min(p.x + grow, (W + 2 * grow) / 2)), Math.max(0, Math.min(p.y + grow, (H + 2 * grow) / 2))); });
      }
      ctx.scale(s, s);
      ctx.translate(L, T);
      var K = cw + 64;   // the shape is drawn off-canvas; only its shadow lands (shadow offsets ignore the CTM, hence * s)
      for (var i = blurred.length - 1; i >= 0; i--) {   // the first CSS layer is on top
        var l = blurred[i];
        ctx.save();
        ctx.shadowColor = l.color; ctx.shadowBlur = l.blur * s;
        ctx.shadowOffsetX = (l.x + K) * s; ctx.shadowOffsetY = l.y * s;
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.roundRect(-l.spread - K, -l.spread, W + 2 * l.spread, H + 2 * l.spread, radii(l.spread)); ctx.fill();
        ctx.restore();
      }
      ctx.globalCompositeOperation = 'destination-out';   // a box-shadow never paints under its own box
      ctx.beginPath(); ctx.roundRect(0, 0, W, H, radii(0)); ctx.fill();
      var url;
      try { url = canvas.toDataURL('image/png'); } catch (e) { skipped++; return; }
      var img = document.createElement('div');
      img.className = 'nbg-print-shadow';
      img.setAttribute('aria-hidden', 'true');
      img.style.cssText = 'position:absolute;left:0;top:0;margin:0;padding:0;border:0;box-sizing:border-box;z-index:-1;pointer-events:none;' +
        'width:' + cw + 'px;height:' + ch + 'px;background:url(' + url + ') no-repeat 0 0 / 100% 100%;';
      remember(parent);
      if (pcs.isolation !== 'isolate') parent.style.setProperty('isolation', 'isolate', 'important');
      // The parent is NOT made positioned (that would move its absolutely positioned children): the
      // shadow is placed against whatever containing block applies, measured, then corrected.
      parent.insertBefore(img, el);
      reg.inserted.push(img);
      var ir = img.getBoundingClientRect();
      img.style.left = (r.left - L - ir.left) + 'px';
      img.style.top = (r.top - T - ir.top) + 'px';
      remember(el);
      var rest = layers.filter(function (l) { return blurred.indexOf(l) < 0; }).map(function (l) { return l.raw; });
      el.style.setProperty('box-shadow', rest.length ? rest.join(', ') : 'none', 'important');
      count++;
    });
  });
  diag.rasterShadows = count;
  if (skipped) diag.notes.push(skipped + ' shadow(s) left as CSS (rotated / inline / hidden element)');
  function remember(el) {
    reg.touched.push({ el: el, className: el.getAttribute('class'), style: el.getAttribute('style'),
      hidden: el.getAttribute('hidden'), ariaHidden: el.getAttribute('aria-hidden') });
  }
}

async function nbgPreparePrintLayout(opts) {
  opts = opts || {};
  var diag = { slides: 0, page: null, forcedDisplay: 0, hiddenElements: 0, ancestors: 0, sizeMismatch: [], rasterShadows: 0, notes: [] };
  if (__nbgPrintRegistry) { diag.notes.push('already prepared'); diag.slides = __nbgPrintRegistry.slides; diag.page = __nbgPrintRegistry.page; return diag; }
  var sel = opts.selector || '.slide';
  var all = Array.prototype.slice.call(document.querySelectorAll(sel));
  var slides = all.filter(function (s) { return !(s.parentElement && s.parentElement.closest(sel)); });
  if (!slides.length) { diag.notes.push('no element matches "' + sel + '"'); return diag; }
  diag.slides = slides.length;

  var reg = { slides: slides.length, page: null, style: null, touched: [], inserted: [] };
  function remember(el) {
    reg.touched.push({ el: el, className: el.getAttribute('class'), style: el.getAttribute('style'),
      hidden: el.getAttribute('hidden'), ariaHidden: el.getAttribute('aria-hidden') });
  }

  // 1. Global print rules (page box is filled in after measurement).
  var style = document.createElement('style');
  style.id = 'nbg-pdf-style';
  document.head.appendChild(style);
  reg.style = style;
  var baseCss = '\n' +
    'html, body { margin:0 !important; padding:0 !important; height:auto !important; min-height:0 !important;' +
    ' max-height:none !important; overflow:visible !important; background:transparent !important; }\n' +
    '*, *::before, *::after { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important;' +
    ' animation-duration:0s !important; animation-delay:0s !important; animation-fill-mode:forwards !important;' +
    ' transition-duration:0s !important; transition-delay:0s !important; }\n' +
    '::-webkit-scrollbar { display:none !important; }\n' +
    '.nbg-pdf-ancestor { position:static !important; display:block !important; transform:none !important;' +
    ' width:auto !important; height:auto !important; min-width:0 !important; min-height:0 !important;' +
    ' max-width:none !important; max-height:none !important; margin:0 !important; padding:0 !important;' +
    ' inset:auto !important; overflow:visible !important; aspect-ratio:auto !important; zoom:1 !important;' +
    ' flex:none !important; float:none !important; border:0 !important; }\n' +
    '.nbg-pdf-hidden { display:none !important; }\n' +
    '.nbg-pdf-slide { position:relative !important; inset:auto !important; margin:0 !important; transform:none !important;' +
    ' opacity:1 !important; visibility:visible !important; overflow:hidden !important; float:none !important;' +
    ' zoom:1 !important; break-after:page !important; page-break-after:always !important;' +
    ' break-inside:avoid !important; page-break-inside:avoid !important; }\n' +
    '.nbg-pdf-last { break-after:auto !important; page-break-after:auto !important; }\n';
  style.textContent = baseCss;

  // 2. Neutralise every ancestor of a slide and hide the siblings that are not on the way
  //    to a slide (navigation buttons, counters, hints, decorative stage backgrounds).
  var chain = [];
  slides.forEach(function (s) {
    var p = s.parentElement;
    while (p && p !== document.documentElement) { if (chain.indexOf(p) < 0) chain.push(p); p = p.parentElement; }
  });
  var skipTags = { SCRIPT: 1, STYLE: 1, LINK: 1, TEMPLATE: 1, META: 1, TITLE: 1, NOSCRIPT: 1 };
  chain.forEach(function (a) {
    remember(a);
    a.classList.add('nbg-pdf-ancestor');
    diag.ancestors++;
    Array.prototype.slice.call(a.children).forEach(function (c) {
      if (chain.indexOf(c) >= 0 || slides.indexOf(c) >= 0 || skipTags[c.tagName]) return;
      remember(c);
      c.classList.add('nbg-pdf-hidden');
      diag.hiddenElements++;
    });
  });

  // 3. Make every slide visible in flow. Lift the navigation toggles, keep the design CSS.
  slides.forEach(function (s, i) {
    remember(s);
    s.classList.remove('hidden', 'is-hidden', 'inactive');
    s.classList.add('active', 'nbg-pdf-slide');
    s.removeAttribute('hidden');
    s.removeAttribute('aria-hidden');
    ['display', 'opacity', 'visibility', 'transform', 'position', 'top', 'left', 'right', 'bottom', 'margin']
      .forEach(function (p) { s.style.removeProperty(p); });
    if (i === slides.length - 1) s.classList.add('nbg-pdf-last');
  });
  slides.forEach(function (s) {
    if (getComputedStyle(s).display === 'none') {
      s.style.setProperty('display', 'block', 'important');
      diag.forcedDisplay++;
    }
  });

  // 4. Page box = the slide's own box (or the forced size). Slides of another size are
  //    reported, never resized — resizing would change the design.
  var W, H;
  if (opts.size) { W = opts.size[0]; H = opts.size[1]; }
  else {
    var r0 = slides[0].getBoundingClientRect();
    W = Math.round(r0.width); H = Math.round(r0.height);
  }
  __nbgPrintRegistry = reg;   // registered before the early return so a restore still works
  if (!W || !H) { diag.notes.push('slide 1 has a zero-sized box'); return diag; }
  diag.page = { width: W, height: H };
  reg.page = diag.page;
  slides.forEach(function (s, i) {
    var r = s.getBoundingClientRect();
    var w = Math.round(r.width), h = Math.round(r.height);
    if (w !== W || h !== H) diag.sizeMismatch.push({ slide: i + 1, width: w, height: h });
  });
  style.textContent = '@page { size: ' + W + 'px ' + H + 'px; margin: 0; }\n html, body { width:' + W + 'px !important; }' + baseCss;

  // 4b. Blurred box-shadows → pre-rendered images (see header); synchronous, so a beforeprint
  //     handler already has them. Off for export-pdf.mjs, which repairs the masks in the file.
  if (opts.rasterShadows !== false) {
    try { __nbgRasterShadows(slides, reg, diag, opts); }
    catch (e) { diag.notes.push('shadow rasterisation failed: ' + (e && e.message ? e.message : e)); }
  }

  // 5. Wait for fonts, images and two frames so lazy layout settles before printing.
  //    (Everything above ran synchronously, so a `beforeprint` handler already has the layout.)
  try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) { diag.notes.push('fonts.ready failed: ' + e); }
  await Promise.all(Array.prototype.slice.call(document.images).filter(function (im) { return !im.complete; })
    .map(function (im) { return new Promise(function (res) { im.onload = im.onerror = res; }); }));
  await new Promise(function (res) { requestAnimationFrame(function () { requestAnimationFrame(res); }); });
  window.scrollTo(0, 0);
  return diag;
}

function nbgRestorePrintLayout() {
  var reg = __nbgPrintRegistry;
  if (!reg) return false;
  __nbgPrintRegistry = null;
  if (reg.style && reg.style.parentNode) reg.style.parentNode.removeChild(reg.style);
  // the pre-rendered shadows go first; then every attribute change, in reverse order so an
  // element touched twice ends up with its original state
  (reg.inserted || []).forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
  for (var i = reg.touched.length - 1; i >= 0; i--) {
    var t = reg.touched[i], el = t.el;
    if (t.className === null) el.removeAttribute('class'); else el.setAttribute('class', t.className);
    if (t.style === null) {
      el.removeAttribute('style');
      // Chrome: after el.style.setProperty() and a style recalc, the first removeAttribute('style')
      // leaves an empty style="" behind (the inline declaration re-synchronises); a second one clears it.
      if (el.getAttribute('style') === '') el.removeAttribute('style');
    } else el.setAttribute('style', t.style);
    if (t.hidden === null) el.removeAttribute('hidden'); else el.setAttribute('hidden', t.hidden);
    if (t.ariaHidden === null) el.removeAttribute('aria-hidden'); else el.setAttribute('aria-hidden', t.ariaHidden);
  }
  // let the deck's own viewport-fit code recompute its scale/centering
  try { window.dispatchEvent(new Event('resize')); } catch (e) { /* ignore */ }
  return true;
}
