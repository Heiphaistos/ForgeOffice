import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Deck } from '@forgeoffice/pptx';
import { showMenuItems, type ShowMenuContext } from '../src/app/show-menu.ts';

const deck = { slides: [{ id: 1, shapes: [] }, { id: 2, shapes: [] }, { id: 3, shapes: [] }] } as unknown as Deck;
const calls: string[] = [];
const ctx = (over: Partial<ShowMenuContext> = {}): ShowMenuContext => ({
  deck, order: [0, 2], pos: 0, tool: 'arrow', blank: null, hasInk: false,
  next: () => calls.push('next'), back: () => calls.push('back'), goTo: (p) => calls.push(`goto${p}`), setTool: (t) => calls.push(`tool:${t}`),
  setBlank: (b) => calls.push(`blank:${b}`), clearInk: () => calls.push('clear'), end: () => calls.push('end'), ...over,
});
const sub = (id: string, c = ctx()) => (showMenuItems(c).find((i) => i.id === id) as unknown as { items: Array<{ id: string; disabled?: boolean; checked?: boolean; onClick?: () => void }> }).items;

test('menu : precedent desactive sur la premiere, suivant sur la derniere', () => {
  const first = showMenuItems(ctx());
  assert.equal((first.find((i) => i.id === 'prev') as { disabled?: boolean }).disabled, true);
  const last = showMenuItems(ctx({ pos: 1 }));
  assert.equal((last.find((i) => i.id === 'next') as { disabled?: boolean }).disabled, true);
});

test('atteindre : seulement les diapositives jouees, courante cochee', () => {
  const items = sub('goto');
  assert.equal(items.length, 2);
  assert.equal(items[0]?.checked, true);
  items[1]?.onClick?.();
  assert.ok(calls.includes('goto1'));
});

test('pointeur et ecran : outil coche, effacer desactive sans encre, ecran noir/blanc bascule', () => {
  const pointer = sub('pointer', ctx({ tool: 'pen' }));
  assert.equal(pointer.find((i) => i.id === 'pen')?.checked, true);
  assert.equal(pointer.find((i) => i.id === 'clear')?.disabled, true);
  assert.equal(sub('pointer', ctx({ hasInk: true })).find((i) => i.id === 'clear')?.disabled, false);
  sub('screen').find((i) => i.id === 'black')?.onClick?.();
  sub('screen', ctx({ blank: 'black' })).find((i) => i.id === 'black')?.onClick?.();
  assert.deepEqual(calls.filter((c) => c.startsWith('blank')), ['blank:black', 'blank:null']);
});
