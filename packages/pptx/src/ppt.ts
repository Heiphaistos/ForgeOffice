// Lecture des presentations PowerPoint 97-2003 (.ppt, .pps, .pot) : texte, positions, images PNG/JPEG, notes.
import { blipOf } from '@forgeoffice/opc';
import { createBlankDeck } from './blank.ts';
import { CfbError, CfbFile } from './cfb.ts';
import { addMedia, nextSlideId, paragraphsFromText } from './edit.ts';
import type { Color, Paragraph, RunProps } from './dml.ts';
import type { AutoShape, Deck, Picture, PlaceholderType, Run, Shape, Slide } from './model.ts';
import { PresentationError } from './pptx-read.ts';
import { STRINGS } from './strings.ts';

// Types d'enregistrements (MS-PPT, MS-ODRAW).
const RT_DOCUMENT = 0x03e8;
const RT_DOCUMENT_ATOM = 0x03e9;
const RT_SLIDE = 0x03ee;
const RT_SLIDE_ATOM = 0x03ef;
const RT_NOTES = 0x03f0;
const RT_SLIDE_PERSIST = 0x03f3;
const RT_SLWT = 0x0ff0;
const RT_TEXT_HEADER = 0x0f9f;
const RT_TEXT_CHARS = 0x0fa0;
const RT_TEXT_BYTES = 0x0fa8;
const RT_STYLE_TEXT_PROP = 0x0fa1;
const RT_OUTLINE_REF = 0x0f9e;
const RT_USER_EDIT = 0x0ff5;
const RT_PERSIST_DIR = 0x1772;
const RT_PLACEHOLDER = 0x0bc3;
const RT_SP_CONTAINER = 0xf004;
const RT_FOPT = 0xf00b;
const RT_CLIENT_TEXTBOX = 0xf00d;
const RT_CHILD_ANCHOR = 0xf00f;
const RT_CLIENT_ANCHOR = 0xf010;
const RT_BSE = 0xf007;
const RT_PPDRAWING_GROUP = 0x040b;
const RT_DRAWING = 0x040c;
const RT_ENVIRONMENT = 0x03f2;
const RT_FONT_COLLECTION = 0x07d5;
const RT_FONT_ENTITY = 0x0fb7;
const RT_SPGR_CONTAINER = 0xf003;
const RT_FSPGR = 0xf009;

const MAX_DEPTH = 32;

interface PptRecord {
  type: number;
  instance: number;
  version: number;
  offset: number;
  /** Debut des donnees. */
  data: number;
  length: number;
}

class RecordReader {
  readonly bytes: Uint8Array;
  readonly view: DataView;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  at(offset: number): PptRecord | undefined {
    if (offset < 0 || offset + 8 > this.bytes.length) return undefined;
    const verInst = this.view.getUint16(offset, true);
    const length = this.view.getUint32(offset + 4, true);
    if (offset + 8 + length > this.bytes.length) return undefined;
    return { type: this.view.getUint16(offset + 2, true), instance: verInst >> 4, version: verInst & 0xf, offset, data: offset + 8, length };
  }

  /** Enregistrements enfants directs d'un conteneur. */
  children(parent: PptRecord): PptRecord[] {
    const out: PptRecord[] = [];
    let offset = parent.data;
    const end = parent.data + parent.length;
    while (offset + 8 <= end) {
      const rec = this.at(offset);
      if (!rec) break;
      out.push(rec);
      offset = rec.data + rec.length;
    }
    return out;
  }

  /** Parcours en profondeur (ordre du document). */
  walk(parent: PptRecord, visit: (rec: PptRecord) => void, depth = 0): void {
    if (depth > MAX_DEPTH) return;
    for (const rec of this.children(parent)) {
      visit(rec);
      if (rec.version === 0xf) this.walk(rec, visit, depth + 1);
    }
  }

  u32(offset: number): number {
    return offset + 4 <= this.bytes.length ? this.view.getUint32(offset, true) : 0;
  }

  i32(offset: number): number {
    return offset + 4 <= this.bytes.length ? this.view.getInt32(offset, true) : 0;
  }

