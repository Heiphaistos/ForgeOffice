// Ruban Mise en page, sauts de page, zone d'impression, affichages Apercu des sauts et Mise en page (vrai navigateur, modele relu).
// Usage : node apps/web/tests/e2e/page-setup-views.mjs <port vite> <port cdp> <dossier de captures>
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './harness.mjs';
import { fixture, helpers } from './page-setup-lib.mjs';

const [vitePort = '5423', cdp = '9683', outDir = 'shots'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const url = `http://127.0.0.1:${vitePort}/?app=excel`;
const ok = (name, cond, info = '') => console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ` : ${info}` : ''}`);

const b = await launch({ port: Number(cdp) });
const shot = (name) => b.shot(join(outDir, `${name}.png`));
const h = helpers(b, ok);
const goto = async (addr) => {
  await b.ev(`[...document.querySelectorAll('input')].find((e) => /^[A-Z]{1,3}[0-9]+(:[A-Z]{1,3}[0-9]+)?$/.test(e.value))?.setAttribute('data-e2e', 'nb')`);
  await b.click('[data-e2e=nb]');
  await b.key('a', { ctrl: true, commands: ['selectAll'] });
  await b.press(addr);
  await b.key('Enter');
  await b.ev(`document.querySelector('[data-e2e=nb]')?.removeAttribute('data-e2e')`);
};
const menu = async (button, item) => { await b.click(`text=${button}`); await sleep(250); await b.click(`text=${item}`); await sleep(300); };
try {
  // ---- Telephone : les nouveaux controles de l'onglet Mise en page restent atteignables
  await b.viewport(390, 844, true);
  await b.goto(url, 1500);
  await h.tab('Mise en page');
  await sleep(500);
  await shot('15-mobile-mise-en-page');
  const names = await b.ev(`[...document.querySelectorAll('button')].map((e) => (e.getAttribute('aria-label') || e.textContent).trim())`);
  ok('mobile : Marges, Orientation, Taille, Zone, Sauts presents dans le ruban', ['Marges', 'Orientation', 'Taille', 'Zone d’impression', 'Sauts de page'].every((n) => names.includes(n)));
  await b.ev(`(() => { const e = [...document.querySelectorAll('button')].find((x) => !(x.getAttribute('aria-label') || x.textContent).trim() && x.getBoundingClientRect().width > 0 && x.closest('[class*=rb], [class*=ribbon]')); e?.setAttribute('data-e2e', 'more'); })()`);
  await b.click('[data-e2e=more]');
  await sleep(500);
  await shot('16-mobile-suite-ruban');
  const more = await b.ev(`[...document.querySelectorAll('button')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => (e.getAttribute('aria-label') || e.textContent).trim())`);
  ok('mobile : Imprimer les titres, Largeur et Hauteur atteignables via le menu de debordement', ['Imprimer les titres', 'Largeur : Automatique', 'Hauteur : Automatique'].every((n) => more.includes(n)), JSON.stringify(more.slice(8, 24)));
  await b.viewport(1440, 900, false);
  await b.goto(url, 1500);
  await h.openFile('ventes.xlsx', await fixture());
  ok('classeur de test charge', await b.waitFor("document.querySelector('.xl-fi__input')?.value === 'Produit'", 6000));
  await h.tab('Mise en page');
  await menu('Marges', 'Étroites');
  await menu('Orientation', 'Paysage');
  await menu('Taille', 'Légal (21,6 x 35,6 cm)');
  await shot('10-ruban-menu-taille-ouvert');
  await goto('A31');
  await menu('Sauts de page', 'Insérer un saut de page');
  await goto('A1:H40');
  await menu('Zone d’impression', 'Définir la zone d’impression');
  await goto('J1:K5');
  await menu('Zone d’impression', 'Ajouter à la zone d’impression');
  await menu('Largeur : Automatique', '2 pages');
  ok('Largeur affiche 2 pages', await b.ev(`document.body.textContent.includes('Largeur : 2 pages')`));
  await shot('11-ruban-mise-en-page');
  await b.click('text=Imprimer les titres');
  await sleep(500);
  ok('Imprimer les titres ouvre la boite sur Feuille', await b.ev(`Boolean(document.querySelector('.ps-sheetform'))`));
  await shot('12-imprimer-les-titres');
  await h.dlgButton('Annuler');
  // ---- Apercu des sauts de page
  await h.tab('Affichage');
  await b.click('text=Aperçu des sauts de page');
  await sleep(600);
  await shot('13-apercu-sauts-de-page');
  // ---- Mise en page (pages reelles)
  await b.clickText('button[aria-pressed]', 'Mise en page');
  await sleep(900);
  const pages = await b.ev(`document.querySelectorAll('.ps-layout__page').length`);
  ok('Mise en page : pages reelles affichees', pages >= 2, String(pages));
  await shot('14-vue-mise-en-page');
  await b.click('.ps-layout .xl-hf--header');
  await sleep(500);
  ok('clic sur l en-tete : boite Mise en page, onglet En-tete/Pied', await b.ev(`document.querySelector('.fo-dialog [role=tab][aria-selected=true]')?.textContent === 'En-tête/Pied de page'`));
  await h.dlgButton('Annuler');
  await b.ev(`document.querySelector('.ps-layout td[data-r="3"][data-c="1"]')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`);
  await sleep(600);
  ok('double-clic sur une cellule : retour en mode Normal sur B4', await b.ev(`!document.querySelector('.ps-layout') && document.querySelector('.xl-fi__input') !== null`));
  // ---- Etendue de l'impression : selection, puis classeur entier (feuille 2 en A5)
  await b.ev(`window.print = () => { const r = document.querySelector('.xl-print-root'); const c = r.cloneNode(true); c.classList.add('xl-print-copy'); document.body.appendChild(c); }`);
  await b.ev(`document.querySelector('.xl-print-copy')?.remove()`);
  await h.tab('Accueil');
  await goto('A1:C3');
  await h.fichier('Imprimer');
  await sleep(500);
  await h.setSelect('select[aria-label="Étendue de l’impression"]', 'selection');
  await b.click('.xl-print__opts .fo-btn--primary');
  await sleep(900);
  const sel = await b.ev(`({ pages: document.querySelectorAll('.xl-print-copy .xl-page').length, rows: document.querySelector('.xl-print-copy .xl-page tbody')?.children.length })`);
  ok('imprimer la selection : 1 page de 3 lignes', sel.pages === 1 && sel.rows === 3, JSON.stringify(sel));
  await b.ev(`document.querySelector('.xl-print-copy')?.remove()`);
  await h.fichier('Imprimer');
  await sleep(500);
  await h.setSelect('select[aria-label="Étendue de l’impression"]', 'workbook');
  await b.click('.xl-print__opts .fo-btn--primary');
  await sleep(900);
  const all = await b.ev(`({ pages: document.querySelectorAll('.xl-print-copy .xl-page').length, css: document.querySelector('.xl-print-copy style')?.textContent, last: [...document.querySelectorAll('.xl-print-copy .xl-page')].pop()?.textContent.slice(0, 40) })`);
  ok('imprimer le classeur : pages des deux feuilles, @page A5 pour la seconde', all.pages >= 3 && all.css.includes('ps1 { size: 148mm 210mm') && all.last.includes('Seconde feuille'), JSON.stringify(all));
  await b.ev(`document.querySelector('.xl-print-copy')?.remove()`);
  // ---- Modele enregistre
  const ps = (await h.savedModel()).sheets[0].pageSetup;
  ok('marges etroites (0,25 po)', ps.margins.left === 0.25 && ps.margins.right === 0.25 && ps.margins.top === 0.75, JSON.stringify(ps.margins));
  ok('paysage', ps.orientation === 'landscape');
  ok('papier Legal (5)', ps.paperSize === 5, String(ps.paperSize));
  ok('saut de ligne apres la ligne 30', JSON.stringify(ps.rowBreaks) === '[29]', JSON.stringify(ps.rowBreaks));
  ok('zones A1:H40 + J1:K5', JSON.stringify(ps.printArea) === JSON.stringify([{ r1: 0, c1: 0, r2: 39, c2: 7 }, { r1: 0, c1: 9, r2: 4, c2: 10 }]), JSON.stringify(ps.printArea));
  ok('ajuster 2 pages en largeur, hauteur automatique', ps.fitToPage === true && ps.fitToWidth === 2 && ps.fitToHeight === 0, `${ps.fitToPage} ${ps.fitToWidth} ${ps.fitToHeight}`);
  // ---- Commentaires tels qu'affiches + noir et blanc dans l'apercu
  await h.tab('Mise en page');
  await h.launcher();
  await h.tab('Feuille');
  await h.setSelect('#ps-comments', 'asDisplayed');
  await b.clickText('.fo-dialog label', 'Noir et blanc');
  await h.dlgButton('OK');
  await h.fichier('Imprimer');
  await sleep(800);
  const prev = await b.ev(`({ bw: document.querySelectorAll('.xl-print__preview .is-bw').length, notes: [...document.querySelectorAll('.xl-print__preview .xl-page__note')].map((e) => e.textContent) })`);
  ok('apercu : noir et blanc applique et note affichee sur la page', prev.bw === 1 && prev.notes.join() === 'Valeur a confirmer', JSON.stringify(prev));
  await shot('17-apercu-note-noir-et-blanc');
  await b.key('Escape');
  console.log(JSON.stringify(b.consoleLog.filter((l) => !l.includes('vite')).slice(0, 6)));
} finally {
  await b.close();
}
