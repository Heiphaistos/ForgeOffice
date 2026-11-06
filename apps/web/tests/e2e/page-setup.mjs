// Mise en page et impression dans le vrai navigateur. Usage : node apps/web/tests/e2e/page-setup.mjs <port vite> <port cdp> <dossier de captures>
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument } from '@cantoo/pdf-lib';
import { launch, sleep } from './harness.mjs';
import { fixture, helpers } from './page-setup-lib.mjs';

const [vitePort = '5423', cdp = '9683', outDir = 'shots'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const url = `http://127.0.0.1:${vitePort}/?app=excel`;
const ok = (name, cond, info = '') => console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ` : ${info}` : ''}`);

const b = await launch({ port: Number(cdp) });
const shot = (name) => b.shot(join(outDir, `${name}.png`));
const h = helpers(b, ok);
try {
  console.log('goto'); await b.goto(url, 1500); console.log('loaded');
  const fx = await fixture(); console.log('fixture', fx.length); await h.openFile('ventes.xlsx', fx); console.log('opened');
  ok('classeur de test charge (A1 = Produit, feuille Ventes)', await b.waitFor("document.querySelector('.xl-fi__input')?.value === 'Produit' && document.body.textContent.includes('Ventes')", 6000));
  await h.tab('Mise en page');
  await shot('01-ruban');
  await h.launcher();
  ok('le lanceur ouvre la boite Mise en page', await h.dialogOpen());
  await shot('02-boite-page');
  // ---- Page : paysage, A3, ajuster 1 page en largeur (hauteur automatique)
  await b.clickText('.fo-dialog label', 'Paysage');
  await h.setSelect('#ps-paper', '8');
  await b.clickText('.fo-dialog label', 'Ajuster');
  await shot('03-page-ajuster');
  // ---- Marges : haut 2,5 cm, centrer horizontalement
  await h.tab('Marges');
  await h.fill('.fo-dialog [aria-label="Haut"]', '2,5');
  await b.press('	');
  await b.clickText('.fo-dialog label', 'Horizontalement');
  await shot('04-marges');
  // ---- En-tete/Pied : pied predefini « Page 1 sur ? », en-tete personnalise, premiere page differente
  await h.tab('En-tête/Pied de page');
  await h.setSelect('.ps-hfrow:nth-of-type(2) select', 'pageOf');
  await h.dlgButton('En-tête personnalisé...');
  await b.click('textarea[data-zone=center]');
  await b.type('Rapport &[Fichier] - &[Date]');
  await b.click('textarea[data-zone=left]');
  await b.type('Confidentiel');
  await b.clickText('.fo-dialog label', 'Première page différente');
  await shot('05-entete-pied');
  // ---- Feuille : titres $1:$1, zone A1:H60, quadrillage, erreurs --
  await h.tab('Feuille');
  await h.fill('#ps-rows', '$1:$1');
  await h.fill('#ps-area', 'A1:H60');
  await b.clickText('.fo-dialog label', 'Quadrillage');
  await b.clickText('.fo-dialog label', 'En-têtes de ligne et de colonne');
  await h.setSelect('#ps-errors', 'dash');
  await h.setSelect('#ps-comments', 'atEnd');
  await shot('06-feuille');
  await h.dlgButton('OK');
  ok('OK ferme la boite', !(await h.dialogOpen()));
  const m = await h.savedModel();
  const ps = m.sheets[0].pageSetup;
  ok('paysage', ps.orientation === 'landscape');
  ok('papier A3 (8)', ps.paperSize === 8, String(ps.paperSize));
  ok('ajuster 1 x auto', ps.fitToPage === true && ps.fitToWidth === 1 && (ps.fitToHeight ?? 1) === 1, `${ps.fitToPage} ${ps.fitToWidth} ${ps.fitToHeight}`);
  ok('marge haute 2,5 cm = 0,984 po', Math.abs(ps.margins.top - 2.5 / 2.54) < 0.01, String(ps.margins.top));
  ok('centre horizontalement', ps.horizontalCentered === true);
  ok('pied Page &P sur &N', ps.headerFooter?.oddFooter === '&CPage &P sur &N', ps.headerFooter?.oddFooter);
  ok('en-tete personnalise', ps.headerFooter?.oddHeader === '&LConfidentiel&CRapport &F - &D', ps.headerFooter?.oddHeader);
  ok('premiere page differente', ps.headerFooter?.differentFirst === true);
  ok('titres a repeter 1:1', ps.printTitleRows?.first === 0 && ps.printTitleRows?.last === 0);
  ok('zone A1:H60', JSON.stringify(ps.printArea) === JSON.stringify([{ r1: 0, c1: 0, r2: 59, c2: 7 }]), JSON.stringify(ps.printArea));
  ok('quadrillage + en-tetes imprimes', ps.printGridLines === true && ps.printHeadings === true);
  ok('erreurs --', ps.errors === 'dash');
  ok('commentaires en fin', ps.cellComments === 'atEnd');
  // ---- Apercu avant impression (Fichier > Imprimer) : en-tete / pied, titres repetes, quadrillage, en-tetes, A3 paysage
  await h.fichier('Imprimer');
  await sleep(800);
  await shot('07-apercu-impression-p1');
  const info = await b.ev(`(() => { const p = document.querySelector('.xl-print__preview .xl-page'); return p ? { w: p.getBoundingClientRect().width, h: p.getBoundingClientRect().height, text: p.textContent.slice(0, 160), rows: p.querySelectorAll('tbody tr').length } : null; })()`);
  ok('apercu : A3 paysage (plus large que haut)', info && info.w > info.h, JSON.stringify(info));
  ok('apercu : titre de colonne et en-tetes de ligne imprimes', info && info.text.includes('Produit'));
  await b.click('.xl-print__nav button:last-of-type');
  await shot('08-apercu-impression-p2');
  const foot = await b.ev(`(() => { const p = document.querySelector('.xl-print__preview .xl-page'); return [...p.querySelectorAll('.xl-hf')].map((e) => e.textContent); })()`);
  ok('apercu page 2 : en-tete et pied avec les champs remplaces', await b.ev(`document.querySelector('.xl-print__nav span')?.textContent`) === 'Page 2 sur 2' && foot.some((t) => t.includes('Page 2 sur 2')) && foot.some((t) => t.includes('Confidentiel') && /Rapport ventes.* - \d\d\/\d\d\/\d{4}/.test(t)), JSON.stringify(foot));
  // ---- Impression reelle : le document imprime (PrintRoot) est exporte en PDF par le navigateur avec @page
  await b.ev(`window.print = () => { const r = document.querySelector('.xl-print-root'); const c = r.cloneNode(true); c.classList.add('xl-print-copy'); document.body.appendChild(c); }`);
  await b.click('.xl-print__opts .fo-btn--primary');
  await sleep(900);
  ok('document imprime : 2 pages dans PrintRoot', (await b.ev(`document.querySelectorAll('.xl-print-copy .xl-page').length`)) === 2);
  await b.send('Emulation.setEmulatedMedia', { media: 'print' });
  await sleep(300);
  await shot('09-document-imprime');
  const pdf = await b.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true });
  await b.send('Emulation.setEmulatedMedia', { media: '' });
  const doc = await PDFDocument.load(Buffer.from(pdf.data, 'base64'));
  const sizes = doc.getPages().map((pg) => pg.getSize());
  ok('PDF : 2 pages A3 paysage (1190 x 842 pt)', sizes.length === 2 && sizes.every((z) => Math.abs(z.width - 1190.55) < 3 && Math.abs(z.height - 841.89) < 3), JSON.stringify(sizes));
  await b.ev(`document.querySelector('.xl-print-copy')?.remove()`);
  await b.ev(`document.querySelector('.xl-app')?.focus()`);
  await b.key('Escape');
  console.log(JSON.stringify(b.consoleLog.slice(0, 10)));
} finally {
  await b.close();
}
