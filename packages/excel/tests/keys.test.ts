// Raccourcis clavier du Tableur (lot E) : un evenement clavier simule par raccourci de EXCEL.md section 5, le raccourci qui le traite
// est verifie par son identifiant (dispatchKeyId) et ses effets (appels de l'API, selection, modele du classeur).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlankWorkbook, type Workbook } from '@forgeoffice/xlsx';
import { Draft } from '../src/logic/draft.ts';
import { commitEntry, parseEntry } from '../src/logic/cells.ts';
import { findFrom, matchesQuery, setLastFind } from '../src/logic/find-next.ts';
import {
  commitArrayEntry, defaultNameSides, isDigit, KEY_FORMATS, mergeNames, nameFromLabel, namesFromSelection, nextChartSheetName, nextCorner, pickListValues, reduceToActive,
} from '../src/logic/keys-logic.ts';
import { cellSelection, extendTo, rangeSelection } from '../src/logic/selection.ts';
import { setRowHeights, setColumnWidths } from '../src/logic/structure.ts';
import { applyKeytips, CONTROL_KEYTIPS, TAB_KEYTIPS } from '../src/ribbon/keytips.ts';
import { dispatchKeyId, registerDialog, shortcutsOf, type DialogState, type KeyLike } from '../src/ui/registry.ts';
import '../src/ui/keys-nav.ts';
import '../src/ui/keys-format.ts';
import '../src/ui/keys-edit.ts';
import '../src/ui/keys-entry.ts';
import { resetSelectionMode, selectionMode, selectionModeLabel } from '../src/ui/keys-select.ts';
import { forgetLastAction, lastAction, recordCommands, repeatLast } from '../src/ui/keys-repeat.ts';
import { nextZone } from '../src/ui/keys-zones.ts';
import type { GridKeyApi } from '../src/ui/keys-types.ts';

type Mods = { ctrl?: boolean; alt?: boolean; shift?: boolean };
const ev = (key: string, mods: Mods = {}, code?: string): KeyLike => ({
  key, ctrlKey: !!mods.ctrl, altKey: !!mods.alt, shiftKey: !!mods.shift, metaKey: false, ...(code ? { code } : {}),
});

function put(wb: Workbook, entries: Record<string, string>): Workbook {
  const d = new Draft(wb);
  for (const [addr, text] of Object.entries(entries)) {
    const m = addr.match(/^([A-Z]+)(\d+)$/);
    const e = parseEntry(text);
    if (!m || !e.ok) throw new Error(addr);
    commitEntry(d, 0, Number(m[2]) - 1, (m[1] ?? 'A').charCodeAt(0) - 65, e);
  }
  return d.wb;
}

/** API de grille factice : enregistre chaque appel ; la feuille est reelle pour les raccourcis qui la lisent. */
function grid(init: { wb?: Workbook; sel?: ReturnType<typeof cellSelection>; canRedo?: boolean } = {}): { api: GridKeyApi; calls: string[]; sel: () => ReturnType<typeof cellSelection> } {
  const wb = init.wb ?? put(createBlankWorkbook(), { A1: 'x', A2: '1', B2: '2', A3: '3' });
  let sel = init.sel ?? cellSelection(0, 0);
  const calls: string[] = [];
  const rec = (name: string) => (...a: unknown[]): void => void calls.push(a.length ? `${name}(${a.map((x) => JSON.stringify(x)).join(',')})` : name);
  const cmd = new Proxy({}, { get: (_t, p) => rec(`cmd.${String(p)}`) });
  const api = {
    sheet: wb.sheets[0], get sel() { return sel; }, setSel: (s: typeof sel) => { sel = s; calls.push(`setSel(${s.active.row},${s.active.col})`); }, cmd,
    startEdit: rec('startEdit'), undo: rec('undo'), redo: rec('redo'), canRedo: !!init.canRedo, save: rec('save'), saveAs: rec('saveAs'), openFile: rec('openFile'), newFile: rec('newFile'),
    closeDoc: rec('closeDoc'), print: rec('print'), open: (d: DialogState) => calls.push(`open:${d.kind}${'tab' in d && d.tab ? `:${d.tab}` : ''}`), switchSheet: rec('switchSheet'), addSheet: rec('addSheet'),
    recalc: rec('recalc'), toggleFormulas: rec('toggleFormulas'), escape: rec('escape'), stamp: rec('stamp'), deleteDrawing: () => false, flashFill: rec('flashFill'),
    pageRows: 20, pageCols: 5, notify: rec('notify'), reveal: rec('reveal'), dropDown: rec('dropDown'), contextMenu: rec('contextMenu'), outline: rec('outline'),
    insertChart: rec('insertChart'), chartSheet: rec('chartSheet'), toggleTotalRow: () => { calls.push('toggleTotalRow'); return true; },
    cellText: (r: number, c: number, w: string) => `${w}@${r},${c}`,
  } as unknown as GridKeyApi;
  return { api, calls, sel: () => sel };
}

/** Raccourci qui traite la touche dans la grille, et les appels qu'il a faits. */
function press(k: KeyLike, init?: Parameters<typeof grid>[0]): { id: string | null; calls: string[]; sel: () => ReturnType<typeof cellSelection> } {
  const g = grid(init);
  return { id: dispatchKeyId('grid', k, g.api), calls: g.calls, sel: g.sel };
}

