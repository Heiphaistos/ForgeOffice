// Briques de construction des pages (sans DOM) : zones de texte, formes, traits, couleurs du theme.
import { nextShapeId, type AutoShape, type Color, type ColorMod, type Fill, type Line, type Paragraph, type ParagraphProps, type RunProps, type SchemeColorName, type Shape, type TextBody, type Transform } from '@forgeoffice/pptx';

export const mm = (v: number): number => (v * 72) / 25.4;

/** Les formes d'une page maitre ont des identifiants a partir de 10000 (pas de collision avec les pages). */
export const MASTER_SHAPE_BASE = 10000;

export const sc = (value: SchemeColorName, mods?: ColorMod[]): Color => (mods ? { type: 'scheme', value, mods } : { type: 'scheme', value });
export const hex = (value: string): Color => ({ type: 'rgb', value: value.replace('#', '').toUpperCase() });
export const solid = (color: Color): Fill => ({ type: 'solid', color });
export const NO_FILL: Fill = { type: 'none' };
export const lum = (mod: number, off = 0): ColorMod[] => (off ? [{ name: 'lumMod', val: mod }, { name: 'lumOff', val: off }] : [{ name: 'lumMod', val: mod }]);

/** Police de titre / de corps du theme (suivent le modele de polices). */
export const MAJOR = '+mj-lt';
export const MINOR = '+mn-lt';

export type Box4 = [number, number, number, number];

const xfrm = ([x, y, width, height]: Box4): Transform => ({ x, y, width, height });

export function para(text: string, run: RunProps = {}, props: ParagraphProps = {}): Paragraph {
  const r: RunProps = { lang: 'fr-FR', ...run };
  return { props, runs: text ? [{ type: 'text', text, props: r }] : [], endProps: r };
}

export interface TextOptions {
  anchor?: 't' | 'ctr' | 'b';
  insets?: { left: number; top: number; right: number; bottom: number };
  columns?: number;
  gap?: number;
  /** Ajuster la zone au texte (defaut : taille fixe, comme Publisher). */
  grow?: boolean;
  fill?: Fill;
  line?: Line;
  name?: string;
  preset?: string;
  minId?: number;
}

export function textBody(paragraphs: Paragraph[], o: TextOptions = {}): TextBody {
  return {
    props: {
      wrap: true,
      anchor: o.anchor ?? 't',
      insets: o.insets ?? { left: 7.2, top: 3.6, right: 7.2, bottom: 3.6 },
      autofit: o.grow ? { type: 'shape' } : { type: 'none' },
      ...(o.columns && o.columns > 1 ? { columns: o.columns, columnSpacing: o.gap ?? 14.4 } : {}),
    },
    paragraphs: paragraphs.length ? paragraphs : [para('')],
  };
}

const newId = (shapes: Shape[], minId = 2): number => Math.max(minId, nextShapeId(shapes));

/** Zone de texte (sans remplissage ni contour par defaut). */
export function addText(shapes: Shape[], box: Box4, content: Paragraph[] | string, run: RunProps = {}, o: TextOptions = {}): AutoShape {
  const id = newId(shapes, o.minId);
  const paragraphs = typeof content === 'string' ? content.split('\n').map((line) => para(line, run)) : content;
  const shape: AutoShape = {
    kind: 'shape',
    id,
    name: o.name ?? `Zone de texte ${id - 1}`,
    xfrm: xfrm(box),
    textBox: true,
    geometry: { type: 'preset', preset: o.preset ?? 'rect' },
    fill: o.fill ?? NO_FILL,
    line: o.line ?? { fill: NO_FILL },
    text: textBody(paragraphs, o),
  };
  shapes.push(shape);
  return shape;
}

/** Forme pleine (rectangle par defaut) sans texte. */
export function addShape(shapes: Shape[], box: Box4, fill: Fill, o: { preset?: string; line?: Line; name?: string; adjust?: Record<string, number>; rotation?: number; minId?: number } = {}): AutoShape {
  const id = newId(shapes, o.minId);
  const shape: AutoShape = {
    kind: 'shape',
    id,
    name: o.name ?? `Forme ${id - 1}`,
    xfrm: { ...xfrm(box), ...(o.rotation ? { rotation: o.rotation } : {}) },
    geometry: { type: 'preset', preset: o.preset ?? 'rect', ...(o.adjust ? { adjust: o.adjust } : {}) },
    fill,
    line: o.line ?? { fill: NO_FILL },
  };
  shapes.push(shape);
  return shape;
}

/** Trait horizontal ou vertical. */
export function addLine(shapes: Shape[], x1: number, y1: number, x2: number, y2: number, color: Color, width = 1, dash?: string, minId?: number): AutoShape {
  const id = newId(shapes, minId);
  const shape: AutoShape = {
    kind: 'shape',
    id,
    name: `Connecteur droit ${id - 1}`,
    xfrm: { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1), flipH: x2 < x1, flipV: y2 < y1 },
    geometry: { type: 'preset', preset: 'line' },
    line: { fill: solid(color), width, ...(dash ? { dash } : {}) },
  };
  shapes.push(shape);
  return shape;
}

/** Champ « numero de page » (rempli par le rendu et par PowerPoint). */
export function pageNumberParagraph(run: RunProps, props: ParagraphProps = {}): Paragraph {
  const r: RunProps = { lang: 'fr-FR', ...run };
  return { props, runs: [{ type: 'field', fieldType: 'slidenum', id: '{B6F15528-21DE-4FAA-801E-634DDDAF4B2B}', text: '‹N°›', props: r }], endProps: r };
}
