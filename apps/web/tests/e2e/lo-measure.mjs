// Releve de mesure de la disposition LibreOffice / OpenOffice de ForgeOffice : captures en 1936x1048 (taille des vraies fenetres) et geometrie des menus ouverts.
// Usage : node apps/web/tests/e2e/lo-measure.mjs <port vite> <port cdp> <dossier> <app> <layout> [theme]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './harness.mjs';

const [vitePort, cdp, outDir, app = 'excel', layout = 'libreoffice', theme = 'light'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const b = await launch({ port: Number(cdp) });
const out = { menus: [] };
try {
  await b.viewport(1936, 1048);
  await b.goto(`http://127.0.0.1:${vitePort}/?app=${app}`, 600);
  await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"${layout}"'); localStorage.setItem('fo-setting:ui.theme', '"${theme}"')`);
  await b.goto(`http://127.0.0.1:${vitePort}/?app=${app}`, 2500);
  if (app === 'publisher') { try { await b.click('text=A4 (portrait)'); await sleep(800); } catch { /* deja ouvert */ } }
  await b.shot(join(outDir, 'base.png'));
  const tops = await b.ev(`[...document.querySelectorAll('.fo-suite .fo-menubar__row > .fo-menubar__item')].map((x) => x.textContent)`);
  out.tops = tops;
  for (const [i, label] of tops.entries()) {
    if (label === 'ForgeOffice' || label === 'Disposition') continue;
    await b.ev(`document.querySelectorAll('.fo-suite .fo-menubar__row > .fo-menubar__item')[${i}]?.click()`);
    await sleep(400);
    const m = await b.ev(`(() => [...document.querySelectorAll('.fo-menu')].map((m) => { const r = m.getBoundingClientRect(); const q = (sel) => [...m.querySelectorAll(sel)].map((e) => e.getBoundingClientRect());
      const L = q('.fo-menu__label'), S = q('.fo-menu__shortcut'), C = q('.fo-menu__chevron');
      const mx = (a, f) => (a.length ? Math.max(...a.map(f)) - r.x : null), mn = (a, f) => (a.length ? Math.min(...a.map(f)) - r.x : null);
      return { x: r.x, y: r.y, w: r.width, h: r.height, n: m.children.length, labL: mn(L, (b) => b.left), labR: mx(L, (b) => b.right), labW: L.length ? Math.max(...L.map((b) => b.width)) : 0, shL: mn(S, (b) => b.left), shR: mx(S, (b) => b.right), shW: S.length ? Math.max(...S.map((b) => b.width)) : 0, chL: mn(C, (b) => b.left), chR: mx(C, (b) => b.right), rows: [...m.querySelectorAll('.fo-menu__item')].map((it) => { const l = it.querySelector('.fo-menu__label'), s = it.querySelector('.fo-menu__shortcut'); return [l ? Math.round(l.getBoundingClientRect().width * 10) / 10 : 0, s ? Math.round(s.getBoundingClientRect().width * 10) / 10 : 0, it.querySelector('.fo-menu__chevron') ? 1 : 0]; }) }; }))()`);
    out.menus.push({ label, popups: m });
    await b.shot(join(outDir, `m${out.menus.length - 1}.png`));
    await b.ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
    await sleep(150);
  }
  writeFileSync(join(outDir, 'geo.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out.menus.map((m) => [m.label, m.popups.map((p) => `${p.w}x${p.h}`).join('+')])));
} finally {
  await b.close();
}