/** Tableau de la section 5 : identifiant EXCEL.md, evenement simule, raccourci attendu. */
const GRID_TABLE: readonly [string, KeyLike, string][] = [
  ['K5.1-01', ev('ArrowDown'), 'nav.move.ArrowDown'],
  ['K5.1-02', ev('ArrowRight', { ctrl: true }), 'nav.jump.ArrowRight'],
  ['K5.1-03', ev('ArrowDown', { shift: true }), 'nav.move.ArrowDown'],
  ['K5.1-04', ev('ArrowDown', { ctrl: true, shift: true }), 'nav.jump.ArrowDown'],
  ['K5.1-05', ev('Tab'), 'nav.tab'],
  ['K5.1-05b', ev('Tab', { shift: true }), 'nav.tabBack'],
  ['K5.1-06', ev('Enter'), 'nav.enter'],
  ['K5.1-06b', ev('Enter', { shift: true }), 'nav.enterUp'],
  ['K5.1-07', ev('Home'), 'nav.home'],
  ['K5.1-08', ev('Home', { ctrl: true }), 'nav.homeTop'],
  ['K5.1-09', ev('End', { ctrl: true }), 'nav.end'],
  ['K5.1-10', ev('End', { ctrl: true, shift: true }), 'nav.end'],
  ['K5.1-10b', ev('Home', { ctrl: true, shift: true }), 'nav.homeTopExtend'],
  ['K5.1-11', ev('Home', { shift: true }), 'nav.homeExtend'],
  ['K5.1-12', ev('PageDown'), 'nav.page.PageDown'],
  ['K5.1-12b', ev('PageUp'), 'nav.page.PageUp'],
  ['K5.1-13', ev('PageDown', { alt: true }), 'nav.screen.PageDown'],
  ['K5.1-13b', ev('PageUp', { alt: true }), 'nav.screen.PageUp'],
  ['K5.1-14', ev('PageDown', { ctrl: true }), 'nav.sheet.PageDown'],
  ['K5.1-14b', ev('PageUp', { ctrl: true }), 'nav.sheet.PageUp'],
  ['K5.1-15', ev('PageDown', { shift: true }), 'nav.page.PageDown'],
  ['K5.1-16', ev(' ', { ctrl: true }), 'nav.selectCols'],
  ['K5.1-17', ev(' ', { shift: true }), 'nav.selectRows'],
  ['K5.1-18', ev('a', { ctrl: true }), 'nav.selectAll'],
  ['K5.1-19', ev('*', { ctrl: true, shift: true }), 'nav.region'],
  ['K5.1-20', ev(' ', { ctrl: true, shift: true }), 'nav.selectSheet'],
  ['K5.1-21', ev('Backspace', { ctrl: true }), 'nav.reveal'],
  ['K5.1-22', ev('Backspace', { shift: true }), 'nav.collapse'],
  ['K5.1-23', ev('.', { ctrl: true }), 'nav.corner'],
  ['K5.1-24', ev('F8'), 'select.extend'],
  ['K5.1-24b', ev('F8', { shift: true }), 'select.add'],
  ['K5.1-25', ev('F5'), 'nav.goto'],
  ['K5.1-25b', ev('t', { ctrl: true }), 'nav.gotoCtrlT'],
  ['K5.1-26', ev('F5', { shift: true }), 'edit.find.shiftF5'],
  ['K5.1-26b', ev('f', { ctrl: true }), 'edit.find'],
  ['K5.1-27', ev('F4', { shift: true }), 'edit.findNext'],
  ['K5.1-27b', ev('F4', { ctrl: true, shift: true }), 'edit.findPrev'],
  ['K5.2-01', ev('F2'), 'edit.f2'],
  ['K5.2-08', ev('Delete'), 'edit.delete'],
  ['K5.2-09', ev('Backspace'), 'edit.backspace'],
  ['K5.2-11', ev('F4'), 'edit.repeat'],
  ['K5.2-12', ev('z', { ctrl: true }), 'edit.undo'],
  ['K5.2-13', ev('y', { ctrl: true }), 'edit.redo.y'],
  ['K5.2-14', ev('z', { ctrl: true, shift: true }), 'edit.redo'],
  ['K5.2-15', ev(';', { ctrl: true }), 'edit.stampDate'],
  ['K5.2-16', ev(':', { ctrl: true, shift: true }), 'edit.stampTime'],
  ['K5.2-17', ev("'", { ctrl: true }), 'edit.copyFormulaAbove'],
  ['K5.2-18', ev('"', { ctrl: true, shift: true }), 'edit.copyValueAbove'],
  ['K5.2-19', ev('u', { ctrl: true, shift: true }), 'edit.expandBar'],
  ['K5.2-20', ev('ArrowDown', { alt: true }), 'edit.dropDown'],
  ['K5.2-21', ev('ArrowDown', { alt: true }), 'edit.dropDown'],
  ['K5.2-22', ev('F3', { shift: true }), 'edit.fnWizard'],
  ['K5.2-25', ev('F3'), 'edit.pasteName'],
  ['K5.2-26', ev('F3', { ctrl: true }), 'edit.names'],
  ['K5.2-27', ev('F3', { ctrl: true, shift: true }), 'edit.namesFromSelection'],
  ['K5.2-28', ev('=', { alt: true }), 'edit.autoSum.equal'],
  ['K5.2-29', ev('"', { ctrl: true }), 'view.formulas."'],
  ['K5.2-29b', ev('`', { ctrl: true }), 'view.formulas.`'],
  ['K5.2-30', ev('F9'), 'edit.recalc'],
  ['K5.2-31', ev('F9', { shift: true }), 'edit.recalcSheet'],
  ['K5.2-32', ev('F9', { ctrl: true, alt: true }), 'edit.recalcAll'],
  ['K5.2-32b', ev('F9', { ctrl: true, alt: true, shift: true }), 'edit.recalcAll'],
  ['K5.2-33', ev('F7'), 'edit.spelling'],
  ['K5.2-38', ev('F11'), 'edit.chartSheet'],
  ['K5.2-39', ev('F1', { alt: true }), 'edit.chart'],
  ['K5.3-01', ev('g', { ctrl: true }), 'format.bold'],
  ['K5.3-02', ev('i', { ctrl: true }), 'format.italic'],
  ['K5.3-03', ev('u', { ctrl: true }), 'format.underline'],
  ['K5.3-04', ev('5', { ctrl: true }), 'format.strike'],
  ['K5.3-05', ev('F', { ctrl: true, shift: true }), 'format.fontTab.f'],
  ['K5.3-05b', ev('P', { ctrl: true, shift: true }), 'format.fontTab.p'],
  ['K5.3-06', ev('>', { ctrl: true, shift: true }), 'format.grow'],
  ['K5.3-06b', ev('<', { ctrl: true, shift: true }), 'format.shrink'],
  ['K5.3-07', ev('1', { ctrl: true }), 'format.cells'],
  ['K5.3-08', ev('~', { ctrl: true, shift: true }), 'format.general'],
  ['K5.3-09', ev('$', { ctrl: true, shift: true }), 'format.currency'],
  ['K5.3-10', ev('%', { ctrl: true, shift: true }), 'format.percent'],
  ['K5.3-11', ev('^', { ctrl: true, shift: true }), 'format.scientific'],
  ['K5.3-12', ev('#', { ctrl: true, shift: true }), 'format.date'],
  ['K5.3-13', ev('@', { ctrl: true, shift: true }), 'format.time'],
  ['K5.3-14', ev('!', { ctrl: true, shift: true }), 'format.number'],
  ['K5.3-15', ev('&', { ctrl: true, shift: true }), 'format.outline'],
  ['K5.3-16', ev('_', { ctrl: true, shift: true }), 'format.noBorder'],
  ['K5.3-17', ev('+', { ctrl: true, shift: true }), 'edit.insertCells'],
  ['K5.3-18', ev('-', { ctrl: true }), 'edit.deleteCells'],
  ['K5.3-19', ev('9', { ctrl: true }), 'format.hideRows'],
  ['K5.3-19b', ev('0', { ctrl: true }), 'format.hideCols'],
  ['K5.3-20', ev('(', { ctrl: true, shift: true }), 'format.showRows'],
  ['K5.3-20b', ev(')', { ctrl: true, shift: true }), 'format.showCols'],
  ['K5.3-21', ev('b', { ctrl: true }), 'edit.fillDown'],
  ['K5.3-22', ev('d', { ctrl: true }), 'edit.fillRight'],
  ['K5.3-23', ev('e', { ctrl: true }), 'edit.flashFill'],
  ['K5.3-24', ev('k', { ctrl: true }), 'edit.link'],
  ['K5.3-25', ev('l', { ctrl: true }), 'edit.table'],
  ['K5.3-26', ev('L', { ctrl: true, shift: true }), 'edit.filter'],
  ['K5.3-27', ev('l', { ctrl: true, alt: true }), 'edit.filter.reapply'],
  ['K5.3-28', ev('T', { ctrl: true, shift: true }), 'edit.totalRow'],
  ['K5.3-29', ev('F2', { shift: true }), 'edit.note'],
  ['K5.3-30', ev('F2', { ctrl: true, shift: true }), 'edit.newComment'],
  ['K5.3-31', ev('F10', { shift: true }), 'edit.contextMenu'],
  ['K5.3-31b', ev('ContextMenu'), 'edit.contextMenu.key'],
  ['K5.3-32', ev('v', { ctrl: true, alt: true }), 'edit.pasteSpecial'],
  ['K5.4-01', ev('n', { ctrl: true }), 'file.new'],
  ['K5.4-02', ev('o', { ctrl: true }), 'file.open'],
  ['K5.4-03', ev('s', { ctrl: true }), 'file.save'],
  ['K5.4-04', ev('F12'), 'file.saveAs'],
  ['K5.4-05', ev('p', { ctrl: true }), 'file.print'],
  ['K5.4-05b', ev('F12', { ctrl: true, shift: true }), 'file.print.f12'],
  ['K5.4-06', ev('w', { ctrl: true }), 'file.close.w'],
  ['K5.4-06b', ev('F4', { ctrl: true }), 'file.close'],
  ['K5.4-14', ev('ArrowRight', { alt: true, shift: true }), 'edit.group'],
  ['K5.4-14b', ev('ArrowLeft', { alt: true, shift: true }), 'edit.ungroup'],
  ['K5.4-16', ev('F11', { shift: true }), 'edit.addSheet'],
  ['K5.4-17', ev('F1', { alt: true, shift: true }), 'edit.addSheet.f1'],
  ['K5.4-18', ev('u', { ctrl: true, shift: true }), 'edit.expandBar'],
  ['K5.4-19', ev('ArrowDown', { ctrl: true, shift: true }), 'nav.jump.ArrowDown'],
];

