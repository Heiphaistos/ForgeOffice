// Boites de dialogue des dispositions LibreOffice / OpenOffice : ouvre chaque boite par le menu, photographie chaque onglet, verifie la structure.
// Usage : node apps/web/tests/e2e/lo-dialogs.mjs <port vite> <port cdp> <dossier> [layout] [theme]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './harness.mjs';

const [vitePort = '5391', cdp = '9694', outDir = 'shots/lo-dlg', layout = 'libreoffice', theme = 'light'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const ok = (name, cond, info = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ` : ${info}` : ''}`); if (!cond) process.exitCode = 1; };
const b = await launch({ port: Number(cdp) });
const clickText = (sel, re) => b.ev(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => new RegExp(${JSON.stringify(re)}, 'i').test(x.textContent)); if (!e) return false; e.click(); return true; })()`);
const menuPath = async (top, item) => {
  await clickText('.fo-suite .fo-menubar__row > .fo-menubar__item', `^${top}`);
  await sleep(250);
  const hit = await clickText('.fo-menu [role^="menuitem"]', `^${item}`);
  await sleep(500);
  return hit;
};
try {
  await b.goto(`http://127.0.0.1:${vitePort}/?app=word`, 600);
  await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"${layout}"'); localStorage.setItem('fo-setting:ui.theme', '"${theme}"')`);
  await b.goto(`http://127.0.0.1:${vitePort}/?app=word`, 2500);
  await b.ev(`document.querySelector('.ProseMirror')?.focus()`);
  const jobs = [['Format', 'Caract', 'char'], ['Format', 'Paragraphe', 'para'], ['Format', 'Page', 'page'], layout === 'openoffice' ? ['Insertion', 'Tableau', 'table'] : ['Tableau', 'Ins.rer un tableau', 'table'], ['.dition', 'Rechercher (et|&)', 'find']];
  for (const [top, item, name] of jobs) {
    const hit = await menuPath(top, item);
    ok(`ouvre ${name}`, hit);
    const info = await b.ev(`(() => { const d = document.querySelector('.fo-dialog--suite'); if (!d) return null; return { tabs: [...d.querySelectorAll('[role=tab]')].map((t) => t.textContent + (t.disabled ? '(off)' : '')), buttons: [...d.querySelectorAll('.fo-sbtn')].map((x) => x.textContent), w: d.getBoundingClientRect().width, h: d.getBoundingClientRect().height }; })()`);
    ok(`boite suite ${name}`, !!info, JSON.stringify(info));
    if (info) {
      await b.shot(join(outDir, `${layout}-${theme}-${name}-0.png`));
      const n = info.tabs.length;
      for (let i = 1; i < n; i++) {
        const dis = await b.ev(`document.querySelectorAll('.fo-dialog--suite [role=tab]')[${i}].disabled`);
        if (dis) continue;
        await b.ev(`document.querySelectorAll('.fo-dialog--suite [role=tab]')[${i}].click()`);
        await sleep(150);
        await b.shot(join(outDir, `${layout}-${theme}-${name}-${i}.png`));
      }
    }
    await b.ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); document.querySelector('.fo-dialog--suite')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
    await sleep(300);
    ok(`ferme ${name}`, await b.ev(`!document.querySelector('.fo-dialog--suite')`));
  }
  console.log(b.consoleLog.slice(0, 8).join('\n') || 'console propre');
} finally {
  await b.close();
}
