// Parcourt chaque commande du ruban (tous les onglets, formes selectionnee) et signale celles qui ne changent rien a l'ecran.
// Usage : node residus2-ribbon.mjs <fichier> <app> <x_pt> <y_pt> ; banc http://127.0.0.1:5371 ; CDP 9631.
import { readFileSync } from 'node:fs';
import { launch, sleep } from './harness.mjs';

const [file, app, xs, ys] = process.argv.slice(2);
const BASE = process.env.FO_BASE ?? 'http://127.0.0.1:5371';
const b = await launch({ port: 9631 });
const sig = () => b.ev(`(() => { const h = document.body.outerHTML; let x = 0; for (let i = 0; i < h.length; i++) x = (x * 31 + h.charCodeAt(i)) | 0; return x + ':' + h.length; })()`);
const pageW = app === 'publisher' ? 595.2756 : 960;
async function clickPage() {
  const r = await b.ev(`(() => { const p = document.querySelector('.fo-canvas__page').getBoundingClientRect(); return { x: p.left, y: p.top, w: p.width }; })()`);
  const k = r.w / pageW;
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', { type, x: r.x + Number(xs) * k, y: r.y + Number(ys) * k, button: 'left', clickCount: 1 });
  await sleep(250);
}
const noop = [];
const errors = [];
try {
  await b.viewport(1900, 1000);
  await b.goto(`${BASE}/?app=hub`);
  await b.drop('.hub', file.split(/[\\/]/).pop(), readFileSync(file));
  await b.waitFor(`document.documentElement.dataset.app === ${JSON.stringify(app)}`, 20000);
  await b.waitFor(`!/^(Texte|Tableur|Présentation|Publication|Bloc-notes|PDF|Convertisseur|Base de données) - ForgeOffice$/.test(document.title)`, 20000);
  await sleep(2500);
  await b.shot(`${process.env.TEMP ?? '.'}/ribbon-dbg.png`);
  const tabs = await b.ev(`[...document.querySelectorAll('.fo-ribbon__tabs [role=tab]:not(.fo-ribbon__tab--file)')].filter((t) => t.getBoundingClientRect().width > 0).map((t) => t.textContent.trim())`);
  console.log('onglets :', tabs.join(' | '));
  for (const tab of tabs) {
    await clickPage();
    await b.ev(`[...document.querySelectorAll('.fo-ribbon__tabs [role=tab]')].find((t) => t.textContent.trim() === ${JSON.stringify(tab)})?.click()`);
    await sleep(350);
    const count = await b.ev(`document.querySelectorAll('.fo-ribbon__panel button').length`);
    for (let i = 0; i < count; i++) {
      const info = await b.ev(`(() => { const e = [...document.querySelectorAll('.fo-ribbon__panel button')][${i}]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, vis: r.width > 0 && r.height > 0, dis: e.disabled || e.getAttribute('aria-disabled') === 'true', label: (e.getAttribute('aria-label') || e.title || e.textContent || '').trim().slice(0, 40), popup: e.getAttribute('aria-haspopup') }; })()`);
      if (!info || !info.vis || info.dis) continue;
      const before = await sig();
      const logBefore = b.consoleLog.length;
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', { type, x: info.x, y: info.y, button: 'left', clickCount: 1 });
      await sleep(350);
      const after = await sig();
      const newErrors = b.consoleLog.slice(logBefore).filter((l) => /exception|error/i.test(l) && !/requestFullscreen/.test(l));
      if (newErrors.length) errors.push(`${tab} > ${info.label} : ${newErrors[0].slice(0, 160)}`);
      if (before === after) noop.push(`${tab} > ${info.label}`);
      // retour a l'etat de base : fermer menus, dialogues, diaporama, outils
      for (let k = 0; k < 3; k++) { await b.key('Escape'); await sleep(120); }
      await b.ev(`document.querySelectorAll('[role=dialog] button').forEach((x) => /Annuler|Fermer|Non/.test(x.textContent) && x.click())`);
      const still = await b.ev(`document.querySelectorAll('.fo-canvas__page').length > 0 && !document.querySelector('.fo-bs')`);
      if (!still) { await b.key('Escape'); await b.ev(`document.querySelector('.fo-bs__close, .fo-bs [aria-label=Retour]')?.click()`); await sleep(300); }
      await b.ev(`[...document.querySelectorAll('.fo-ribbon__tabs [role=tab]')].find((t) => t.textContent.trim() === ${JSON.stringify(tab)})?.click()`);
      await sleep(120);
    }
    console.log(`${tab} : ${count} boutons examines`);
  }
} finally {
  await b.close();
}
console.log('\nSANS EFFET VISIBLE (' + noop.length + ') :\n' + noop.join('\n'));
console.log('\nERREURS CONSOLE (' + errors.length + ') :\n' + errors.join('\n'));