test('section 5 : chaque touche simulee est traitee par le raccourci prevu', () => {
  for (const [id, k, expected] of GRID_TABLE) {
    resetSelectionMode();
    assert.equal(press(k).id, expected, `${id} (${k.key})`);
  }
});

test('plus aucun raccourci ne repond a Alt+0 ni F12 = Format de cellule, F3/F4 ne sont plus des touches mortes (X-04)', () => {
  assert.equal(press(ev('0', { alt: true })).id, null, 'Alt+0 n existe pas dans Excel');
  assert.equal(press(ev('F12')).id, 'file.saveAs');
  assert.equal(press(ev('F4')).id, 'edit.repeat');
  assert.equal(press(ev('F3')).id, 'edit.pasteName');
  assert.equal(shortcutsOf('grid').some((d) => d.id.endsWith('.none')), false);
});

test('aucun doublon : une meme combinaison exacte ne mene pas a deux raccourcis de meme priorite', () => {
  const seen = new Map<string, string>();
  for (const d of shortcutsOf('grid')) {
    if (!d.combo) continue;
    const key = `${d.priority ?? 0}|${d.combo}`;
    assert.equal(seen.has(key), false, `${d.id} double ${seen.get(key)}`);
    seen.set(key, d.id);
  }
});

test('navigation : Ctrl+Maj+Debut etend jusqu a A1, Maj+Retour arriere reduit, Ctrl+. tourne les coins', () => {
  const start = rangeSelection({ r1: 2, c1: 2, r2: 4, c2: 4 }, { row: 2, col: 2 });
  const home = press(ev('Home', { ctrl: true, shift: true }), { sel: start });
  assert.deepEqual(home.sel().ranges, [{ r1: 0, c1: 0, r2: 2, c2: 2 }], 'etendu de l ancre a A1, pas deplace');
  const collapse = press(ev('Backspace', { shift: true }), { sel: start });
  assert.deepEqual(collapse.sel().ranges, [{ r1: 2, c1: 2, r2: 2, c2: 2 }]);
  assert.deepEqual(reduceToActive(start).ranges, [{ r1: 2, c1: 2, r2: 2, c2: 2 }]);
  const corners: string[] = [];
  let sel = start;
  for (let i = 0; i < 5; i++) {
    sel = nextCorner(sel);
    corners.push(`${sel.active.row},${sel.active.col}`);
  }
  assert.deepEqual(corners, ['2,4', '4,4', '4,2', '2,2', '2,4'], 'sens horaire, retour au point de depart');
  assert.deepEqual(nextCorner(cellSelection(1, 1)), cellSelection(1, 1), 'une seule cellule : rien ne change');
  const col = rangeSelection({ r1: 0, c1: 3, r2: 2, c2: 3 }, { row: 0, col: 3 });
  assert.deepEqual(nextCorner(col).active, { row: 2, col: 3 }, 'une colonne : du haut au bas');
  assert.deepEqual(nextCorner(nextCorner(col)).active, { row: 0, col: 3 }, 'puis retour en haut');
  assert.equal(press(ev('Backspace', { ctrl: true })).calls[0], 'reveal');
  assert.equal(press(ev('PageDown', { alt: true })).sel().active.col, 5, 'Alt+Page suiv. : un ecran (5 colonnes) vers la droite');
  assert.equal(press(ev('Home', { ctrl: true }), { sel: start }).sel().active.row, 0);
  assert.equal(press(ev('a', { ctrl: true }), { sel: cellSelection(1, 0) }).sel().ranges[0]?.r2, 2, 'Ctrl+A : region courante d abord');
  assert.equal(press(ev(' ', { ctrl: true, shift: true }), { sel: cellSelection(1, 0) }).sel().ranges[0]?.r2, 2, 'Ctrl+Maj+Espace : region puis feuille');
  assert.equal(press(ev(' ', { ctrl: true, shift: true }), { sel: cellSelection(30, 30) }).sel().ranges[0]?.r2, 1_048_575, 'hors donnees : feuille entiere');
});

