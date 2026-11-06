// Mise en page et pagination (logique sans DOM) : papier, codes d'en-tete/pied, titres, ajustement, sauts, ordre, zones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlankWorkbook, setValue, type Sheet } from '@forgeoffice/xlsx';
import { editBreaks, pageBreakInfo, paginate, printRanges } from '../src/logic/pagebreaks.ts';
import {
  HF_FIELDS, MARGIN_PRESETS, fitPatch, PAPER_SIZES, hfFromDisplay, hfJoin, hfPlain, hfSplit, hfToDisplay, marginPresetOf, marginsOf, pageDims, paperLabel, parseHeaderFooter,
  parsePrintAreaText, parseTitleCols, parseTitleRows, printAreaText, titleColsText, titleRowsText, type HfContext,
} from '../src/logic/pagesetup.ts';

const ctx: HfContext = { page: 3, pages: 12, now: new Date(2026, 10, 5, 9, 7), file: 'Budget.xlsx', path: 'C:/Docs/', sheet: 'Feuil1' };

function sheetOf(rows: number, cols: number): Sheet {
  const wb = createBlankWorkbook();
  const s = wb.sheets[0] as Sheet;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) setValue(s, r, c, r * 100 + c);
  return s;
}
const all = (s: Sheet) => paginate(s, printRanges(s));

test('papier : 20 tailles, dimensions en pixels et orientation', () => {
  assert.equal(PAPER_SIZES.length, 20);
  assert.deepEqual(pageDims({ paperSize: 9 }), { w: 794, h: 1123 });
  assert.deepEqual(pageDims({ paperSize: 9, orientation: 'landscape' }), { w: 1123, h: 794 });
  assert.deepEqual(pageDims({ paperSize: 1 }), { w: 816, h: 1056 });
  assert.deepEqual(pageDims({}), pageDims({ paperSize: 9 }));
  assert.equal(paperLabel(PAPER_SIZES.find((p) => p.id === 9) ?? (PAPER_SIZES[0] as never)), 'A4 (21 x 29,7 cm)');
  assert.equal(new Set(PAPER_SIZES.map((p) => p.id)).size, 20);
});

test('marges : presets reconnus, personnalisees = aucun preset', () => {
  for (const p of MARGIN_PRESETS) assert.equal(marginPresetOf(marginsOf(p)), p.id);
  assert.equal(marginPresetOf({ ...marginsOf(MARGIN_PRESETS[0] as never), left: 0.9 }), null);
});

test('en-tete / pied : champs, zones et mise en forme', () => {
  const s = parseHeaderFooter('&LDossier &F&C&"Arial,Gras"&14Titre&"-,Normal"&10 &A&RPage &P sur &N le &D a &T', ctx);
  assert.equal(s.left.map((r) => r.text).join(''), 'Dossier Budget.xlsx');
  assert.equal(s.center[0]?.text, 'Titre');
  assert.deepEqual([s.center[0]?.bold, s.center[0]?.size, s.center[0]?.font], [true, 14, 'Arial']);
  assert.equal(s.center[1]?.text, ' Feuil1');
  assert.equal(s.center[1]?.bold, undefined);
  assert.equal(s.center[1]?.size, 10);
  assert.equal(s.right.map((r) => r.text).join(''), 'Page 3 sur 12 le 05/11/2026 a 09:07');
  assert.equal(hfPlain('&L&Z&F&C&&&RFin', ctx), 'C:/Docs/Budget.xlsx | & | Fin');
  const f = parseHeaderFooter('&BGras &Iitalique &Usoul&E double &Sbarre&B off', ctx).center;
  assert.deepEqual(f.map((r) => [r.text, !!r.bold, !!r.italic, r.underline ?? '', !!r.strike]), [
    ['Gras ', true, false, '', false],
    ['italique ', true, true, '', false],
    ['soul', true, true, 'single', false],
    [' double ', true, true, 'double', false],
    ['barre', true, true, 'double', true],
    [' off', false, true, 'double', true],
  ]);
});

test('en-tete / pied : forme affichee en francais et retour aux codes', () => {
  const raw = '&L&F&CPage &P sur &N&R&D &T &Z &A &B&&';
  const shown = hfToDisplay(raw);
  assert.equal(shown, '&L&[Fichier]&CPage &[Page] sur &[Pages]&R&[Date] &[Heure] &[Chemin d’accès] &[Onglet] &B&&');
  assert.equal(hfFromDisplay(shown), raw);
  assert.equal(hfFromDisplay('&[inconnu]'), '&[inconnu]');
  assert.equal(HF_FIELDS.length, 7);
  const parts = hfSplit(raw);
  assert.deepEqual(parts, { left: '&F', center: 'Page &P sur &N', right: '&D &T &Z &A &B&&' });
  assert.equal(hfJoin(parts.left, parts.center, parts.right), raw);
  assert.deepEqual(hfSplit('Sans zone'), { left: '', center: 'Sans zone', right: '' });
});