  u16(offset: number): number {
    return offset + 2 <= this.bytes.length ? this.view.getUint16(offset, true) : 0;
  }

  i16(offset: number): number {
    return offset + 2 <= this.bytes.length ? this.view.getInt16(offset, true) : 0;
  }

  text(rec: PptRecord): string {
    const slice = this.bytes.subarray(rec.data, rec.data + rec.length);
    if (rec.type === RT_TEXT_BYTES) return Array.from(slice, (b) => String.fromCharCode(b)).join('');
    let out = '';
    for (let i = 0; i + 1 < slice.length; i += 2) out += String.fromCharCode((slice[i] ?? 0) | ((slice[i + 1] ?? 0) << 8));
    return out;
  }
}

/** Correspondance persistId -> position dans le flux, en suivant les editions successives (la plus recente l'emporte). */
function persistDirectory(reader: RecordReader, currentEdit: number): Map<number, number> {
  const map = new Map<number, number>();
  const seen = new Set<number>();
  let edit = currentEdit;
  while (edit > 0 && !seen.has(edit)) {
    seen.add(edit);
    const atom = reader.at(edit);
    if (!atom || atom.type !== RT_USER_EDIT) break;
    const dir = reader.at(reader.u32(atom.data + 12));
    if (dir && dir.type === RT_PERSIST_DIR) {
      let offset = dir.data;
      const end = dir.data + dir.length;
      while (offset + 4 <= end) {
        const header = reader.u32(offset);
        const start = header & 0xfffff;
        const count = header >>> 20;
        offset += 4;
        for (let i = 0; i < count && offset + 4 <= end; i++, offset += 4) {
          if (!map.has(start + i)) map.set(start + i, reader.u32(offset));
        }
      }
    }
    edit = reader.u32(atom.data + 8);
  }
  return map;
}

interface ListEntry {
  persistId: number;
  id: number;
  texts: Array<{ type: number; text: string; levels?: number[]; runs?: CharRun[] }>;
}

/** Octets des champs optionnels d'un TextPFException, d'apres son masque (MS-PPT 2.9.18), hors taquets. */
const PF_FIELDS: ReadonlyArray<[number, number]> = [
  [0x0000000f, 2], [0x00000080, 2], [0x00000010, 2], [0x00000040, 2], [0x00000020, 4],
  [0x00000800, 2], [0x00001000, 2], [0x00002000, 2], [0x00004000, 2], [0x00000100, 2], [0x00000400, 2], [0x00008000, 2],
];

/** Niveau de retrait de chaque paragraphe d'un texte, lu dans son StyleTextPropAtom (paragraphes seulement). */
function paragraphLevels(reader: RecordReader, rec: PptRecord, text: string): number[] | undefined {
  return styleRuns(reader, rec, text)?.levels;
}

