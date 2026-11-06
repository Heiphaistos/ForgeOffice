// Articles (zones de texte chainees) dans la publication : objets habilles, recalcul de la repartition,
// liaison et suppression de liaison, zones debordantes.
import type { AutoShape, Deck, Paragraph, Shape, Slide } from '@forgeoffice/pptx';
import { boundsOfXfrm, DEFAULT_INSETS } from './geom.ts';
import { DEFAULT_FONT_SIZE, distribute, fitParagraphs, mergeStory, partStarts, type Frame, type MeasureFn, type Obstacle, type StoryPos } from './flow.ts';
import { shapeOutline } from './outline.ts';
import { shapeKey, type BoxRef, type Chain, type PubSettings, type WrapMode } from './model.ts';

/** Habillage effectif : reglage de la forme, sinon « carre » pour les images, aucun pour le reste. */
export function wrapOf(pub: PubSettings, page: number, shape: Shape): WrapMode {
  return pub.wraps[shapeKey(page, shape.id)] ?? (shape.kind === 'picture' ? 'square' : 'none');
}

export const isTextFrame = (s: Shape): s is AutoShape & { text: NonNullable<AutoShape['text']> } => s.kind === 'shape' && !!s.text && s.geometry.type === 'preset' && s.geometry.preset !== 'line';

/** Objets places au-dessus de la zone (ordre de superposition) qui la chevauchent et l'habillent. */
export function obstaclesFor(slide: Slide, shape: AutoShape, pub: PubSettings): Obstacle[] {
  if (!shape.xfrm || !shape.text) return [];
  const box = boundsOfXfrm(shape.xfrm);
  const insets = { ...DEFAULT_INSETS, ...(shape.text.props.insets ?? {}) };
  const index = slide.shapes.indexOf(shape);
  const out: Obstacle[] = [];
  slide.shapes.forEach((other, i) => {
    if (i <= index || !other.xfrm || other.hidden) return;
    const mode = wrapOf(pub, slide.id, other);
    if (mode === 'none') return;
    const b = boundsOfXfrm(other.xfrm);
    if (b.x >= box.x + box.width || b.x + b.width <= box.x || b.y >= box.y + box.height || b.y + b.height <= box.y) return;
    const ob: Obstacle = { x: b.x - box.x - insets.left, y: b.y - box.y - insets.top, width: b.width, height: b.height, mode };
    if (mode === 'tight') {
      const polygons = shapeOutline(other, box.x + insets.left, box.y + insets.top);
      if (polygons) ob.polygons = polygons;
    }
    out.push(ob);
  });
  return out;
}

export function frameOf(slide: Slide, shape: AutoShape, pub: PubSettings): Frame {
  const x = shape.xfrm ?? { x: 0, y: 0, width: 100, height: 100 };
  const props = shape.text?.props ?? {};
  return {
    width: x.width,
    height: x.height,
    insets: { ...DEFAULT_INSETS, ...(props.insets ?? {}) },
    columns: props.columns ?? 1,
    gap: props.columnSpacing ?? 0,
    obstacles: obstaclesFor(slide, shape, pub),
  };
}

interface Located {
  slide: Slide;
  shape: AutoShape & { text: NonNullable<AutoShape['text']> };
}

function findBox(deck: Deck, ref: BoxRef): Located | null {
  const slide = deck.slides.find((s) => s.id === ref.page);
  const shape = slide?.shapes.find((s) => s.id === ref.shape);
  return slide && shape && isTextFrame(shape) ? { slide, shape } : null;
}

export const chainOf = (pub: PubSettings, ref: BoxRef): Chain | undefined => pub.chains.find((c) => c.boxes.some((b) => b.page === ref.page && b.shape === ref.shape));

export interface ReflowResult {
  deck: Deck;
  pub: PubSettings;
  /** Zones dont le texte deborde (cles `page:forme`). */
  overflow: Set<string>;
}

