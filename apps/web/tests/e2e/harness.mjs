// Petit pilote Chrome/Edge par CDP, sans dependance (Node 24 : WebSocket et fetch natifs).
// Un seul navigateur a la fois, profil temporaire supprime dans close().
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Navigateur : variable CHROME, sinon Chromium de Playwright, sinon Edge. */
export function findBrowser() {
  if (process.env.CHROME && existsSync(process.env.CHROME)) return process.env.CHROME;
  const pw = join(process.env.LOCALAPPDATA ?? '', 'ms-playwright');
  if (existsSync(pw)) {
    for (const d of readdirSync(pw).filter((n) => n.startsWith('chromium-')).sort().reverse()) {
      const exe = join(pw, d, 'chrome-win64', 'chrome.exe');
      if (existsSync(exe)) return exe;
    }
  }
  for (const p of ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe']) if (existsSync(p)) return p;
  throw new Error('Aucun navigateur trouve : definir CHROME');
}

// Script injecte dans chaque page : telechargements captes, selecteur de fichier pilote, depot de fichier.
const INIT = `(() => {
  const b64 = (buf) => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  window.__dl = []; window.__picks = [];
  const aClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download && this.href.startsWith('blob:')) { const name = this.download; fetch(this.href).then((r) => r.arrayBuffer()).then((b) => window.__dl.push({ name, b64: b64(b) })); return; }
    return aClick.call(this);
  };
  const iClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function () {
    if (this.type !== 'file') return iClick.call(this);
    const p = window.__picks.shift();
    if (!p) { this.dispatchEvent(new Event('cancel')); return; }
    const dt = new DataTransfer(); dt.items.add(new File([unb64(p.b64)], p.name)); this.files = dt.files;
    this.dispatchEvent(new Event('change', { bubbles: true }));
  };
  window.__drop = (sel, name, data) => {
    const dt = new DataTransfer(); dt.items.add(new File([unb64(data)], name));
    const el = document.querySelector(sel);
    for (const t of ['dragenter', 'dragover', 'drop']) el.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt }));
  };
})();`;

export async function launch({ port = 9581 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'foe2e-'));
  const proc = spawn(findBrowser(), ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--window-size=1440,900', '--force-device-scale-factor=1', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  let list;
  for (let i = 0; i < 80 && !list; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { await sleep(250); } }
  const page = list?.find((t) => t.type === 'page');
  if (!page) throw new Error('navigateur injoignable');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0; const pending = new Map(); const consoleLog = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) consoleLog.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300)}`);
    else if (m.method === 'Runtime.exceptionThrown') consoleLog.push(`exception: ${(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 300)}`);
    else if (m.method === 'Log.entryAdded' && ['error', 'warning'].includes(m.params.entry.level)) consoleLog.push(`log-${m.params.entry.level}: ${m.params.entry.text.slice(0, 200)} ${m.params.entry.url ?? ''}`);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const i = ++id; pending.set(i, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result))); ws.send(JSON.stringify({ id: i, method, params }));
  });
  for (const d of ['Page', 'Runtime', 'Log']) await send(`${d}.enable`);
  await send('Page.addScriptToEvaluateOnNewDocument', { source: INIT });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => undefined);

  const b = {
    consoleLog,
    send,
    async ev(expression) {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(`ev: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
      return r.result.value;
    },
    /** Fenetre de bureau (defaut) ou telephone tactile. */
    async viewport(w = 1440, h = 900, mobile = false) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile });
      await send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 });
    },
    /** Navigue puis attend que l'application ait rendu (au moins un element sous #root, hors ecran de demarrage). */
    async goto(url, wait = 800) {
      await send('Page.navigate', { url }); await sleep(300);
      await b.waitFor("document.querySelector('#root > .fo-shell') && !document.querySelector('.fo-splash')", 30000);
      await sleep(wait);
    },
    async waitFor(expr, ms = 8000) {
      const t = Date.now();
      while (Date.now() - t < ms) { if (await b.ev(`Boolean(${expr})`).catch(() => false)) return true; await sleep(150); }
      return false;
    },
    async shot(file) { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(file, Buffer.from(r.data, 'base64')); },
    /** Clic reel au centre du premier element visible (selecteur CSS, ou `text=...` : texte exact d'un bouton, onglet, item...). */
    async click(target, { touch = false, count = 1 } = {}) {
      const box = await b.ev(`(() => {
        const t = ${JSON.stringify(target)};
        const els = t.startsWith('text=') ? [...document.querySelectorAll('button,[role=menuitem],[role=tab],a,label,[role=option],li,span')].filter((e) => e.textContent.trim() === t.slice(5)) : [...document.querySelectorAll(t)];
        const e = els.find((x) => x.getBoundingClientRect().width > 0) ?? null; if (!e) return null;
        e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const r = e.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
      })()`);
      if (!box) throw new Error(`introuvable: ${target}`);
      if (touch) {
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.y }] });
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
        for (let n = 1; n <= count; n++) {
          await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: n });
          await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: n });
        }
      }
      await sleep(250);
      return box;
    },
    /** Clic sur l'element de selecteur `sel` dont le texte est exactement `text`. */
    async clickText(sel, text, opts) {
      const idx = await b.ev(`(() => { const l = [...document.querySelectorAll(${JSON.stringify(sel)})].filter((e) => e.getBoundingClientRect().width > 0 && e.textContent.trim() === ${JSON.stringify(text)}); if (!l[0]) return -1; l[0].setAttribute('data-e2e', 'x'); return 0; })()`);
      if (idx < 0) throw new Error(`introuvable: ${sel} « ${text} »`);
      try { return await b.click('[data-e2e=x]', opts); } finally { await b.ev(`document.querySelector('[data-e2e=x]')?.removeAttribute('data-e2e')`); }
    },
    /** Frappe reelle caractere par caractere (keydown + keypress + input), pour les grilles et editeurs qui ecoutent le clavier. */
    async press(text) {
      for (const ch of text) {
        if (ch === '\n') { await b.key('Enter'); continue; }
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch, unmodifiedText: ch });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
      }
      await sleep(200);
    },
    async type(text) { await send('Input.insertText', { text }); await sleep(150); },
    /** Touche avec modificateurs ; `commands` declenche la vraie commande d'edition (copy, paste, selectAll...). */
    async key(key, { ctrl = false, shift = false, commands, code } = {}) {
      const mods = (ctrl ? 2 : 0) | (shift ? 8 : 0);
      const vk = key.length === 1 ? key.toUpperCase().charCodeAt(0) : ({ Enter: 13, Escape: 27, Tab: 9, Backspace: 8, Delete: 46, ArrowDown: 40, ArrowRight: 39 }[key] ?? 0);
      const base = { key, code: code ?? (key.length === 1 ? `Key${key.toUpperCase()}` : key), modifiers: mods, windowsVirtualKeyCode: vk };
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base, ...(commands ? { commands } : {}) });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
      await sleep(250);
    },
    async pick(name, bytes) { await b.ev(`window.__picks.push(${JSON.stringify({ name, b64: Buffer.from(bytes).toString('base64') })})`); },
    async drop(sel, name, bytes) { await b.ev(`window.__drop(${JSON.stringify(sel)}, ${JSON.stringify(name)}, ${JSON.stringify(Buffer.from(bytes).toString('base64'))})`); },
    /** Telechargements captes depuis la derniere lecture. */
    async downloads() { const d = await b.ev('window.__dl.splice(0)'); return d.map((x) => ({ name: x.name, bytes: Buffer.from(x.b64, 'base64') })); },
    async close() {
      try { ws.close(); } catch { /* deja ferme */ }
      spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F']);
      spawnSync('powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${basename(dir)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`]);
      for (let i = 0; i < 20; i++) { try { rmSync(dir, { recursive: true, force: true }); break; } catch { await sleep(500); } }
    },
  };
  return b;
}
