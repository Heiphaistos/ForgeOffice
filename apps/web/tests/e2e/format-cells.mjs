// Boite « Format de cellule » dans le vrai navigateur : chaque onglet est exerce par de vrais clics, le classeur enregistre
// (Ctrl+S) est relu avec le lecteur xlsx de la suite : c'est le MODELE qui est verifie, pas seulement l'absence d'erreur.
// Usage : node apps/web/tests/e2e/format-cells.mjs <port vite> <port cdp> <dossier de captures>
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { readXlsx } from '../../../../packages/xlsx/src/index.ts';
import { borderOf, cellFormat, fillOf, fontOf, mergeAt, numFmtOf, styleAt } from '../../../../packages/excel/src/logic/styles.ts';
import { launch, sleep } from './harness.mjs';

const [vitePort = '5421', cdp = '9681', outDir = 'shots'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const url = `http://127.0.0.1:${vitePort}/?app=excel`;
let failed = 0;
const ok = (name, cond, info = '') => { if (!cond) failed++; console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ` : ${info}` : ''}`); };

const b = await launch({ port: Number(cdp) });
const shot = (name) => b.shot(join(outDir, `${name}.png`));
const D = '.fo-dialog';
try {
  await b.goto(url, 1500);
  const goto = async (addr) => {
    await b.ev(`[...document.querySelectorAll('input')].find((e) => /^[A-Z]{1,3}[0-9]+(:[A-Z]{1,3}[0-9]+)?$/.test(e.value))?.setAttribute('data-e2e', 'nb')`);
    await b.click('[data-e2e=nb]');
    await b.key('a', { ctrl: true, commands: ['selectAll'] });
    await b.press(addr);
    await b.key('Enter');
    await b.ev(`document.querySelector('[data-e2e=nb]')?.removeAttribute('data-e2e')`);
  };
  const type = async (addr, v) => { await goto(addr); await b.press(`${v}\n`); };
  const openDlg = async (range, tab) => {
    await goto(range);
    await b.key('1', { ctrl: true });
    await b.waitFor(`document.querySelector('${D}')`);
    if (tab) await b.clickText(`${D} [role=tab]`, tab);
    await sleep(200);
  };
  const okBtn = async () => { await b.clickText(`${D} button`, 'OK'); await sleep(400); };
  const setSelect = (sel, v) => b.ev(`(() => { const e = document.querySelector(${JSON.stringify(`${D} ${sel}`)}); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(e, ${JSON.stringify(String(v))}); e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  const setNumber = async (label, text) => {
    await b.click(`${D} input[aria-label="${label}"]`);
    await b.key('a', { ctrl: true, commands: ['selectAll'] });
    await b.type(text);
    await b.key('Tab');
  };
  const saved = async () => {
    await b.downloads();
    await b.key('s', { ctrl: true });
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      const d = await b.downloads();
      if (d.length) return readXlsx(new Uint8Array(d[d.length - 1].bytes));
    }
    throw new Error('aucun telechargement');
  };
  const sheetOf = (wb) => wb.sheets[0];
  const sid = (wb, ref) => { const m = ref.match(/^([A-Z])(\d+)$/); return styleAt(sheetOf(wb), Number(m[2]) - 1, m[1].charCodeAt(0) - 65); };
  const font = (wb, ref) => fontOf(wb, sid(wb, ref));
  const xf = (wb, ref) => cellFormat(wb, sid(wb, ref));

  await type('A1', '1234,5');
  await type('B1', 'Texte');
  await type('A2', '-45,5');
  await type('B2', 'un long texte pour le renvoi');
  await type('A3', '45000');
  await goto('B1');
  await b.key('g', { ctrl: true }); // Ctrl+G : gras (FR)
  await goto('A1');
  await b.key('i', { ctrl: true }); // Ctrl+I : italique
  const before = await saved();
  ok('depart : B1 gras, A1 italique', font(before, 'B1').bold === true && font(before, 'A1').italic === true && !font(before, 'A1').bold);

  // ---- OK sans rien modifier : aucun style cree
  const nXf = before.styles.cellXfs.length;
  await openDlg('A1:B1', 'Police');
  await shot('10-heterogene-police');
  await okBtn();
  const same = await saved();
  ok('X-02 : OK sans modification ne cree aucun style', same.styles.cellXfs.length === nXf && sid(same, 'A1') === sid(before, 'A1') && sid(same, 'B1') === sid(before, 'B1'));

  // ---- Selection heterogene : seul le soulignement change
  await openDlg('A1:B1', 'Police');
  await setSelect('#fc-ul', 'double');
  await sleep(200);
  await shot('11-police-double');
  await okBtn();
  const w2 = await saved();
  ok('X-02 : soulignement double applique aux deux cellules', font(w2, 'A1').underline === 'double' && font(w2, 'B1').underline === 'double');
  ok('X-02 : le gras de B1 et l\'italique de A1 sont conserves', font(w2, 'B1').bold === true && font(w2, 'A1').italic === true && !font(w2, 'A1').bold && !font(w2, 'B1').italic);

  // ---- Police : style, taille, barre, exposant
  await openDlg('A3', 'Police');
  await setSelect('#fc-style', '3');
  await setNumber('Taille :', '16');
  await b.clickText(`${D} label`, 'Barré');
  await b.clickText(`${D} label`, 'Exposant');
  await sleep(200);
  await shot('12-police-effets');
  const prev = await b.ev(`(() => { const s = getComputedStyle(document.querySelector('[data-testid=fc-font-preview]')); return [s.fontWeight, s.fontStyle, s.fontSize, s.textDecorationLine].join('|'); })()`);
  ok('Police : l\'apercu suit les reglages', prev.startsWith('700|italic|16px|line-through'), prev);
  await okBtn();
  const w3 = await saved();
  const f3 = font(w3, 'A3');
  ok('Police : gras italique 16 pt barre exposant', f3.bold && f3.italic && f3.size === 16 && f3.strike && f3.vertAlign === 'superscript', JSON.stringify(f3));

  // ---- Nombre : categorie Monetaire
  await openDlg('A1:A2', 'Nombre');
  await b.clickText(`${D} [role=option]`, 'Monétaire');
  await setNumber('Nombre de décimales :', '1');
  await sleep(200);
  const sample = await b.ev(`document.querySelector('[data-testid=fc-sample]').textContent`);
  ok('Nombre : apercu Monetaire 1 decimale', /1\s?234,5\s€/.test(sample.replace(/\s/g, ' ')), JSON.stringify(sample));
  await shot('13-nombre-monetaire');
  await okBtn();
  await shot('14-grille-monetaire');
  const w4 = await saved();
  ok('Nombre : code de format ecrit', numFmtOf(w4, sid(w4, 'A1')) === '#,##0.0 [$€-40C]' && numFmtOf(w4, sid(w4, 'A2')) === '#,##0.0 [$€-40C]', numFmtOf(w4, sid(w4, 'A1')));
  ok('Nombre : le gras de B1 n\'est pas touche', font(w4, 'B1').bold === true);

  // ---- Nombre : date puis personnalisee
  await openDlg('A3', 'Nombre');
  await b.clickText(`${D} [role=option]`, 'Date');
  await sleep(200);
  await shot('15-nombre-date');
  await b.ev(`[...document.querySelectorAll('${D} [role=option]')].find((e) => e.title === 'Jour mois année')?.click()`);
  await sleep(150);
  const dsample = await b.ev(`document.querySelector('[data-testid=fc-sample]').textContent`);
  ok('Nombre : date longue sur 45000', /2023/.test(dsample), dsample);
  await okBtn();
  const w5 = await saved();
  ok('Nombre : format date', numFmtOf(w5, sid(w5, 'A3')) === 'd mmmm yyyy', numFmtOf(w5, sid(w5, 'A3')));
  await openDlg('A3', 'Nombre');
  await b.clickText(`${D} [role=option]`, 'Personnalisée');
  await b.click(`${D} #fc-code`);
  await b.key('a', { ctrl: true, commands: ['selectAll'] });
  await b.type('0.000" kg"');
  await sleep(150);
  const csample = await b.ev(`document.querySelector('[data-testid=fc-sample]').textContent`);
  ok('Nombre : code personnalise en direct', /45\s?000,000 kg/.test(csample.replace(/\s/g, ' ')), csample);
  await okBtn();
  const w5b = await saved();
  ok('Nombre : code personnalise enregistre', numFmtOf(w5b, sid(w5b, 'A3')) === '0.000" kg"', numFmtOf(w5b, sid(w5b, 'A3')));

  // ---- Alignement
  await openDlg('B2', 'Alignement');
  await setSelect('#fc-h', 'center');
  await setSelect('#fc-v', 'top');
  await b.clickText(`${D} label`, 'Renvoyer à la ligne automatiquement');
  await setNumber('Degrés :', '30');
  await sleep(200);
  await shot('16-alignement');
  await okBtn();
  const w6 = await saved();
  const a6 = xf(w6, 'B2').alignment;
  ok('Alignement : centre, haut, renvoi, 30 degres', a6?.horizontal === 'center' && a6?.vertical === 'top' && a6?.wrapText === true && a6?.textRotation === 30, JSON.stringify(a6));
  await openDlg('B2', 'Alignement');
  await setNumber('Degrés :', '-45');
  await okBtn();
  const w6b = await saved();
  ok('Alignement : -45 degres = rotation 135', xf(w6b, 'B2').alignment?.textRotation === 135, String(xf(w6b, 'B2').alignment?.textRotation));
  await openDlg('A1:A2', 'Alignement');
  await setSelect('#fc-h', 'left');
  await setNumber('Retrait :', '2');
  await b.clickText(`${D} label`, 'Fusionner les cellules');
  await okBtn();
  const w7 = await saved();
  ok('Alignement : retrait 2 et fusion A1:A2', xf(w7, 'A1').alignment?.indent === 2 && !!mergeAt(sheetOf(w7).merges, 1, 0));

  // ---- Bordure : style double, contour, interieur fin, diagonale
  await type('E2', 'x');
  await openDlg('E2:G4', 'Bordure');
  await b.click(`${D} [title="Trait double"]`);
  await b.click(`${D} [title="Contour"]`);
  await b.click(`${D} [title="Trait fin"]`);
  await b.click(`${D} [title="Intérieur"]`);
  await b.click(`${D} [data-edge=diagDown]`);
  await sleep(250);
  await shot('17-bordure');
  await okBtn();
  await goto('A10');
  await shot('18-grille-bordures');
  const w8 = await saved();
  const bd = (r) => borderOf(w8, sid(w8, r));
  ok('Bordure : contour double', bd('E2').top?.style === 'double' && bd('E2').left?.style === 'double' && bd('G4').bottom?.style === 'double' && bd('G4').right?.style === 'double');
  ok('Bordure : interieur fin', bd('F3').top?.style === 'thin' && bd('F3').left?.style === 'thin' && bd('E2').bottom?.style === 'thin' && bd('F2').right?.style === 'thin');
  ok('Bordure : diagonale descendante', bd('F3').diagonal?.style === 'thin' && bd('F3').diagonalDown === true && !bd('F3').diagonalUp);
  // Retrait d'un seul bord : le haut (la couleur/style courant « fin » differe du « double » lu : 1er clic remplace, 2e clic retire)
  await openDlg('E2:G4', 'Bordure');
  await b.click(`${D} [data-edge=top]`);
  await b.click(`${D} [data-edge=top]`);
  await okBtn();
  const w9 = await saved();
  ok('Bordure : un seul bord retire, les autres restent', !borderOf(w9, sid(w9, 'F2')).top && borderOf(w9, sid(w9, 'G4')).bottom?.style === 'double' && borderOf(w9, sid(w9, 'E3')).left?.style === 'double');

  // ---- Remplissage : couleur d'arriere-plan + motif, puis degrade
  await type('I1', 'p');
  await openDlg('I1:I2', 'Remplissage');
  await b.click(`${D} [title="Jaune"]`);
  await b.click(`${D} [title="Quadrillage épais"]`);
  await sleep(250);
  await shot('19-remplissage');
  await okBtn();
  await goto('A12');
  await shot('20-grille-motif');
  const w10 = await saved();
  const fl = fillOf(w10, sid(w10, 'I1'));
  ok('Remplissage : quadrillage epais sur fond jaune', fl?.type === 'pattern' && fl.pattern === 'darkGrid' && fl.bg?.rgb?.endsWith('FFFF00'), JSON.stringify(fl));
  await openDlg('K1:K2', 'Remplissage');
  await b.clickText(`${D} button`, 'Effets de remplissage...');
  await b.waitFor(`document.querySelectorAll('${D}').length === 2`);
  await sleep(300);
  await shot('21-degrade');
  await b.ev(`document.querySelectorAll('input[name=gk]')[1].click()`); // style « Vertical »
  await sleep(100);
  await b.click(`[aria-label="Variante 2"]`);
  await sleep(250);
  await shot('22-degrade-vertical');
  const nDlg = await b.ev(`document.querySelectorAll('${D}').length`);
  ok('Remplissage : la boite Effets s\'ouvre par dessus', nDlg === 2, String(nDlg));
  await b.ev(`(() => { const d = [...document.querySelectorAll('.fo-dialog')].at(-1); [...d.querySelectorAll('button')].find((x) => x.textContent.trim() === 'OK').click(); })()`);
  await sleep(300);
  const still = await b.ev(`document.querySelectorAll('${D}').length`);
  ok('Remplissage : OK du degrade ferme seulement la boite Effets', still === 1, String(still));
  await okBtn();
  await goto('A12');
  await shot('23-grille-degrade');
  const w11 = await saved();
  const gf = fillOf(w11, sid(w11, 'K1'));
  ok('Remplissage : degrade enregistre', gf?.type === 'gradient' && gf.stops.length >= 2 && gf.degree === 0, JSON.stringify(gf));

  // ---- Protection
  await type('M1', 'p');
  await openDlg('M1', 'Protection');
  await b.clickText(`${D} label`, 'Verrouillée');
  await b.clickText(`${D} label`, 'Masquée');
  await shot('24-protection');
  await okBtn();
  const w12 = await saved();
  ok('Protection : deverrouillee et masquee', xf(w12, 'M1').protection?.locked === false && xf(w12, 'M1').protection?.hidden === true);

  // ---- Rendu des options d'alignement et de police sur la grille (captures regardees a l'oeil)
  await type('C14', 'Vertical');
  await openDlg('C14', 'Alignement');
  await b.clickText(`${D} button`, 'Texte vertical');
  await okBtn();
  await type('C16', 'abcdefghijklmnopqrstuvwxyz');
  await openDlg('C16', 'Alignement');
  await b.clickText(`${D} label`, 'Ajuster');
  await okBtn();
  await type('C17', 'Distribue');
  await openDlg('C17', 'Alignement');
  await setSelect('#fc-h', 'distributed');
  await okBtn();
  await type('E14', 'Centre sur trois colonnes');
  await openDlg('E14:G14', 'Alignement');
  await setSelect('#fc-h', 'centerContinuous');
  await okBtn();
  await type('C18', 'm2');
  await openDlg('C18', 'Police');
  await b.clickText(`${D} label`, 'Exposant');
  await okBtn();
  await type('C19', 'H2O');
  await openDlg('C19', 'Police');
  await b.clickText(`${D} label`, 'Indice');
  await okBtn();
  await type('C20', 'Comptable');
  await openDlg('C20', 'Police');
  await setSelect('#fc-ul', 'doubleAccounting');
  await okBtn();
  await type('E16', 'Droite a gauche');
  await openDlg('E16', 'Alignement');
  await setSelect('#fc-dir', '2');
  await okBtn();
  await type('E18', 'une phrase assez longue qui passe sur plusieurs lignes dans la cellule');
  await openDlg('E18', 'Alignement');
  await b.clickText(`${D} label`, 'Renvoyer à la ligne automatiquement');
  await setSelect('#fc-h', 'justify');
  await okBtn();
  await goto('A25');
  await shot('26-rendu-options');
  const w13 = await saved();
  ok('Lignes automatiques : renvoi (E18) et texte vertical (C14) agrandissent leur ligne', (sheetOf(w13).rows.get(17)?.height ?? 0) > 30 && (sheetOf(w13).rows.get(13)?.height ?? 0) > 60, `${sheetOf(w13).rows.get(17)?.height} / ${sheetOf(w13).rows.get(13)?.height}`);
  ok('Rendu : options enregistrees (vertical 255, ajuster, distribue, plusieurs colonnes, droite a gauche)',
    xf(w13, 'C14').alignment?.textRotation === 255 && xf(w13, 'C16').alignment?.shrinkToFit === true && xf(w13, 'C17').alignment?.horizontal === 'distributed'
    && xf(w13, 'E14').alignment?.horizontal === 'centerContinuous' && xf(w13, 'G14').alignment?.horizontal === 'centerContinuous' && xf(w13, 'E16').alignment?.readingOrder === 2
    && font(w13, 'C18').vertAlign === 'superscript' && font(w13, 'C19').vertAlign === 'subscript' && font(w13, 'C20').underline === 'doubleAccounting');

  // ---- Ruban : Autres formats numeriques / Autres bordures
  await goto('A3');
  await b.click('input[aria-label="Format de nombre"]');
  await sleep(300);
  await shot('25-ruban-format');
  await b.clickText('[role=option], [role=menuitem], li, button', 'Autres formats numériques…');
  await sleep(500);
  const tabNow = await b.ev(`document.querySelector('${D} [role=tab][aria-selected=true]')?.textContent ?? null`);
  ok('Ruban : « Autres formats numeriques... » ouvre la boite sur Nombre', tabNow === 'Nombre', String(tabNow));
  if (tabNow) await b.clickText(`${D} button`, 'Annuler');
  // Ruban : « Autres formats comptabilite... » ouvre la boite sur Nombre, categorie Comptabilite appliquee
  await goto('A3');
  const arrow = await b.ev(`(() => { const m = document.querySelector('[aria-label^="Format Nombre Comptabilité :"]'); const r = m?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; })()`);
  if (arrow) {
    await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: arrow.x, y: arrow.y });
    await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: arrow.x, y: arrow.y, button: 'left', clickCount: 1 });
    await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: arrow.x, y: arrow.y, button: 'left', clickCount: 1 });
  }
  await sleep(300);
  await shot('27-ruban-comptabilite');
  const clicked = await b.ev(`(() => { const m = [...document.querySelectorAll('[role=menuitem], button')].find((x) => x.textContent.trim() === 'Autres formats comptabilité…'); m?.click(); return !!m; })()`);
  await sleep(500);
  const accSample = clicked ? await b.ev(`JSON.stringify([document.querySelector('${D} [role=tab][aria-selected=true]')?.textContent, document.querySelector('${D} [role=option][aria-selected=true]')?.textContent])`) : 'menu absent';
  ok('Ruban : « Autres formats comptabilite... » ouvre Nombre > Comptabilite', accSample === '["Nombre","Comptabilité"]', String(accSample));
  if (clicked) { await shot('28-comptabilite'); await b.clickText(`${D} button`, 'Annuler'); }
  console.log(JSON.stringify(b.consoleLog.filter((l) => !/vite|raccourci deja/.test(l)).slice(0, 8)));
} finally {
  await b.close();
}
console.log(failed ? `${failed} ECHEC(S)` : 'TOUT PASSE');
process.exit(failed ? 1 : 0);
