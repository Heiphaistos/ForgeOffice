// Concepteur : propositions de mise en page pour la diapositive courante (titre, texte, images), sans DOM.
import type { AutoShape, Deck, Fill, Shape, Slide, Transform } from '@forgeoffice/pptx';
import { nextShapeId } from '@forgeoffice/pptx';

export interface DesignIdea {
  id: string;
  slide: Slide;
}

const DESIGN_PREFIX = 'Concepteur';

const isTitle = (s: Shape): boolean => s.placeholder?.type === 'title' || s.placeholder?.type === 'ctrTitle';
const isBody = (s: Shape): boolean => s.kind === 'shape' && !isTitle(s) && (!!s.placeholder || !!s.textBox) && !!s.text?.paragraphs.some((p) => p.runs.length);
const isPicture = (s: Shape): boolean => s.kind === 'picture';
/** Contenus visuels places comme des images (tableaux, graphiques, medias, groupes). */
const isVisual = (s: Shape): boolean => isPicture(s) || s.kind === 'table' || s.kind === 'chart' || s.kind === 'media' || s.kind === 'group' || s.kind === 'smartart';

function band(id: number, name: string, xfrm: Transform, fill: Fill, preset = 'rect'): AutoShape {
  return { kind: 'shape', id, name: `${DESIGN_PREFIX} ${name}`, xfrm, geometry: { type: 'preset', preset }, fill, line: { fill: { type: 'none' } } };
}

const scheme = (value: 'accent1' | 'accent2' | 'dk2' | 'tx1', alpha?: number): Fill => ({ type: 'solid', color: alpha ? { type: 'scheme', value, mods: [{ name: 'alpha', val: alpha }] } : { type: 'scheme', value } });

/** Change la couleur du texte d'une forme (titre clair sur fond fonce). */
function recolor(shape: Shape, value: 'bg1' | 'tx1'): void {
  if (shape.kind !== 'shape' || !shape.text) return;
  for (const p of shape.text.paragraphs) {
    for (const r of p.runs) r.props = { ...r.props, color: { type: 'scheme', value } };
    p.endProps = { ...(p.endProps ?? {}), color: { type: 'scheme', value } };
  }
}

/**
 * Propositions de mise en page : image a gauche / a droite / en fond, bandeau de titre, colonne de titre.
 * `effective` donne la position effective des espaces reserves.
 */
