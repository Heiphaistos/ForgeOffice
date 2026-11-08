// Geometries de formes : identifiants uniques (noms DrawingML), polygones valides, libelles francais.
import test from 'node:test';
import assert from 'node:assert/strict';
import { svgPoints, GEOMETRIES, geometryLabel } from '../src/objects/geometry.ts';

test('geometries : uniques, polygones en pourcentages', () => {
  assert.equal(new Set(GEOMETRIES.map((g) => g.id)).size, GEOMETRIES.length);
  for (const g of GEOMETRIES.filter((x) => x.polygon)) {
    const pts = g.polygon!.split(',');
    assert.ok(pts.length >= 3, g.id);
    for (const pt of pts) assert.match(pt.trim(), /^(\d+%|0) (\d+%|0)$/, `${g.id} : ${pt}`);
  }
  assert.ok(GEOMETRIES.some((g) => g.group === 'arrows') && GEOMETRIES.some((g) => g.group === 'stars') && GEOMETRIES.some((g) => g.group === 'callouts'));
});

test('points SVG et libelles', () => {
  assert.equal(svgPoints('rect'), null);
  assert.equal(svgPoints('triangle'), '50,0 100,100 0,100');
  assert.match(svgPoints('star5')!, /^50,0 61,35 /);
  assert.equal(geometryLabel('rightArrow'), 'Flèche droite');
  assert.equal(geometryLabel('inconnue'), 'inconnue');
});
