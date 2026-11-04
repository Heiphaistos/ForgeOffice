// Ecriture des elements en attente dans le PDF avec pdf-lib (sans DOM, teste) :
// - annotations reelles (surlignage, soulignement, barre, note, texte libre, formes, dessin, tampon) avec
//   leur apparence (/AP) pour un rendu identique dans tous les lecteurs ;
// - champs de formulaire crees, valeurs saisies, aplatissement ;
// - signature visuelle (image) et correction de texte « couvrir et reecrire » (repli sans moteur natif).
import {
  PDFCheckBox, PDFDocument, PDFDropdown, PDFHexString, PDFName, PDFOptionList, PDFRadioGroup, PDFString, PDFTextField, StandardFonts, degrees, rgb,
  type PDFFont, type PDFPage, type PDFRef,
} from '@cantoo/pdf-lib';
import { STAMP_COLORS, hexToRgb, toPdfPoint, toPdfRect, type DocState, type Item, type PageGeom, type Rect } from './model.ts';
import { S } from './strings.ts';

export function geomOf(page: PDFPage): PageGeom {
  const b = page.getCropBox();
  return { box: [b.x, b.y, b.x + b.width, b.y + b.height], rotate: page.getRotation().angle };
}

const n = (v: number): string => (Math.round(v * 1000) / 1000).toString();
const color = (hex: string, op: 'rg' | 'RG'): string => `${hexToRgb(hex).map(n).join(' ')} ${op}`;

/** Texte limite a la police standard (WinAnsi). */
function safe(font: PDFFont, text: string): string {
  const set = new Set(font.getCharacterSet());
  return [...text].map((c) => (c === '\n' || set.has(c.codePointAt(0) ?? 0) ? c : '?')).join('');
}

interface Ctx {
  doc: PDFDocument;
  helv: PDFFont;
  helvBold: PDFFont;
}

/** Flux d'apparence (formulaire XObject) d'une annotation, dessine dans l'espace de la page. */
function appearance(c: Ctx, rect: readonly number[], content: string, fonts = false, multiply = false): PDFRef {
  const resources = c.doc.context.obj({
    ...(fonts ? { Font: { Helv: c.helv.ref, HelvB: c.helvBold.ref } } : {}),
    ...(multiply ? { ExtGState: { GM: { Type: 'ExtGState', BM: 'Multiply' } } } : {}),
  });
  const stream = c.doc.context.stream(content, { Type: 'XObject', Subtype: 'Form', BBox: [...rect], Resources: resources });
  return c.doc.context.register(stream);
}

function addAnnot(c: Ctx, page: PDFPage, item: Item, subtype: string, rect: readonly number[], extra: Record<string, unknown>, ap: PDFRef, contents: string): void {
  const dict = c.doc.context.obj({
    Type: 'Annot', Subtype: subtype, Rect: [...rect], F: 4, NM: PDFString.of(item.id),
    T: PDFHexString.fromText(item.author), M: PDFString.fromDate(new Date(item.at)), Contents: PDFHexString.fromText(contents),
    AP: { N: ap }, ...extra,
  });
  page.node.addAnnot(c.doc.context.register(dict));
}

function ellipsePath(x: number, y: number, w: number, h: number): string {
  const k = 0.5523;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2;
  const ry = h / 2;
  return [
    `${n(cx + rx)} ${n(cy)} m`,
    `${n(cx + rx)} ${n(cy + k * ry)} ${n(cx + k * rx)} ${n(cy + ry)} ${n(cx)} ${n(cy + ry)} c`,
    `${n(cx - k * rx)} ${n(cy + ry)} ${n(cx - rx)} ${n(cy + k * ry)} ${n(cx - rx)} ${n(cy)} c`,
    `${n(cx - rx)} ${n(cy - k * ry)} ${n(cx - k * rx)} ${n(cy - ry)} ${n(cx)} ${n(cy - ry)} c`,
    `${n(cx + k * rx)} ${n(cy - ry)} ${n(cx + rx)} ${n(cy - k * ry)} ${n(cx + rx)} ${n(cy)} c`,
  ].join('\n');
}

function pad(r: readonly [number, number, number, number], d: number): [number, number, number, number] {
  return [r[0] - d, r[1] - d, r[2] + d, r[3] + d];
}

/** Lignes de texte en operateurs (police Helv), alignees en haut a gauche du rectangle. */
function textOps(font: PDFFont, name: string, text: string, size: number, x: number, top: number, hex: string): string {
  const lines = safe(font, text).split('\n');
  return lines.map((line, i) => `BT /${name} ${n(size)} Tf ${color(hex, 'rg')} ${n(x)} ${n(top - size * (i + 1) * 1.15 + size * 0.2)} Td ${font.encodeText(line).toString()} Tj ET`).join('\n');
}