test('plages : zone d impression multiple et titres a repeter', () => {
  assert.deepEqual(parsePrintAreaText('A1:D12; F1:G5'), [{ r1: 0, c1: 0, r2: 11, c2: 3 }, { r1: 0, c1: 5, r2: 4, c2: 6 }]);
  assert.equal(printAreaText(parsePrintAreaText('A1:D12;F1:G5') ?? []), '$A$1:$D$12;$F$1:$G$5');
  assert.equal(parsePrintAreaText('A1:zz'), null);
  assert.deepEqual(parsePrintAreaText(''), []);
  assert.deepEqual(parseTitleRows('$1:$3'), { first: 0, last: 2 });
  assert.deepEqual(parseTitleRows('Feuil1!$2:$2'), { first: 1, last: 1 });
  assert.equal(parseTitleRows('abc'), null);
  assert.equal(parseTitleRows(''), undefined);
  assert.deepEqual(parseTitleCols('$A:$B'), { first: 0, last: 1 });
  assert.deepEqual(parseTitleCols('c'), { first: 2, last: 2 });
  assert.equal(titleRowsText({ first: 0, last: 2 }), '$1:$3');
  assert.equal(titleColsText({ first: 1, last: 1 }), '$B:$B');
});

test('pagination : lignes decoupees selon la hauteur, numerotation et total', () => {
  const s = sheetOf(120, 3); // 120 lignes de 19 px ; A4 : 1123 - 2 x 0,75 x 96 = 979 px -> 51 lignes
  const { pages, scale } = all(s);
  assert.equal(scale, 1);
  assert.deepEqual(pages.map((p) => p.rows.length), [51, 51, 18]);
  assert.deepEqual(pages.map((p) => [p.number, p.total]), [[1, 3], [2, 3], [3, 3]]);
  s.pageSetup.firstPageNumber = 7;
  assert.deepEqual(all(s).pages.map((p) => p.number), [7, 8, 9]);
});

test('pagination : saut manuel, orientation paysage, echelle', () => {
  const s = sheetOf(60, 3);
  s.pageSetup.rowBreaks = [9];
  assert.deepEqual(all(s).pages.map((p) => p.rows.length), [10, 50]);
  s.pageSetup.rowBreaks = [];
  s.pageSetup.orientation = 'landscape'; // 794 - 144 = 650 px -> 34 lignes
  assert.deepEqual(all(s).pages.map((p) => p.rows.length), [34, 26]);
  s.pageSetup.scale = 50;
  assert.equal(all(s).pages.length, 1);
});

test('pagination : lignes et colonnes a repeter en tete des pages suivantes', () => {
  const s = sheetOf(120, 3);
  s.pageSetup.printTitleRows = { first: 0, last: 1 };
  const { pages } = all(s);
  assert.equal(pages.length, 3);
  assert.deepEqual(pages[0]?.rows.slice(0, 3), [0, 1, 2]);
  assert.deepEqual(pages[1]?.rows.slice(0, 3), [0, 1, 51]);
  assert.equal(pages[1]?.rows.length, 51);
  const w = sheetOf(3, 40);
  w.pageSetup.printTitleCols = { first: 0, last: 0 };
  const wp = all(w).pages;
  assert.ok(wp.length > 1);
  assert.equal(wp[1]?.cols[0], 0);
  assert.ok((wp[1]?.cols[1] ?? 0) > 1);
});

test('pagination : ajuster a largeur x hauteur', () => {
  const s = sheetOf(200, 30); // 3 800 px de haut, 1 920 px de large
  s.pageSetup.fitToPage = true;
  s.pageSetup.fitToWidth = 1;
  s.pageSetup.fitToHeight = 0; // hauteur automatique
  let r = all(s);
  assert.ok(r.scale < 0.4 && r.scale > 0.3, String(r.scale));
  assert.equal(new Set(r.pages.map((p) => p.cols.join())).size, 1);
  assert.ok(r.pages.length >= 2);
  s.pageSetup.fitToHeight = 1;
  r = all(s);
  assert.equal(r.pages.length, 1);
  assert.ok(r.scale <= 0.26 && r.scale >= 0.25, String(r.scale));
  s.pageSetup.fitToWidth = 2;
  s.pageSetup.fitToHeight = 2;
  r = all(s);
  assert.ok(r.pages.length <= 4 && r.scale > 0.25, `${r.pages.length} ${r.scale}`);
  s.pageSetup.fitToWidth = 0;
  s.pageSetup.fitToHeight = 0;
  assert.equal(all(s).scale, 1);
});