/** Paragraphes (niveaux) et suites de caracteres mis en forme d'un StyleTextPropAtom. */
function styleRuns(reader: RecordReader, rec: PptRecord, text: string, fonts: readonly string[] = []): { levels: number[]; runs: CharRun[] } | undefined {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\r') starts.push(i + 1);
  const charLevels: number[] = [];
  let offset = rec.data;
  const end = rec.data + rec.length;
  while (charLevels.length <= text.length && offset + 10 <= end) {
    const count = reader.u32(offset);
    const level = reader.u16(offset + 4);
    const masks = reader.u32(offset + 6);
    offset += 10;
    for (const [mask, size] of PF_FIELDS) if (masks & mask) offset += size;
    if (masks & 0x100000) offset += 2 + reader.u16(offset) * 4;
    if (masks & 0x10000) offset += 2;
    if (masks & 0xe0000) offset += 2;
    if (masks & 0x200000) offset += 2;
    if (count === 0 || level > 8 || offset > end) return undefined;
    for (let i = 0; i < count && charLevels.length <= text.length; i++) charLevels.push(level);
  }
  // Suites de caracteres (TextCFException) : masque, puis style (2), police (2), taille (2), couleur (4)...
  const runs: CharRun[] = [];
  let covered = 0;
  while (covered <= text.length && offset + 8 <= end) {
    const count = reader.u32(offset);
    const masks = reader.u32(offset + 4);
    offset += 8;
    const props: RunProps = {};
    if (masks & 0xffff) {
      const style = reader.u16(offset);
      offset += 2;
      if (masks & 0x1) props.bold = (style & 0x1) !== 0;
      if (masks & 0x2) props.italic = (style & 0x2) !== 0;
      if (masks & 0x4) props.underline = (style & 0x4) !== 0 ? 'sng' : 'none';
    }
    if (masks & 0x10000) {
      const font = fonts[reader.u16(offset)];
      if (font) props.font = font;
      offset += 2;
    }
    if (masks & 0x200000) offset += 2;
    if (masks & 0x400000) offset += 2;
    if (masks & 0x800000) offset += 2;
    if (masks & 0x20000) {
      const size = reader.u16(offset);
      if (size > 0 && size < 4000) props.size = size;
      offset += 2;
    }
    if (masks & 0x40000) {
      const color = pptColor(reader.bytes[offset] ?? 0, reader.bytes[offset + 1] ?? 0, reader.bytes[offset + 2] ?? 0, reader.bytes[offset + 3] ?? 0xff);
      if (color) props.color = color;
      offset += 4;
    }
    if (masks & 0x80000) {
      const position = reader.i16(offset);
      if (position) props.baseline = position;
      offset += 2;
    }
    if (count === 0 || offset > end) break;
    runs.push({ count, props });
    covered += count;
  }
  return { levels: starts.map((start) => charLevels[start] ?? 0), runs };
}

/** Suite de `count` caracteres partageant la meme mise en forme. */
interface CharRun {
  count: number;
  props: RunProps;
}