test('modes de selection : F8 etend avec les fleches, Maj+F8 ajoute des cellules, Echap quitte', () => {
  resetSelectionMode();
  const g = grid({ sel: cellSelection(2, 2) });
  assert.equal(dispatchKeyId('grid', ev('F8'), g.api), 'select.extend');
  assert.equal(selectionMode(), 'extend');
  assert.equal(selectionModeLabel(), 'Étendre la sélection');
  dispatchKeyId('grid', ev('ArrowDown'), g.api);
  dispatchKeyId('grid', ev('ArrowRight'), g.api);
  assert.deepEqual(g.sel().ranges, [{ r1: 2, c1: 2, r2: 3, c2: 3 }], 'les fleches etendent la plage depuis l ancre');
  assert.equal(dispatchKeyId('grid', ev('Escape'), g.api), 'edit.escape', 'Echap quitte le mode puis fait l Echap normal');
  assert.equal(selectionMode(), null);
  assert.equal(selectionModeLabel(), undefined);
  // mode Ajout : la selection de depart est conservee, chaque fleche remplace la cellule courante ajoutee
  const a = grid({ sel: cellSelection(0, 0) });
  dispatchKeyId('grid', ev('F8', { shift: true }), a.api);
  assert.equal(selectionLabelIs('Ajouter à la sélection'), true);
  dispatchKeyId('grid', ev('ArrowDown'), a.api);
  dispatchKeyId('grid', ev('ArrowDown'), a.api);
  assert.deepEqual(a.sel().ranges, [{ r1: 0, c1: 0, r2: 0, c2: 0 }, { r1: 2, c1: 0, r2: 2, c2: 0 }]);
  dispatchKeyId('grid', ev('F8', { shift: true }), a.api);
  assert.equal(selectionMode(), null, 'Maj+F8 une seconde fois quitte le mode');
  dispatchKeyId('grid', ev('F8'), a.api);
  assert.equal(dispatchKeyId('grid', ev('x'), a.api), 'edit.type', 'taper un caractere : saisie (et le mode est quitte)');
  assert.equal(selectionMode(), null);
});
const selectionLabelIs = (s: string): boolean => selectionModeLabel() === s;

