// Repartition du texte (sans DOM) : coupure des lignes, capacite d'une zone (colonnes, habillage autour des objets),
// distribution d'un article dans des zones chainees, correspondance des positions article <-> zone.
// La mesure des mots est injectee : canvas measureText dans le navigateur, largeur fixe dans les tests.
import type { Paragraph, Run, RunProps } from '@forgeoffice/pptx';
import { splitRunsAt } from './geom.ts';

/** Largeur (pt) d'un texte dans la mise en forme donnee. */
export type MeasureFn = (text: string, props: RunProps) => number;

export const DEFAULT_FONT_SIZE = 18;
/** Hauteur de ligne CSS du moteur de rendu (TextBlock) : 1,2 x la taille. */
const LINE_FACTOR = 1.2;
/** Distance entre le texte et un objet habille. */
export const WRAP_GAP = 7.2;

export interface Insets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Objet a contourner, en coordonnees de la zone de texte (origine = coin haut gauche apres les marges). */
export interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  mode: 'square' | 'tight' | 'topBottom';
  ellipse?: boolean;
}

export interface Frame {
  width: number;
  height: number;
  insets: Insets;
  columns: number;
  gap: number;
  obstacles: readonly Obstacle[];
}

/** Flottant equivalent a un obstacle dans la premiere colonne (meme regle pour la mesure et pour le rendu CSS). */
export interface FloatSpec {
  side: 'left' | 'right';
  /** Largeur reservee depuis le bord. */
  width: number;
  top: number;
  bottom: number;
  ellipse?: { cx: number; cy: number; rx: number; ry: number };
}

export function obstacleFloat(ob: Obstacle, columnWidth: number): FloatSpec | null {
  const top = Math.max(0, ob.y - WRAP_GAP);
  const bottom = ob.y + ob.height + WRAP_GAP;
  if (bottom <= 0 || ob.x >= columnWidth || ob.x + ob.width <= 0) return null;
  if (ob.mode === 'topBottom') return { side: 'left', width: columnWidth, top, bottom };
  const left = ob.x + ob.width / 2 < columnWidth / 2;
  const width = left ? ob.x + ob.width + WRAP_GAP : columnWidth - ob.x + WRAP_GAP;
  const spec: FloatSpec = { side: left ? 'left' : 'right', width: Math.max(0, Math.min(columnWidth, width)), top, bottom };
  if (ob.mode === 'tight' && ob.ellipse) {
    const rx = ob.width / 2 + WRAP_GAP;
    const ry = ob.height / 2 + WRAP_GAP;
    const cxPage = ob.x + ob.width / 2;
    spec.ellipse = { cx: left ? cxPage : cxPage - (columnWidth - spec.width), cy: ob.y + ob.height / 2, rx, ry };
  }
  return spec;
}

export const columnWidth = (f: Frame): number => {
  const inner = f.width - f.insets.left - f.insets.right;
  const n = Math.max(1, f.columns);
  return Math.max(1, (inner - f.gap * (n - 1)) / n);
};

interface Token {
  width: number;
  /** Decalage du debut du jeton dans le paragraphe. */
  start: number;
  length: number;
  space: boolean;
  br: boolean;
  size: number;
}

const runSize = (props: RunProps, fallback: number): number => props.size ?? fallback;

function tokenize(p: Paragraph, measure: MeasureFn, fallback: number): Token[] {
  const out: Token[] = [];
  let at = 0;
  for (const run of p.runs as Run[]) {
    const size = runSize(run.props, fallback);
    if (run.type === 'break') {
      out.push({ width: 0, start: at, length: 1, space: false, br: true, size });
      at += 1;
      continue;
    }
    if (run.type === 'field') {
      out.push({ width: measure(run.text, run.props), start: at, length: run.text.length, space: false, br: false, size });
      at += run.text.length;
      continue;
    }
    for (const piece of run.text.split(/(\s+)/)) {
      if (!piece) continue;
      out.push({ width: measure(piece, run.props), start: at, length: piece.length, space: /^\s+$/.test(piece), br: false, size });
      at += piece.length;
    }
  }
  return out;
}

function paragraphSize(p: Paragraph, fallback: number): number {
  let size = p.endProps?.size ?? p.runs[0]?.props.size ?? fallback;
  for (const r of p.runs) size = Math.max(size, runSize(r.props, fallback));
  return size;
}

function lineHeight(p: Paragraph, size: number): number {
  const ls = p.props.lineSpacing;
  if (ls?.type === 'pts') return ls.value;
  return size * LINE_FACTOR * ((ls?.value ?? 100) / 100);
}

const spacing = (s: Paragraph['props']['spaceBefore'], size: number): number => (!s ? 0 : s.type === 'pts' ? s.value : (s.value / 100) * size * LINE_FACTOR);

