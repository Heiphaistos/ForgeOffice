import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorSelection, EditorState, type Transaction, type TransactionSpec } from '@codemirror/state';
import { columnInsert, columnText, indentWidth } from '../src/logic/columns.ts';
import { dailyDate, dailyNote } from '../src/logic/daily.ts';
import { recordStep, runMacro, parseSteps, type MacroStep } from '../src/editor/macros.ts';
import { changeCounts, changeEffects, changeHistory } from '../src/editor/visual.ts';
import { buildCommands, dirOf, parseTimes } from '../src/commands.ts';
import { DEFAULT_PREFS, parsePrefs } from '../src/logic/prefs.ts';
import { Workspace } from '../src/workspace.ts';
import { fake, makeHost } from './fake.ts';

test('colonne : {n} et {n:depart,pas}, lignes courtes completees', () => {
  assert.equal(columnText('a{n}b', 2), 'a3b');
  assert.equal(columnText('{n:10,5}', 2), '20');
  assert.equal(columnText('{n', 0), '{n');
  assert.equal(columnText('{n:x}', 0), '1');
  assert.deepEqual(columnInsert(['abc', 'a', 'abcdef'], 2, '[{n}]'), ['ab[1]c', 'a [2]', 'ab[3]cdef']);
  assert.equal(indentWidth('\t  x', 4), 6);
  assert.equal(indentWidth('x', 4), 0);
});

test('note du jour : nom, titre par defaut, modele avec {{date}}', () => {
  const d = new Date(2026, 2, 9);
  assert.equal(dailyDate(d), '2026-03-09');
  assert.deepEqual(dailyNote(d, null), { name: '2026-03-09.md', text: '# 2026-03-09\n\n' });
  assert.equal(dailyNote(d, 'J {{date}} / {{date}}').text, 'J 2026-03-09 / 2026-03-09');
});

test('note du jour : creee une fois, puis reactivee ; le modele du dossier sert de depart', () => {
  const ws = new Workspace(fake().services, DEFAULT_PREFS);
  ws.setFolder({ name: 'n', files: [{ rel: 'modele-quotidien.md', text: '## {{date}}\n- [ ] ' }] });
  const d = new Date(2026, 10, 13);
  const a = ws.openDailyNote(d);
  assert.equal(a.created, true);
  assert.equal(ws.text(a.id), '## 2026-11-13\n- [ ] ');
  assert.equal(ws.tab(a.id)?.name, '2026-11-13.md');
  ws.newTab();
  const b = ws.openDailyNote(d);
  assert.deepEqual([b.created, b.id], [false, a.id]);
  assert.equal(ws.activeId, a.id);
  ws.setFolder({ name: 'n', files: [{ rel: '2026-11-14.md', text: 'deja la' }] });
  const c = ws.openDailyNote(new Date(2026, 10, 14));
  assert.equal(c.created, false);
  assert.equal(ws.text(c.id), 'deja la');
});

/** Simule la frappe : applique les transactions et renvoie l'etat final. */
function type(state: EditorState, specs: TransactionSpec[]): { state: EditorState; trs: Transaction[] } {
  const trs: Transaction[] = [];
  for (const spec of specs) {
    const tr = state.update(spec);
    trs.push(tr);
    state = tr.state;
  }
  return { state, trs };
}

