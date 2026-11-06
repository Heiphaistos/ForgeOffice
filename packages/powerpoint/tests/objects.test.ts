import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseXml } from '@forgeoffice/opc';
import { createBlankDeck, readPptx, writePptx, type GroupShape } from '@forgeoffice/pptx';
import { EquationError, renderEquation } from '../src/app/equation.ts';
import { buildSmartArt, itemsToText, parseItems, readSmartArt } from '../src/app/smartart.ts';
import { applyMask, backgroundMask, colorDistance, removedShare, sampleBackground, type RgbaImage } from '../src/app/bg-remove.ts';

// ---- Equations

test('equation : SVG bien forme, dimensions positives, texte present', () => {
  const eq = renderEquation('x = \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}', { size: 28 });
  const root = parseXml(eq.svg);
  assert.equal(root.name, 'svg');
  assert.ok(eq.width > 80 && eq.height > 40, `${eq.width}x${eq.height}`);
  assert.ok(eq.svg.includes('<rect'), 'barre de fraction');
  assert.ok(eq.svg.includes('<polyline'), 'radical');
  assert.ok(eq.svg.includes('±') && eq.svg.includes('font-style="italic"'));
});

test('equation : fraction plus haute qu une ligne, exposants et indices, sommes, integrales, grec, delimiteurs', () => {
  const line = renderEquation('abc', { size: 20 });
  const frac = renderEquation('\\frac{a}{b}', { size: 20 });
  assert.ok(frac.height > line.height * 1.5, 'la fraction empile deux niveaux');
  const sup = renderEquation('x^{2}', { size: 20 });
  assert.ok(sup.height > renderEquation('x', { size: 20 }).height, 'exposant releve');
  const sub = renderEquation('x_{i}', { size: 20 });
  assert.ok(sub.height > renderEquation('x', { size: 20 }).height, 'indice abaisse');
  const sum = renderEquation('\\sum_{i=1}^{n} i', { size: 20 });
  assert.ok(sum.svg.includes('∑') && sum.height > line.height * 2, 'limites au-dessus et au-dessous');
  const int = renderEquation('\\int_{0}^{1} f(x)\\,dx', { size: 20 });
  assert.ok(int.svg.includes('∫'));
  assert.ok(renderEquation('\\alpha + \\beta = \\pi', { size: 20 }).svg.includes('α'));
  const fence = renderEquation('\\left( \\frac{a}{b} \\right)^{2}', { size: 20 });
  assert.ok(fence.svg.includes('scale(1 '), 'parentheses etirees');
  for (const e of [sum, int, fence]) parseXml(e.svg);
});

test('equation : erreurs de saisie claires, contenu hostile echappe', () => {
  assert.throws(() => renderEquation('   '), EquationError);
  assert.throws(() => renderEquation('\\frac{a}'), EquationError);
  assert.throws(() => renderEquation('\\inconnue'), /Commande inconnue/);
  assert.throws(() => renderEquation('{a'), /manquante/);
  assert.throws(() => renderEquation('a}'), EquationError);
  assert.throws(() => renderEquation('^2'), EquationError);
  assert.throws(() => renderEquation('x'.repeat(3000)), /trop longue/);
  const hostile = renderEquation('<script>alert(1)</script> & "x"');
  assert.ok(!hostile.svg.includes('<script'), 'les balises de la saisie sont echappees');
  parseXml(hostile.svg);
  // La couleur n'accepte que du CSS hexadecimal (pas d'injection d'attribut).
  const color = renderEquation('x', { color: '#f00" onload="alert(1)' });
  assert.ok(!color.svg.includes('onload'));
});

test('equation : la mesure du navigateur remplace l approximation', () => {
  const narrow = renderEquation('abc', { size: 20, measure: () => 10 });
  const wide = renderEquation('abc', { size: 20, measure: () => 100 });
  assert.ok(wide.width > narrow.width + 200);
});

// ---- SmartArt

const AREA = { x: 80, y: 120, width: 800, height: 360 };

test('SmartArt : saisie, niveaux et aller-retour du texte', () => {
  const items = parseItems('Direction\n\tService A\n\t\tÉquipe 1\n  Service B\n\n');
  assert.deepEqual(items.map((i) => i.level), [0, 1, 2, 1]);
  assert.equal(itemsToText(items), 'Direction\n\tService A\n\t\tÉquipe 1\n\tService B');
  assert.equal(parseItems('x\n'.repeat(100)).length, 40);
});

