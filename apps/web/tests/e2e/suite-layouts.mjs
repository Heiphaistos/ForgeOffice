// LibreOffice et OpenOffice : menus propres a la suite, deux barres d'outils, barre laterale « Proprietes ». Usage : node suite-layouts.mjs <port vite> <port cdp>
import { launch, sleep } from './harness.mjs';

const [vite = '5190', cdp = '9713'] = process.argv.slice(2);
// Base (access) n'affiche son ruban qu'avec une base ouverte : couvert par le test unitaire des menus.
const MODULES = ['word', 'excel', 'powerpoint', 'publisher', 'notes', 'pdf', 'convert'];
const WANT = { word: ['Édition', 'Affichage', 'Insertion', 'Format', 'Tableau', 'Outils'], excel: ['Édition', 'Affichage', 'Insertion', 'Format', 'Données', 'Outils'], powerpoint: ['Édition', 'Affichage', 'Insertion', 'Format', 'Diapo', 'Diaporama', 'Outils'] };
const b = await launch({ port: Number(cdp) });
let bad = 0;
const ok = (n, c, i = '') => { if (!c) bad++; console.log(`${c ? 'OK  ' : 'FAIL'} ${n}${i ? ` : ${i}` : ''}`); };
try {
  await b.viewport(1440, 900);
  await b.goto(`http://127.0.0.1:${vite}/`, 600);
  for (const layout of ['libreoffice', 'openoffice']) {
    await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"${layout}"')`);
    for (const app of MODULES) {
      await b.goto(`http://127.0.0.1:${vite}/?app=${app}`, 2200);
      const labels = await b.ev(`[...document.querySelectorAll('.fo-menubar__row .fo-menubar__item')].map((x) => x.textContent.trim())`);
      const bars = await b.ev(`document.querySelectorAll('.fo-menubar__toolbar').length`);
      const want = (WANT[app] ?? []).filter((w) => layout === 'libreoffice' || (w !== 'Styles' && w !== 'Diapo'));
      ok(`${layout} ${app} : menus de la suite`, want.every((w) => labels.includes(w)), labels.join(' / '));
      ok(`${layout} ${app} : barres d'outils`, bars >= 1, String(bars));
      ok(`${layout} ${app} : barre laterale`, await b.ev(`Boolean(document.querySelector('.fo-oo-rail--right'))`));
      // Chaque menu s'ouvre et contient des commandes (ou le message « selectionnez un objet »).
      const n = await b.ev(`(async () => { const items = [...document.querySelectorAll('.fo-menubar__row .fo-menubar__item')]; let empty = 0; for (const it of items.slice(1, -1)) { it.click(); await new Promise((r) => setTimeout(r, 120)); const c = document.querySelectorAll('.fo-menu [role=menuitem]').length; if (c === 0) empty++; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await new Promise((r) => setTimeout(r, 80)); } return empty; })()`);
      ok(`${layout} ${app} : aucun menu vide`, n === 0, String(n));
      ok(`${layout} ${app} : menus Fenetre et Aide`, labels.includes('Fenêtre') && labels.includes('Aide'), labels.join(' / '));
      // Fichier = menu deroulant ; « Imprimer » ouvre le Backstage.
      await b.ev(`document.querySelector('.fo-menubar__row .fo-menubar__item').click()`);
      await sleep(150);
      const fileItems = await b.ev(`[...document.querySelectorAll('.fo-menu [role=menuitem]')].map((x) => x.textContent.trim())`);
      ok(`${layout} ${app} : menu Fichier deroulant`, fileItems.length >= 8 && fileItems.some((x) => x.startsWith('Imprimer')), String(fileItems.length));
      await b.ev(`[...document.querySelectorAll('.fo-menu [role=menuitem]')].find((x) => x.textContent.startsWith('Imprimer'))?.click()`);
      await sleep(500);
      ok(`${layout} ${app} : Imprimer ouvre le Backstage`, await b.ev(`Boolean(document.querySelector('.fo-bs'))`));
      await b.ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
      await sleep(250);
    }
  }
  console.log(b.consoleLog.slice(0, 6).join('\n') || 'console propre');
} finally {
  await b.close();
}
process.exit(bad ? 1 : 0);
