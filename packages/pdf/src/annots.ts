// Annotations DEJA presentes dans un fichier (sans DOM, teste) : relecture des dictionnaires /Annots en elements
// modifiables, retrait de l'affichage pdf.js (elles sont redessinees par la couche d'edition), suppression par reference.
import {
  PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRef, PDFString, type PDFObject, type PDFPage,
} from '@cantoo/pdf-lib';
import { geomOf } from './geom.ts';
import { EXISTING, fromPdfPoint, fromPdfRect, type Item, type MarkKind, type Point, type Rect, type StampKind } from './model.ts';
import { loadForRead } from './forms.ts';
import { S } from './strings.ts';

const N = (s: string): PDFName => PDFName.of(s);

function nums(a: PDFObject | undefined): number[] | null {
  if (!(a instanceof PDFArray)) return null;
  const out: number[] = [];
  for (let i = 0; i < a.size(); i++) {
    const v = a.lookup(i);
    if (!(v instanceof PDFNumber)) return null;
    out.push(v.asNumber());
  }
  return out;
}

const hex2 = (v: number): string => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');

/** Couleur /C (gris, RVB ou CMJN) ou, a defaut, `fallback`. */
function colorOf(d: PDFDict, key: string, fallback: string): string {
  const c = nums(d.lookup(N(key)));
  if (!c) return fallback;
  if (c.length === 1) return `#${hex2(c[0] ?? 0).repeat(3)}`;
  if (c.length === 3) return `#${c.map(hex2).join('')}`;
  if (c.length === 4) {
    const [cy = 0, m = 0, y = 0, k = 0] = c;
    return `#${[(1 - cy) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k)].map(hex2).join('')}`;
  }
  return fallback;
}

function textOf(d: PDFDict, key: string): string {
  const v = d.lookup(N(key));
  return v instanceof PDFString || v instanceof PDFHexString ? v.decodeText() : '';
}

function dateOf(d: PDFDict): number {
  const raw = textOf(d, 'M');
  const m = raw.match(/^D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?/);
  if (!m) return 0;
  return Date.UTC(Number(m[1]), Number(m[2] ?? 1) - 1, Number(m[3] ?? 1), Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0));
}