test('SmartArt : liste, processus et hierarchie sont des groupes nommes « SmartArt » dans leur zone', () => {
  const sets = {
    list: 'Un\nDeux\nTrois',
    process: 'Planifier\nRéaliser\nVérifier\nAméliorer',
    hierarchy: 'Direction\n\tService A\n\t\tÉquipe 1\n\t\tÉquipe 2\n\tService B',
  } as const;
  for (const kind of ['list', 'process', 'hierarchy'] as const) {
    const items = parseItems(sets[kind]);
    const group = buildSmartArt(kind, items, AREA, 10);
    assert.equal(group.kind, 'group');
    assert.equal(group.name, 'SmartArt');
    const boxes = group.children.filter((c) => c.kind === 'shape' && c.geometry.type === 'preset' && c.geometry.preset === 'roundRect');
    assert.equal(boxes.length, items.length, kind);
    // Tout reste dans la zone, sans chevauchement de boites.
    for (const c of group.children) {
      const x = c.xfrm;
      assert.ok(x && x.x >= AREA.x - 1 && x.y >= AREA.y - 1 && x.x + x.width <= AREA.x + AREA.width + 1 && x.y + x.height <= AREA.y + AREA.height + 1, `${kind} ${c.name} dans la zone`);
    }
    const rects = boxes.map((b) => b.xfrm as NonNullable<typeof b.xfrm>);
    rects.forEach((a, i) => rects.slice(i + 1).forEach((b) => assert.ok(a.x + a.width <= b.x + 0.5 || b.x + b.width <= a.x + 0.5 || a.y + a.height <= b.y + 0.5 || b.y + b.height <= a.y + 0.5, `${kind} boites disjointes`)));
    const ids = new Set<number>();
    for (const c of [group, ...group.children]) {
      assert.ok(!ids.has(c.id), 'identifiants uniques');
      ids.add(c.id);
    }
    // Relecture pour l'edition du texte.
    const back = readSmartArt(group);
    assert.equal(back?.kind, kind);
    assert.deepEqual(back?.items.map((i) => i.text), items.map((i) => i.text));
    if (kind === 'hierarchy') assert.deepEqual(back?.items.map((i) => i.level), [0, 1, 2, 2, 1]);
  }
  assert.throws(() => buildSmartArt('list', [], AREA, 1), /au moins un/);
});

test('SmartArt : enregistre en pptx et relu, le groupe garde son nom et ses textes', async () => {
  const deck = createBlankDeck('widescreen', { titleSlide: false });
  const slide = { id: 256, layoutId: deck.masters[0]?.layouts[0]?.id ?? '', shapes: [] as GroupShape[], animations: [], comments: [] };
  slide.shapes.push(buildSmartArt('process', parseItems('A\nB\nC'), AREA, 2));
  deck.slides.push(slide);
  const back = await readPptx(await writePptx(deck));
  const group = back.slides[0]?.shapes[0];
  assert.equal(group?.kind, 'group');
  assert.equal(group?.name, 'SmartArt');
  assert.ok(group && readSmartArt(group)?.items.map((i) => i.text).join() === 'A,B,C');
});

// ---- Suppression de l'arriere-plan

/** Image 40 x 30 : fond uni (250, 250, 250) avec un disque bleu, et un trou de meme couleur que le fond dans le disque. */
function sample(): RgbaImage {
  const w = 40;
  const h = 30;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - 20, y - 15);
      const c = d < 10 ? (d < 3 ? [250, 250, 250] : [30, 110, 200]) : [250, 250, 250];
      data.set([...c, 255], (y * w + x) * 4);
    }
  }
  return { width: w, height: h, data };
}

test('arriere-plan : la couleur du fond est echantillonnee sur les bords', () => {
  const bg = sampleBackground(sample());
  assert.deepEqual([...bg], [250, 250, 250]);
  assert.ok(colorDistance([0, 0, 0], [255, 255, 255]) > 99.9);
  assert.equal(colorDistance([10, 20, 30], [10, 20, 30]), 0);
});

test('arriere-plan : masque contigu (le trou central reste), non contigu, tolerance, adoucissement', () => {
  const img = sample();
  const bg = sampleBackground(img);
  const contiguous = backgroundMask(img, bg, 8, true);
  assert.equal(contiguous[0], 1, 'coin = fond');
  assert.equal(contiguous[15 * 40 + 20], 0, 'le trou au centre du disque est conserve');
  assert.equal(contiguous[15 * 40 + 14], 0, 'le disque est conserve');
  const global = backgroundMask(img, bg, 8, false);
  assert.equal(global[15 * 40 + 20], 1, 'sans la contrainte, le trou part aussi');
  assert.ok(removedShare(global) > removedShare(contiguous));
  // Tolerance trop forte : le disque bleu part aussi ; trop faible : rien ne part (fond different de 1 niveau accepte a 0).
  assert.ok(removedShare(backgroundMask(img, bg, 80, true)) > 0.95);
  assert.equal(removedShare(backgroundMask(img, [0, 0, 0], 2, true)), 0);
  const out = applyMask(img, contiguous);
  assert.equal(out.data[3], 0, 'pixel du fond transparent');
  assert.equal(out.data[(15 * 40 + 20) * 4 + 3], 255, 'pixel conserve opaque');
  const edge = out.data[(15 * 40 + 11) * 4 + 3] as number;
  assert.ok(edge > 0 && edge < 255, `bord adouci (${edge})`);
  assert.equal(img.data[3], 255, 'l image d origine n est pas modifiee');
});