/** Couleur d'un ColorIndexStruct : RVB direct (index 0xFE) ou couleur du jeu (texte, arriere-plan, accent). */
function pptColor(r: number, g: number, b: number, index: number): Color | undefined {
  if (index === 0xfe) return { type: 'rgb', value: [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase() };
  const scheme: Readonly<Record<number, 'bg1' | 'tx1' | 'accent1'>> = { 0: 'bg1', 1: 'tx1', 3: 'tx1', 4: 'accent1', 5: 'accent1', 6: 'accent1', 7: 'accent1' };
  const value = scheme[index];
  return value ? { type: 'scheme', value } : undefined;
}

/** Noms des polices (FontEntityAtom de l'environnement du document), indexes par numero de police. */
function fontNames(reader: RecordReader, document: PptRecord): string[] {
  const env = reader.children(document).find((r) => r.type === RT_ENVIRONMENT);
  const collection = env ? reader.children(env).find((r) => r.type === RT_FONT_COLLECTION) : undefined;
  if (!collection) return [];
  return reader.children(collection).filter((r) => r.type === RT_FONT_ENTITY).map((r) => {
    let name = '';
    for (let i = 0; i < 32; i++) {
      const c = reader.u16(r.data + i * 2);
      if (!c) break;
      name += String.fromCharCode(c);
    }
    return name;
  });
}

function slideList(reader: RecordReader, document: PptRecord, instance: number, fonts: readonly string[]): ListEntry[] {
  const entries: ListEntry[] = [];
  for (const list of reader.children(document)) {
    if (list.type !== RT_SLWT || list.instance !== instance) continue;
    let current: ListEntry | undefined;
    let textType = 4;
    for (const rec of reader.children(list)) {
      if (rec.type === RT_SLIDE_PERSIST) {
        current = { persistId: reader.u32(rec.data), id: reader.u32(rec.data + 12), texts: [] };
        entries.push(current);
      } else if (rec.type === RT_TEXT_HEADER) {
        textType = reader.u32(rec.data);
      } else if ((rec.type === RT_TEXT_CHARS || rec.type === RT_TEXT_BYTES) && current) {
        current.texts.push({ type: textType, text: reader.text(rec) });
      } else if (rec.type === RT_STYLE_TEXT_PROP && current) {
        const last = current.texts.at(-1);
        const style = last ? styleRuns(reader, rec, last.text, fonts) : undefined;
        if (last && style) {
          last.levels = style.levels;
          last.runs = style.runs;
        }
      }
    }
  }
  return entries;
}

interface DrawnShape {
  placement?: number;
  text?: string;
  textType?: number;
  levels?: number[];
  runs?: CharRun[];
  rect?: { x: number; y: number; width: number; height: number };
  blip?: number;
}

/** Correspondance affine d'un repere (coordonnees enfants d'un groupe) vers la page : x' = ax + bx.x, y' = ay + by.y. */
interface FrameMap {
  ax: number;
  bx: number;
  ay: number;
  by: number;
}

const IDENTITY_MAP: FrameMap = { ax: 0, bx: 1, ay: 0, by: 1 };

/** Rectangle d'une ancre (unites maitre 1/576 po) : [gauche, haut, droite, bas]. */
function anchorBox(reader: RecordReader, rec: PptRecord): [number, number, number, number] {
  const big = rec.length >= 16;
  const read = (i: number): number => (big ? reader.i32(rec.data + i * 4) : reader.i16(rec.data + i * 2));
  const [a, b, c, d] = [read(0), read(1), read(2), read(3)];
  // Ancre client : haut, gauche, droite, bas ; ancre enfant : gauche, haut, droite, bas.
  return rec.type === RT_CLIENT_ANCHOR ? [b, a, c, d] : [a, b, c, d];
}

/** Repere des enfants d'un groupe : son rectangle (dans le repere parent) est mis en correspondance avec FSPGR. */
function groupMap(reader: RecordReader, sp: PptRecord, parent: FrameMap): FrameMap | undefined {
  const parts = reader.children(sp);
  const fspgr = parts.find((r) => r.type === RT_FSPGR);
  const anchor = parts.find((r) => r.type === RT_CLIENT_ANCHOR || r.type === RT_CHILD_ANCHOR);
  if (!fspgr) return undefined;
  const [cl, ct, cr, cb] = [reader.i32(fspgr.data), reader.i32(fspgr.data + 4), reader.i32(fspgr.data + 8), reader.i32(fspgr.data + 12)];
  if (!anchor || cr === cl || cb === ct) return parent;
  const [l, t, r, bt] = anchorBox(reader, anchor);
  const [al, ar] = [parent.ax + parent.bx * l, parent.ax + parent.bx * r];
  const [at, ab] = [parent.ay + parent.by * t, parent.ay + parent.by * bt];
  const bx = (ar - al) / (cr - cl);
  const by = (ab - at) / (cb - ct);
  return { ax: al - cl * bx, bx, ay: at - ct * by, by };
}

/** Formes du dessin d'une diapositive ou d'une page de notes (groupes aplatis, coordonnees de la page). */
function drawnShapes(reader: RecordReader, container: PptRecord, outline: ListEntry | undefined, fonts: readonly string[]): DrawnShape[] {
  const shapes: DrawnShape[] = [];
  const parse = (rec: PptRecord, map: FrameMap): void => {
    const shape: DrawnShape = {};
    let textType: number | undefined;
    reader.walk(rec, (inner) => {
      if (inner.type === RT_CLIENT_ANCHOR || inner.type === RT_CHILD_ANCHOR) {
        if (shape.rect && inner.type === RT_CHILD_ANCHOR) return;
        const [left, top, right, bottom] = anchorBox(reader, inner);
        const x = map.ax + map.bx * left;
        const y = map.ay + map.by * top;
        shape.rect = { x: x / 8, y: y / 8, width: Math.max(0, (map.bx * (right - left)) / 8), height: Math.max(0, (map.by * (bottom - top)) / 8) };
      } else if (inner.type === RT_PLACEHOLDER) {
        shape.placement = reader.bytes[inner.data + 4];
      } else if (inner.type === RT_TEXT_HEADER) {
        textType = reader.u32(inner.data);
      } else if (inner.type === RT_TEXT_CHARS || inner.type === RT_TEXT_BYTES) {
        shape.text = reader.text(inner);
        shape.textType = textType;
      } else if (inner.type === RT_STYLE_TEXT_PROP && shape.text !== undefined) {
        const style = styleRuns(reader, inner, shape.text, fonts);
        shape.levels = style?.levels;
        shape.runs = style?.runs;
      } else if (inner.type === RT_OUTLINE_REF) {
        const ref = outline?.texts[reader.u32(inner.data)];
        if (ref) {
          shape.text = ref.text;
          shape.textType = ref.type;
          shape.levels = ref.levels;
          shape.runs = ref.runs;
        }
      } else if (inner.type === RT_FOPT) {
        for (let i = 0; i < inner.instance; i++) {
          const opid = reader.view.getUint16(inner.data + i * 6, true);
          if ((opid & 0x3fff) === 0x104) shape.blip = reader.u32(inner.data + i * 6 + 2);
        }
      }
    });
    if (shape.text !== undefined || shape.blip !== undefined) shapes.push(shape);
  };
  // Un groupe (SpgrContainer) commence par la forme du groupe (FSPGR + ancre), suivie de ses enfants dans le repere FSPGR.
  const group = (spgr: PptRecord, parent: FrameMap, depth: number): void => {
    if (depth > MAX_DEPTH) return;
    let map = parent;
    let first = true;
    for (const rec of reader.children(spgr)) {
      if (rec.type === RT_SPGR_CONTAINER) {
        group(rec, map, depth + 1);
      } else if (rec.type === RT_SP_CONTAINER) {
        if (first && depth > 0) map = groupMap(reader, rec, parent) ?? parent;
        else parse(rec, map);
        first = false;
      }
    }
  };
  const drawing = reader.children(container).find((r) => r.type === RT_DRAWING);
  const roots: PptRecord[] = [];
  const findRoots = (rec: PptRecord, depth: number): void => {
    for (const kid of reader.children(rec)) {
      if (kid.type === RT_SPGR_CONTAINER) roots.push(kid);
      else if (kid.version === 0xf && depth < 4) findRoots(kid, depth + 1);
    }
  };
  if (drawing) findRoots(drawing, 0);
  if (roots.length) for (const root of roots) group(root, IDENTITY_MAP, 0);
  else reader.walk(container, (rec) => { if (rec.type === RT_SP_CONTAINER) parse(rec, IDENTITY_MAP); });
  return shapes;
}

/** Paragraphes d'un texte .ppt : fins de paragraphe (\r), sauts de ligne (\v) et suites de caracteres mises en forme. */
function richParagraphs(raw: string, levels: number[] | undefined, runs: CharRun[] | undefined): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  let current: Run[] = [];
  let buffer = '';
  let bufferProps: RunProps = {};
  let runIndex = 0;
  let left = runs?.[0]?.count ?? Infinity;
  const flush = (): void => {
    if (buffer) current.push({ type: 'text', text: buffer, props: { ...bufferProps } });
    buffer = '';
  };
  const endParagraph = (): void => {
    flush();
    const level = levels?.[paragraphs.length];
    paragraphs.push({ props: level ? { level } : {}, runs: current });
    current = [];
  };
  for (const ch of raw) {
    while (left <= 0 && runs && runIndex + 1 < runs.length) {
      runIndex++;
      left = runs[runIndex]?.count ?? Infinity;
    }
    left -= ch.length;
    const props = runs?.[runIndex]?.props ?? {};
    if (ch === '\r') endParagraph();
    else if (ch === '\v') {
      flush();
      current.push({ type: 'break', props: { ...props } });
    } else if (!/[\u0000-\u0008\u000E-\u001F]/.test(ch)) {
      if (buffer && props !== bufferProps) flush();
      bufferProps = props;
      buffer += ch;
    }
  }
  if (buffer || current.length || !paragraphs.length) endParagraph();
  return paragraphs;
}

