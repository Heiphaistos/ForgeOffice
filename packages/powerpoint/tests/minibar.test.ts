import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RibbonControl, RibbonTab } from '@forgeoffice/ui';
import { MINI_ROWS, miniKindOf, miniRows } from '../src/app/minibar.ts';

const btn = (id: string): RibbonControl => ({ kind: 'button', id, label: id, onClick: () => undefined });
const tab = (id: string, ids: string[]): RibbonTab => ({ id, label: id, groups: [{ id: 'g', label: 'g', controls: [{ kind: 'row', id: 'r', controls: ids.map(btn) }] }] }) as unknown as RibbonTab;

test('type de mini-barre selon l objet', () => {
  assert.equal(miniKindOf({ kind: 'picture' }), 'picture');
  assert.equal(miniKindOf({ kind: 'table' }), 'table');
  assert.equal(miniKindOf({ kind: 'shape' }), 'shape');
  assert.equal(miniKindOf(undefined), null);
});

test('rangees : controles du ruban dans l ordre demande, absents ignores, rangees vides retirees', () => {
  const rows = miniRows('text', [tab('home', ['bold', 'font', 'size', 'italic'])]);
  assert.deepEqual(rows.map((r) => r.map((c) => c.id)), [['font', 'size'], ['bold', 'italic']]);
  assert.deepEqual(miniRows('table', [tab('home', ['bold'])]), []);
  assert.ok(MINI_ROWS.table.length === 2 && MINI_ROWS.picture.length === 1);
});

test('galerie du ruban : devient un menu compact avec la meme liste et la selection', () => {
  const gallery: RibbonControl = { kind: 'gallery', id: 'tableStyles', label: 'Styles de tableau', items: [{ id: 'a', label: 'Style A', render: () => null }, { id: 'b', label: 'Style B', render: () => null }], selectedId: 'b', itemWidth: 60, columns: 7, onSelect: () => undefined } as unknown as RibbonControl;
  const t: RibbonTab = { id: 'tableDesign', label: 'x', groups: [{ id: 'g', label: 'g', controls: [gallery] }] } as unknown as RibbonTab;
  const [row] = miniRows('table', [t]);
  const control = row?.[0];
  assert.equal(control?.kind, 'menu');
  const items = control?.kind === 'menu' ? control.items : [];
  assert.deepEqual(items.map((i) => ('label' in i ? [i.label, i.checked] : null)), [['Style A', undefined], ['Style B', true]]);
});