test('formats de nombre : Ctrl+Maj+symbole applique le bon code (touches QWERTY, AZERTY sans Maj, AltGr)', () => {
  const codes: Record<string, string> = { '~': KEY_FORMATS.general, '!': KEY_FORMATS.number, '#': KEY_FORMATS.date, '@': KEY_FORMATS.time, '$': KEY_FORMATS.currency, '%': KEY_FORMATS.percent, '^': KEY_FORMATS.scientific };
  for (const [sym, code] of Object.entries(codes)) {
    for (const mods of [{ ctrl: true, shift: true }, { ctrl: true }, { ctrl: true, alt: true }]) {
      const r = press(ev(sym, mods));
      assert.deepEqual(r.calls, [`cmd.numberFormat(${JSON.stringify(code)})`], `${sym} ${JSON.stringify(mods)}`);
    }
  }
  assert.deepEqual(press(ev('Dead', { ctrl: true }, 'BracketLeft')).calls, [`cmd.numberFormat(${JSON.stringify(KEY_FORMATS.scientific)})`], '^ AZERTY = touche morte');
  assert.deepEqual(press(ev('&', { ctrl: true, shift: true })).calls, ['cmd.borders("outside")']);
  assert.deepEqual(press(ev('_', { ctrl: true })).calls, ['cmd.borders("none")']);
  assert.deepEqual(press(ev('>', { ctrl: true, shift: true })).calls, ['cmd.growFont(1)']);
  assert.deepEqual(press(ev('<', { ctrl: true })).calls, ['cmd.growFont(-1)'], '« < » est une touche directe en AZERTY');
  assert.deepEqual(press(ev('F', { ctrl: true, shift: true })).calls, ['open:formatCells:font']);
});

test('Ctrl+9/0 masquent, Ctrl+Maj+( ) affichent : QWERTY et AZERTY (touche physique)', () => {
  assert.deepEqual(press(ev('9', { ctrl: true })).calls, ['cmd.hide("row",true)']);
  assert.deepEqual(press(ev('0', { ctrl: true })).calls, ['cmd.hide("col",true)']);
  assert.deepEqual(press(ev('(', { ctrl: true, shift: true }, 'Digit9')).calls, ['cmd.hide("row",false)']);
  assert.deepEqual(press(ev(')', { ctrl: true, shift: true }, 'Digit0')).calls, ['cmd.hide("col",false)']);
  assert.deepEqual(press(ev('ç', { ctrl: true }, 'Digit9')).calls, ['cmd.hide("row",true)'], 'AZERTY : Ctrl+ç (touche du 9)');
  assert.deepEqual(press(ev('à', { ctrl: true }, 'Digit0')).calls, ['cmd.hide("col",true)'], 'AZERTY : Ctrl+à (touche du 0)');
  assert.deepEqual(press(ev('(', { ctrl: true }, 'Digit5')).calls, ['cmd.hide("row",false)'], 'AZERTY : « ( » sans Maj reste Afficher les lignes, pas Barre');
  assert.equal(isDigit(ev('ç', {}, 'Digit9'), '9'), true);
  assert.equal(isDigit(ev('(', {}, 'Digit9'), '9'), false, 'symbole reclame par un autre raccourci');
  assert.equal(press(ev('9', { alt: true })).id, null, 'Alt+9 : rien');
});

test('Ctrl+9 / Ctrl+Maj+( sur le modele : les lignes se masquent puis se reaffichent', () => {
  const d = new Draft(put(createBlankWorkbook(), { A1: '1', A2: '2', A3: '3' }));
  setRowHeights(d, 0, 1, 1, undefined, true);
  assert.equal(d.wb.sheets[0]?.rows.get(1)?.hidden, true);
  setRowHeights(d, 0, 1, 1, undefined, false);
  assert.notEqual(d.wb.sheets[0]?.rows.get(1)?.hidden, true);
  setColumnWidths(d, 0, 2, 2, undefined, true);
  assert.equal(d.wb.sheets[0]?.cols.some((c) => c.min <= 2 && c.max >= 2 && c.hidden), true);
});

test('Ctrl++ et Ctrl+- : lignes/colonnes entieres direct, cellules : boite si enregistree, sinon decalage', () => {
  const rows = press(ev('-', { ctrl: true }), { sel: { ranges: [{ r1: 1, c1: 0, r2: 2, c2: 16383 }], active: { row: 1, col: 0 }, anchor: { row: 1, col: 0 } } });
  assert.deepEqual(rows.calls, ['cmd.remove("rows")']);
  const cols = press(ev('+', { ctrl: true, shift: true }), { sel: { ranges: [{ r1: 0, c1: 1, r2: 1048575, c2: 1 }], active: { row: 0, col: 1 }, anchor: { row: 0, col: 1 } } });
  assert.deepEqual(cols.calls, ['cmd.insert("cols")']);
  assert.deepEqual(press(ev('+', { ctrl: true, shift: true })).calls, ['cmd.insert("cellsDown")'], 'sans boite : decalage vers le bas, defaut d Excel');
  assert.deepEqual(press(ev('-', { ctrl: true })).calls, ['cmd.remove("cellsUp")']);
  const off = registerDialog({ id: 'insertCells' as never, title: 'Insérer', render: () => null } as never);
  assert.deepEqual(press(ev('+', { ctrl: true, shift: true })).calls, ['open:insertCells'], 'la boite du lot Cellules est preferee quand elle existe');
  off();
});

