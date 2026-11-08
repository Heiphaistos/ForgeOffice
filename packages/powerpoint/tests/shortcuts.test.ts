import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHORTCUTS, matchShortcut, type KeyLike, type ShortcutContext } from '../src/app/shortcuts.ts';
import { shortcutRows } from '../src/app/shortcuts-list.ts';

const key = (k: string, mods: Partial<KeyLike> = {}): KeyLike => ({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods });
const ctx = (over: Partial<ShortcutContext> = {}): ShortcutContext => ({ hasTarget: true, hasText: true, ...over });
const id = (e: KeyLike, c = ctx()): string | undefined => matchShortcut(e, c)?.id;

test('raccourcis de fichier et d edition', () => {
  assert.equal(id(key('s', { ctrlKey: true })), 'save');
  assert.equal(id(key('S', { ctrlKey: true, shiftKey: true })), 'saveAs');
  assert.equal(id(key('z', { ctrlKey: true })), 'undo');
  assert.equal(id(key('z', { ctrlKey: true, shiftKey: true })), 'redo');
  assert.equal(id(key('y', { metaKey: true })), 'redo');
  assert.equal(id(key('f', { ctrlKey: true })), 'find');
  assert.equal(id(key('F', { ctrlKey: true, shiftKey: true })), 'font');
  assert.equal(id(key('/', { ctrlKey: true })), 'shortcuts');
});

test('Ctrl+G : gras dans un texte, rien sur un objet ; Ctrl+B partout', () => {
  assert.equal(id(key('g', { ctrlKey: true }), ctx({ hasText: true })), 'bold');
  assert.equal(id(key('g', { ctrlKey: true }), ctx({ hasText: false })), undefined);
  assert.equal(id(key('b', { ctrlKey: true }), ctx({ hasText: false })), 'bold');
  assert.equal(id(key('b', { ctrlKey: true }), ctx({ hasTarget: false, hasText: false })), undefined);
});

test('AltGr (Ctrl+Alt) ne declenche pas les raccourcis de lettre ; F5 et ses variantes', () => {
  assert.equal(id(key('e', { ctrlKey: true, altKey: true })), undefined);
  assert.equal(id(key('F5')), 'startShow');
  assert.equal(id(key('F5', { shiftKey: true })), 'startFromCurrent');
  assert.equal(id(key('F5', { altKey: true })), 'presenterShow');
});

test('taille de police : ] et > agrandissent, [ et < reduisent', () => {
  assert.equal(id(key(']', { ctrlKey: true })), 'grow');
  assert.equal(id(key('>', { ctrlKey: true, shiftKey: true })), 'grow');
  assert.equal(id(key('<', { ctrlKey: true, shiftKey: true })), 'shrink');
});

test('registre : identifiants uniques, notation et libelle pour chaque raccourci, recherche sans accents', () => {
  assert.equal(new Set(SHORTCUTS.map((s) => s.id)).size, SHORTCUTS.length);
  const rows = shortcutRows('');
  assert.ok(rows.length >= SHORTCUTS.length + 10);
  assert.ok(rows.every((r) => r.keys && r.label));
  assert.deepEqual(shortcutRows('enregistrer').map((r) => r.keys).sort(), ['Ctrl+Maj+S', 'Ctrl+S']);
  assert.ok(shortcutRows('ecran noir').some((r) => r.group === 'show'));
  assert.equal(shortcutRows('zzzz').length, 0);
});