const BLIP_EXTENSIONS: Readonly<Record<string, string>> = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/tiff': 'tiff', 'image/bmp': 'bmp', 'image/x-emf': 'emf', 'image/x-wmf': 'wmf' };

/** Images de la reserve (PNG, JPEG, TIFF, DIB, EMF, WMF) indexees par numero de BLIP (1..n). */
function blipStore(reader: RecordReader, document: PptRecord, pictures: Uint8Array | undefined): Map<number, { bytes: Uint8Array; extension: string }> {
  const out = new Map<number, { bytes: Uint8Array; extension: string }>();
  const group = reader.children(document).find((r) => r.type === RT_PPDRAWING_GROUP);
  if (!group) return out;
  let index = 0;
  const pics = pictures ? new RecordReader(pictures) : undefined;
  reader.walk(group, (rec) => {
    if (rec.type !== RT_BSE) return;
    index++;
    const size = reader.u32(rec.data + 20);
    const delay = reader.u32(rec.data + 28);
    const nameLength = reader.bytes[rec.data + 33] ?? 0;
    // Image incorporee dans l'enregistrement, sinon dans le flux « Pictures ».
    const embedded = rec.length > 36 + nameLength ? reader.at(rec.data + 36 + nameLength) : undefined;
    const blip = embedded ?? (pics && size ? pics.at(delay) : undefined);
    const source = embedded ? reader : pics;
    if (!blip || !source) return;
    const image = blipOf(source.bytes, blip.data, blip.instance, blip.type, blip.length);
    const extension = image ? BLIP_EXTENSIONS[image.contentType] : undefined;
    if (image && extension) out.set(index, { extension, bytes: image.bytes });
  });
  return out;
}

