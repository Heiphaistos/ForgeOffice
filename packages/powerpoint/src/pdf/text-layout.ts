// Mise en page du texte d'une forme pour le PDF (sans DOM) : coupure des lignes, puces, alignement, interligne, colonnes.
// Les regles suivent celles du rendu HTML (TextBlock) : interligne = 1,2 x la taille x le pourcentage, marges verticales fusionnees.
import type { Paragraph, ParagraphProps, Run, RunProps, Spacing } from '@forgeoffice/pptx';
import type { FontBook, FontStyle } from './fonts.ts';

export type Rgb = [number, number, number];

/** Style d'un segment, deja resolu (couleurs en RVB, polices en familles standard, tailles a l'echelle). */
export interface SegStyle {
  font: FontStyle;
  size: number;
  color: Rgb;
  alpha: number;
  underline: boolean;
  strike: boolean;
  highlight?: Rgb;
  /** Decalage vers le haut de la ligne de base (points). */
  rise: number;
  spacing: number;
  outline?: { color: Rgb; width: number };
  link?: string;
  /** Police CSS pour la mesure a l'ecran. */
  css: string;
}

export interface Seg {
  text: string;
  style: SegStyle;
  x: number;
  /** Largeur mesuree (a l'ecran si une mesure est fournie, sinon dans la police du PDF). */
  width: number;
  /** Largeur dans la police du PDF (sert a la mise a l'echelle horizontale). */
  natural: number;
  /** Espacement supplementaire des mots (texte justifie), en points. */
  wordSpace: number;
}

export interface PlacedLine {
  /** Ordonnee de la ligne de base depuis le haut du bloc. */
  baseline: number;
  top: number;
  height: number;
  segs: Seg[];
  bullet?: Seg;
  column: number;
}

export interface Block {
  lines: PlacedLine[];
  height: number;
}

export interface LayoutEnv {
  book: FontBook;
  /** Style resolu d'un segment (props = proprietes du segment, scale = echelle de reduction automatique). */
  style: (props: RunProps, scale: number) => SegStyle;
  /** Texte d'un champ (numero de page, date). */
  field: (run: Extract<Run, { type: 'field' }>) => string;
  /** Largeur a l'ecran d'un texte dans une police CSS (navigateur) ; absent = metriques du PDF. */
  screen?: (text: string, css: string) => number;
  /** Libelle de la puce ou du numero d'un paragraphe (null = pas de puce). */
  bullet: (p: Paragraph, number: number | null, base: SegStyle, scale: number) => { text: string; style: SegStyle } | null;
  numbers: Array<number | null>;
}

export interface LayoutOptions {
  width: number;
  /** Hauteur utile (colonnes). */
  height: number;
  scale: number;
  lineScale: number;
  wrap: boolean;
  columns: number;
  columnGap: number;
}

const ASC = 0.905;
const DESC = 0.212;
const DEFAULT_SIZE = 18;

const spacingPts = (s: Spacing | undefined, size: number): number => (!s ? 0 : s.type === 'pts' ? s.value : (s.value / 100) * size * 1.2);

interface Atom {
  text: string;
  style: SegStyle;
  width: number;
  space: boolean;
  brk?: boolean;
}

export function measure(env: LayoutEnv, text: string, style: SegStyle): number {
  const natural = env.book.width(text, style.font, style.size);
  const base = env.screen ? env.screen(text, style.css) : natural;
  return base + style.spacing * [...text].length;
}

function atomsOf(p: Paragraph, env: LayoutEnv, scale: number): Atom[] {
  const out: Atom[] = [];
  for (const run of p.runs) {
    const style = env.style(run.props, scale);
    if (run.type === 'break') {
      out.push({ text: '', style, width: 0, space: false, brk: true });
      continue;
    }
    const raw = run.type === 'field' ? env.field(run) : run.text;
    const text = run.props.caps === 'all' || run.props.caps === 'small' ? raw.toUpperCase() : raw;
    for (const piece of text.split(/(\s+)/)) {
      if (!piece) continue;
      if (/^\s+$/.test(piece)) {
        out.push({ text: piece, style, width: measure(env, piece, style), space: true });
        continue;
      }
      // Coupure possible apres un trait d'union.
      for (const word of piece.split(/(?<=[-‐–])(?=\S)/)) out.push({ text: word, style, width: measure(env, word, style), space: false });
    }
  }
  return out;
}

