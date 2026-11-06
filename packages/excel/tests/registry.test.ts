import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMenu, dialogIds, dialogTitle, dispatchKey, matchCombo, menuProviderIds, openDialog, parseCombo, registerDialog, registerMenu, registerShortcut, renderDialog, shortcutsOf,
  type DialogEnv, type DialogHostApi, type DialogState, type KeyLike, type MenuEnv,
} from '../src/ui/registry.ts';
import '../src/ui/keys-nav.ts';
import '../src/ui/keys-format.ts';
import '../src/ui/keys-edit.ts';
import '../src/ui/keys-entry.ts';
import '../src/ui/keys-select.ts';
import '../src/ui/menus-grid.ts';
import type { GridKeyApi } from '../src/ui/keys-types.ts';

const key = (k: string, mods: { ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean } = {}): KeyLike => ({
  key: k, ctrlKey: !!mods.ctrl, altKey: !!mods.alt, shiftKey: !!mods.shift, metaKey: !!mods.meta,
});

/** API de grille factice : chaque appel est enregistre sous son nom. */
function gridApi(): { api: GridKeyApi; calls: string[] } {
  const calls: string[] = [];
  const rec = (name: string) => (...a: unknown[]): void => void calls.push(a.length ? `${name}(${a.map((x) => JSON.stringify(x)).join(',')})` : name);
  const cmd = new Proxy({}, { get: (_t, p) => rec(`cmd.${String(p)}`) });
  const api = {
    cmd, setSel: (s: { active: { row: number; col: number } }) => calls.push(`setSel(${s.active.row},${s.active.col})`),
    startEdit: rec('startEdit'), undo: rec('undo'), redo: rec('redo'), save: rec('save'), saveAs: rec('saveAs'), openFile: rec('openFile'), newFile: rec('newFile'),
    closeDoc: rec('closeDoc'), print: rec('print'), open: (d: DialogState) => calls.push(`open:${d.kind}`), switchSheet: rec('switchSheet'), addSheet: rec('addSheet'),
    recalc: rec('recalc'), notify: rec('notify'), canRedo: false, toggleFormulas: rec('toggleFormulas'), escape: rec('escape'), stamp: rec('stamp'), deleteDrawing: () => false, flashFill: rec('flashFill'), pageRows: 20,
  } as unknown as GridKeyApi;
  return { api, calls };
}

test('combinaisons : modificateurs exacts, indifferents (~) et touche +', () => {
  const c = parseCombo('Ctrl+~Shift+~Alt+Space');
  assert.deepEqual(c, { key: ' ', ctrl: true, shift: 'any', alt: 'any' });
  assert.equal(matchCombo(c, key(' ', { ctrl: true, shift: true })), true);
  assert.equal(matchCombo(c, key(' ')), false);
  assert.equal(matchCombo(parseCombo('Ctrl+L'), key('L', { ctrl: true })), true);
  assert.equal(matchCombo(parseCombo('Ctrl+L'), key('L', { ctrl: true, shift: true })), false, 'Maj non indique : doit etre relache');
  assert.equal(matchCombo(parseCombo('Ctrl+L'), key('l', { meta: true })), true, 'Meta vaut Ctrl');
  assert.equal(parseCombo('Ctrl++').key, '+');
  assert.throws(() => parseCombo('Super+A'));
});

test('raccourcis : priorite, contexte, condition et repli sur la definition suivante', () => {
  const seen: string[] = [];
  const off = [
    registerShortcut({ id: 't.low', context: 'grid', combo: 'F21', priority: 1, run: () => void seen.push('low') }),
    registerShortcut({ id: 't.high', context: 'grid', combo: 'F21', priority: 5, run: () => void seen.push('high') }),
    registerShortcut({ id: 't.entry', context: 'entry', combo: 'F21', run: () => void seen.push('entry') }),
    registerShortcut({ id: 't.pass', context: 'grid', combo: 'F20', priority: 9, run: () => { seen.push('pass'); return false; } }),
    registerShortcut({ id: 't.next', context: 'grid', combo: 'F20', run: () => void seen.push('next') }),
    registerShortcut({ id: 't.when', context: 'grid', combo: 'F22', priority: 9, when: (k) => k.pageRows > 100, run: () => void seen.push('when') }),
    registerShortcut({ id: 't.fallback', context: 'grid', combo: 'F22', run: () => void seen.push('fallback') }),
  ];
  const { api } = gridApi();
  assert.equal(dispatchKey('grid', key('F21'), api), true);
  assert.deepEqual(seen, ['high'], 'la priorite la plus haute passe en premier, une seule definition');
  seen.length = 0;
  assert.equal(dispatchKey('grid', key('F20'), api), true);
  assert.deepEqual(seen, ['pass', 'next'], 'false = non traite : on essaie la suivante');
  seen.length = 0;
  dispatchKey('grid', key('F22'), api);
  assert.deepEqual(seen, ['fallback'], 'when faux : definition ignoree');
  assert.equal(dispatchKey('grid', key('F10'), api), false, 'touche inconnue : non traitee');
  assert.deepEqual(shortcutsOf('grid').filter((d) => d.id.startsWith('t.')).map((d) => d.id), ['t.pass', 't.when', 't.high', 't.low', 't.next', 't.fallback']);
  assert.throws(() => registerShortcut({ id: 't.low', context: 'grid', combo: 'F1', run: () => undefined }), /deja enregistre/);
  for (const o of off) o();
  assert.equal(dispatchKey('grid', key('F21'), api), false, 'retire');
});

