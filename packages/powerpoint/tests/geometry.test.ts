import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Geometry } from '@forgeoffice/pptx';
import { adjustFromPoint, buildGeometry, isPresetKnown, LINE_PRESETS } from '../src/canvas/geometry/index.ts';
import { builtinVars, evaluateFormula } from '../src/canvas/geometry/formula.ts';
import { PRESET_NAMES } from '../src/canvas/geometry/compile.ts';

const preset = (name: string, adjust?: Record<string, number>): Geometry => (adjust ? { type: 'preset', preset: name, adjust } : { type: 'preset', preset: name });

/** Points (x, y) d'un `d` (toutes les coordonnees, points de controle compris). */
function coords(d: string): Array<[number, number]> {
  const nums = d.split(/[ A-Z]+/).filter(Boolean).map(Number);
  const out: Array<[number, number]> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i] ?? NaN, nums[i + 1] ?? NaN]);
  return out;
}

const near = (a: number, b: number, eps = 0.01): void => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('evaluateur : chaque operateur et variables integrees', () => {
  const v = builtinVars(200, 100);
  v.set('adj', 25000);
  const e = (f: string): number => evaluateFormula(f, v);
  assert.equal(e('*/ w adj 100000'), 50);
  assert.equal(e('+- r 10 30'), 180);
  assert.equal(e('+/ w h 3'), 100);
  assert.equal(e('?: 1 5 7'), 5);
  assert.equal(e('?: 0 5 7'), 7);
  assert.equal(e('abs -4'), 4);
  near(e('at2 1 1'), 2700000);
  near(e('cat2 10 1 1'), 10 * Math.SQRT1_2, 1e-9);
  near(e('sat2 10 0 1'), 10, 1e-9);
  near(e('cos 10 cd2'), -10, 1e-9);
  near(e('sin 10 cd4'), 10, 1e-9);
  near(e('tan 10 2700000'), 10, 1e-9);
  assert.equal(e('max 3 9'), 9);
  assert.equal(e('min 3 9'), 3);
  assert.equal(e('mod 2 3 6'), 7);
  assert.equal(e('pin 0 -5 10'), 0);
  assert.equal(e('pin 0 50 10'), 10);
  assert.equal(e('pin 0 5 10'), 5);
  assert.equal(e('sqrt 49'), 7);
  assert.equal(e('val 12'), 12);
  assert.equal(e('val hc'), 100);
  assert.equal(e('val ss'), 100);
  assert.equal(e('val ls'), 200);
  assert.equal(e('val wd8'), 25);
  assert.equal(e('val hd10'), 10);
  assert.equal(e('val ssd32'), 100 / 32);
  assert.equal(e('val 3cd4'), 16200000);
  assert.equal(e('val 7cd8'), 18900000);
  assert.equal(e('*/ 1 1 0'), 0, 'division par zero neutralisee');
  assert.equal(e('val inconnu'), 0);
});

test('rect : chemin, zone de texte, sites de connexion', () => {
  const g = buildGeometry(preset('rect'), 100, 60);
  assert.equal(g.paths.length, 1);
  assert.equal(g.paths[0]?.d, 'M 0 0 L 100 0 L 100 60 L 0 60 Z');
  assert.deepEqual(g.textRect, { x: 0, y: 0, width: 100, height: 60 });
  assert.ok(g.connectionSites.some((c) => c.x === 100 && c.y === 30 && c.angle === 0));
  assert.ok(g.connectionSites.some((c) => c.x === 50 && c.y === 0 && c.angle === 270));
});

test('ellipse : fermee, inscrite dans la boite', () => {
  const g = buildGeometry(preset('ellipse'), 100, 60);
  const d = g.paths[0]?.d ?? '';
  assert.ok(d.startsWith('M 0 30') && d.endsWith('Z'));
  const pts = coords(d);
  const last = pts[pts.length - 1] ?? [NaN, NaN];
  near(last[0], 0);
  near(last[1], 30);
  for (const [x, y] of pts) assert.ok(x >= -0.01 && x <= 100.01 && y >= -0.01 && y <= 60.01);
  assert.ok(pts.some(([x, y]) => Math.abs(x - 50) < 0.01 && Math.abs(y) < 0.01), 'passe par le haut');
  assert.ok(pts.some(([x, y]) => Math.abs(x - 100) < 0.01 && Math.abs(y - 30) < 0.01), 'passe par la droite');
});