/** Lignes d'un paragraphe pour une suite de largeurs disponibles : decalage de debut de chaque ligne. */
export function breakLines(p: Paragraph, widthAt: (line: number) => number, measure: MeasureFn, fallback = DEFAULT_FONT_SIZE): number[] {
  const tokens = tokenize(p, measure, fallback);
  const starts = [0];
  let line = 0;
  let used = 0;
  let empty = true;
  const indent = (p.props.marginLeft ?? 0) + (p.props.marginRight ?? 0);
  const avail = (): number => widthAt(line) - indent - (line === 0 ? (p.props.indent ?? 0) : 0);
  const newLine = (start: number): void => {
    starts.push(start);
    line++;
    used = 0;
    empty = true;
  };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i] as Token;
    if (t.br) {
      newLine(t.start + 1);
      continue;
    }
    if (t.space) {
      used += t.width;
      continue;
    }
    if (!empty && used + t.width > avail() + 0.01) newLine(t.start);
    if (empty && t.width > avail() && t.length > 1) {
      // Mot plus long que la ligne : coupe par caracteres (overflow-wrap: break-word).
      const per = t.width / t.length;
      let rest = t.length;
      let start = t.start;
      while (rest > 0) {
        const fit = Math.max(1, Math.floor(Math.max(0, avail() - used) / per));
        if (fit >= rest) {
          used += rest * per;
          empty = false;
          break;
        }
        newLine(start + fit);
        start += fit;
        rest -= fit;
      }
      continue;
    }
    used += t.width;
    empty = false;
  }
  return starts;
}

export interface FitResult {
  /** Paragraphes places en entier. */
  count: number;
  /** Paragraphe suivant coupe : nombre de caracteres places (0 = rien). */
  split: number;
  /** Tout le texte tient. */
  fits: boolean;
}

/** Place les paragraphes dans une zone (colonnes successives, lignes raccourcies par les objets habilles). */
export function fitParagraphs(paragraphs: readonly Paragraph[], frame: Frame, measure: MeasureFn, fallback = DEFAULT_FONT_SIZE): FitResult {
  const height = frame.height - frame.insets.top - frame.insets.bottom;
  const cw = columnWidth(frame);
  const columns = Math.max(1, frame.columns);
  const floats = frame.obstacles.map((o) => obstacleFloat(o, cw)).filter((f): f is FloatSpec => f !== null);
  const widthAt = (col: number, top: number, h: number): number => {
    if (col > 0) return cw;
    let left = 0;
    let right = 0;
    for (const f of floats) {
      if (top + h <= f.top || top >= f.bottom) continue;
      if (f.side === 'left') left = Math.max(left, f.width);
      else right = Math.max(right, f.width);
    }
    return cw - left - right;
  };
  /** Bas de l'objet le plus haut qui touche la bande (pour descendre sous un objet trop large). */
  const nextFree = (top: number, h: number): number => {
    let best = Infinity;
    for (const f of floats) if (!(top + h <= f.top || top >= f.bottom)) best = Math.min(best, f.bottom);
    return best;
  };
  let col = 0;
  let y = 0;
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i] as Paragraph;
    const size = paragraphSize(p, fallback);
    const lh = lineHeight(p, size);
    y += spacing(p.props.spaceBefore, size);
    // Position de chaque ligne calculee a la demande : la largeur depend de la hauteur (objets habilles).
    const slots: Array<{ col: number; top: number }> = [];
    const slot = (line: number): { col: number; top: number } => {
      while (slots.length <= line) {
        const prev = slots[slots.length - 1];
        let c = prev ? prev.col : col;
        let top = prev ? prev.top + lh : y;
        for (let guard = 0; guard < 50; guard++) {
          if (top + lh > height + 0.01 && c < columns - 1) {
            c++;
            top = 0;
          }
          if (top + lh > height + 0.01 || widthAt(c, top, lh) >= Math.min(cw, size * 2)) break;
          const free = nextFree(top, lh);
          if (!Number.isFinite(free)) break;
          top = free;
        }
        slots.push({ col: c, top });
      }
      return slots[line] as { col: number; top: number };
    };
    const starts = breakLines(p, (line) => {
      const s = slot(line);
      return widthAt(s.col, s.top, lh);
    }, measure, fallback);
    for (let l = 0; l < starts.length; l++) {
      if (slot(l).top + lh > height + 0.01) return { count: i, split: l === 0 ? 0 : (starts[l] as number), fits: false };
    }
    const end = slot(starts.length - 1);
    col = end.col;
    y = end.top + lh + spacing(p.props.spaceAfter, size);
  }
  return { count: paragraphs.length, split: 0, fits: true };
}

const clone = <T>(v: T): T => structuredClone(v);

const emptyParagraph = (like?: Paragraph): Paragraph => {
  const props = like?.endProps ?? like?.runs[0]?.props ?? {};
  return { props: { ...(like?.props ?? {}) }, runs: [], endProps: { ...props } };
};