test('copie du dessus : Ctrl+\' formule, Ctrl+Maj+" valeur, rien en premiere ligne', () => {
  assert.deepEqual(press(ev("'", { ctrl: true }), { sel: cellSelection(1, 0) }).calls, ['startEdit("formula@0,0")']);
  assert.deepEqual(press(ev('"', { ctrl: true, shift: true }), { sel: cellSelection(2, 1) }).calls, ['startEdit("value@1,1")']);
  assert.deepEqual(press(ev("'", { ctrl: true }), { sel: cellSelection(0, 0) }).calls, []);
});

test('Ctrl+Y : retablit s il y a quoi, sinon repete ; F4 repete la derniere commande de mise en forme (X-04)', () => {
  forgetLastAction();
  assert.deepEqual(press(ev('y', { ctrl: true }), { canRedo: true }).calls, ['redo']);
  assert.deepEqual(press(ev('F4')).calls, ['notify("Aucune action à répéter.","info")'], 'rien a repeter');
  const log: string[] = [];
  const raw = { bold: () => void log.push('bold'), numberFormat: (c: string) => void log.push(`fmt:${c}`), copy: () => void log.push('copy'), view: () => void log.push('view') };
  const cmd = recordCommands(raw);
  cmd.numberFormat('0%');
  cmd.copy();
  assert.equal(lastAction(), 'numberFormat', 'copier n est pas repetable');
  assert.equal(repeatLast(cmd), true);
  assert.deepEqual(log, ['fmt:0%', 'copy', 'fmt:0%']);
  cmd.bold();
  const g = grid();
  (g.api as { cmd: unknown }).cmd = cmd;
  dispatchKeyId('grid', ev('F4'), g.api);
  dispatchKeyId('grid', ev('y', { ctrl: true }), g.api);
  assert.deepEqual(log.slice(-2), ['bold', 'bold'], 'F4 et Ctrl+Y (sans retablir) rejouent la derniere action');
  forgetLastAction();
  assert.equal(repeatLast(cmd), false);
});

test('Rechercher suivant (Maj+F4) : memorise la derniere recherche, boucle, sens inverse', () => {
  const wb = put(createBlankWorkbook(), { A1: 'chat', A2: 'chien', B2: 'Chat noir', A4: 'oiseau' });
  const sh = wb.sheets[0]!;
  const text = (r: number, c: number): string => String(sh.cells.get(r)?.get(c)?.value ?? '');
  const q = { what: 'chat', matchCase: false, whole: false, inFormulas: false };
  assert.equal(matchesQuery('Chat noir', q), true);
  assert.equal(matchesQuery('Chat noir', { ...q, matchCase: true }), false);
  assert.equal(matchesQuery('chat', { ...q, whole: true }), true);
  assert.deepEqual(findFrom(sh, { row: 0, col: 0 }, q, false, text), { row: 1, col: 1 });
  assert.deepEqual(findFrom(sh, { row: 1, col: 1 }, q, false, text), { row: 0, col: 0 }, 'boucle au debut');
  assert.deepEqual(findFrom(sh, { row: 0, col: 0 }, q, true, text), { row: 1, col: 1 }, 'precedent : boucle a la fin');
  assert.equal(findFrom(sh, { row: 0, col: 0 }, { ...q, what: 'zebre' }, false, text), null);
  // raccourci : sans recherche precedente la boite s ouvre ; avec, la selection saute a la cellule suivante
  const none = press(ev('F4', { shift: true }));
  assert.deepEqual(none.calls.map((c) => c.split('(')[0]), ['notify', 'open:find']);
  setLastFind(q);
  const g = grid({ wb });
  g.api.cellText = (r, c) => text(r, c);
  assert.equal(dispatchKeyId('grid', ev('F4', { shift: true }), g.api), 'edit.findNext');
  assert.deepEqual(g.sel().active, { row: 1, col: 1 });
  dispatchKeyId('grid', ev('F4', { shift: true, ctrl: true }), g.api);
  assert.deepEqual(g.sel().active, { row: 0, col: 0 });
});

test('Maj+F9, Ctrl+Alt+F9 : recalcul ; Alt+Maj+fleches : plan par lignes ou colonnes entieres', () => {
  assert.deepEqual(press(ev('F9', { shift: true })).calls, ['recalc("sheet")'], 'Maj+F9 : la feuille seulement');
  assert.deepEqual(press(ev('F9', { ctrl: true, alt: true })).calls, ['recalc("all")'], 'Ctrl+Alt+F9 : recalcul complet');
  assert.deepEqual(press(ev('ArrowRight', { alt: true, shift: true })).calls, ['outline("row",1)']);
  assert.deepEqual(press(ev('ArrowLeft', { alt: true, shift: true })).calls, ['outline("row",-1)']);
  const full = { ranges: [{ r1: 0, c1: 2, r2: 1048575, c2: 3 }], active: { row: 0, col: 2 }, anchor: { row: 0, col: 2 } };
  assert.deepEqual(press(ev('ArrowRight', { alt: true, shift: true }), { sel: full }).calls, ['outline("col",1)']);
  assert.deepEqual(press(ev('F11')).calls, ['chartSheet']);
  assert.deepEqual(press(ev('F1', { alt: true })).calls, ['insertChart("col")']);
  assert.deepEqual(press(ev('T', { ctrl: true, shift: true })).calls, ['toggleTotalRow']);
  assert.deepEqual(press(ev('F10', { shift: true })).calls, ['contextMenu']);
  assert.deepEqual(press(ev('ArrowDown', { alt: true })).calls, ['dropDown']);
  assert.deepEqual(press(ev('F7')).calls.map((c) => c.split('(')[0]), ['notify'], 'sans boite d orthographe : message, pas de silence');
  assert.equal(nextChartSheetName(['Feuil1']), 'Graph1');
  assert.equal(nextChartSheetName(['Feuil1', 'graph1', 'Graph2']), 'Graph3');
});