interface RawLine {
  atoms: Atom[];
  width: number;
  forced: boolean;
}

/** Coupe en lignes ; `first` est la largeur de la premiere ligne, `rest` celle des suivantes. */
function breakLines(atoms: Atom[], first: number, rest: number, env: LayoutEnv): RawLine[] {
  const lines: RawLine[] = [];
  let cur: Atom[] = [];
  let width = 0;
  const limit = (): number => (lines.length === 0 ? first : rest);
  const flush = (forced: boolean): void => {
    while (cur.length && cur[cur.length - 1]?.space) width -= (cur.pop() as Atom).width;
    lines.push({ atoms: cur, width: Math.max(0, width), forced });
    cur = [];
    width = 0;
  };
  const push = (text: string, style: SegStyle): void => {
    const w = measure(env, text, style);
    cur.push({ text, style, width: w, space: false });
    width += w;
  };
  for (const atom of atoms) {
    if (atom.brk) {
      flush(true);
      continue;
    }
    if (atom.space) {
      if (cur.length === 0 && lines.length > 0 && !lines[lines.length - 1]?.forced) continue; // espaces absorbes par la coupure
      cur.push(atom);
      width += atom.width;
      continue;
    }
    if (width + atom.width > limit() + 0.01 && cur.some((a) => !a.space)) flush(false);
    if (atom.width > limit() + 0.01) {
      // Mot plus large que la ligne : coupe par caracteres (overflow-wrap: break-word).
      let piece = '';
      for (const ch of atom.text) {
        if (piece && width + measure(env, piece + ch, atom.style) > limit() + 0.01) {
          push(piece, atom.style);
          flush(false);
          piece = ch;
        } else piece += ch;
      }
      if (piece) push(piece, atom.style);
      continue;
    }
    cur.push(atom);
    width += atom.width;
  }
  flush(true);
  return lines;
}

const sameStyle = (a: SegStyle, b: SegStyle): boolean =>
  a === b ||
  (a.css === b.css && a.size === b.size && a.color.join() === b.color.join() && a.alpha === b.alpha && a.underline === b.underline && a.strike === b.strike && a.rise === b.rise && a.spacing === b.spacing && a.highlight?.join() === b.highlight?.join() && a.link === b.link);

/** Segments d'une ligne : atomes consecutifs de meme style fusionnes (le texte reste selectionnable d'un bloc). */
function segmentsOf(atoms: Atom[], env: LayoutEnv, startX: number): { segs: Seg[]; spaces: number } {
  const segs: Seg[] = [];
  let spaces = 0;
  for (const atom of atoms) {
    if (atom.space) spaces += atom.text.length;
    const last = segs[segs.length - 1];
    if (last && sameStyle(last.style, atom.style)) {
      last.text += atom.text;
      last.width += atom.width;
    } else segs.push({ text: atom.text, style: atom.style, x: 0, width: atom.width, natural: 0, wordSpace: 0 });
  }
  let at = startX;
  for (const seg of segs) {
    seg.x = at;
    seg.natural = env.book.width(seg.text, seg.style.font, seg.style.size);
    at += seg.width;
  }
  return { segs, spaces };
}

const styleOfPara = (p: Paragraph, env: LayoutEnv, scale: number): SegStyle => env.style(p.runs[0]?.props ?? p.endProps ?? p.props.defaultRun ?? {}, scale);

function lineMetrics(props: ParagraphProps, atoms: Atom[], strut: SegStyle, lineScale: number): { height: number; size: number } {
  const ls = props.lineSpacing;
  const per = (size: number): number => (ls?.type === 'pts' ? ls.value : size * 1.2 * ((ls?.value ?? 100) / 100) * lineScale);
  let height = per(strut.size);
  let size = strut.size;
  for (const a of atoms) {
    const h = per(a.style.size);
    if (h > height) height = h;
    if (a.style.size > size) size = a.style.size;
  }
  return { height, size };
}

