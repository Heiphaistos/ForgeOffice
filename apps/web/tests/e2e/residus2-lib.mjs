// Outils de residus2.mjs : seconde fenetre (onglet du meme profil) pilotee par CDP brut, lecture des telechargements.
import { sleep } from './harness.mjs';

/** Se connecte a une page deja ouverte du navigateur (fenetre ouverte par window.open). `port` = port CDP du navigateur. */
export async function attachPage(port, match, timeout = 15000) {
  const t0 = Date.now();
  let target;
  while (!target && Date.now() - t0 < timeout) {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    target = list.find((t) => t.type === 'page' && match(t.url));
    if (!target) await sleep(250);
  }
  if (!target) throw new Error('page introuvable');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const i = ++id;
    pending.set(i, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  await send('Runtime.enable');
  return {
    url: target.url,
    send,
    async ev(expression) {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(`ev: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
      return r.result.value;
    },
    async waitFor(expr, ms = 8000) {
      const t = Date.now();
      while (Date.now() - t < ms) { if (await this.ev(`Boolean(${expr})`).catch(() => false)) return true; await sleep(150); }
      return false;
    },
    async shot(file) {
      const { writeFileSync } = await import('node:fs');
      const r = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(file, Buffer.from(r.data, 'base64'));
    },
    async click(x, y) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    },
    async clickSel(sel) {
      const box = await this.ev(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.getBoundingClientRect().width > 0); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
      if (!box) throw new Error(`introuvable : ${sel}`);
      await this.click(box.x, box.y);
      await sleep(200);
    },
    async key(key, vk) {
      const base = { key, code: key, windowsVirtualKeyCode: vk };
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
    },
    close() { try { ws.close(); } catch { /* deja ferme */ } },
  };
}

/** Telechargements captes (window.__dl de harness) de la page principale. */
export async function waitDownload(b, ext, ms = 20000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    const d = await b.downloads();
    const hit = d.find((x) => x.name.toLowerCase().endsWith(ext));
    if (hit) return hit;
    await sleep(300);
  }
  throw new Error(`aucun telechargement ${ext}`);
}
