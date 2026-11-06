// Ecriture d'une page PDF en operateurs : repere en points, axe y vers le bas (comme la page de la diapositive).
import {
  PDFDict, PDFName, PDFOperator, PDFOperatorNames, PDFString,
  appendBezierCurve, beginText, clip, closePath, concatTransformationMatrix, drawObject, endPath, endText, fill, lineTo, moveTo,
  popGraphicsState, pushGraphicsState, setCharacterSpacing, setCharacterSqueeze, setDashPattern, setFillingRgbColor, setFontAndSize, setGraphicsState,
  setLineCap, setLineJoin, setLineWidth, setStrokingRgbColor, setTextMatrix, setTextRenderingMode, setWordSpacing, showText, stroke,
  LineCapStyle, LineJoinStyle, TextRenderingMode,
  type PDFDocument, type PDFFont, type PDFImage, type PDFPage, type PDFRef,
} from '@cantoo/pdf-lib';
import type { FontBook } from './fonts.ts';
import type { Rgb, Seg } from './text-layout.ts';

export interface GradientStop {
  position: number;
  color: Rgb;
}

export class PageWriter {
  private readonly ops: PDFOperator[] = [];
  private readonly fontNames = new Map<PDFFont, PDFName>();
  private readonly alphas = new Map<number, PDFName>();
  private shadingCount = 0;

  readonly pdf: PDFDocument;
  readonly page: PDFPage;
  readonly book: FontBook;
  readonly height: number;

  constructor(pdf: PDFDocument, page: PDFPage, book: FontBook, height: number) {
    this.pdf = pdf;
    this.page = page;
    this.book = book;
    this.height = height;
    // Axe y vers le bas pour toute la page.
    this.cm(1, 0, 0, -1, 0, height);
  }

  push(...ops: PDFOperator[]): void {
    this.ops.push(...ops);
  }

  save(): void {
    this.push(pushGraphicsState());
  }

  restore(): void {
    this.push(popGraphicsState());
  }

  cm(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.push(concatTransformationMatrix(a, b, c, d, e, f));
  }

  finish(): void {
    this.page.pushOperators(...this.ops);
  }

  alpha(a: number): void {
    if (a >= 0.999) return;
    const key = Math.round(Math.max(0, a) * 100) / 100;
    let name = this.alphas.get(key);
    if (!name) {
      name = this.page.node.newExtGState('GS', this.pdf.context.obj({ Type: 'ExtGState', ca: key, CA: key }));
      this.alphas.set(key, name);
    }
    this.push(setGraphicsState(name));
  }

  fillColor([r, g, b]: Rgb): void {
    this.push(setFillingRgbColor(r, g, b));
  }

  strokeColor([r, g, b]: Rgb): void {
    this.push(setStrokingRgbColor(r, g, b));
  }

