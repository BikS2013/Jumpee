// NBG Design — minimal Chrome DevTools Protocol client over --remote-debugging-pipe.
// fd 3 = to browser, fd 4 = from browser; messages are JSON terminated by a NUL byte.
// Zero dependencies. Used by export-pdf.mjs and by test scripts.

import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

export class Cdp {
  constructor(proc) {
    this.proc = proc; this.nextId = 0; this.pending = new Map(); this.listeners = new Set(); this.buf = '';
    const input = proc.stdio[4];
    input.setEncoding('utf8');
    input.on('data', (chunk) => {
      this.buf += chunk;
      let i;
      while ((i = this.buf.indexOf('\0')) >= 0) {
        const raw = this.buf.slice(0, i); this.buf = this.buf.slice(i + 1);
        let msg; try { msg = JSON.parse(raw); } catch { continue; }
        this.dispatch(msg);
      }
    });
  }
  dispatch(m) {
    if (m.id !== undefined && this.pending.has(m.id)) {
      const p = this.pending.get(m.id); this.pending.delete(m.id);
      if (m.error) p.reject(new Error(`${p.method}: ${m.error.message}${m.error.data ? ' — ' + m.error.data : ''}`));
      else p.resolve(m.result);
    } else if (m.method) {
      for (const l of this.listeners) l(m);
    }
  }
  send(method, params = {}, sessionId) {
    const id = ++this.nextId;
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.proc.stdio[3].write(JSON.stringify(msg) + '\0');
    });
  }
  waitFor(method, sessionId, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.listeners.delete(l); reject(new Error(`timeout waiting for ${method}`)); }, timeoutMs);
      const l = (m) => {
        if (m.method === method && (!sessionId || m.sessionId === sessionId)) {
          clearTimeout(timer); this.listeners.delete(l); resolve(m.params);
        }
      };
      this.listeners.add(l);
    });
  }
  failAll(err) { for (const p of this.pending.values()) p.reject(err); this.pending.clear(); }
}

/**
 * Launch a headless browser with a throw-away profile and return { proc, cdp, close }.
 * `close()` kills the process and deletes the profile; safe to call more than once.
 */
export function launchBrowser(browserPath, { width = 1920, height = 1080 } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'nbg-cdp-profile-'));
  const proc = spawn(browserPath, [
    '--headless=new', '--remote-debugging-pipe', '--disable-gpu', '--hide-scrollbars',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync',
    '--disable-background-networking', '--mute-audio', '--force-device-scale-factor=1',
    `--user-data-dir=${profile}`, `--window-size=${width},${height}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  let stderr = '';
  proc.stderr.setEncoding('utf8');
  proc.stderr.on('data', (d) => { stderr += d; if (stderr.length > 20000) stderr = stderr.slice(-20000); });
  const cdp = new Cdp(proc);
  proc.on('exit', () => cdp.failAll(new Error('browser exited')));
  const exited = new Promise((_, reject) => proc.on('exit', (code) =>
    reject(new Error(`browser exited early (code ${code})${stderr ? '\n' + stderr.trim().split('\n').slice(-5).join('\n') : ''}`))));
  exited.catch(() => { /* raced by callers; never an unhandled rejection after close() */ });
  const close = () => {
    try { proc.kill('SIGKILL'); } catch { /* ignore */ }
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  };
  return { proc, cdp, exited, close };
}

/** Open a page target and attach to it (flattened session). Returns { sessionId, targetId }. */
export async function openPage(cdp, { width = 1920, height = 1080 } = {}) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
  return { sessionId, targetId };
}

/** Navigate the session to a URL and wait for the load event. */
export async function navigate(cdp, sessionId, url, timeoutMs) {
  const loaded = cdp.waitFor('Page.loadEventFired', sessionId, timeoutMs);
  await cdp.send('Page.navigate', { url }, sessionId);
  await loaded;
}

/** Evaluate an expression in the page, awaiting promises, returning the value; throws on exception. */
export async function evaluate(cdp, sessionId, expression) {
  const ev = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (ev.exceptionDetails) throw new Error(ev.exceptionDetails.exception?.description || ev.exceptionDetails.text);
  return ev.result.value;
}

/** Print the current page to PDF at the given CSS-px page box; returns a Buffer. */
export async function printToPdf(cdp, sessionId, { width, height }) {
  const pdf = await cdp.send('Page.printToPDF', {
    printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false, scale: 1,
    paperWidth: width / 96, paperHeight: height / 96,
    marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
    transferMode: 'ReturnAsBase64',
  }, sessionId);
  return Buffer.from(pdf.data, 'base64');
}

/** Count pages in a Chrome/Skia PDF (classic xref tables, no object streams). */
export function countPdfPages(buf) {
  const m = buf.toString('latin1').match(/\/Type\s*\/Page(?![A-Za-z])/g);
  return m ? m.length : 0;
}
