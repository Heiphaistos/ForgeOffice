import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlankDocument } from '@forgeoffice/docx';
import { EMPTY_SELECTION } from '../src/app/selection.ts';
import { INITIAL_UI } from '../src/app/types.ts';
import type { Ctl } from '../src/app/types.ts';
import { clickContext, editorMenu, headerFooterMenu } from '../src/ui/editorMenu.ts';

const noop = (): void => undefined;
function fakeCtl(sel: Partial<typeof EMPTY_SELECTION> = {}): Ctl {
  return {
    meta: createBlankDocument(), sel: { ...EMPTY_SELECTION, ...sel }, ui: { ...INITIAL_UI, spell: false }, view: () => null, state: () => null,
    run: () => true, openDialog: noop, notify: noop, setUi: noop, act: new Proxy({}, { get: () => noop }),
  } as unknown as Ctl;
}
const ids = (items: { id: string }[]): string[] => items.map((i) => i.id);
const hooks = { armNative: noop };

test('texte : commandes de Word dans l ordre (couper, copier, collage, police, paragraphe, puces, styles, lien, commentaire...)', () => {
  const items = editorMenu(fakeCtl(), 10, 10, hooks);
  const labels = items.map((i) => i.label).filter(Boolean);
  for (const l of ['Couper', 'Copier', 'Options de collage', 'Police…', 'Paragraphe…', 'Puces', 'Numérotation', 'Styles', 'Lien hypertexte…', 'Nouveau commentaire', 'Rechercher…', 'Synonymes', 'Sélectionner']) assert.ok(labels.includes(l), l);
  assert.ok(ids(items).indexOf('cut') < ids(items).indexOf('font'));
  const paste = items.find((i) => i.id === 'paste');
  assert.deepEqual(paste?.items?.map((i) => i.label), ['Conserver la mise en forme source', 'Conserver uniquement le texte', 'Collage spécial…']);
});

test('sans selection : couper et copier sont grises', () => {
  const items = editorMenu(fakeCtl(), 0, 0, hooks);
  assert.equal(items.find((i) => i.id === 'cut')?.disabled, true);
  const withSel = editorMenu(fakeCtl({ empty: false, text: 'mot' }), 0, 0, hooks);
  assert.equal(withSel.find((i) => i.id === 'cut')?.disabled, false);
  assert.equal(withSel.find((i) => i.id === 'find')?.label, 'Rechercher « mot »');
});

test('tableau, liste et image : entrees propres au contexte', () => {
  const table = ids(editorMenu(fakeCtl({ inTable: true }), 0, 0, hooks));
  assert.ok(table.includes('t-insert') && table.includes('t-merge') && table.includes('t-split'));
  for (const id of ['t-select', 't-autofit', 't-splittable', 't-totext', 't-props']) assert.ok(table.includes(id), id);
  assert.ok(!ids(editorMenu(fakeCtl(), 0, 0, hooks)).includes('t-insert'));
  const list = ids(editorMenu(fakeCtl({ para: { numbering: { numId: 1, level: 0 } } }), 0, 0, hooks));
  assert.ok(list.includes('restart'));
  const image = editorMenu(fakeCtl({ image: { pos: 1, data: { type: 'image', mediaId: 'm', width: 10, height: 10 } } }), 0, 0, hooks);
  const wrap = image.find((i) => i.id === 'i-wrap');
  assert.equal(wrap?.items?.length, 6);
  assert.equal(wrap?.items?.find((i) => i.checked)?.id, 'inline');
  assert.ok(ids(image).includes('i-alt') && ids(image).includes('i-caption'));
});

test('en-tete et pied de page', () => {
  assert.deepEqual(headerFooterMenu(fakeCtl(), 'header').map((i) => i.label), ['Modifier l’en-tête', 'Numéro de page', 'Supprimer l’en-tête']);
  assert.equal(headerFooterMenu(fakeCtl(), 'footer')[0]!.label, 'Modifier le pied de page');
});

test('clickContext sans DOM : tout est vide', () => {
  assert.deepEqual(clickContext(null), { link: null, field: null, revision: null, comment: null, note: null, inTable: false, image: false, shape: null });
});

test('menu de la regle : mise en page, paragraphe, tabulations, effacer, masquer', async () => {
  const { rulerMenu } = await import('../src/ui/rulerMenu.ts');
  const none = rulerMenu(fakeCtl());
  assert.deepEqual(ids(none), ['r-page', 'r-para', 'r-tabs', 'r-clear', 'r-sep', 'r-hide']);
  assert.equal(none.find((i) => i.id === 'r-clear')?.disabled, true);
  const withTabs = rulerMenu(fakeCtl({ para: { tabs: [{ position: 100, align: 'left' }] } }));
  assert.equal(withTabs.find((i) => i.id === 'r-clear')?.disabled, false);
});

test('menu de la barre d etat : indicateurs coches, bascule memorisee', async () => {
  const { statusMenu, toggleHidden } = await import('../src/ui/statusMenu.ts');
  const saved: Record<string, unknown> = {};
  const ui: { statusHidden: string[] } = { statusHidden: ['lang'] };
  const c = { ...fakeCtl(), ui: { ...INITIAL_UI, statusHidden: ui.statusHidden }, services: { settings: { set: (k: string, v: unknown) => { saved[k] = v; } } }, setUi: (p: { statusHidden: string[] }) => { ui.statusHidden = p.statusHidden; } } as unknown as Ctl;
  const items = statusMenu(c);
  assert.equal(items[0]?.kind, 'header');
  assert.equal(items.find((i) => i.id === 'sb-page')?.checked, true);
  assert.equal(items.find((i) => i.id === 'sb-lang')?.checked, false);
  items.find((i) => i.id === 'sb-page')?.onClick?.();
  assert.deepEqual(ui.statusHidden, ['lang', 'page']);
  assert.deepEqual(saved['word.statusHidden'], ['lang', 'page']);
  assert.deepEqual(toggleHidden(['lang', 'page'], 'lang'), ['page']);
});
