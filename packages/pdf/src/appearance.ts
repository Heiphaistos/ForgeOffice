// Ecriture d'un element en annotation PDF reelle avec son apparence (/AP) pour un rendu identique dans tous les lecteurs.
// Sur une page pivotee, le contenu de l'apparence (texte, tampon, icone de note) est tourne pour rester droit a l'ecran.
import { PDFDocument, PDFHexString, PDFName, PDFString, degrees, rgb, type PDFFont, type PDFPage, type PDFRef } from '@cantoo/pdf-lib';
import { STAMP_COLORS, displaySize, hexToRgb, screenFrame, toPdfPoint, toPdfRect, type Item, type PageGeom, type Rect } from './model.ts';
import { S } from './strings.ts';

export const n = (v: number): string => (Math.round(v * 1000) / 1000).toString();
export const color = (hex: string, op: 'rg' | 'RG'): string => `${hexToRgb(hex).map(n).join(' ')} ${op}`;

/** Texte limite a la police standard (WinAnsi). */
export function safe(font: PDFFont, text: string): string {
  const set = new Set(font.getCharacterSet());
  return [...text].map((c) => (c === '\n' || set.has(c.codePointAt(0) ?? 0) ? c : '?')).join('');
}

export interface Ctx {
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

/** Lignes de texte en operateurs (police Helv), alignees en haut a gauche du repere local. */
function textOps(font: PDFFont, name: string, text: string, size: number, x: number, top: number, hex: string): string {
  const lines = safe(font, text).split('\n');
  return lines.map((line, i) => `BT /${name} ${n(size)} Tf ${color(hex, 'rg')} ${n(x)} ${n(top - size * (i + 1) * 1.15 + size * 0.2)} Td ${font.encodeText(line).toString()} Tj ET`).join('\n');
}

/** Enveloppe un contenu dessine dans le repere local (droit a l'ecran) dans l'espace PDF de la page. */
const framed = (m: readonly number[], body: string): string => `q ${m.map(n).join(' ')} cm\n${body}\nQ`;

/** Taille de l'icone de note (points, a l'ecran). */
export const NOTE_PT = 20;

/** Rectangle normalise de l'icone d'une note posee en `pos` (coin haut gauche a l'ecran). */
export function noteRect(pos: { x: number; y: number }, g: PageGeom): Rect {
  const d = displaySize(g);
  return { x: pos.x, y: pos.y, w: NOTE_PT / d.w, h: NOTE_PT / d.h };
}

export function writeItem(c: Ctx, page: PDFPage, g: PageGeom, item: Item): void {
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
      const nr = noteRect(item.pos, g);
      const rect = toPdfRect(nr, g);
      const f = screenFrame(nr, g);
      const lines = [5, 9, 13].map((d) => `4 ${20 - d} m 16 ${20 - d} l S`).join(' ');
      const ops = framed(f.matrix, `${color(item.color, 'rg')} 0.3 0.3 0.3 RG 0.6 w 1 1 18 18 re B\n0.2 0.2 0.2 RG 1 w ${lines}`);
      const [r, gg, b] = hexToRgb(item.color);
      addAnnot(c, page, item, 'Text', rect, { Name: PDFName.of('Comment'), Open: false, C: [r, gg, b] }, appearance(c, rect, ops), item.text);
      return;
    }
    case 'freetext': {
      const rect = toPdfRect(item.rect, g);
      const f = screenFrame(item.rect, g);
      const ops = framed(f.matrix, textOps(c.helv, 'Helv', item.text, item.size, 2, f.h - 2, item.color));
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
      const extra = { L: [ax, ay, bx, by], C: [r, gg, b], BS: { W: w }, ...(item.shape === 'arrow' ? { LE: [PDFName.of('None'), PDFName.of('OpenArrow')] } : {}) };
      addAnnot(c, page, item, 'Line', rect, extra, appearance(c, rect, ops), '');
      return;
    }
    case 'ink': {
      const pts = item.points.map((p) => toPdfPoint(p, g));
      if (pts.length < 2) return;
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      const rect = pad([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], item.width + 1);
      const path = pts.map(([x, y], i) => `${n(x)} ${n(y)} ${i === 0 ? 'm' : 'l'}`).join(' ');
      const [r, gg, b] = hexToRgb(item.color);
      const ops = `${color(item.color, 'RG')} ${n(item.width)} w 1 J 1 j ${path} S`;
      addAnnot(c, page, item, 'Ink', rect, { InkList: [pts.flat()], C: [r, gg, b], BS: { W: item.width } }, appearance(c, rect, ops), '');
      return;
    }
    case 'stamp': {
      const rect = toPdfRect(item.rect, g);
      const f = screenFrame(item.rect, g);
      const label = S.stamps[item.stamp].toUpperCase();
      const size = Math.max(6, Math.min(f.h * 0.55, (f.w * 0.9) / Math.max(1, c.helvBold.widthOfTextAtSize(safe(c.helvBold, label), 1))));
      const tw = c.helvBold.widthOfTextAtSize(safe(c.helvBold, label), size);
      const hex = STAMP_COLORS[item.stamp];
      const text = c.helvBold.encodeText(safe(c.helvBold, label)).toString();
      const body = `${color(hex, 'RG')} 2.5 w 2 2 ${n(f.w - 4)} ${n(f.h - 4)} re S\nBT /HelvB ${n(size)} Tf ${color(hex, 'rg')} ${n((f.w - tw) / 2)} ${n((f.h - size * 0.7) / 2)} Td ${text} Tj ET`;
      addAnnot(c, page, item, 'Stamp', rect, { Name: PDFName.of('Approved') }, appearance(c, rect, framed(f.matrix, body), true), S.stamps[item.stamp]);
      return;
    }
    default:
      return;
  }
}

/** Angle (degres, sens trigonometrique) de l'axe « droite de l'ecran » dans l'espace PDF. */
const angleOf = (m: readonly number[]): number => (Math.atan2(m[1] ?? 0, m[0] ?? 1) * 180) / Math.PI;

/** Image posee a l'ecran dans `rect` (droite meme sur une page pivotee). */
export function drawSignature(page: PDFPage, g: PageGeom, rect: Rect, png: Awaited<ReturnType<PDFDocument['embedPng']>>): void {
  const f = screenFrame(rect, g);
  page.drawImage(png, { x: f.matrix[4], y: f.matrix[5], width: f.w, height: f.h, rotate: degrees(angleOf(f.matrix)) });
}

/** Correction de texte sans moteur natif : fond blanc sur l'ancien texte, nouveau texte par-dessus (droit a l'ecran).
 *  L'ancien texte reste dans le fichier (le moteur natif, lui, le retire). */
export function coverText(c: Ctx, page: PDFPage, g: PageGeom, rect: Rect, text: string, size: number): void {
  const [x0, y0, x1, y1] = toPdfRect(rect, g);
  page.drawRectangle({ x: x0 - 1, y: y0 - 1, width: x1 - x0 + 2, height: y1 - y0 + 2, color: rgb(1, 1, 1) });
  const f = screenFrame(rect, g);
  const dy = (f.h - size) / 2 + size * 0.2;
  const [, , cc, d, e, ff] = f.matrix;
  page.drawText(safe(c.helv, text), { x: e + cc * dy, y: ff + d * dy, size, font: c.helv, color: rgb(0, 0, 0), rotate: degrees(angleOf(f.matrix)) });
}