/** Met en page des paragraphes dans une largeur donnee. Les ordonnees sont relatives au haut du bloc. */
export function layoutBody(paragraphs: readonly Paragraph[], env: LayoutEnv, opts: LayoutOptions): Block {
  const cols = Math.max(1, Math.min(8, opts.columns));
  const colW = Math.max(1, (opts.width - (cols - 1) * opts.columnGap) / cols);
  const lines: PlacedLine[] = [];
  let y = 0;
  let prevAfter = 0;
  paragraphs.forEach((p, index) => {
    const props = p.props;
    const strut = env.style(p.endProps ?? p.runs[0]?.props ?? p.props.defaultRun ?? { size: DEFAULT_SIZE }, opts.scale);
    const sizeForSpacing = styleOfPara(p, env, opts.scale).size;
    const before = spacingPts(props.spaceBefore, sizeForSpacing);
    y += index === 0 ? before : Math.max(prevAfter, before);
    prevAfter = spacingPts(props.spaceAfter, sizeForSpacing);
    const left = props.marginLeft ?? 0;
    const right = props.marginRight ?? 0;
    const indent = props.indent ?? 0;
    const bulletInfo = p.runs.length ? env.bullet(p, env.numbers[index] ?? null, styleOfPara(p, env, opts.scale), opts.scale) : null;
    const bulletWidth = bulletInfo ? measure(env, bulletInfo.text, bulletInfo.style) : 0;
    const bulletBox = bulletInfo ? (indent < 0 ? Math.max(-indent, bulletWidth) : bulletWidth + 0.4 * bulletInfo.style.size) : 0;
    const firstStart = left + indent;
    const textStartFirst = firstStart + bulletBox;
    const availFirst = opts.wrap ? colW - right - textStartFirst : Infinity;
    const availRest = opts.wrap ? colW - right - left : Infinity;
    const atoms = atomsOf(p, env, opts.scale);
    const raw: RawLine[] = atoms.length ? breakLines(atoms, availFirst, availRest, env) : [{ atoms: [], width: 0, forced: true }];
    const align = props.align ?? 'l';
    raw.forEach((rl, li) => {
      const first = li === 0;
      const { height, size } = lineMetrics(props, rl.atoms, strut, opts.lineScale);
      const lineStart = first ? firstStart : left;
      const contentStart = first ? textStartFirst : left;
      const avail = colW - right - lineStart;
      const content = (first ? bulletBox : 0) + rl.width;
      let shift = 0;
      if (align === 'ctr') shift = (avail - content) / 2;
      else if (align === 'r') shift = avail - content;
      const { segs, spaces } = segmentsOf(rl.atoms, env, contentStart + shift);
      const lastLine = li === raw.length - 1 || rl.forced;
      const justify = align === 'just' || align === 'justLow' ? !lastLine : align === 'dist';
      if (justify && spaces > 0 && opts.wrap && avail - content > 0) {
        const per = (avail - content) / spaces;
        let acc = 0;
        for (const seg of segs) {
          seg.x += acc;
          const n = [...seg.text].filter((c) => /\s/.test(c)).length;
          seg.wordSpace = per;
          seg.width += per * n;
          acc += per * n;
        }
      }
      const placed: PlacedLine = { top: y, height, baseline: y + (height - (ASC + DESC) * size) / 2 + ASC * size, segs, column: 0 };
      if (first && bulletInfo) {
        placed.bullet = { text: bulletInfo.text, style: bulletInfo.style, x: lineStart + shift, width: bulletWidth, natural: env.book.width(bulletInfo.text, bulletInfo.style.font, bulletInfo.style.size), wordSpace: 0 };
      }
      lines.push(placed);
      y += height;
    });
  });
  y += prevAfter;
  if (cols === 1) return { lines, height: y };
  // Colonnes : remplissage colonne apres colonne selon la hauteur utile.
  let col = 0;
  let base = 0;
  for (const line of lines) {
    if (line.top - base + line.height > opts.height + 0.01 && col < cols - 1 && line.top > base) {
      col++;
      base = line.top;
    }
    const dx = col * (colW + opts.columnGap);
    line.column = col;
    for (const seg of line.segs) seg.x += dx;
    if (line.bullet) line.bullet.x += dx;
    line.baseline -= base;
    line.top -= base;
  }
  return { lines, height: Math.min(y, opts.height) };
}
