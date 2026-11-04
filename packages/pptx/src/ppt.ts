// Lecture des presentations PowerPoint 97-2003 (.ppt, .pps, .pot) : texte, positions, images PNG/JPEG, notes.
import { createBlankDeck } from './blank.ts';
import { CfbError, CfbFile } from './cfb.ts';
import { addMedia, nextSlideId, paragraphsFromText } from './edit.ts';
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
  texts: Array<{ type: number; text: string; levels?: number[] }>;
}

/** Octets des champs optionnels d'un TextPFException, d'apres son masque (MS-PPT 2.9.18), hors taquets. */
const PF_FIELDS: ReadonlyArray<[number, number]> = [
  [0x0000000f, 2], [0x00000080, 2], [0x00000010, 2], [0x00000040, 2], [0x00000020, 4],
  [0x00000800, 2], [0x00001000, 2], [0x00002000, 2], [0x00004000, 2], [0x00000100, 2], [0x00000400, 2], [0x00008000, 2],
];

/** Niveau de retrait de chaque paragraphe d'un texte, lu dans son StyleTextPropAtom (paragraphes seulement). */
function paragraphLevels(reader: RecordReader, rec: PptRecord, text: string): number[] | undefined {
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
  return starts.map((start) => charLevels[start] ?? 0);
}

function slideList(reader: RecordReader, document: PptRecord, instance: number): ListEntry[] {
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
        if (last) last.levels = paragraphLevels(reader, rec, last.text);
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
  rect?: { x: number; y: number; width: number; height: number };
  blip?: number;
}

/** Formes du dessin d'une diapositive ou d'une page de notes. */
function drawnShapes(reader: RecordReader, container: PptRecord, outline: ListEntry | undefined): DrawnShape[] {
  const shapes: DrawnShape[] = [];
  reader.walk(container, (rec) => {
    if (rec.type !== RT_SP_CONTAINER) return;
    const shape: DrawnShape = {};
    let textType: number | undefined;
    reader.walk(rec, (inner) => {
      if (inner.type === RT_CLIENT_ANCHOR || inner.type === RT_CHILD_ANCHOR) {
        if (shape.rect && inner.type === RT_CHILD_ANCHOR) return;
        const big = inner.length >= 16;
        const read = (i: number): number => (big ? reader.i32(inner.data + i * 4) : reader.i16(inner.data + i * 2));
        const [a, b, c, d] = [read(0), read(1), read(2), read(3)];
        // Ancre client : haut, gauche, droite, bas ; ancre enfant : gauche, haut, droite, bas (unites maitre 1/576 po).
        const [top, left, right, bottom] = inner.type === RT_CLIENT_ANCHOR ? [a, b, c, d] : [b, a, c, d];
        shape.rect = { x: left / 8, y: top / 8, width: Math.max(0, right - left) / 8, height: Math.max(0, bottom - top) / 8 };
      } else if (inner.type === RT_PLACEHOLDER) {
        shape.placement = reader.bytes[inner.data + 4];
      } else if (inner.type === RT_TEXT_HEADER) {
        textType = reader.u32(inner.data);
      } else if (inner.type === RT_TEXT_CHARS || inner.type === RT_TEXT_BYTES) {
        shape.text = reader.text(inner);
        shape.textType = textType;
      } else if (inner.type === RT_STYLE_TEXT_PROP && shape.text !== undefined) {
        shape.levels = paragraphLevels(reader, inner, shape.text);
      } else if (inner.type === RT_OUTLINE_REF) {
        const ref = outline?.texts[reader.u32(inner.data)];
        if (ref) {
          shape.text = ref.text;
          shape.textType = ref.type;
          shape.levels = ref.levels;
        }
      } else if (inner.type === RT_FOPT) {
        for (let i = 0; i < inner.instance; i++) {
          const opid = reader.view.getUint16(inner.data + i * 6, true);
          if ((opid & 0x3fff) === 0x104) shape.blip = reader.u32(inner.data + i * 6 + 2);
        }
      }
    });
    if (shape.text !== undefined || shape.blip !== undefined) shapes.push(shape);
  });
  return shapes;
}

/** Images de la reserve (PNG, JPEG, TIFF) indexees par numero de BLIP (1..n). */
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
    const formats: Record<number, [string, number[]]> = {
      0xf01d: ['jpeg', [0x46a, 0x6e2]],
      0xf02a: ['jpeg', [0x46a, 0x6e2]],
      0xf01e: ['png', [0x6e0]],
      0xf029: ['tiff', [0x6e4]],
    };
    const format = formats[blip.type];
    if (!format) return;
    const singleUid = format[1].includes(blip.instance);
    const skip = (singleUid ? 16 : 32) + 1;
    out.set(index, { extension: format[0], bytes: source.bytes.slice(blip.data + skip, blip.data + blip.length) });
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
  const paragraphs = paragraphsFromText(toText(drawn.text ?? '').replace(/\r/g, '\n')).map((p, i) => ({
    ...p,
    props: drawn.levels?.[i] ? { ...p.props, level: drawn.levels[i] } : p.props,
    runs: p.runs.flatMap((run): Run[] =>
      run.type === 'text' ? run.text.split(LINE_BREAK).flatMap((part, i) => (i ? [{ type: 'break' as const, props: {} }, { ...run, text: part }] : [{ ...run, text: part }])).filter((r) => r.type === 'break' || r.text) : [run],
    ),
  }));
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
  const notesById = new Map<number, ListEntry>();
  for (const entry of slideList(reader, document, 2)) notesById.set(entry.id, entry);
  for (const entry of slideList(reader, document, 0)) {
    const offset = persist.get(entry.persistId);
    const container = offset !== undefined ? reader.at(offset) : undefined;
    const slide: Slide = { id: entry.id >= 256 ? entry.id : nextSlideId(deck), layoutId: 'layout7', shapes: [], animations: [], comments: [] };
    if (deck.slides.some((s) => s.id === slide.id)) slide.id = nextSlideId(deck);
    const drawn = container && container.type === RT_SLIDE ? drawnShapes(reader, container, entry) : [];
    // Repli : texte du plan sans dessin exploitable.
    const source = drawn.length ? drawn : entry.texts.map((t) => ({ text: t.text, textType: t.type, levels: t.levels, placement: t.type === 0 ? 0x0d : 0x0e }));
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
      const body = drawnShapes(reader, notesContainer, notes).find((s) => s.text && (s.placement === 0x0c || s.placement === 0x06 || s.textType === 2));
      if (body?.text) slide.notes = paragraphsFromText(toText(body.text).replaceAll(LINE_BREAK, ' ').replace(/\r/g, '\n'));
    }
    deck.slides.push(slide);
  }
  return deck;
}