function writeItem(c: Ctx, page: PDFPage, g: PageGeom, item: Item): void {
  switch (item.kind) {
    case 'mark': {
      const rects = item.rects.map((r) => toPdfRect(r, g));
      if (rects.length === 0) return;
      const all: [number, number, number, number] = [
        Math.min(...rects.map((r) => r[0])), Math.min(...rects.map((r) => r[1])), Math.max(...rects.map((r) => r[2])), Math.max(...rects.map((r) => r[3])),
      ];
      const quads = rects.flatMap(([a, b, cx, d]) => [a, d, cx, d, a, b, cx, b]);
      const subtype = item.mark === 'highlight' ? 'Highlight' : item.mark === 'underline' ? 'Underline' : 'StrikeOut';
      const draw = rects.map(([a, b, cx, d]) => {
        if (item.mark === 'highlight') return `${n(a)} ${n(b)} ${n(cx - a)} ${n(d - b)} re f`;
        const y = item.mark === 'underline' ? b + (d - b) * 0.08 : b + (d - b) * 0.45;
        return `${n(Math.max(0.8, (d - b) * 0.07))} w ${n(a)} ${n(y)} m ${n(cx)} ${n(y)} l S`;
      }).join('\n');
      const ops = item.mark === 'highlight' ? `/GM gs ${color(item.color, 'rg')}\n${draw}` : `${color(item.color, 'RG')}\n${draw}`;
      const [r, gg, b] = hexToRgb(item.color);
      addAnnot(c, page, item, subtype, all, { QuadPoints: quads, C: [r, gg, b] }, appearance(c, all, ops, false, item.mark === 'highlight'), item.text);
      return;
    }
    case 'note': {
      const [x, y] = toPdfPoint(item.pos, g);
      const rect = [x, y - 20, x + 20, y];
      const ops = `${color(item.color, 'rg')} 0.3 0.3 0.3 RG 0.6 w ${n(x + 1)} ${n(y - 19)} 18 18 re B\n0.2 0.2 0.2 RG 1 w ${[5, 9, 13].map((d) => `${n(x + 4)} ${n(y - d)} m ${n(x + 16)} ${n(y - d)} l S`).join(' ')}`;
      const [r, gg, b] = hexToRgb(item.color);
      addAnnot(c, page, item, 'Text', rect, { Name: PDFName.of('Comment'), Open: false, C: [r, gg, b] }, appearance(c, rect, ops), item.text);
      return;
    }
    case 'freetext': {
      const rect = toPdfRect(item.rect, g);
      const ops = textOps(c.helv, 'Helv', item.text, item.size, rect[0] + 2, rect[3] - 2, item.color);
      addAnnot(c, page, item, 'FreeText', rect, { DA: PDFString.of(`/Helv ${item.size} Tf ${color(item.color, 'rg')}`) }, appearance(c, rect, ops, true), item.text);
      return;
    }
    case 'shape': {
      const w = item.width;
      const [r, gg, b] = hexToRgb(item.color);
      if (item.shape === 'rect' || item.shape === 'ellipse') {
        const rect = pad(toPdfRect(item.rect, g), w / 2);
        const [x0, y0, x1, y1] = rect;
        const path = item.shape === 'rect' ? `${n(x0 + w)} ${n(y0 + w)} ${n(x1 - x0 - 2 * w)} ${n(y1 - y0 - 2 * w)} re` : ellipsePath(x0 + w, y0 + w, x1 - x0 - 2 * w, y1 - y0 - 2 * w);
        const ops = `${color(item.color, 'RG')} ${n(w)} w\n${path} S`;
        addAnnot(c, page, item, item.shape === 'rect' ? 'Square' : 'Circle', rect, { C: [r, gg, b], BS: { W: w } }, appearance(c, rect, ops), '');
        return;
      }
      const [ax, ay] = toPdfPoint(item.from, g);
      const [bx, by] = toPdfPoint(item.to, g);
      const head = w * 4 + 6;
      const rect = pad([Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)], head);
      let ops = `${color(item.color, 'RG')} ${color(item.color, 'rg')} ${n(w)} w 1 J ${n(ax)} ${n(ay)} m ${n(bx)} ${n(by)} l S`;
      if (item.shape === 'arrow') {
        const a = Math.atan2(by - ay, bx - ax);
        const p1 = [bx - head * Math.cos(a - 0.4), by - head * Math.sin(a - 0.4)];
        const p2 = [bx - head * Math.cos(a + 0.4), by - head * Math.sin(a + 0.4)];
        ops += `\n${n(bx)} ${n(by)} m ${n(p1[0] ?? 0)} ${n(p1[1] ?? 0)} l ${n(p2[0] ?? 0)} ${n(p2[1] ?? 0)} l h f`;
      }
      addAnnot(c, page, item, 'Line', rect, { L: [ax, ay, bx, by], C: [r, gg, b], BS: { W: w }, ...(item.shape === 'arrow' ? { LE: [PDFName.of('None'), PDFName.of('OpenArrow')] } : {}) }, appearance(c, rect, ops), '');
      return;
    }
    case 'ink': {
      const pts = item.points.map((p) => toPdfPoint(p, g));
      if (pts.length < 2) return;
      const rect = pad([Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))], item.width + 1);
      const path = pts.map(([x, y], i) => `${n(x)} ${n(y)} ${i === 0 ? 'm' : 'l'}`).join(' ');
      const [r, gg, b] = hexToRgb(item.color);
      addAnnot(c, page, item, 'Ink', rect, { InkList: [pts.flat()], C: [r, gg, b], BS: { W: item.width } }, appearance(c, rect, `${color(item.color, 'RG')} ${n(item.width)} w 1 J 1 j ${path} S`), '');
      return;
    }
    case 'stamp': {
      const rect = toPdfRect(item.rect, g);
      const [x0, y0, x1, y1] = rect;
      const label = S.stamps[item.stamp].toUpperCase();
      const h = y1 - y0;
      const size = Math.max(6, Math.min(h * 0.55, ((x1 - x0) * 0.9) / Math.max(1, c.helvBold.widthOfTextAtSize(safe(c.helvBold, label), 1))));
      const tw = c.helvBold.widthOfTextAtSize(safe(c.helvBold, label), size);
      const hex = STAMP_COLORS[item.stamp];
      const ops = `${color(hex, 'RG')} 2.5 w ${n(x0 + 2)} ${n(y0 + 2)} ${n(x1 - x0 - 4)} ${n(h - 4)} re S\nBT /HelvB ${n(size)} Tf ${color(hex, 'rg')} ${n(x0 + (x1 - x0 - tw) / 2)} ${n(y0 + (h - size * 0.7) / 2)} Td ${c.helvBold.encodeText(safe(c.helvBold, label)).toString()} Tj ET`;
      addAnnot(c, page, item, 'Stamp', rect, { Name: PDFName.of('Approved') }, appearance(c, rect, ops, true), S.stamps[item.stamp]);
      return;
    }
    default:
      return;
  }
}

