import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addShape, addText, NO_FILL, para } from '../src/build.ts';
import { addBlock, captureBlock, parseLibrary, removeBlock } from '../src/library.ts';
import { createPublication } from '../src/pubdeck.ts';

function sample() {
  const deck = createPublication({ width: 595, height: 842 }, 1);
  const shapes = deck.slides[0]!.shapes;
  addText(shapes, [100, 200, 80, 30], [para('Titre', { size: 20 })], {}, {});
  addShape(shapes, [150, 260, 60, 40], NO_FILL);
  return shapes;
}

test('captureBlock : formes ramenées à l origine, taille du cadre englobant, copie indépendante', () => {
  const shapes = sample();
  const { block, skipped } = captureBlock('  Mon bloc ', shapes, []);
  assert.ok(block);
  assert.equal(skipped, 0);
  assert.equal(block.name, 'Mon bloc');
  assert.equal(block.id, 'bloc1');
  assert.deepEqual([block.width, block.height], [110, 100]);
  assert.deepEqual(block.shapes.map((s) => [s.xfrm?.x, s.xfrm?.y]), [[0, 0], [50, 60]]);
  assert.equal(shapes[0]!.xfrm?.x, 100);
});

test('captureBlock : nom vide, rien à enregistrer, objets avec image ignorés', () => {
  const shapes = sample();
  assert.equal(captureBlock('  ', shapes, []).block, null);
  assert.equal(captureBlock('x', [], []).block, null);
  const withPicture = [...shapes, { kind: 'picture', id: 99, name: 'img', mediaId: 'm1', xfrm: { x: 0, y: 0, width: 10, height: 10 } }] as never;
  const r = captureBlock('x', withPicture, []);
  assert.equal(r.skipped, 1);
  assert.equal(r.block?.shapes.length, 2);
});

test('addBlock remplace le bloc de même nom, identifiants uniques ; removeBlock', () => {
  const a = captureBlock('A', sample(), []).block!;
  let lib = addBlock([], a);
  const b = captureBlock('B', sample(), lib).block!;
  assert.equal(b.id, 'bloc2');
  lib = addBlock(lib, b);
  lib = addBlock(lib, { ...a, width: 5 });
  assert.equal(lib.length, 2);
  assert.equal(lib[0]!.width, 5);
  assert.deepEqual(removeBlock(lib, 'bloc1').map((x) => x.name), ['B']);
});

test('lecture défensive de la bibliothèque (réglages altérés)', () => {
  const ok = captureBlock('A', sample(), []).block!;
  const lib = parseLibrary([ok, ok, { name: '', shapes: [] }, { name: 'sans formes', shapes: [] }, { name: 'faux', shapes: [{ pas: 'une forme' }, 3] }, null, 'x', { ...ok, name: 'B', id: '../../x', width: -4 }]);
  assert.deepEqual(lib.map((b) => b.name), ['A', 'B']);
  assert.ok(/^[a-z0-9-]+$/.test(lib[1]!.id));
  assert.equal(lib[1]!.width, 100);
  assert.deepEqual(parseLibrary('pas une liste'), []);
});