export function designIdeas(deck: Deck, slide: Slide, effective: (shape: Shape) => Transform | undefined): DesignIdea[] {
  const { width: w, height: h } = deck.size;
  const m = Math.round(w * 0.05);
  const clean = slide.shapes.filter((s) => !s.name.startsWith(DESIGN_PREFIX));
  const title = clean.find(isTitle);
  const bodies = clean.filter(isBody);
  const realPictures = clean.filter(isPicture);
  const pictures = clean.filter(isVisual);
  const ideas: DesignIdea[] = [];
  const make = (id: string, build: (shapes: Shape[], nextId: () => number) => void): void => {
    const copy: Slide = structuredClone({ ...slide, shapes: clean });
    let n = nextShapeId(copy.shapes);
    const decor: Shape[] = [];
    const shapes = copy.shapes;
    build(shapes, () => n++);
    for (const s of shapes) if (s.name.startsWith(DESIGN_PREFIX)) decor.push(s);
    copy.shapes = [...decor, ...shapes.filter((s) => !s.name.startsWith(DESIGN_PREFIX))];
    ideas.push({ id, slide: copy });
  };
  const place = (shapes: Shape[], target: Shape | undefined, xfrm: Transform): void => {
    const s = target && shapes.find((x) => x.id === target.id);
    if (s) s.xfrm = { ...(s.xfrm ?? effective(s) ?? xfrm), ...xfrm, rotation: undefined };
    if (s?.xfrm && s.xfrm.rotation === undefined) delete s.xfrm.rotation;
  };
  const stackBodies = (shapes: Shape[], x: number, y: number, width: number, height: number): void => {
    const each = bodies.length ? height / bodies.length : height;
    bodies.forEach((b, i) => place(shapes, b, { x, y: y + i * each, width, height: each - (i < bodies.length - 1 ? m / 3 : 0) }));
  };
  const tilePictures = (shapes: Shape[], x: number, y: number, width: number, height: number): void => {
    const cols = pictures.length > 2 ? 2 : 1;
    const rows = Math.ceil(pictures.length / cols);
    pictures.forEach((pic, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      place(shapes, pic, { x: x + (c * width) / cols, y: y + (r * height) / rows, width: width / cols, height: height / rows });
    });
  };

  if (realPictures.length) {
    make('pic-right', (shapes) => {
      tilePictures(shapes, w / 2, 0, w / 2, h);
      place(shapes, title, { x: m, y: m, width: w / 2 - 2 * m, height: h * 0.25 });
      stackBodies(shapes, m, m + h * 0.28, w / 2 - 2 * m, h - h * 0.28 - 2 * m);
    });
    make('pic-left', (shapes, id) => {
      tilePictures(shapes, 0, 0, w * 0.45, h);
      shapes.push(band(id(), 'filet', { x: w * 0.45, y: 0, width: w * 0.012, height: h }, scheme('accent1')));
      place(shapes, title, { x: w * 0.45 + m, y: m, width: w * 0.55 - 2 * m, height: h * 0.25 });
      stackBodies(shapes, w * 0.45 + m, m + h * 0.28, w * 0.55 - 2 * m, h - h * 0.28 - 2 * m);
    });
    make('pic-full', (shapes, id) => {
      tilePictures(shapes, 0, 0, w, h);
      shapes.push(band(id(), 'voile', { x: 0, y: h * 0.62, width: w, height: h * 0.38 }, scheme('tx1', 60000)));
      const t = shapes.find((s) => s.id === title?.id);
      if (t) recolor(t, 'bg1');
      for (const b of bodies) {
        const s = shapes.find((x) => x.id === b.id);
        if (s) recolor(s, 'bg1');
      }
      place(shapes, title, { x: m, y: h * 0.64, width: w - 2 * m, height: h * 0.16 });
      stackBodies(shapes, m, h * 0.8, w - 2 * m, h * 0.17);
      // Le voile passe sous le texte mais au-dessus des images.
      const veil = shapes.pop();
      if (veil) shapes.splice(pictures.length, 0, veil);
    });
  }
  make('band', (shapes, id) => {
    shapes.push(band(id(), 'bandeau', { x: 0, y: 0, width: w, height: h * 0.24 }, scheme('accent1')));
    const t = shapes.find((s) => s.id === title?.id);
    if (t) recolor(t, 'bg1');
    place(shapes, title, { x: m, y: h * 0.03, width: w - 2 * m, height: h * 0.18 });
    if (pictures.length) {
      stackBodies(shapes, m, h * 0.3, w * 0.55 - m, h * 0.65);
      tilePictures(shapes, w * 0.6, h * 0.3, w * 0.4 - m, h * 0.62);
    } else stackBodies(shapes, m, h * 0.3, w - 2 * m, h * 0.65);
  });
  make('column', (shapes, id) => {
    shapes.push(band(id(), 'colonne', { x: 0, y: 0, width: w * 0.36, height: h }, scheme('dk2')));
    const t = shapes.find((s) => s.id === title?.id);
    if (t) recolor(t, 'bg1');
    place(shapes, title, { x: m, y: h * 0.3, width: w * 0.36 - 2 * m, height: h * 0.4 });
    if (pictures.length) tilePictures(shapes, w * 0.36 + m, m, w * 0.64 - 2 * m, h * 0.45);
    stackBodies(shapes, w * 0.36 + m, pictures.length ? h * 0.5 + m / 2 : m * 1.5, w * 0.64 - 2 * m, pictures.length ? h * 0.5 - 1.5 * m : h - 3 * m);
  });
  make('accent', (shapes, id) => {
    shapes.push(band(id(), 'trait', { x: m, y: h * 0.3, width: w * 0.12, height: 4 }, scheme('accent2')));
    place(shapes, title, { x: m, y: m, width: w - 2 * m, height: h * 0.3 - m - 6 });
    if (pictures.length) {
      stackBodies(shapes, m, h * 0.36, w * 0.5 - m, h * 0.58);
      tilePictures(shapes, w * 0.55, h * 0.36, w * 0.45 - m, h * 0.58);
    } else stackBodies(shapes, m, h * 0.36, w - 2 * m, h * 0.58);
  });
  return ideas;
}