// --------------------------------------------------------------------- Saisie (contexte entry)

interface EntryCalls {
  calls: string[];
  api: Parameters<typeof dispatchKeyId<'entry'>>[2];
}
function entry(text: string, caret = text.length, mode: 'enter' | 'edit' = 'edit'): EntryCalls {
  const calls: string[] = [];
  const edit = { sheet: 0, row: 0, col: 0, text, caret, mode, point: null };
  const api = {
    edit, si: 0, pointing: false, textarea: null,
    commit: (dr: number, dc: number, all?: boolean, arr?: boolean) => { calls.push(`commit(${dr},${dc},${!!all},${!!arr})`); return true; },
    cancel: () => calls.push('cancel'), cycleAbsolute: () => calls.push('f4'), open: (d: DialogState) => calls.push(`open:${d.kind}${'fn' in d && d.fn ? `:${d.fn}` : ''}`),
    setEdit: (e: typeof edit) => calls.push(`setEdit:${e.text}`), onPoint: () => calls.push('point'),
  } as unknown as EntryCalls['api'];
  return { calls, api };
}

test('saisie : Ctrl+Maj+Entree = matricielle, Ctrl+Entree = toute la selection, Ctrl+A / Ctrl+Maj+A / F3 / F4', () => {
  const run = (e: KeyLike, text = '=SOMME(A1:A3)', caret?: number): { id: string | null; calls: string[] } => {
    const x = entry(text, caret);
    return { id: dispatchKeyId('entry', e, x.api), calls: x.calls };
  };
  assert.deepEqual(run(ev('Enter', { ctrl: true, shift: true })), { id: 'entry.array', calls: ['commit(0,0,false,true)'] });
  assert.deepEqual(run(ev('Enter', { ctrl: true })).calls, ['commit(1,0,true,false)']);
  assert.deepEqual(run(ev('Enter', { shift: true })).calls, ['commit(-1,0,false,false)']);
  assert.deepEqual(run(ev('F4')).calls, ['f4']);
  assert.deepEqual(run(ev('F3')).calls, ['open:keysPasteName']);
  assert.deepEqual(run(ev('a', { ctrl: true }), '=SOMME(A1;', 10), { id: 'entry.fnArgs', calls: ['open:fnWizard:SOMME'] }, 'Ctrl+A dans SOMME( : boite Arguments de la fonction');
  assert.equal(run(ev('a', { ctrl: true }), 'texte').id, null, 'hors formule : Ctrl+A garde son sens (tout selectionner)');
  assert.deepEqual(run(ev('A', { ctrl: true, shift: true }), '=SOMME', 6).calls, ['setEdit:=SOMME(nombre1;nombre2;...)'], 'Ctrl+Maj+A : noms des arguments');
  assert.equal(run(ev('A', { ctrl: true, shift: true }), '=SOMME(1)', 6).id, null, 'deja des parentheses : rien');
  assert.deepEqual(run(ev('u', { ctrl: true, shift: true })).id, 'entry.expandBar');
});

test('formule matricielle (Ctrl+Maj+Entree) : cellule maitre avec array.ref, autres cellules videes, valeurs repartie par le moteur', () => {
  const wb = put(createBlankWorkbook(), { A1: '1', A2: '2', A3: '3', C1: 'sera ecrase' });
  const d = new Draft(wb);
  const e = parseEntry('=A1:A3*2');
  assert.equal(e.ok, true);
  if (!e.ok) return;
  commitArrayEntry(d, 0, { r1: 0, c1: 2, r2: 2, c2: 2 }, e);
  const master = d.wb.sheets[0]?.cells.get(0)?.get(2);
  assert.equal(master?.formula, 'A1:A3*2');
  assert.deepEqual(master?.array?.ref, { r1: 0, c1: 2, r2: 2, c2: 2 });
  assert.equal(d.wb.sheets[0]?.cells.get(1)?.get(2), undefined);
  assert.throws(() => commitArrayEntry(d, 0, { r1: 0, c1: 2, r2: 0, c2: 2 }, { ok: true, value: 5 }), RangeError);
});

test('Alt+Bas : liste des valeurs de la colonne voisine (texte distinct, trie, sans nombres)', () => {
  const wb = put(createBlankWorkbook(), { A1: 'Pomme', A2: 'poire', A3: 'Banane', A4: 'Pomme', A5: '12' });
  const sh = wb.sheets[0]!;
  const display = (r: number, c: number): string => String(sh.cells.get(r)?.get(c)?.value ?? '');
  assert.deepEqual(pickListValues(sh, 5, 0, display), ['Banane', 'poire', 'Pomme'], 'cellule A6 sous le bloc : distinct, trie, sans le nombre');
  assert.deepEqual(pickListValues(sh, 0, 5, display), [], 'aucune cellule voisine remplie : liste vide');
  assert.deepEqual(pickListValues(sh, 7, 0, display), [], 'separee du bloc par une cellule vide : rien');
});