function drawSignature(page: PDFPage, g: PageGeom, rect: Rect, png: Awaited<ReturnType<PDFDocument['embedPng']>>): void {
  const [x0, y0, x1, y1] = toPdfRect(rect, g);
  page.drawImage(png, { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rotate: degrees(0) });
}

/** Correction de texte sans moteur natif : fond blanc sur l'ancien texte, nouveau texte par-dessus.
 *  L'ancien texte reste dans le fichier (le moteur natif, lui, le retire). */
function coverText(c: Ctx, page: PDFPage, g: PageGeom, rect: Rect, text: string, size: number): void {
  const [x0, y0, x1, y1] = toPdfRect(rect, g);
  page.drawRectangle({ x: x0 - 1, y: y0 - 1, width: x1 - x0 + 2, height: y1 - y0 + 2, color: rgb(1, 1, 1) });
  page.drawText(safe(c.helv, text), { x: x0, y: y0 + (y1 - y0 - size) / 2 + size * 0.2, size, font: c.helv, color: rgb(0, 0, 0) });
}

export interface ApplyOptions {
  /** Corrections de texte ecrites en « couvrir et reecrire » (sans moteur natif). */
  coverTextEdits: boolean;
  /** Aplatir le formulaire apres ecriture. */
  flatten?: boolean;
}