test('pagination : jamais d agrandissement en mode ajuster, sauts manuels ignores', () => {
  const s = sheetOf(10, 3);
  s.pageSetup.fitToPage = true;
  s.pageSetup.rowBreaks = [4];
  const r = all(s);
  assert.equal(r.scale, 1);
  assert.equal(r.pages.length, 1);
});

test('pagination : ordre des pages et zones d impression multiples', () => {
  const s = sheetOf(100, 40);
  const down = all(s).pages;
  assert.ok(new Set(down.map((p) => p.rows.join())).size > 1 && new Set(down.map((p) => p.cols.join())).size > 1);
  assert.equal(down[1]?.cols.join(), down[0]?.cols.join()); // bas puis droite : memes colonnes d'abord
  s.pageSetup.pageOrder = 'overThenDown';
  const over = all(s).pages;
  assert.equal(over[1]?.rows.join(), over[0]?.rows.join()); // droite puis bas
  s.pageSetup.pageOrder = 'downThenOver';
  s.pageSetup.printArea = [{ r1: 0, c1: 0, r2: 4, c2: 2 }, { r1: 50, c1: 0, r2: 54, c2: 2 }];
  const multi = all(s);
  assert.equal(multi.pages.length, 2);
  assert.deepEqual(multi.pages.map((p) => p.area), [0, 1]);
  assert.equal(multi.pages[1]?.rows[0], 50);
});

test('pagination : commentaires a la fin de la feuille', () => {
  const s = sheetOf(5, 2);
  s.notes.push({ ref: { row: 1, col: 1 }, author: 'Alice', text: 'A verifier' });
  assert.equal(all(s).pages.length, 1);
  s.pageSetup.cellComments = 'atEnd';
  const p = all(s).pages;
  assert.equal(p.length, 2);
  assert.deepEqual(p[1]?.comments, [{ cell: 'B2', author: 'Alice', text: 'A verifier' }]);
  assert.equal(p[1]?.total, 2);
});

test('apercu des sauts : traits automatiques et manuels, numeros de page', () => {
  const s = sheetOf(120, 3);
  s.pageSetup.rowBreaks = [19];
  const info = pageBreakInfo(s);
  assert.deepEqual(info?.manualRows, [20]);
  assert.ok(info?.rows.includes(20));
  assert.deepEqual(info?.labels.map((l) => l.n), [1, 2, 3]);
  s.pageSetup.fitToPage = true;
  assert.deepEqual(pageBreakInfo(s)?.manualRows, []);
});

test('sauts manuels : inserer au-dessus et a gauche de la cellule active, supprimer, tout retablir', () => {
  const base = { rowBreaks: [] as number[], colBreaks: [] as number[] };
  const a = editBreaks(base, 'insert', { row: 10, col: 4 });
  assert.deepEqual(a, { rowBreaks: [9], colBreaks: [3] });
  assert.deepEqual(editBreaks(a, 'insert', { row: 10, col: 0 }), { rowBreaks: [9], colBreaks: [3] });
  assert.deepEqual(editBreaks(a, 'remove', { row: 10, col: 4 }), { rowBreaks: [], colBreaks: [] });
  assert.deepEqual(editBreaks(a, 'reset', { row: 0, col: 0 }), { rowBreaks: [], colBreaks: [] });
});

test('Largeur / Hauteur du ruban : 0 = automatique, les deux a 0 coupent l ajustement', () => {
  assert.deepEqual(fitPatch({}, 'w', 1), { fitToPage: true, fitToWidth: 1, fitToHeight: 0 });
  assert.deepEqual(fitPatch({ fitToPage: true, fitToWidth: 1, fitToHeight: 0 }, 'h', 2), { fitToPage: true, fitToWidth: 1, fitToHeight: 2 });
  assert.deepEqual(fitPatch({ fitToPage: true, fitToWidth: 1, fitToHeight: 0 }, 'w', 0), { fitToPage: false });
  assert.deepEqual(fitPatch({ fitToPage: true, fitToWidth: 3 }, 'h', 0), { fitToPage: true, fitToWidth: 3, fitToHeight: 0 });
});

test('apercu des sauts : les traits automatiques restent dans leur zone imprimee', () => {
  const s = sheetOf(120, 3);
  s.pageSetup.printArea = [{ r1: 0, c1: 0, r2: 119, c2: 2 }, { r1: 0, c1: 5, r2: 4, c2: 6 }];
  const info = pageBreakInfo(s);
  assert.deepEqual(info?.perArea[0]?.rows, [51, 102, 120]);
  assert.deepEqual(info?.perArea[1]?.rows, [5]);
  assert.ok(info?.rows.includes(5));
});