/** Police et couleur du texte libre d'apres /DA (« /Helv 14 Tf 0.1 0.2 0.3 rg »). */
export function parseDA(da: string): { size: number; color: string } {
  const size = Number(da.match(/([\d.]+)\s+Tf/)?.[1] ?? 12) || 12;
  const rgb = da.match(/([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+rg/);
  const gray = da.match(/([\d.]+)\s+g\b/);
  const color = rgb ? `#${[rgb[1], rgb[2], rgb[3]].map((v) => hex2(Number(v))).join('')}` : gray ? `#${hex2(Number(gray[1])).repeat(3)}` : '#000000';
  return { size, color };
}

const STAMP_BY_LABEL = new Map<string, StampKind>((Object.keys(S.stamps) as StampKind[]).map((k) => [S.stamps[k], k]));

/** Identifiant stable d'une annotation lue du fichier. */
export const idOfRef = (ref: PDFRef): string => `${EXISTING}${ref.objectNumber}.${ref.generationNumber}`;
export const refOfId = (id: string): PDFRef | null => {
  const m = id.match(/^a:(\d+)\.(\d+)$/);
  return m ? PDFRef.of(Number(m[1]), Number(m[2])) : null;
};

/** Convertit une annotation en element modifiable ; null si elle n'est pas prise en charge (elle reste dessinee par pdf.js). */
export function parseAnnotation(d: PDFDict, ref: PDFRef, page: number, pdfPage: PDFPage): Item | null {
  const sub = d.lookup(N('Subtype'));
  if (!(sub instanceof PDFName)) return null;
  const flags = d.lookup(N('F'));
  if (flags instanceof PDFNumber && (flags.asNumber() & 2) !== 0) return null; // masquee
  if (d.has(N('IRT'))) return null; // reponse a un autre commentaire
  const g = geomOf(pdfPage);
  const rect = nums(d.lookup(N('Rect')));
  if (!rect || rect.length !== 4) return null;
  const [llx = 0, lly = 0, urx = 0, ury = 0] = rect;
  const pr: [number, number, number, number] = [Math.min(llx, urx), Math.min(lly, ury), Math.max(llx, urx), Math.max(lly, ury)];
  const base = { id: idOfRef(ref), page, author: textOf(d, 'T'), at: dateOf(d) };
  const text = textOf(d, 'Contents');
  switch (sub.decodeText()) {
    case 'Highlight':
    case 'Underline':
    case 'StrikeOut': {
      const q = nums(d.lookup(N('QuadPoints')));
      if (!q || q.length === 0 || q.length % 8 !== 0) return null;
      const rects: Rect[] = [];
      for (let i = 0; i < q.length; i += 8) {
        const xs = [q[i] ?? 0, q[i + 2] ?? 0, q[i + 4] ?? 0, q[i + 6] ?? 0];
        const ys = [q[i + 1] ?? 0, q[i + 3] ?? 0, q[i + 5] ?? 0, q[i + 7] ?? 0];
        rects.push(fromPdfRect([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], g));
      }
      const name = sub.decodeText();
      const mark: MarkKind = name === 'Highlight' ? 'highlight' : name === 'Underline' ? 'underline' : 'strike';
      return { ...base, kind: 'mark', mark, rects, color: colorOf(d, 'C', mark === 'highlight' ? '#FFE500' : '#D13438'), text };
    }
    case 'Text': {
      const r = fromPdfRect(pr, g);
      return { ...base, kind: 'note', pos: { x: r.x, y: r.y }, text, color: colorOf(d, 'C', '#FFE500') };
    }
    case 'FreeText': {
      const da = parseDA(textOf(d, 'DA'));
      return { ...base, kind: 'freetext', rect: fromPdfRect(pr, g), text, size: da.size, color: da.color };
    }
    case 'Square':
    case 'Circle': {
      const bs = d.lookup(N('BS'));
      const border = nums(d.lookup(N('Border')));
      const width = (bs instanceof PDFDict ? (bs.lookup(N('W')) as PDFNumber | undefined)?.asNumber() : undefined) ?? border?.[2] ?? 1;
      const inner = fromPdfRect([pr[0] + width / 2, pr[1] + width / 2, pr[2] - width / 2, pr[3] - width / 2], g);
      return { ...base, kind: 'shape', shape: sub.decodeText() === 'Square' ? 'rect' : 'ellipse', rect: inner, from: { x: inner.x, y: inner.y }, to: { x: inner.x + inner.w, y: inner.y + inner.h }, color: colorOf(d, 'C', '#D13438'), width };
    }
    case 'Line': {
      const l = nums(d.lookup(N('L')));
      if (!l || l.length !== 4) return null;
      const le = d.lookup(N('LE'));
      const arrow = le instanceof PDFArray && [0, 1].some((i) => {
        const e = le.lookup(i);
        return e instanceof PDFName && /Arrow/.test(e.decodeText());
      });
      const from = fromPdfPoint([l[0] ?? 0, l[1] ?? 0], g);
      const to = fromPdfPoint([l[2] ?? 0, l[3] ?? 0], g);
      const bs = d.lookup(N('BS'));
      const width = (bs instanceof PDFDict ? (bs.lookup(N('W')) as PDFNumber | undefined)?.asNumber() : undefined) ?? 1;
      const r: Rect = { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), w: Math.abs(from.x - to.x), h: Math.abs(from.y - to.y) };
      return { ...base, kind: 'shape', shape: arrow ? 'arrow' : 'line', rect: r, from, to, color: colorOf(d, 'C', '#D13438'), width };
    }
    case 'Ink': {
      const list = d.lookup(N('InkList'));
      if (!(list instanceof PDFArray) || list.size() !== 1) return null; // plusieurs traits : laisses a pdf.js
      const flat = nums(list.lookup(0));
      if (!flat || flat.length < 4) return null;
      const points: Point[] = [];
      for (let i = 0; i + 1 < flat.length; i += 2) points.push(fromPdfPoint([flat[i] ?? 0, flat[i + 1] ?? 0], g));
      const bs = d.lookup(N('BS'));
      const width = (bs instanceof PDFDict ? (bs.lookup(N('W')) as PDFNumber | undefined)?.asNumber() : undefined) ?? 1;
      return { ...base, kind: 'ink', points, color: colorOf(d, 'C', '#000000'), width };
    }
    case 'Stamp': {
      const stamp = STAMP_BY_LABEL.get(text);
      return stamp ? { ...base, kind: 'stamp', stamp, rect: fromPdfRect(pr, g) } : null; // tampon d'un autre outil : image a conserver tel quel
    }
    default:
      return null;
  }
}

/** Reference de la fenetre /Popup liee a une annotation. */
function popupOf(d: PDFDict): PDFRef | null {
  const p = d.get(N('Popup'));
  return p instanceof PDFRef ? p : null;
}

export interface ReadResult {
  items: Item[];
  /** Octets sans les annotations prises en charge (pour pdf.js) ; identiques a l'entree s'il n'y en a pas. */
  display: Uint8Array;
}

/** Annotations modifiables du fichier + version d'affichage sans elles. */
export async function readAnnotations(bytes: Uint8Array, loaded?: PDFDocument): Promise<ReadResult> {
  const doc = loaded ?? await loadForRead(bytes);
  const items: Item[] = [];
  const drop: { page: PDFPage; ref: PDFRef; popup: PDFRef | null }[] = [];
  doc.getPages().forEach((page, index) => {
    const annots = page.node.Annots();
    for (let k = 0; k < (annots?.size() ?? 0); k++) {
      const ref = annots?.get(k);
      if (!(ref instanceof PDFRef)) continue;
      const d = doc.context.lookupMaybe(ref, PDFDict);
      if (!d) continue;
      const item = parseAnnotation(d, ref, index, page);
      if (item) {
        items.push(item);
        drop.push({ page, ref, popup: popupOf(d) });
      }
    }
  });
  if (drop.length === 0) return { items, display: bytes };
  for (const { page, ref, popup } of drop) {
    page.node.removeAnnot(ref);
    if (popup) page.node.removeAnnot(popup);
  }
  return { items, display: await doc.save({ useObjectStreams: false }) };
}

/** Retire des pages les annotations designees (et leur fenetre /Popup). Retourne les pages touchees. */
export function removeAnnotations(doc: PDFDocument, ids: Iterable<string>): void {
  const wanted = new Set(ids);
  for (const page of doc.getPages()) {
    const annots = page.node.Annots();
    for (let k = (annots?.size() ?? 0) - 1; k >= 0; k--) {
      const ref = annots?.get(k);
      if (!(ref instanceof PDFRef) || !wanted.has(idOfRef(ref))) continue;
      const d = doc.context.lookupMaybe(ref, PDFDict);
      const popup = d ? popupOf(d) : null;
      page.node.removeAnnot(ref);
      doc.context.delete(ref);
      if (popup) {
        page.node.removeAnnot(popup);
        doc.context.delete(popup);
      }
    }
  }
}
