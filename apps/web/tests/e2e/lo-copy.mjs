// Copie LibreOffice / OpenOffice : captures de l'appli ForgeOffice (barre de menus, barres d'outils, menus ouverts) et verifications de structure.
// Usage : node apps/web/tests/e2e/lo-copy.mjs <port vite> <port cdp> <dossier> [app] [layout] [theme]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './harness.mjs';

const [vitePort = '5290', cdp = '9693', outDir = 'shots', app = 'word', layout = 'libreoffice', theme = 'light'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const ok = (name, cond, info = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ` : ${info}` : ''}`); if (!cond) process.exitCode = 1; };
const b = await launch({ port: Number(cdp) });
try {
  await b.goto(`http://127.0.0.1:${vitePort}/?app=${app}`, 600);
  await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"${layout}"'); localStorage.setItem('fo-setting:ui.theme', '"${theme}"')`);
  await b.goto(`http://127.0.0.1:${vitePort}/?app=${app}`, 2500);
  const tops = await b.ev(`[...document.querySelectorAll('.fo-suite .fo-menubar__row > .fo-menubar__item')].map((x) => x.textContent)`);
  console.log('menus :', JSON.stringify(tops));
  ok('barre de menus de la suite', Array.isArray(tops) && tops.length >= 8 && tops[0] === 'Fichier');
  const bars = await b.ev(`[...document.querySelectorAll('.fo-suite__bar')].map((bar) => ({ n: bar.children.length, bound: bar.querySelectorAll('.fo-suite__ctl, .fo-suite__btn:not(:disabled)').length }))`);
  console.log('barres :', JSON.stringify(bars));
  ok('deux barres d\'outils', bars.length >= 2);
  await b.shot(join(outDir, `${layout}-${app}-${theme}-base.png`));
  const names = Array.isArray(tops) ? tops : [];
  for (const [i, label] of names.entries()) {
    if (label === 'ForgeOffice' || label === 'Disposition') continue;
    await b.ev(`document.querySelectorAll('.fo-suite .fo-menubar__row > .fo-menubar__item')[${i}]?.click()`);
    await sleep(350);
    const info = await b.ev(`(() => { const it = [...document.querySelectorAll('.fo-menu > [role^="menuitem"]')]; return { n: it.length, off: it.filter((x) => x.getAttribute('aria-disabled')).length }; })()`);
    console.log(`  ${label} : ${info.n} entrees, ${info.off} grisees`);
    ok(`menu ${label} rempli`, info.n >= 1);
    await b.shot(join(outDir, `${layout}-${app}-${theme}-menu-${i}.png`));
    await b.ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
    await sleep(150);
  }
  console.log(b.consoleLog.slice(0, 8).join('\n') || 'console propre');
} finally {
  await b.close();
}
