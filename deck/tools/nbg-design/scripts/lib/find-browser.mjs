// NBG Design — shared Chrome/Chromium/Edge locator for the browser-backed scripts
// (screenshot-deck.mjs, export-pdf.mjs). Zero dependencies.
//
// Returns the executable path, `null` when no browser exists on the host, or
// `{ error }` when an explicit path was given but is not executable (an explicit
// --browser flag is authoritative: honor it or fail clearly, never fall back).

import { accessSync, constants } from 'node:fs';
import { spawnSync } from 'node:child_process';

export function findBrowser(explicit) {
  if (explicit) {
    try { accessSync(explicit, constants.X_OK); return explicit; }
    catch { return { error: `--browser path is not an executable: ${explicit}` }; }
  }
  const candidates = [
    process.env.NBG_BROWSER, process.env.CHROME_BIN, process.env.CHROME_PATH, process.env.BROWSER,
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    // Linux common paths
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/chrome',
    '/snap/bin/chromium', '/usr/bin/microsoft-edge',
  ].filter(Boolean);
  for (const c of candidates) {
    try { accessSync(c, constants.X_OK); return c; } catch { /* keep looking */ }
  }
  // PATH lookup as a last resort
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome']) {
    const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [name], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim().split('\n')[0];
  }
  return null;
}

export const NO_BROWSER_EXIT_CODE = 3;