const PLACEMENT_TYPES: Readonly<Record<number, PlaceholderType>> = {
  0x0d: 'title',
  0x0e: 'body',
  0x0f: 'ctrTitle',
  0x10: 'subTitle',
  0x11: 'title',
  0x12: 'body',
  0x13: 'obj',
  0x07: 'dt',
  0x08: 'sldNum',
  0x09: 'ftr',
};

const TEXT_TYPE_PLACEHOLDER: Readonly<Record<number, PlaceholderType>> = { 0: 'title', 1: 'body', 5: 'subTitle', 6: 'ctrTitle', 7: 'body', 8: 'body' };

/** Marqueur interne de saut de ligne (\v dans le flux .ppt). */
const LINE_BREAK = '\u2028';

function toText(raw: string): string {
  // \r = fin de paragraphe, \v = saut de ligne ; les caracteres de controle restants sont retires.
  return raw.replace(/\v/g, LINE_BREAK).replace(/[\u0000-\u0008\u000E-\u001F]/g, '');
}

function buildShape(deck: Deck, drawn: DrawnShape, id: number, images: Map<number, { bytes: Uint8Array; extension: string }>): Shape | undefined {
  const xfrm = drawn.rect;
  if (drawn.blip !== undefined && drawn.text === undefined) {
    const image = images.get(drawn.blip);
    if (!image || !xfrm) return undefined;
    const picture: Picture = { kind: 'picture', id, name: `${STRINGS.pictureName} ${id - 1}`, xfrm, mediaId: addMedia(deck, image.bytes, image.extension), fillMode: 'stretch', geometry: { type: 'preset', preset: 'rect' } };
    return picture;
  }
  const ph = (drawn.placement !== undefined ? PLACEMENT_TYPES[drawn.placement] : undefined) ?? (drawn.textType !== undefined && drawn.placement !== undefined ? TEXT_TYPE_PLACEHOLDER[drawn.textType] : undefined);
  const paragraphs = richParagraphs(drawn.text ?? '', drawn.levels, drawn.runs);
  const shape: AutoShape = { kind: 'shape', id, name: `${ph ? STRINGS.pptSlideTitle : STRINGS.textBoxName} ${id - 1}`, geometry: { type: 'preset', preset: 'rect' }, text: { props: { wrap: true }, paragraphs } };
  if (xfrm) shape.xfrm = xfrm;
  if (ph) {
    shape.placeholder = ph === 'body' || ph === 'obj' ? { type: ph, index: 1 } : ph === 'subTitle' ? { type: ph, index: 1 } : { type: ph };
  } else {
    shape.textBox = true;
  }
  return shape;
}

function chooseLayout(shapes: Shape[]): string {
  const types = new Set(shapes.map((s) => s.placeholder?.type));
  if (types.has('ctrTitle') || types.has('subTitle')) return 'layout1';
  if (types.has('title') && (types.has('body') || types.has('obj'))) return 'layout2';
  if (types.has('title')) return 'layout6';
  return 'layout7';
}

