import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { indentUnit } from '@codemirror/language';
import { wantsCompletion, wordsFromDocument } from '../src/editor/extensions.ts';
import { INDENT_CHOICES, indentStyle, languageIndent, tabInsertion } from '../src/logic/indent.ts';
import { KEYMAP_KEY, applyKeymap, normalizeChord, parseKeymap } from '../src/logic/keymap.ts';
import { matchShortcut } from '../src/logic/shortcuts.ts';
import { DEFAULT_PREFS, parsePrefs } from '../src/logic/prefs.ts';
import { buildCommands } from '../src/commands.ts';
import { Workspace } from '../src/workspace.ts';
import { fake, makeHost } from './fake.ts';

test('indentation par langage : habitudes, choix impose, touche Tab', () => {
  assert.deepEqual(languageIndent('JavaScript'), { size: 2, tabs: false });
  assert.deepEqual(languageIndent('Python'), { size: 4, tabs: false });
  assert.deepEqual(languageIndent('Go'), { size: 4, tabs: true });
  assert.deepEqual(languageIndent('Texte brut', 3), { size: 3, tabs: true });
  assert.deepEqual(indentStyle('auto', 'YAML'), { size: 2, tabs: false });
  assert.deepEqual(indentStyle('8', 'Go'), { size: 8, tabs: false });
  assert.deepEqual(indentStyle('tab', 'JavaScript'), { size: 2, tabs: true });
  assert.equal(tabInsertion({ size: 4, tabs: false }, 1), '   ');
  assert.equal(tabInsertion({ size: 4, tabs: false }, 4), '    ');
  assert.equal(tabInsertion({ size: 4, tabs: true }, 3), '\t');
  assert.equal(INDENT_CHOICES.length, 5);
  assert.equal(parsePrefs({ indent: '8' }).indent, '8');
  assert.equal(parsePrefs({ indent: '3' }).indent, 'auto');
});

test('indentation : le langage de l onglet decide, le choix de l utilisateur l emporte', () => {
  const f = fake();
  const unit = (ws: Workspace, id: string): string => (ws.stateOf(id) as EditorState).facet(indentUnit);
  const ws = new Workspace(f.services, DEFAULT_PREFS);
  const py = ws.add({ name: 'a.py', text: '' });
  const go = ws.add({ name: 'a.go', text: '' });
  assert.equal(unit(ws, py), '    ', 'Python : 4 espaces');
  assert.equal(unit(ws, go), '\t', 'Go : tabulations');
  const eight = new Workspace(f.services, { ...DEFAULT_PREFS, indent: '8' });
  assert.equal(unit(eight, eight.add({ name: 'a.go', text: '' })), '        ');
  assert.equal((eight.stateOf(eight.activeId) as EditorState).tabSize, 8);
});

test('completion des mots : 3 lettres minimum, ou a la demande', () => {
  const state = EditorState.create({ doc: 'calcul calcul\nca', extensions: [] });
  const at = (pos: number, explicit: boolean) => wordsFromDocument(new CompletionContext(state, pos, explicit));
  assert.equal(at(16, false), null, '2 lettres : rien');
  assert.equal(at(16, true) === null, false, 'Ctrl+Espace : propose');
  const three = EditorState.create({ doc: 'calcul calcul\ncal' });
  const res = wordsFromDocument(new CompletionContext(three, 17, false));
  assert.ok(res && !(res instanceof Promise));
  assert.ok(res.options.some((o) => o.label === 'calcul'));
});

test('completion : active seulement pour un langage de code', () => {
  assert.equal(wantsCompletion(DEFAULT_PREFS, { extension: [] } as never), false, 'reglage coupe');
  assert.equal(wantsCompletion({ ...DEFAULT_PREFS, autoComplete: true }, null), false, 'texte brut');
  assert.equal(wantsCompletion({ ...DEFAULT_PREFS, autoComplete: true }, { extension: [] } as never), true);
});

test('raccourcis : normalisation et refus', () => {
  assert.equal(normalizeChord('ctrl+shift+k'), 'Ctrl+Maj+K');
  assert.equal(normalizeChord('Alt + enter'.replace(/ /g, '')), 'Alt+Entrée');
  assert.equal(normalizeChord('f9'), 'F9');
  assert.equal(normalizeChord('Ctrl+='), 'Ctrl+=');
  assert.equal(normalizeChord('K'), null, 'lettre seule refusee');
  assert.equal(normalizeChord('Ctrl+Maj'), null);
  assert.equal(normalizeChord('Ctrl+K+L'), null);
  assert.equal(normalizeChord(''), null);
  assert.ok(matchShortcut('Ctrl+Maj+K', { key: 'K', ctrlKey: true, metaKey: false, altKey: false, shiftKey: true }));
});

test('fichier de raccourcis : libelle ou identifiant, commentaires, erreurs signalees', () => {
  const cmds = [{ id: 'dailyNote', label: 'Note du jour' }, { id: 'zoomIn', label: 'Zoom avant' }, { id: 'find', label: 'Rechercher…' }];
  const text = '# commentaire\nCtrl+Alt+D = note du jour\nctrl+= = Zoom avant\nCtrl+Maj+Q=find\nCtrl+X = Inconnue\nQ = Zoom avant\npas de signe\nCtrl+Alt+D = Zoom avant\n';
  const k = parseKeymap(text, cmds);
  assert.deepEqual(k.overrides, { dailyNote: 'Ctrl+Alt+D', zoomIn: 'Ctrl+=', find: 'Ctrl+Maj+Q' });
  assert.deepEqual(k.errors.map((e) => e.line), [5, 6, 7, 8]);
  assert.match(k.errors[0]?.why ?? '', /inconnue/i);
  assert.equal(KEYMAP_KEY, 'notes.keymap');
});

test('raccourcis : un raccourci personnalise remplace le defaut et le retire aux autres', () => {
  const ws = new Workspace(fake().services, DEFAULT_PREFS);
  const base = buildCommands(makeHost(ws));
  const find = base.find((c) => c.id === 'find');
  const dup = base.find((c) => c.id === 'duplicate');
  assert.equal(find?.key, 'Ctrl+F');
  assert.equal(dup?.key, 'Ctrl+D');
  const list = applyKeymap(base, { dailyNote: 'Ctrl+D', undo: 'Ctrl+Alt+U' });
  assert.equal(list.find((c) => c.id === 'dailyNote')?.key, 'Ctrl+D');
  assert.equal(list.find((c) => c.id === 'duplicate')?.key, undefined, 'le defaut cede');
  const undo = list.find((c) => c.id === 'undo');
  assert.deepEqual([undo?.key, undo?.nativeKey], ['Ctrl+Alt+U', false], 'une commande native devient interceptee');
  assert.equal(list.find((c) => c.id === 'find')?.key, 'Ctrl+F');
});

test('commandes d indentation : une par choix, la courante cochee', () => {
  const ws = new Workspace(fake().services, DEFAULT_PREFS);
  const set: unknown[] = [];
  const list = buildCommands(makeHost(ws, { setPrefs: (c) => void set.push(c) }));
  const ids = list.filter((c) => c.id.startsWith('indent:')).map((c) => c.id);
  assert.deepEqual(ids, ['indent:auto', 'indent:2', 'indent:4', 'indent:8', 'indent:tab']);
  assert.equal(list.find((c) => c.id === 'indent:auto')?.checked, true);
  list.find((c) => c.id === 'indent:tab')?.run();
  assert.deepEqual(set, [{ indent: 'tab' }]);
});