test('macro : enregistre une frappe + descente, rejoue N fois et jusqu a la fin', () => {
  const start = EditorState.create({ doc: 'a\nb\nc\nd', selection: { anchor: 0 } });
  const { trs } = type(start, [
    { changes: { from: 0, insert: '- ' }, selection: { anchor: 2 }, userEvent: 'input.type' },
    { selection: { anchor: 5 }, userEvent: 'select' },
  ]);
  const steps = trs.map(recordStep).filter((s): s is MacroStep => s !== null);
  assert.equal(steps.length, 2);
  assert.deepEqual(steps[0], { t: 'edit', from: 0, to: 0, ins: '- ', caret: 2 });
  assert.equal(steps[1]?.t, 'move');
  const base = EditorState.create({ doc: 'a\nb\nc\nd', selection: { anchor: 0 } });
  const down: MacroStep = { t: 'move', lines: 1, col: 0, abs: true, sel: 0 };
  const macro: MacroStep[] = [{ t: 'edit', from: 0, to: 0, ins: '- ', caret: 2 }, down];
  let out = runMacro(base, macro, 2).at(-1)?.state;
  assert.equal(out?.doc.toString(), '- a\n- b\nc\nd');
  assert.equal(out?.doc.lineAt(out.selection.main.head).number, 3);
  out = runMacro(base, macro, 'end').at(-1)?.state;
  assert.equal(out?.doc.toString(), '- a\n- b\n- c\n- d', 'jusqu a la derniere ligne, une seule fois sur chacune');
  assert.deepEqual(runMacro(base, [], 5), []);
});

test('macro : ce qui n est pas rejouable est ignore (souris, plusieurs curseurs, rejeu lui-meme)', () => {
  const st = EditorState.create({ doc: 'ab\ncd', selection: { anchor: 0 } });
  assert.equal(recordStep(st.update({ selection: { anchor: 4 }, userEvent: 'select.pointer' })), null);
  const multi = EditorState.create({ doc: 'ab\ncd', selection: EditorSelection.create([EditorSelection.cursor(0), EditorSelection.cursor(3)]), extensions: EditorState.allowMultipleSelections.of(true) });
  assert.equal(recordStep(multi.update({ changes: { from: 0, insert: 'x' } })), null);
  const replayed = runMacro(st, [{ t: 'edit', from: 0, to: 0, ins: 'x', caret: 1 }], 1)[0];
  assert.ok(replayed);
  assert.equal(recordStep(replayed), null);
  const back = EditorState.create({ doc: 'abc', selection: { anchor: 2 } });
  assert.deepEqual(recordStep(back.update({ changes: { from: 1, to: 2 }, selection: { anchor: 1 }, userEvent: 'delete.backward' })), { t: 'edit', from: -1, to: 0, ins: '', caret: 0 });
});

test('macro : selection enregistree et etapes de session verifiees', () => {
  const st = EditorState.create({ doc: 'hello world', selection: { anchor: 0 } });
  const step = recordStep(st.update({ selection: EditorSelection.single(0, 5), userEvent: 'select' }));
  assert.deepEqual(step, { t: 'move', lines: 0, col: 5, abs: false, sel: -5 });
  const out = runMacro(EditorState.create({ doc: 'abc def', selection: { anchor: 4 } }), [step as MacroStep], 1).at(-1)?.state;
  assert.deepEqual([out?.selection.main.anchor, out?.selection.main.head], [2, 7], 'selection bornee au texte');
  assert.deepEqual(parseSteps([{ t: 'edit', from: 1, to: 2, ins: 'x', caret: 1 }, { t: 'bad' }, null, { t: 'move', lines: 'x' }]), [
    { t: 'edit', from: 1, to: 2, ins: 'x', caret: 1 }, { t: 'move', lines: 0, col: 0, abs: false, sel: 0 },
  ]);
  assert.deepEqual(parseSteps('x'), []);
});

test('macro : espace de travail (enregistrer, garder, rejouer apres redemarrage)', () => {
  const f = fake();
  const ws = new Workspace(f.services, DEFAULT_PREFS);
  assert.equal(ws.toggleMacro(), null);
  assert.equal(ws.macro.recording, true);
  assert.equal(ws.toggleMacro(), 0, 'macro vide');
  assert.equal(ws.playMacro(1), false, 'rien a rejouer');
  ws.macro.last = [{ t: 'edit', from: 0, to: 0, ins: 'x', caret: 1 }];
  f.services.settings.set('notes.macro', ws.macro.last);
  assert.deepEqual(new Workspace(f.services, DEFAULT_PREFS).macro.last, ws.macro.last);
});