test('roundRect : rayon des coins selon adj', () => {
  const def = buildGeometry(preset('roundRect'), 100, 60);
  assert.ok(def.paths[0]?.d.startsWith('M 0 10 C'), def.paths[0]?.d);
  near(def.handles[0]?.x ?? NaN, 10);
  const big = buildGeometry(preset('roundRect', { adj: 50000 }), 100, 60);
  assert.ok(big.paths[0]?.d.startsWith('M 0 30 C'));
  const pts = coords(big.paths[0]?.d ?? '');
  assert.ok(pts.some(([x, y]) => Math.abs(x - 30) < 0.01 && Math.abs(y) < 0.01));
  const over = buildGeometry(preset('roundRect', { adj: 900000 }), 100, 60);
  assert.equal(over.paths[0]?.d, big.paths[0]?.d, 'adj borne par pin');
});

test('star5 : 10 sommets dans la boite', () => {
  const g = buildGeometry(preset('star5'), 100, 60);
  const d = g.paths[0]?.d ?? '';
  assert.equal((d.match(/[ML]/g) ?? []).length, 10);
  const pts = coords(d);
  assert.equal(pts.length, 10);
  for (const [x, y] of pts) assert.ok(x >= -0.01 && x <= 100.01 && y >= -0.01 && y <= 60.01, `${x},${y}`);
});

test('rightArrow : poignees et adjustFromPoint borne', () => {
  const geo = preset('rightArrow');
  const g = buildGeometry(geo, 100, 60);
  assert.deepEqual(g.handles, [{ x: 0, y: 15 }, { x: 70, y: 0 }]);
  assert.deepEqual(adjustFromPoint(geo, 100, 60, 1, 55, 0), { adj1: 50000, adj2: 75000 });
  assert.deepEqual(adjustFromPoint(geo, 100, 60, 1, 500, 0), { adj1: 50000, adj2: 0 });
  assert.deepEqual(adjustFromPoint(geo, 100, 60, 1, -500, 0), { adj1: 50000, adj2: 166667 });
  assert.deepEqual(adjustFromPoint(geo, 100, 60, 0, 0, 24), { adj1: 20000, adj2: 50000 });
  assert.deepEqual(adjustFromPoint(geo, 100, 60, 0, 0, -50), { adj1: 100000, adj2: 50000 });
  assert.deepEqual(adjustFromPoint(geo, 100, 60, 9, 0, 0), { adj1: 50000, adj2: 50000 }, 'poignee inexistante');
  const moved = buildGeometry(preset('rightArrow', adjustFromPoint(geo, 100, 60, 1, 55, 0)), 100, 60);
  near(moved.handles[1]?.x ?? NaN, 55);
});

test('poignee polaire (blockArc) et poignee de legende sans bornes', () => {
  const geo = preset('blockArc');
  const g = buildGeometry(geo, 100, 100);
  const h = g.handles[0];
  assert.ok(h);
  const adj = adjustFromPoint(geo, 100, 100, 0, h.x, h.y);
  near(adj.adj1 ?? NaN, 10800000, 2);
  const callout = preset('wedgeRectCallout');
  const c = adjustFromPoint(callout, 100, 60, 0, 80, 90);
  const back = buildGeometry(preset('wedgeRectCallout', c), 100, 60).handles[0];
  near(back?.x ?? NaN, 80, 0.01);
  near(back?.y ?? NaN, 90, 0.01);
});

test('arcTo : ellipse fermee par deux arcs, chemin mis a l echelle', () => {
  const geo: Geometry = {
    type: 'custom',
    paths: [{
      width: 200, height: 100,
      commands: [
        { cmd: 'moveTo', pt: { x: 0, y: 50 } },
        { cmd: 'arcTo', wR: 100, hR: 50, stAng: 10800000, swAng: 10800000 },
        { cmd: 'arcTo', wR: 100, hR: 50, stAng: 0, swAng: 10800000 },
        { cmd: 'close' },
      ],
    }],
  };
  const d = buildGeometry(geo, 100, 60).paths[0]?.d ?? '';
  assert.equal((d.match(/C/g) ?? []).length, 4);
  const pts = coords(d);
  const last = pts[pts.length - 1] ?? [NaN, NaN];
  near(last[0], 0);
  near(last[1], 30);
  assert.ok(pts.some(([x, y]) => Math.abs(x - 50) < 0.01 && Math.abs(y) < 0.01));
  assert.ok(pts.some(([x, y]) => Math.abs(x - 100) < 0.01 && Math.abs(y - 30) < 0.01));
});

test('arcTo : angles visuels convertis en angles parametriques (pie)', () => {
  const g = buildGeometry(preset('pie', { adj1: 0, adj2: 2700000 }), 200, 100);
  const pts = coords(g.paths[0]?.d ?? '');
  const last = pts[pts.length - 2] ?? [NaN, NaN];
  near(pts[pts.length - 1]?.[0] ?? NaN, 100);
  // Fin de l'arc (avant le retour au centre) a 45 degres visuels : sur le rayon y = x (repere centre), sur l'ellipse.
  const dx = last[0] - 100;
  const dy = last[1] - 50;
  near(dx, dy, 0.01);
  near((dx / 100) ** 2 + (dy / 50) ** 2, 1, 1e-4);
});