test('Ctrl+Maj+F3 : noms depuis la ligne du haut / la colonne de gauche, remplacement des noms existants', () => {
  const wb = put(createBlankWorkbook(), { A1: 'Mois', B1: 'Ventes', C1: 'Cout total', A2: 'Jan', B2: '10', C2: '4', A3: 'Fev', B3: '20', C3: '5' });
  const sh = wb.sheets[0]!;
  const label = (r: number, c: number): string => String(sh.cells.get(r)?.get(c)?.value ?? '');
  const range = { r1: 0, c1: 0, r2: 2, c2: 2 };
  assert.deepEqual(defaultNameSides(sh, range), { top: true, left: true, bottom: false, right: false });
  const both = namesFromSelection('Feuil1', range, { top: true, left: true, bottom: false, right: false }, label);
  assert.deepEqual(both.map((n) => [n.name, n.formula]), [
    ['Ventes', 'Feuil1!$B$2:$B$3'], ['Cout_total', 'Feuil1!$C$2:$C$3'], ['Jan', 'Feuil1!$B$2:$C$2'], ['Fev', 'Feuil1!$B$3:$C$3'],
  ]);
  const top = namesFromSelection('Feuil1', range, { top: true, left: false, bottom: false, right: false }, label);
  assert.deepEqual(top.map((n) => n.name), ['Mois', 'Ventes', 'Cout_total']);
  assert.deepEqual(namesFromSelection('Feuil1', range, { top: false, left: false, bottom: false, right: false }, label), []);
  assert.deepEqual(namesFromSelection('Ma feuille', { r1: 0, c1: 0, r2: 1, c2: 0 }, { top: true, left: false, bottom: false, right: false }, label)[0], { name: 'Mois', formula: "'Ma feuille'!$A$2" });
  assert.equal(nameFromLabel('  2024 Total '), '_2024_Total');
  assert.equal(nameFromLabel('A1'), '_A1', 'reference de cellule : prefixe');
  assert.equal(nameFromLabel('€%'), null);
  const merged = mergeNames([{ name: 'ventes', formula: 'Feuil1!$A$1' }, { name: 'Autre', formula: 'Feuil1!$A$2' }], both);
  assert.equal(merged.length, 5);
  assert.equal(merged.find((n) => n.name.toLowerCase() === 'ventes')?.formula, 'Feuil1!$B$2:$B$3', 'nom existant remplace');
  const selected = rangeSelection(range);
  assert.deepEqual(extendTo(selected, 2, 2).ranges.length, 1);
});

// --------------------------------------------------------------------- Info-touches (X-05)

test('info-touches : Insertion S, Donnees E accent aigu, Affichage N comme Excel FR ; Normal = Alt,N,N ; Tableau croise = Alt,S,V', () => {
  assert.deepEqual(TAB_KEYTIPS, { home: 'L', insert: 'S', layout: 'P', formulas: 'U', data: 'É', review: 'R', view: 'N', help: 'Ù' });
  assert.deepEqual(CONTROL_KEYTIPS, { 'insert/pivot': 'V', 'view/normal': 'N' });
  const btn = (id: string) => ({ kind: 'button' as const, id, label: id, onClick: () => undefined });
  const tabs = applyKeytips([
    { id: 'insert', label: 'Insertion', keytip: 'N', groups: [{ id: 'tables', label: 'Tableaux', controls: [btn('pivot'), btn('table')] }] },
    { id: 'data', label: 'Données', keytip: 'D', groups: [] },
    { id: 'view', label: 'Affichage', keytip: 'A', groups: [{ id: 'views', label: 'Affichages', controls: [{ kind: 'row' as const, id: 'r', controls: [btn('normal')] }, btn('break')] }] },
    { id: 'chartDesign', label: 'Création de graphique', keytip: 'JC', groups: [] },
  ]);
  assert.deepEqual(tabs.map((t) => t.keytip), ['S', 'É', 'N', 'JC'], 'onglet inconnu : sa propre info-touche conservee');
  const keytipOf = (tab: number, id: string): string | undefined => {
    const find = (cs: readonly { id: string; keytip?: string; controls?: readonly unknown[] }[]): string | undefined => {
      for (const c of cs) {
        if (c.id === id) return c.keytip;
        const inner = c.controls ? find(c.controls as never) : undefined;
        if (inner) return inner;
      }
      return undefined;
    };
    return find(tabs[tab]?.groups.flatMap((g) => g.controls as never) ?? []);
  };
  assert.equal(keytipOf(0, 'pivot'), 'V');
  assert.equal(keytipOf(0, 'table'), undefined, 'les autres commandes gardent l attribution automatique');
  assert.equal(keytipOf(2, 'normal'), 'N', 'commande imbriquee dans une rangee');
});

test('F6 : zones parcourues en boucle dans les deux sens', () => {
  assert.equal(nextZone(0, 1, 3), 1);
  assert.equal(nextZone(2, 1, 3), 0);
  assert.equal(nextZone(0, -1, 3), 2);
  assert.equal(nextZone(-1, 1, 3), 0, 'hors zone : on entre par la premiere');
  assert.equal(nextZone(-1, -1, 3), 2);
});