test('raccourcis de la grille : F12 = Enregistrer sous, Ctrl+F4 = fermer, plus de Format de cellule sur F12 (X-04)', () => {
  const run = (k: KeyLike): string[] => {
    const { api, calls } = gridApi();
    dispatchKey('grid', k, api);
    return calls;
  };
  assert.deepEqual(run(key('F12')), ['saveAs']);
  assert.deepEqual(run(key('F4', { ctrl: true })), ['closeDoc']);
  assert.deepEqual(run(key('s', { ctrl: true })), ['save']);
  assert.deepEqual(run(key('1', { ctrl: true })), ['open:formatCells']);
  assert.deepEqual(run(key('L', { ctrl: true, shift: true })), ['cmd.toggleFilter']);
  assert.deepEqual(run(key('l', { ctrl: true })), ['open:createTable']);
  assert.deepEqual(run(key('v', { ctrl: true, alt: true })), ['open:pasteSpecial']);
  assert.deepEqual(run(key('=', { alt: true })), ['cmd.autoSum("SUM")']);
  assert.deepEqual(run(key('F2', { shift: true })), ['open:note']);
  assert.deepEqual(run(key('F2')), ['startEdit(null)']);
  assert.deepEqual(run(key('g', { ctrl: true })), ['cmd.bold']);
  assert.deepEqual(run(key('Home', { ctrl: true })), ['setSel(0,0)']);
  assert.deepEqual(run(key('a')), ['startEdit("a")'], 'caractere imprimable : saisie directe');
  assert.deepEqual(run(key('F4')), ['notify("Aucune action à répéter.","info")'], 'F4 seul : repeter (rien a repeter ici : message)');
  assert.equal(dispatchKey('grid', key('F4'), gridApi().api), true);
  assert.equal(dispatchKey('grid', key('F10'), gridApi().api), false);
});

test('raccourcis de saisie : Entree, Echap, F4, fleches selon le mode', () => {
  const calls: string[] = [];
  const edit = { sheet: 0, row: 0, col: 0, text: 'ab', caret: 1, mode: 'enter' as 'enter' | 'edit', point: null };
  const api = {
    edit, si: 0, pointing: false, textarea: null,
    commit: (dr: number, dc: number, all?: boolean) => { calls.push(`commit(${dr},${dc},${!!all})`); return true; }, cancel: () => calls.push('cancel'),
    cycleAbsolute: () => calls.push('f4'), open: () => calls.push('open'), setEdit: () => calls.push('setEdit'), onPoint: () => calls.push('point'),
  };
  dispatchKey('entry', key('Enter'), api);
  dispatchKey('entry', key('Enter', { shift: true }), api);
  dispatchKey('entry', key('Enter', { ctrl: true }), api);
  dispatchKey('entry', key('Tab'), api);
  dispatchKey('entry', key('Escape'), api);
  dispatchKey('entry', key('F4'), api);
  dispatchKey('entry', key('ArrowDown'), api);
  edit.mode = 'edit';
  assert.equal(dispatchKey('entry', key('ArrowDown'), api), false, 'mode Modifier : la fleche deplace le curseur du texte');
  assert.deepEqual(calls, ['commit(1,0,false)', 'commit(-1,0,false)', 'commit(1,0,true)', 'commit(0,1,false)', 'cancel', 'f4', 'commit(1,0,false)']);
  assert.equal(dispatchKey('entry', key('Enter', { alt: true }), api), true, 'Alt+Entree sans zone de texte : repli sur Entree (valide)');
});