/** Lit une presentation PowerPoint 97-2003. */
export function readPpt(bytes: Uint8Array): Deck {
  let cfb: CfbFile;
  try {
    cfb = new CfbFile(bytes);
  } catch (error) {
    throw new PresentationError(`${STRINGS.errors.pptCorrupt} (${(error as CfbError).message})`);
  }
  if (cfb.has('EncryptedPackage')) throw new PresentationError(STRINGS.errors.encrypted);
  const stream = cfb.stream('PowerPoint Document');
  const user = cfb.stream('Current User');
  if (!stream || !user || user.length < 20) throw new PresentationError(STRINGS.errors.pptCorrupt);
  const userView = new DataView(user.buffer, user.byteOffset, user.byteLength);
  if (userView.getUint32(12, true) === 0xf3d1c4df) throw new PresentationError(STRINGS.errors.encrypted);
  const reader = new RecordReader(stream);
  const persist = persistDirectory(reader, userView.getUint32(16, true));
  const edit = reader.at(userView.getUint32(16, true));
  const documentOffset = edit ? persist.get(reader.u32(edit.data + 16)) : undefined;
  const document = documentOffset !== undefined ? reader.at(documentOffset) : undefined;
  if (!document || document.type !== RT_DOCUMENT) throw new PresentationError(STRINGS.errors.pptCorrupt);
  const docAtom = reader.children(document).find((r) => r.type === RT_DOCUMENT_ATOM);
  const width = docAtom ? reader.i32(docAtom.data) / 8 : 720;
  const height = docAtom ? reader.i32(docAtom.data + 4) / 8 : 540;
  const deck = createBlankDeck({ width: width > 0 ? width : 720, height: height > 0 ? height : 540 }, { titleSlide: false });
  deck.format = 'pptx';
  const images = blipStore(reader, document, cfb.stream('Pictures'));
  const fonts = fontNames(reader, document);
  const notesById = new Map<number, ListEntry>();
  for (const entry of slideList(reader, document, 2, fonts)) notesById.set(entry.id, entry);
  for (const entry of slideList(reader, document, 0, fonts)) {
    const offset = persist.get(entry.persistId);
    const container = offset !== undefined ? reader.at(offset) : undefined;
    const slide: Slide = { id: entry.id >= 256 ? entry.id : nextSlideId(deck), layoutId: 'layout7', shapes: [], animations: [], comments: [] };
    if (deck.slides.some((s) => s.id === slide.id)) slide.id = nextSlideId(deck);
    const drawn = container && container.type === RT_SLIDE ? drawnShapes(reader, container, entry, fonts) : [];
    // Repli : texte du plan sans dessin exploitable.
    const source = drawn.length ? drawn : entry.texts.map((t) => ({ text: t.text, textType: t.type, levels: t.levels, runs: t.runs, placement: t.type === 0 ? 0x0d : 0x0e }));
    let id = 2;
    for (const item of source) {
      const shape = buildShape(deck, item, id, images);
      if (shape) {
        slide.shapes.push(shape);
        id++;
      }
    }
    slide.layoutId = chooseLayout(slide.shapes);
    const slideAtom = container ? reader.children(container).find((r) => r.type === RT_SLIDE_ATOM) : undefined;
    const notes = slideAtom ? notesById.get(reader.u32(slideAtom.data + 16)) : undefined;
    const notesOffset = notes ? persist.get(notes.persistId) : undefined;
    const notesContainer = notesOffset !== undefined ? reader.at(notesOffset) : undefined;
    if (notesContainer && notesContainer.type === RT_NOTES) {
      const body = drawnShapes(reader, notesContainer, notes, fonts).find((s) => s.text && (s.placement === 0x0c || s.placement === 0x06 || s.textType === 2));
      if (body?.text) slide.notes = paragraphsFromText(toText(body.text).replaceAll(LINE_BREAK, ' ').replace(/\r/g, '\n'));
    }
    deck.slides.push(slide);
  }
  return deck;
}