/** Recalcule la repartition de chaque article ; les pages modifiees sont copiees, le reste partage. */
export function reflow(deck: Deck, pub: PubSettings, measure: MeasureFn): ReflowResult {
  const overflow = new Set<string>();
  const copies = new Map<number, Slide>();
  const slideOf = (id: number): Slide | undefined => {
    const hit = copies.get(id);
    if (hit) return hit;
    const index = deck.slides.findIndex((s) => s.id === id);
    const source = deck.slides[index];
    if (!source) return undefined;
    const copy = { ...source, shapes: [...source.shapes] };
    copies.set(id, copy);
    return copy;
  };
  let chainsChanged = false;
  const chains = pub.chains.map((chain) => {
    const located = chain.boxes.map((b) => findBox(deck, b));
    if (located.some((l) => !l)) {
      chainsChanged = true;
      const kept = chain.boxes.filter((_, i) => located[i]);
      return { ...chain, boxes: kept, joins: kept.slice(1).map(() => false), empty: kept.map(() => false) };
    }
    const boxes = located as Located[];
    const parts = boxes.map((b) => b.shape.text.paragraphs);
    const story = mergeStory(parts, chain.joins, chain.empty);
    const frames = boxes.map((b) => frameOf(b.slide, b.shape, pub));
    const dist = distribute(story, frames, measure, DEFAULT_FONT_SIZE);
    if (dist.overflow) {
      const last = chain.boxes[chain.boxes.length - 1];
      if (last) overflow.add(shapeKey(last.page, last.shape));
    }
    boxes.forEach((b, i) => {
      const next = dist.parts[i] as Paragraph[];
      if (JSON.stringify(next) === JSON.stringify(b.shape.text.paragraphs)) return;
      const slide = slideOf(b.slide.id);
      if (!slide) return;
      const at = slide.shapes.findIndex((s) => s.id === b.shape.id);
      slide.shapes[at] = { ...b.shape, text: { ...b.shape.text, paragraphs: next } };
    });
    if (JSON.stringify(dist.joins) !== JSON.stringify(chain.joins) || JSON.stringify(dist.empty) !== JSON.stringify(chain.empty)) {
      chainsChanged = true;
      return { ...chain, joins: dist.joins, empty: dist.empty };
    }
    return chain;
  });
  // Zones seules de taille fixe : debordement signale.
  const chained = new Set(pub.chains.flatMap((c) => c.boxes.map((b) => shapeKey(b.page, b.shape))));
  const nextDeck = copies.size ? { ...deck, slides: deck.slides.map((s) => copies.get(s.id) ?? s) } : deck;
  for (const slide of nextDeck.slides) {
    for (const s of slide.shapes) {
      if (!isTextFrame(s) || chained.has(shapeKey(slide.id, s.id))) continue;
      const fit = s.text.props.autofit?.type;
      if (fit === 'shape' || fit === 'normal' || s.text.props.wrap === false) continue;
      if (!fitParagraphs(s.text.paragraphs, frameOf(slide, s, pub), measure).fits) overflow.add(shapeKey(slide.id, s.id));
    }
  }
  const nextPub = chainsChanged ? { ...pub, chains: chains.filter((c) => c.boxes.length >= 2) } : pub;
  return { deck: nextDeck, pub: nextPub, overflow };
}

/** Lie la zone `from` a la zone vide `to` : `to` devient la suite de l'article de `from`. */
export function linkBoxes(deck: Deck, pub: PubSettings, from: BoxRef, to: BoxRef): PubSettings | string {
  const target = findBox(deck, to);
  if (!findBox(deck, from) || !target) return 'notText';
  if (from.page === to.page && from.shape === to.shape) return 'same';
  if (chainOf(pub, to)) return 'alreadyLinked';
  const hasText = target.shape.text.paragraphs.some((p) => p.runs.some((r) => r.type !== 'text' || r.text !== ''));
  if (hasText) return 'notEmpty';
  const chain = chainOf(pub, from);
  if (chain) {
    const last = chain.boxes[chain.boxes.length - 1];
    if (!last || last.page !== from.page || last.shape !== from.shape) return 'notLast';
    return { ...pub, chains: pub.chains.map((c) => (c === chain ? { ...c, boxes: [...c.boxes, to], joins: [...c.joins, false], empty: [...c.empty, true] } : c)) };
  }
  let n = pub.chains.length + 1;
  while (pub.chains.some((c) => c.id === `article${n}`)) n++;
  return { ...pub, chains: [...pub.chains, { id: `article${n}`, boxes: [from, to], joins: [false], empty: [false, true] }] };
}

/** Rompt la liaison apres `ref` : tout le texte des zones suivantes revient dans `ref` (en debordement). */
export function unlinkAfter(deck: Deck, pub: PubSettings, ref: BoxRef): { deck: Deck; pub: PubSettings } {
  const chain = chainOf(pub, ref);
  if (!chain) return { deck, pub };
  const at = chain.boxes.findIndex((b) => b.page === ref.page && b.shape === ref.shape);
  if (at < 0 || at === chain.boxes.length - 1) return { deck, pub };
  const located = chain.boxes.map((b) => findBox(deck, b));
  const tail = located.slice(at);
  const story = mergeStory(tail.map((l) => l?.shape.text.paragraphs ?? []), chain.joins.slice(at), chain.empty.slice(at));
  const slides = deck.slides.map((s) => {
    const touched = tail.some((l) => l?.slide.id === s.id);
    if (!touched) return s;
    return {
      ...s,
      shapes: s.shapes.map((shape) => {
        const k = tail.findIndex((l) => l?.slide.id === s.id && l.shape.id === shape.id);
        if (k < 0 || shape.kind !== 'shape' || !shape.text) return shape;
        const paragraphs = k === 0 ? story : [{ props: {}, runs: [], endProps: story[0]?.endProps ?? {} }];
        return { ...shape, text: { ...shape.text, paragraphs } };
      }),
    };
  });
  const kept = { ...chain, boxes: chain.boxes.slice(0, at + 1), joins: chain.joins.slice(0, at), empty: chain.empty.slice(0, at + 1) };
  const chains = pub.chains.map((c) => (c === chain ? kept : c)).filter((c) => c.boxes.length >= 2);
  return { deck: { ...deck, slides }, pub: { ...pub, chains } };
}

/** Debut de chaque zone de l'article dans le texte complet (pour suivre le curseur d'une zone a l'autre). */
export function chainStarts(deck: Deck, chain: Chain): Array<StoryPos | null> {
  const parts = chain.boxes.map((b) => findBox(deck, b)?.shape.text.paragraphs ?? []);
  return partStarts(parts, chain.joins, chain.empty);
}