test('dialogues : ouverture par identifiant, titre, rendu, doublon et inconnu', () => {
  const off = registerDialog({ id: 'find', title: 'Rechercher', render: (d, _x, h) => `find:${d.replace}:${h.zoom}` });
  const off2 = registerDialog({ id: 'size', title: (d) => (d.axis === 'col' ? 'Largeur' : 'Hauteur'), render: () => 'size' });
  assert.deepEqual(dialogIds().sort(), ['find', 'size']);
  let state: DialogState | null = null;
  openDialog((d) => { state = d; }, 'find', { replace: true });
  assert.deepEqual(state, { kind: 'find', replace: true });
  assert.equal(dialogTitle(state as unknown as DialogState), 'Rechercher');
  assert.equal(renderDialog(state as unknown as DialogState, {} as DialogEnv, { zoom: 125 } as DialogHostApi), 'find:true:125');
  openDialog((d) => { state = d; }, 'size', { axis: 'col' });
  assert.equal(dialogTitle(state as unknown as DialogState), 'Largeur');
  assert.throws(() => registerDialog({ id: 'find', title: 'x', render: () => null }), /deja enregistre/);
  assert.throws(() => openDialog(() => undefined, 'goto'), /inconnu/);
  assert.equal(renderDialog({ kind: 'goto' }, {} as DialogEnv, {} as DialogHostApi), null, 'non enregistre : rien a afficher');
  off();
  off2();
  assert.deepEqual(dialogIds(), []);
});

test('menus : segments ordonnes par contexte, traits entre segments non vides', () => {
  const env = {} as MenuEnv;
  const offs = [
    registerMenu({ id: 't.b', context: ['chart', 'object'], order: 200, items: () => [{ id: 'b1', label: 'B1' }, { id: 'b2', label: 'B2' }] }),
    registerMenu({ id: 't.a', context: 'chart', order: 100, items: () => [{ id: 'a1', label: 'A1' }] }),
    registerMenu({ id: 't.empty', context: 'chart', order: 150, items: () => [] }),
    registerMenu({ id: 't.sep', context: 'chart', order: 300, items: () => [{ id: 'x', kind: 'separator' }, { id: 'c1', label: 'C1' }, { id: 'y', kind: 'separator' }] }),
    registerMenu({ id: 't.target', context: 'pivot', items: (_e, t) => [{ id: `row${t.row}`, label: 'Ligne' }] }),
  ];
  const ids = (c: Parameters<typeof buildMenu>[0], t = {}): string[] => buildMenu(c, env, t).map((i) => (i.kind === 'separator' ? '|' : i.id));
  assert.deepEqual(ids('chart'), ['a1', '|', 'b1', 'b2', '|', 'c1']);
  assert.deepEqual(ids('object'), ['b1', 'b2']);
  assert.deepEqual(ids('formulaBar'), []);
  assert.deepEqual(ids('pivot', { row: 3 }), ['row3']);
  assert.deepEqual(menuProviderIds('chart'), ['t.a', 't.empty', 't.b', 't.sep']);
  assert.throws(() => registerMenu({ id: 't.a', context: 'chart', items: () => [] }), /deja enregistre/);
  for (const o of offs) o();
  assert.deepEqual(ids('chart'), []);
});

test('menus de la grille : meme disposition qu avant le registre (cellule, ligne, colonne)', () => {
  const env = { cmd: { linkAt: () => undefined }, copy: () => undefined, paste: () => undefined, open: () => undefined, comment: () => undefined } as unknown as MenuEnv;
  const ids = (c: 'cell' | 'row' | 'col' | 'corner'): string[] => buildMenu(c, env).map((i) => (i.kind === 'separator' ? '|' : i.id));
  const cell = ['cut', 'copy', 'paste', 'pastesp', '|', 'ins', 'del', 'clr', '|', 'filter', 'sort', '|', 'cmt', 'note', 'link', 'openlink', 'rmlink', 'name', '|', 'fmt'];
  assert.deepEqual(ids('cell'), cell);
  assert.deepEqual(ids('corner'), cell);
  assert.deepEqual(ids('col'), ['cut', 'copy', 'paste', 'pastesp', '|', 'ic', 'dc', 'cw', 'hc', 'sc', '|', 'fmt']);
  assert.deepEqual(ids('row'), ['cut', 'copy', 'paste', 'pastesp', '|', 'ir', 'dr', 'rh', 'hr', 'sr', '|', 'fmt']);
});