/** Ecrit les elements (hors caviardage, et hors corrections si `coverTextEdits` est faux) et les valeurs de champs. */
export async function applyItems(bytes: Uint8Array, state: Pick<DocState, 'items' | 'values'>, o: ApplyOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const c: Ctx = { doc, helv: await doc.embedFont(StandardFonts.Helvetica), helvBold: await doc.embedFont(StandardFonts.HelveticaBold) };
  const pages = doc.getPages();
  const form = doc.getForm();
  for (const item of state.items) {
    const page = pages[item.page];
    if (!page) continue;
    const g = geomOf(page);
    if (item.kind === 'signature') drawSignature(page, g, item.rect, await doc.embedPng(item.png));
    else if (item.kind === 'textedit') {
      if (o.coverTextEdits) coverText(c, page, g, item.rect, item.text, item.size);
    } else if (item.kind === 'field') {
      const [x0, y0, x1, y1] = toPdfRect(item.rect, g);
      const box = { x: x0, y: y0, width: x1 - x0, height: y1 - y0, font: c.helv };
      switch (item.field) {
        case 'texte':
        case 'zone_texte': {
          const f = form.createTextField(item.name);
          if (item.field === 'zone_texte') f.enableMultiline();
          if (item.value) f.setText(item.value);
          f.addToPage(page, box);
          break;
        }
        case 'case': {
          const f = form.createCheckBox(item.name);
          f.addToPage(page, box);
          if (item.value === 'oui') f.check();
          break;
        }
        case 'radio': {
          const f = form.getFieldMaybe(item.name) ? form.getRadioGroup(item.name) : form.createRadioGroup(item.name);
          f.addOptionToPage(item.value || item.id, page, box);
          break;
        }
        case 'liste_deroulante':
        case 'liste': {
          const f = item.field === 'liste' ? form.createOptionList(item.name) : form.createDropdown(item.name);
          f.addOptions(item.options);
          f.addToPage(page, box);
          break;
        }
      }
    } else if (item.kind !== 'redact') writeItem(c, page, g, item);
  }
  for (const [name, value] of Object.entries(state.values)) {
    const field = form.getFieldMaybe(name);
    if (!field) continue;
    if (field instanceof PDFTextField) field.setText(String(value));
    else if (field instanceof PDFCheckBox) {
      if (value === true) field.check();
      else field.uncheck();
    } else if (field instanceof PDFDropdown || field instanceof PDFOptionList || field instanceof PDFRadioGroup) field.select(String(value));
  }
  if (o.flatten) form.flatten();
  return doc.save({ useObjectStreams: true });
}

/** Champ existant du formulaire, avec sa position sur la page affichee. */
export interface FieldInfo {
  name: string;
  type: 'texte' | 'case' | 'radio' | 'liste' | 'autre';
  value: string | boolean;
  options: string[];
  multiline: boolean;
  readOnly: boolean;
  widgets: { page: number; rect: Rect; option?: string }[];
}

/** Champs du formulaire (pdf-lib) avec les rectangles normalises de leurs widgets. */
export async function readFields(bytes: Uint8Array): Promise<FieldInfo[]> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
  const pages = doc.getPages();
  const refPage = new Map<string, number>();
  pages.forEach((p, i) => {
    const annots = p.node.Annots();
    for (let k = 0; k < (annots?.size() ?? 0); k++) {
      const ref = annots?.get(k);
      if (ref) refPage.set(ref.toString(), i);
    }
  });
  const out: FieldInfo[] = [];
  for (const field of doc.getForm().getFields()) {
    const name = field.getName();
    let type: FieldInfo['type'] = 'autre';
    let value: string | boolean = '';
    let options: string[] = [];
    let multiline = false;
    if (field instanceof PDFTextField) {
      type = 'texte';
      value = field.getText() ?? '';
      multiline = field.isMultiline();
    } else if (field instanceof PDFCheckBox) {
      type = 'case';
      value = field.isChecked();
    } else if (field instanceof PDFRadioGroup) {
      type = 'radio';
      value = field.getSelected() ?? '';
      options = field.getOptions();
    } else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
      type = 'liste';
      value = field.getSelected()[0] ?? '';
      options = field.getOptions();
    }
    const widgets: FieldInfo['widgets'] = [];
    field.acroField.getWidgets().forEach((w, wi) => {
      const ref = doc.context.getObjectRef(w.dict);
      const index = ref ? refPage.get(ref.toString()) : undefined;
      const page = index === undefined ? undefined : pages[index];
      if (index === undefined || !page) return;
      const g = geomOf(page);
      const r = w.getRectangle();
      const [x0, y0, x1, y1] = g.box;
      const W = x1 - x0;
      const H = y1 - y0;
      // Inverse de toPdfRect pour une page sans rotation (cas courant des formulaires).
      const rect: Rect = g.rotate % 360 === 0
        ? { x: (r.x - x0) / W, y: (y1 - r.y - r.height) / H, w: r.width / W, h: r.height / H }
        : { x: 0, y: 0, w: 0, h: 0 };
      widgets.push({ page: index, rect, option: type === 'radio' ? options[wi] : undefined });
    });
    out.push({ name, type, value, options, multiline, readOnly: field.isReadOnly(), widgets });
  }
  return out;
}
