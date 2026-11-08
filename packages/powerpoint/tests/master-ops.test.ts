import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Shape } from '@forgeoffice/pptx';
import { PLACEHOLDER_KINDS, newPlaceholder, nextPlaceholderIndex } from '../src/app/master-ops.ts';

const size = { width: 960, height: 540 };

test('indice libre : apres les pieds de page (10 a 12) puis apres le plus grand existant', () => {
  assert.equal(nextPlaceholderIndex([]), 13);
  const used = [{ placeholder: { type: 'obj', index: 14 } }, { placeholder: { type: 'dt', index: 10 } }] as unknown as Shape[];
  assert.equal(nextPlaceholderIndex(used), 15);
});

test('nouvel espace reserve : type, indice, nom francais, boite centree, texte d invite', () => {
  const p = newPlaceholder('pic', 9, 13, size, 0);
  assert.deepEqual(p.placeholder, { type: 'pic', index: 13 });
  assert.equal(p.name, 'Image 1');
  assert.deepEqual([p.xfrm?.width, p.xfrm?.height, p.xfrm?.x, p.xfrm?.y], [480, 216, 240, 162]);
  const run = p.text?.paragraphs[0]?.runs[0];
  assert.ok(run?.type === 'text' && /image/.test(run.text));
});

test('sept types proposes, tous avec un nom et une invite', () => {
  assert.equal(PLACEHOLDER_KINDS.length, 7);
  for (const k of PLACEHOLDER_KINDS) assert.ok(newPlaceholder(k, 2, 13, size, 2).name.endsWith(' 3'));
});
