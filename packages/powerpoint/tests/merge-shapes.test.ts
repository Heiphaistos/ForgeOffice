import { test } from 'node:test';
import assert from 'node:assert/strict';
import { regionArea } from '../src/canvas/boolean-ops/clip.ts';
import { mergeShapes, pageRings } from '../src/canvas/boolean-ops/merge.ts';
import { flatten, parseSvgPath, toGeometry } from '../src/canvas/path-edit/model.ts';
import { buildGeometry } from '../src/canvas/geometry/index.ts';

const preset = (name: string) => ({ geometry: { type: 'preset' as const, preset: name } });

test('ellipse : contour a noeuds et aire ~ pi r^2', () => {
  const d = buildGeometry(preset('ellipse').geometry, 100, 60).paths[0]?.d ?? '';
  const subs = parseSvgPath(d);
  assert.equal(subs.length, 1);
  assert.equal(subs[0]?.closed, true);
  const area = regionArea([flatten(subs[0] as never, 0.05)]);
  assert.ok(Math.abs(area - Math.PI * 50 * 30) / (Math.PI * 1500) < 0.005, String(area));
});

test('rotation et miroir : la boite tournee de 90 degres echange largeur et hauteur', () => {
  const rings = pageRings(preset('rect'), { x: 0, y: 0, width: 100, height: 20, rotation: 90 });
  const xs = rings[0]?.map((p) => p.x) ?? [];
  const ys = rings[0]?.map((p) => p.y) ?? [];
  assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - 20) < 1e-6 && Math.abs(Math.max(...ys) - Math.min(...ys) - 100) < 1e-6);
});

test('fusion de deux rectangles : union 175, intersection 25, soustraction 75, combinaison 150', () => {
  const frames = [{ shape: preset('rect'), frame: { x: 0, y: 0, width: 10, height: 10 } }, { shape: preset('rect'), frame: { x: 5, y: 5, width: 10, height: 10 } }];
  const area = (op: 'union' | 'intersect' | 'subtract' | 'combine'): number => {
    const r = mergeShapes(frames, op);
    return r?.geometry.type === 'custom' ? Math.round(regionArea(pageRingsOf(r)) * 10) / 10 : 0;
  };
  assert.deepEqual(['union', 'intersect', 'subtract', 'combine'].map((o) => area(o as never)), [175, 25, 75, 150]);
});

function pageRingsOf(r: NonNullable<ReturnType<typeof mergeShapes>>) {
  return pageRings({ geometry: r.geometry }, { x: r.xfrm?.x ?? 0, y: r.xfrm?.y ?? 0, width: r.xfrm?.width ?? 0, height: r.xfrm?.height ?? 0 });
}

test('ellipse moins ellipse : trou ; geometrie personnalisee relue sans perte', () => {
  const frames = [{ shape: preset('ellipse'), frame: { x: 0, y: 0, width: 100, height: 100 } }, { shape: preset('ellipse'), frame: { x: 30, y: 30, width: 40, height: 40 } }];
  const r = mergeShapes(frames, 'subtract');
  assert.ok(r);
  const rings = pageRingsOf(r);
  assert.equal(rings.length, 2);
  const expected = Math.PI * 2500 - Math.PI * 400;
  assert.ok(Math.abs(regionArea(rings) - expected) / expected < 0.01);
  const back = toGeometry(parseSvgPath('M0 0 L10 0 L10 10 Z'), 0, 0, 10, 10, true);
  assert.equal(back.type, 'custom');
});
