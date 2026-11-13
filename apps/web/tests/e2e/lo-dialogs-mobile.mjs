// Boites LibreOffice / OpenOffice a 390 px : aucune ne deborde de l'ecran. Usage : node apps/web/tests/e2e/lo-dialogs-mobile.mjs <port vite> <port cdp>
import { launch, sleep } from './harness.mjs';

const [vite = '5391', cdp = '9726'] = process.argv.slice(2);
let bad = 0;
const b = await launch({ port: Number(cdp) });
try {
  await b.viewport(390, 800);
  for (const layout of ['libreoffice', 'openoffice']) {
    await b.goto(`http://127.0.0.1:${vite}/?app=word`, 500);
    await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"${layout}"')`);
    await b.goto(`http://127.0.0.1:${vite}/?app=word`, 2200);
    for (const [top, item] of [['Format', 'Caract'], ['Format', 'Paragraphe'], ['Format', 'Page'], ['.dition', 'Rechercher'], ['Outils', 'Options[.][.][.]']]) {
      await b.ev(`(() => { const t = [...document.querySelectorAll('.fo-suite .fo-menubar__row > .fo-menubar__item')].find((x) => new RegExp('^${top}', 'i').test(x.textContent)); t?.click(); })()`);
      await sleep(250);
      await b.ev(`[...document.querySelectorAll('.fo-menu [role^="menuitem"]')].find((x) => new RegExp('^${item}', 'i').test(x.textContent))?.click()`);
      await sleep(500);
      const r = await b.ev(`(() => { const d = document.querySelector('.fo-dialog'); if (!d) return null; const r = d.getBoundingClientRect(); return { l: r.left, r: r.right, doc: document.documentElement.scrollWidth, body: d.scrollWidth - d.clientWidth }; })()`);
      const fine = r && r.l >= -1 && r.r <= 391 && r.doc <= 391 && r.body <= 2;
      if (!fine) bad++;
      console.log(`${fine ? 'OK  ' : 'FAIL'} ${layout} ${item} 390 px`, JSON.stringify(r));
      await b.ev(`document.querySelector('.fo-dialog')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
      await sleep(250);
    }
  }
} finally { await b.close(); }
process.exitCode = bad ? 1 : 0;
