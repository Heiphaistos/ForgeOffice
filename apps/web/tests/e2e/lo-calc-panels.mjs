// Barre laterale de Calc en disposition LibreOffice : rail a 5 onglets, panneau Navigateur (acces Colonne/Ligne + feuilles), Styles (liste, application), Galerie.
// Usage : node apps/web/tests/e2e/lo-calc-panels.mjs <port vite> <port cdp>
import { launch, sleep } from './harness.mjs';

const [vitePort = '5391', cdp = '9716'] = process.argv.slice(2);
const ok = (name, cond, info = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ` : ${info}` : ''}`); if (!cond) process.exitCode = 1; };
const b = await launch({ port: Number(cdp) });
const rail = (i) => b.ev(`(() => { const e = document.querySelectorAll('.fo-oo-rail--right .fo-oo-rail__btn')[${i}]; if (e.getAttribute('aria-pressed') !== 'true') e.click(); })()`);
try {
  await b.viewport(1920, 1040);
  await b.goto(`http://127.0.0.1:${vitePort}/?app=excel`, 600);
  await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"libreoffice"'); localStorage.setItem('fo-setting:ui.theme', '"light"')`);
  await b.goto(`http://127.0.0.1:${vitePort}/?app=excel`, 2500);
  const titles = await b.ev(`[...document.querySelectorAll('.fo-oo-rail--right .fo-oo-rail__btn')].map((x) => x.title)`);
  ok('rail : Proprietes, Styles, Galerie, Navigateur, Fonctions', JSON.stringify(titles) === JSON.stringify(['Propriétés', 'Styles', 'Galerie', 'Navigateur', 'Fonctions']), titles.join(','));
  // Navigateur : Colonne C, Ligne 5 -> la zone Nom suit
  await rail(3); await sleep(400);
  await b.ev(`(() => { const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); }; const [c, r] = document.querySelectorAll('.fo-lcp__nav input'); set(c, 'C'); set(r, '5'); r.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`);
  await sleep(500);
  const name = await b.ev(`document.querySelector('.xl-namebox input')?.value`);
  ok('Navigateur : Colonne C / Ligne 5 atteint C5', name === 'C5', String(name));
  const sheets = await b.ev(`[...document.querySelectorAll('.fo-lcp__leaf:not(.is-off)')].map((x) => x.textContent)`);
  ok('Navigateur : liste des feuilles', sheets.length >= 1, sheets.join(','));
  // Styles : un clic applique le style (la cellule C5 change de fond / police)
  await rail(1); await sleep(400);
  const rows = await b.ev(`document.querySelectorAll('.fo-lcp__row').length`);
  ok('Styles : les 19 noms de LibreOffice (Par défaut...)', rows === 19, String(rows));
  await b.ev(`[...document.querySelectorAll('.fo-lcp__row')].find((x) => /^Correct$/.test(x.textContent.trim())).click()`);
  await sleep(500);
  const st = await b.ev(`(() => { const s = [...document.querySelectorAll('.fo-lcp__row')].find((x) => x.getAttribute('aria-selected') === 'true'); return s?.textContent.trim() ?? null; })()`);
  ok('Styles : « Correct » appliqué et surligné', st === 'Correct', String(st));
  await rail(2); await sleep(300);
  ok('Galerie : categories et objets', (await b.ev(`document.querySelectorAll('.fo-lcp__cats button').length`)) >= 1 && (await b.ev(`document.querySelectorAll('.fo-lcp__list .fo-lcp__row').length`)) >= 1);
  // Menu Affichage : Navigateur ouvre le panneau ; Zoom > 150 % change le zoom de la feuille
  const menuPath = async (top, ...items) => {
    await b.ev(`[...document.querySelectorAll('.fo-suite .fo-menubar__row > .fo-menubar__item')].find((x) => new RegExp('^${top}').test(x.textContent))?.click()`);
    await sleep(250);
    for (const it of items) { await b.ev(`[...document.querySelectorAll('.fo-menu [role^="menuitem"]')].find((x) => x.textContent.trim().startsWith(${JSON.stringify(it)}))?.click()`); await sleep(350); }
  };
  await rail(0); await sleep(200);
  await menuPath('Affichage', 'Navigateur');
  ok('Affichage > Navigateur ouvre le panneau', await b.ev(`!!document.querySelector('.fo-lcp__nav')`));
  await menuPath('Affichage', 'Zoom', '150');
  const zoom = await b.ev(`document.querySelector('.fo-sb')?.textContent`);
  ok('Affichage > Zoom > 150 %', /150/.test(zoom ?? ''), String(zoom).slice(-40));
  console.log(b.consoleLog.slice(0, 5).join('\n') || 'console propre');
} finally { await b.close(); }