  /** Trace un chemin « M L C Q Z » (donnees SVG absolues du moteur de geometrie), sans le peindre. */
  path(d: string): void {
    const tokens = d.match(/[MLCQZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
    let cmd = '';
    let i = 0;
    let cx = 0;
    let cy = 0;
    let sx = 0;
    let sy = 0;
    const n = (): number => Number(tokens[i++] ?? 0);
    while (i < tokens.length) {
      const t = tokens[i] as string;
      if (/^[A-Za-z]$/.test(t)) {
        cmd = t.toUpperCase();
        i++;
      }
      switch (cmd) {
        case 'M':
          cx = sx = n();
          cy = sy = n();
          this.push(moveTo(cx, cy));
          cmd = 'L';
          break;
        case 'L':
          cx = n();
          cy = n();
          this.push(lineTo(cx, cy));
          break;
        case 'C': {
          const [x1, y1, x2, y2, x3, y3] = [n(), n(), n(), n(), n(), n()] as [number, number, number, number, number, number];
          this.push(appendBezierCurve(x1, y1, x2, y2, x3, y3));
          cx = x3;
          cy = y3;
          break;
        }
        case 'Q': {
          const [qx, qy, x, y] = [n(), n(), n(), n()] as [number, number, number, number];
          this.push(appendBezierCurve(cx + (2 / 3) * (qx - cx), cy + (2 / 3) * (qy - cy), x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), x, y));
          cx = x;
          cy = y;
          break;
        }
        case 'Z':
          this.push(closePath());
          cx = sx;
          cy = sy;
          break;
        default:
          i++;
      }
    }
  }

  rectPath(x: number, y: number, w: number, h: number): void {
    this.push(moveTo(x, y), lineTo(x + w, y), lineTo(x + w, y + h), lineTo(x, y + h), closePath());
  }

  fillPath(): void {
    this.push(fill());
  }

  clipPath(): void {
    this.push(clip(), endPath());
  }

  strokePath(width: number, color: Rgb, dash: number[] | undefined, cap: 'butt' | 'round' | 'square', join: 'round' | 'bevel' | 'miter'): void {
    this.strokeColor(color);
    this.push(setLineWidth(width), setLineCap(cap === 'round' ? LineCapStyle.Round : cap === 'square' ? LineCapStyle.Projecting : LineCapStyle.Butt));
    this.push(setLineJoin(join === 'round' ? LineJoinStyle.Round : join === 'bevel' ? LineJoinStyle.Bevel : LineJoinStyle.Miter));
    if (dash?.length) this.push(setDashPattern(dash, 0));
    this.push(stroke());
  }

  /** Remplit la zone de decoupe courante avec un degrade (axial ou radial), coordonnees dans le repere courant. */
  shade(kind: 'axial' | 'radial', coords: number[], stops: GradientStop[]): void {
    const ctx = this.pdf.context;
    const sorted = [...stops].sort((a, b) => a.position - b.position);
    if (sorted.length === 0) return;
    const first = sorted[0] as GradientStop;
    const last = sorted[sorted.length - 1] as GradientStop;
    const all = [{ position: 0, color: first.color }, ...sorted.map((s) => ({ position: Math.min(1, Math.max(0, s.position)), color: s.color })), { position: 1, color: last.color }];
    const subs: PDFRef[] = [];
    const bounds: number[] = [];
    for (let i = 0; i + 1 < all.length; i++) {
      const a = all[i] as GradientStop;
      const b = all[i + 1] as GradientStop;
      subs.push(ctx.register(ctx.obj({ FunctionType: 2, Domain: [0, 1], C0: [...a.color], C1: [...b.color], N: 1 })));
      if (i + 2 < all.length) bounds.push(b.position);
    }
    const fn = ctx.register(ctx.obj({ FunctionType: 3, Domain: [0, 1], Functions: subs, Bounds: bounds, Encode: subs.flatMap(() => [0, 1]) }));
    const shading = ctx.register(ctx.obj({ ShadingType: kind === 'axial' ? 2 : 3, ColorSpace: 'DeviceRGB', Coords: coords, Function: fn, Extend: [true, true] }));
    const resources = this.page.node.normalizedEntries().Resources as PDFDict;
    let table = resources.lookupMaybe(PDFName.of('Shading'), PDFDict);
    if (!table) {
      table = ctx.obj({});
      resources.set(PDFName.of('Shading'), table);
    }
    const key = `Sh${++this.shadingCount}`;
    table.set(PDFName.of(key), shading);
    this.push(PDFOperator.of(PDFOperatorNames.ShadingFill, [PDFName.of(key)]));
  }

  image(img: PDFImage, x: number, y: number, w: number, h: number): void {
    const name = this.page.node.newXObject('Image', img.ref);
    this.save();
    this.cm(w, 0, 0, -h, x, y + h);
    this.push(drawObject(name));
    this.restore();
  }

  private fontName(font: PDFFont): PDFName {
    let name = this.fontNames.get(font);
    if (!name) {
      name = this.page.node.newFontDictionary('F', font.ref);
      this.fontNames.set(font, name);
    }
    return name;
  }

  /** Texte d'un segment dont la ligne de base est a l'ordonnee `baseline` (repere courant). */
  text(seg: Seg, baseline: number): void {
    const st = seg.style;
    if (!seg.text) return;
    const spaces = [...seg.text].filter((c) => /\s/.test(c)).length;
    const plain = seg.width - seg.wordSpace * spaces - st.spacing * [...seg.text].length;
    const k = seg.natural > 0 && plain > 0 ? Math.min(1.6, Math.max(0.5, plain / seg.natural)) : 1;
    if (st.highlight) {
      this.save();
      this.fillColor(st.highlight);
      this.rectPath(seg.x, baseline - st.size * 0.82 - st.rise, seg.width, st.size * 1.05);
      this.fillPath();
      this.restore();
    }
    this.save();
    if (st.alpha < 1) this.alpha(st.alpha);
    this.fillColor(st.color);
    let x = seg.x;
    for (const part of this.book.split(seg.text, st.font)) {
      const font = this.book.font(part.style);
      const w = font.widthOfTextAtSize(part.text, st.size) * k;
      this.push(beginText(), setFontAndSize(this.fontName(font), st.size), setCharacterSqueeze(k * 100));
      this.push(setCharacterSpacing(st.spacing / k), setWordSpacing(seg.wordSpace / k));
      if (st.outline) {
        this.strokeColor(st.outline.color);
        this.push(setLineWidth(st.outline.width), setTextRenderingMode(TextRenderingMode.FillAndOutline));
      }
      this.push(setTextMatrix(1, 0, 0, -1, x, baseline - st.rise), showText(font.encodeText(part.text)), endText());
      x += w + st.spacing * [...part.text].length + seg.wordSpace * [...part.text].filter((c) => c === ' ').length;
    }
    this.restore();
    const thick = Math.max(0.5, st.size / 18);
    if (st.underline || st.strike) {
      this.save();
      this.fillColor(st.color);
      if (st.underline) {
        this.rectPath(seg.x, baseline - st.rise + st.size * 0.1, seg.width, thick);
        this.fillPath();
      }
      if (st.strike) {
        this.rectPath(seg.x, baseline - st.rise - st.size * 0.3, seg.width, thick);
        this.fillPath();
      }
      this.restore();
    }
  }

  /** Lien cliquable (rectangle en coordonnees de la page, axe y vers le bas). */
  link(url: string, x: number, y: number, w: number, h: number): void {
    const ctx = this.pdf.context;
    const annot = ctx.register(
      ctx.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [x, this.height - y - h, x + w, this.height - y],
        Border: [0, 0, 0],
        A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
      }),
    );
    this.page.node.normalizedEntries().Annots.push(annot);
  }
}