test('geometrie personnalisee avec guides (valeurs EMU du fichier)', () => {
  const geo: Geometry = {
    type: 'custom',
    adjust: [{ name: 'adj', formula: 'val 25000' }],
    guides: [{ name: 'g1', formula: '*/ w adj 100000' }, { name: 'g2', formula: '+- b 0 g1' }],
    paths: [{ commands: [{ cmd: 'moveTo', pt: { x: 'g1', y: 0 } }, { cmd: 'lineTo', pt: { x: 'r', y: 'b' } }, { cmd: 'lineTo', pt: { x: 0, y: 'g2' } }, { cmd: 'close' }] }],
    textRect: { l: 'g1', t: 't', r: 'r', b: 'b' },
    connectionSites: [{ angle: 'cd4', pos: { x: 'hc', y: 'b' } }],
  };
  const g = buildGeometry(geo, 100, 60);
  assert.equal(g.paths[0]?.d, 'M 25 0 L 100 60 L 0 35 Z');
  assert.deepEqual(g.textRect, { x: 25, y: 0, width: 75, height: 60 });
  assert.deepEqual(g.connectionSites, [{ x: 50, y: 60, angle: 90 }]);
  assert.deepEqual(adjustFromPoint(geo, 100, 60, 0, 0, 0), { adj: 25000 });
});

test('mise a l echelle d un chemin 21600 x 21600', () => {
  const geo: Geometry = {
    type: 'custom',
    paths: [{ width: 21600, height: 21600, commands: [{ cmd: 'moveTo', pt: { x: 0, y: 0 } }, { cmd: 'lineTo', pt: { x: 21600, y: 10800 } }, { cmd: 'quadBezTo', pts: [{ x: 21600, y: 21600 }, { x: 0, y: 21600 }] }] }],
  };
  assert.equal(buildGeometry(geo, 100, 60).paths[0]?.d, 'M 0 0 L 100 30 Q 100 60 0 60');
  // flowChartDocument : chemin 21600 x 21600 (17322 / 21600 * 60 = 48.117).
  assert.ok(buildGeometry(preset('flowChartDocument'), 100, 60).paths[0]?.d.startsWith('M 0 0 L 100 0 L 100 48.117 C'));
});

test('chemins multiples avec remplissage assombri (can, cube, foldedCorner)', () => {
  assert.deepEqual(buildGeometry(preset('can'), 100, 60).paths.map((p) => [p.fill, p.stroke]), [['norm', false], ['lighten', false], ['none', true]]);
  assert.equal(buildGeometry(preset('cube'), 100, 60).paths.map((p) => p.fill).join(), 'norm,darkenLess,lightenLess,none');
  assert.ok(buildGeometry(preset('foldedCorner'), 100, 60).paths.some((p) => p.fill === 'darkenLess'));
});

test('catalogue : formes connues, inconnue = rectangle, formes lineaires', () => {
  assert.ok(PRESET_NAMES.length >= 150);
  for (const name of ['rect', 'star32', 'gear9', 'cloud', 'actionButtonHome', 'flowChartMagneticDrum', 'curvedConnector5']) assert.ok(isPresetKnown(name), name);
  assert.equal(isPresetKnown('toString'), false);
  assert.equal(isPresetKnown('inexistante'), false);
  assert.equal(buildGeometry(preset('inexistante'), 100, 60).paths[0]?.d, 'M 0 0 L 100 0 L 100 60 L 0 60 Z');
  for (const name of LINE_PRESETS) assert.ok(isPresetKnown(name), name);
});

test('toutes les formes connues : aucun NaN (100x60 et 0x10)', () => {
  for (const name of PRESET_NAMES) {
    for (const [w, h] of [[100, 60], [0, 10]] as const) {
      const g = buildGeometry(preset(name), w, h);
      assert.ok(g.paths.length > 0, name);
      for (const p of g.paths) {
        assert.ok(p.d.length > 0 && !/NaN|Infinity|undefined/.test(p.d), `${name} ${w}x${h} : ${p.d}`);
      }
      const nums = [g.textRect.x, g.textRect.y, g.textRect.width, g.textRect.height, ...g.handles.flatMap((p) => [p.x, p.y]), ...g.connectionSites.flatMap((c) => [c.x, c.y, c.angle])];
      assert.ok(nums.every(Number.isFinite), name);
    }
  }
});

test('toutes les poignees : adjustFromPoint renvoie des valeurs finies', () => {
  for (const name of PRESET_NAMES) {
    const { handles } = buildGeometry(preset(name), 100, 60);
    handles.forEach((_, i) => {
      assert.ok(Object.values(adjustFromPoint(preset(name), 100, 60, i, 50, 30)).every(Number.isFinite), `${name} #${i}`);
    });
  }
});