test('repetitions : nombre, 0 = fin du document', () => {
  assert.equal(parseTimes('10'), 10);
  assert.equal(parseTimes(' 0 '), 'end');
  assert.equal(parseTimes('abc'), null);
  assert.equal(parseTimes('-3'), null);
  assert.equal(parseTimes('12345678'), null);
});

test('historique des modifications : orange puis vert apres enregistrement, efface au rechargement', () => {
  let st = EditorState.create({ doc: 'a\nb\nc', extensions: changeHistory });
  st = st.update({ changes: { from: 2, insert: 'X' } }).state;
  assert.deepEqual(changeCounts(st), { unsaved: 1, saved: 0 });
  st = st.update({ effects: changeEffects.saved() }).state;
  assert.deepEqual(changeCounts(st), { unsaved: 0, saved: 1 });
  st = st.update({ changes: { from: 0, insert: '>' } }).state;
  assert.deepEqual(changeCounts(st), { unsaved: 1, saved: 1 });
  st = st.update({ changes: { from: st.doc.length, insert: '\nd' } }).state;
  assert.deepEqual(changeCounts(st), { unsaved: 3, saved: 1 }, 'lignes 1, 3 (fin) et 4');
  st = st.update({ effects: changeEffects.cleared() }).state;
  assert.deepEqual(changeCounts(st), { unsaved: 0, saved: 0 });
});

test('historique des modifications : enregistrement de l espace de travail', async () => {
  const f = fake();
  const ws = new Workspace(f.services, { ...DEFAULT_PREFS, changeHistory: true });
  const id = ws.add({ name: 'h.txt', text: 'un\ndeux' });
  assert.equal(await ws.save(id, true), true);
  assert.deepEqual(changeCounts(ws.stateOf(id) as EditorState), { unsaved: 0, saved: 0 });
});

test('commandes : fermer a droite, copier nom et dossier, bascules d affichage, macros grisees pendant l enregistrement', () => {
  assert.equal(dirOf('C:\\Users\\x\\n.txt'), 'C:\\Users\\x');
  assert.equal(dirOf('/home/x/n.txt'), '/home/x');
  const ws = new Workspace(fake().services, DEFAULT_PREFS);
  const a = ws.add({ name: 'a.txt', text: '', path: '/d/a.txt' });
  ws.add({ name: 'b.txt', text: '' });
  ws.add({ name: 'c.txt', text: '' });
  ws.activate(a);
  const copied: string[] = [];
  const closed: string[][] = [];
  const set: Record<string, unknown>[] = [];
  const list = buildCommands(makeHost(ws, { copyText: (t) => void copied.push(t), closeTabs: (ids) => void closed.push([...ids]), setPrefs: (c) => void set.push(c) }));
  const run = (id: string): void => list.find((c) => c.id === id)?.run();
  run('copyName');
  run('copyDir');
  run('closeRight');
  assert.deepEqual(copied, ['a.txt', '/d']);
  assert.equal(closed[0]?.length, 2);
  assert.equal(list.find((c) => c.id === 'closeLeft')?.disabled, true);
  for (const id of ['guides', 'eolMarks', 'smart', 'changeHistory']) run(id);
  assert.deepEqual(set, [{ guides: true }, { eolMarks: true }, { smart: false }, { changeHistory: true }]);
  assert.equal(list.find((c) => c.id === 'macroPlay')?.key, 'F10');
  assert.equal(list.find((c) => c.id === 'columnInsert')?.key, 'Alt+C');
  ws.toggleMacro();
  const rec = buildCommands(makeHost(ws));
  assert.equal(rec.find((c) => c.id === 'macroRecord')?.checked, true);
  assert.equal(rec.find((c) => c.id === 'macroPlay')?.disabled, true);
  assert.equal(parsePrefs({ guides: true, smart: false }).smart, false);
  assert.equal(parsePrefs(null).smart, true);
});