/** Coupe un paragraphe : la suite garde la mise en forme mais ni puce, ni retrait de premiere ligne, ni espace avant. */
export function splitParagraph(p: Paragraph, at: number): [Paragraph, Paragraph] {
  const copy = clone(p);
  const i = splitRunsAt(copy, at);
  const head: Paragraph = { props: copy.props, runs: copy.runs.slice(0, i), endProps: copy.endProps };
  const tailProps = { ...copy.props };
  delete tailProps.indent;
  delete tailProps.spaceBefore;
  if (tailProps.bullet && tailProps.bullet.type !== 'none') tailProps.bullet = { type: 'none' };
  const tail: Paragraph = { props: tailProps, runs: copy.runs.slice(i), endProps: copy.endProps };
  return [head, tail];
}

const isBlank = (parts: readonly Paragraph[]): boolean => parts.length <= 1 && (parts[0]?.runs ?? []).every((r) => r.type === 'text' && r.text === '');

/** Reconstitue l'article a partir du contenu des zones. */
export function mergeStory(parts: readonly Paragraph[][], joins: readonly boolean[], empty: readonly boolean[]): Paragraph[] {
  const story: Paragraph[] = [];
  parts.forEach((part, i) => {
    if (i > 0 && empty[i] && isBlank(part)) return;
    const list = clone(part);
    if (i > 0 && joins[i - 1] && story.length && list.length) {
      const last = story[story.length - 1] as Paragraph;
      const first = list.shift() as Paragraph;
      last.runs.push(...first.runs);
      if (first.endProps) last.endProps = first.endProps;
    }
    story.push(...list);
  });
  return story.length ? story : [emptyParagraph()];
}

export interface Distribution {
  parts: Paragraph[][];
  joins: boolean[];
  empty: boolean[];
  /** Le texte deborde de la derniere zone. */
  overflow: boolean;
}

/** Distribue l'article dans les zones : chaque zone se remplit, la suite passe dans la zone suivante. */
export function distribute(story: readonly Paragraph[], frames: readonly Frame[], measure: MeasureFn, fallback = DEFAULT_FONT_SIZE): Distribution {
  let rest = clone([...story]);
  const parts: Paragraph[][] = [];
  const joins: boolean[] = [];
  const empty: boolean[] = [];
  let overflow = false;
  frames.forEach((frame, i) => {
    const last = i === frames.length - 1;
    if (!rest.length) {
      parts.push([emptyParagraph(story[story.length - 1])]);
      empty.push(true);
      if (!last) joins.push(false);
      return;
    }
    const fit = fitParagraphs(rest, frame, measure, fallback);
    if (last || fit.fits) {
      parts.push(rest);
      empty.push(false);
      if (!last) joins.push(false);
      overflow = last && !fit.fits;
      rest = [];
      return;
    }
    const taken = rest.slice(0, fit.count);
    let join = false;
    let remaining = rest.slice(fit.count);
    if (fit.split > 0 && remaining[0]) {
      const [head, tail] = splitParagraph(remaining[0], fit.split);
      taken.push(head);
      remaining = [tail, ...remaining.slice(1)];
      join = true;
    }
    parts.push(taken.length ? taken : [emptyParagraph(rest[0])]);
    empty.push(!taken.length);
    joins.push(join);
    rest = remaining;
  });
  return { parts, joins, empty, overflow };
}

// ---- Positions ----

export interface StoryPos {
  p: number;
  o: number;
}

const paraLen = (p: Paragraph): number => p.runs.reduce((n, r) => n + (r.type === 'break' ? 1 : r.text.length), 0);

/** Debut de chaque zone dans l'article (null pour une zone vide). */
export function partStarts(parts: readonly Paragraph[][], joins: readonly boolean[], empty: readonly boolean[]): Array<StoryPos | null> {
  const out: Array<StoryPos | null> = [];
  let p = 0;
  let lastLen = 0;
  parts.forEach((part, i) => {
    if (i > 0 && empty[i] && isBlank(part)) {
      out.push(null);
      return;
    }
    const join = i > 0 && joins[i - 1] && p > 0;
    const start = join ? { p: p - 1, o: lastLen } : { p, o: 0 };
    out.push(start);
    const lengths = part.map(paraLen);
    p = start.p + part.length;
    lastLen = (join && part.length === 1 ? start.o : 0) + (lengths[lengths.length - 1] ?? 0);
  });
  return out;
}

export function toStory(starts: ReadonlyArray<StoryPos | null>, box: number, pos: StoryPos): StoryPos {
  const s = starts[box];
  if (!s) return { p: 0, o: 0 };
  return pos.p === 0 ? { p: s.p, o: s.o + pos.o } : { p: s.p + pos.p, o: pos.o };
}

/** Zone et position locale d'une position de l'article (la derniere zone non vide qui commence avant). */
export function fromStory(starts: ReadonlyArray<StoryPos | null>, pos: StoryPos): { box: number; pos: StoryPos } {
  let box = 0;
  starts.forEach((s, i) => {
    if (s && (s.p < pos.p || (s.p === pos.p && s.o <= pos.o))) box = i;
  });
  const s = starts[box] ?? { p: 0, o: 0 };
  return { box, pos: pos.p === s.p ? { p: 0, o: pos.o - s.o } : { p: pos.p - s.p, o: pos.o } };
}
