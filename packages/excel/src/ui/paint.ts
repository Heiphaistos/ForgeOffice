// Dessin de la grille sur canvas : remplissages, quadrillage, bordures, texte (debordement, renvoi a la ligne),
// fusions, mise en forme conditionnelle, sparklines, indicateurs, selection, references colorees, en-tetes.
import type { BreakInfo } from '../logic/pagebreaks.ts';
import { PS } from '../strings/index.ts';
import { paintFill } from './paint-fill.ts';
import type { Scalar } from '@forgeoffice/formulas';
import { columnName, type CellRange, type Sheet, type SparklineGroup, type Table, type Workbook } from '@forgeoffice/xlsx';
import type { CfEvaluator } from '../logic/condfmt.ts';
import { cellLook, type CellLook, type EdgeLook } from '../logic/look.ts';
import type { RefMark } from '../logic/formula-ui.ts';
import { activeRange, isFullCols, isFullRows, type Selection } from '../logic/selection.ts';
import { inheritedStyle, mergeAt } from '../logic/styles.ts';
import { tableAt, tableLook, type TableStyleParts } from '../logic/tables.ts';
import { colX, rangeRect, rowY, type Band, type Layout, type Viewport } from '../logic/viewport.ts';
import { axisSize } from '../logic/geometry.ts';
import { drawIcon } from './icons-cf.ts';
import { suiteBand, suiteCorner, suiteCursor, suiteRange, type SuitePalette } from './paint-suite.ts';

export interface Palette {
  canvas: string;
  grid: string;
  header: string;
  headerText: string;
  headerLine: string;
  headerSel: string;
  headerSelText: string;
  headerFull: string;
  accent: string;
  selFill: string;
  /** Presente dans les dispositions LibreOffice / OpenOffice : dessin propre a la suite (paint-suite.ts). */
  suite?: SuitePalette;
}

export interface PaintSource {
  wb: Workbook;
  sheet: Sheet;
  value: (row: number, col: number) => Scalar;
  cf: CfEvaluator | null;
  tableParts: (t: Table) => TableStyleParts;
  sel: Selection;
  showGrid: boolean;
  showHeaders: boolean;
  showFormulas: boolean;
  /** Cellule en cours d'edition (son texte est masque sous l'editeur). */
  editing: { row: number; col: number } | null;
  refs: readonly RefMark[];
  copyRange: CellRange | null;
  dash: number;
  filterButtons: readonly { row: number; col: number; active: boolean }[];
  arrows: readonly { from: CellRange; to: { row: number; col: number }; dir?: 'prec' | 'dep'; external?: boolean }[];
  /** Cellule signalee par la verification des erreurs (triangle vert en haut a gauche). */
  errorAt?: (row: number, col: number) => boolean;
  pageBreaks: BreakInfo | null;
  fillTarget: CellRange | null;
  palette: Palette;
  rangeSheetName: string;
  /** Valeurs d'une plage de sparkline. */
  sparkValues: (source: string) => (number | null)[];
}

const DASH: Readonly<Record<string, number[]>> = {
  dashed: [3, 1], dotted: [1, 1], hair: [1, 1], mediumDashed: [6, 2], dashDot: [4, 1, 1, 1], mediumDashDot: [6, 2, 2, 2],
  dashDotDot: [4, 1, 1, 1, 1, 1], mediumDashDotDot: [6, 2, 2, 2, 2, 2], slantDashDot: [6, 2, 2, 2],
};

function edgeWidth(e: EdgeLook): number {
  return e.style === 'medium' || e.style.startsWith('medium') ? 2 : e.style === 'thick' ? 3 : 1;
}

interface Item {
  row: number;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
  look: CellLook;
  merged: boolean;
}

export function paintGrid(ctx: CanvasRenderingContext2D, v: Viewport, L: Layout, src: PaintSource): void {
  const { palette: P, sheet } = src;
  const z = v.zoom;
  ctx.fillStyle = P.canvas;
  ctx.fillRect(0, 0, v.width, v.height);
  const items: Item[] = [];
  const colsByIndex = L.cols;
  // Fusions visibles : dessinees une seule fois sur toute leur surface.
  const merges = sheet.merges.filter((m) => L.rows.some((b) => b.index >= m.r1 && b.index <= m.r2) && L.cols.some((b) => b.index >= m.c1 && b.index <= m.c2));
  const drawnMerges = new Set<CellRange>();
  for (const rb of L.rows) {
    for (const cb of colsByIndex) {
      const m = merges.length ? mergeAt(merges, rb.index, cb.index) : undefined;
      if (m) {
        if (drawnMerges.has(m)) continue;
        drawnMerges.add(m);
        const rect = rangeRect(v, m);
        items.push({ row: m.r1, col: m.c1, x: rect.x, y: rect.y, w: rect.w, h: rect.h, look: lookAt(src, m.r1, m.c1, rect.w / z), merged: true });
        continue;
      }
      items.push({ row: rb.index, col: cb.index, x: cb.pos, y: rb.pos, w: cb.size, h: rb.size, look: lookAt(src, rb.index, cb.index, cb.size / z), merged: false });
    }
  }
  const body = (fn: () => void): void => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(v.headerW, v.headerH, v.width - v.headerW, v.height - v.headerH);
    ctx.clip();
    fn();
    ctx.restore();
  };
  body(() => {
    // 1. Remplissages
    for (const it of items) {
      if (it.look.fill) fillCell(ctx, it.look, it.x, it.y, it.w, it.h);
    }
    // 2. Quadrillage
    if (src.showGrid) {
      ctx.strokeStyle = P.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const rb of L.rows) {
        const y = Math.round(rb.pos + rb.size) - 0.5;
        ctx.moveTo(v.headerW, y);
        ctx.lineTo(v.width, y);
      }
      for (const cb of L.cols) {
        const x = Math.round(cb.pos + cb.size) - 0.5;
        ctx.moveTo(x, v.headerH);
        ctx.lineTo(x, v.height);
      }
      ctx.stroke();
      // Les cellules remplies et les fusions masquent le quadrillage interieur.
      for (const it of items) {
        if (it.look.fill) {
          fillCell(ctx, it.look, it.x - 1, it.y - 1, it.w + 1, it.h + 1);
        } else if (it.merged) {
          ctx.fillStyle = P.canvas;
          ctx.fillRect(it.x, it.y, it.w - 1, it.h - 1);
        }
      }
    }
    // 3. Barres de donnees et texte
    paintTexts(ctx, items, src, z);
    // 4. Bordures
    for (const it of items) {
      const b = it.look.borders;
      if (b.top) line(ctx, it.x, it.y, it.x + it.w, it.y, b.top);
      if (b.bottom) line(ctx, it.x, it.y + it.h, it.x + it.w, it.y + it.h, b.bottom);
      if (b.left) line(ctx, it.x, it.y, it.x, it.y + it.h, b.left);
      if (b.right) line(ctx, it.x + it.w, it.y, it.x + it.w, it.y + it.h, b.right);
      if (b.diagUp) line(ctx, it.x, it.y + it.h, it.x + it.w, it.y, b.diagUp);
      if (b.diagDown) line(ctx, it.x, it.y, it.x + it.w, it.y + it.h, b.diagDown);
    }
    paintSparklines(ctx, v, src);
    paintIndicators(ctx, v, L, src);
    if (src.pageBreaks) paintBreaks(ctx, v, src.pageBreaks);
    paintSelection(ctx, v, src);
    paintRefs(ctx, v, src);
    paintArrows(ctx, v, src);
  });
  // Lignes des volets figes
  if (v.frozenRows > 0 || v.frozenCols > 0) {
    ctx.strokeStyle = '#9E9E9E';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (v.frozenRows > 0) {
      ctx.moveTo(0, Math.round(L.bodyY) - 0.5);
      ctx.lineTo(v.width, Math.round(L.bodyY) - 0.5);
    }
    if (v.frozenCols > 0) {
      ctx.moveTo(Math.round(L.bodyX) - 0.5, 0);
      ctx.lineTo(Math.round(L.bodyX) - 0.5, v.height);
    }
    ctx.stroke();
  }
  if (src.showHeaders) paintHeaders(ctx, v, L, src);
}

function lookAt(src: PaintSource, row: number, col: number, colPx: number): CellLook {
  const cell = src.sheet.cells.get(row)?.get(col);
  const value = src.value(row, col);
  const t = src.sheet.tables.length ? tableAt(src.sheet, row, col) : undefined;
  return cellLook(src.wb, cell, value, {
    colPx,
    showFormulas: src.showFormulas,
    showZeros: src.sheet.view.showZeros,
    cf: src.cf && !src.cf.empty ? src.cf.at(row, col) : null,
    table: t ? tableLook(t, row, col, src.tableParts(t)) : null,
    ...(cell ? {} : { styleId: inheritedStyle(src.sheet, row, col) ?? 0 }),
  });
}

/** Remplissage d'une cellule : couleur plate, motif ou degrade. */
function fillCell(ctx: CanvasRenderingContext2D, look: CellLook, x: number, y: number, w: number, h: number): void {
  if (look.fillPaint) paintFill(ctx, look.fillPaint, x, y, w, h);
  else if (look.fill) {
    ctx.fillStyle = look.fill;
    ctx.fillRect(x, y, w, h);
  }
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, e: EdgeLook): void {
  const w = edgeWidth(e);
  ctx.strokeStyle = e.color;
  ctx.lineWidth = w;
  ctx.setLineDash(DASH[e.style] ?? []);
  const off = w % 2 === 1 ? 0.5 : 0;
  ctx.beginPath();
  if (e.style === 'double') {
    const horiz = y1 === y2;
    ctx.lineWidth = 1;
    for (const d of [-1, 1]) {
      ctx.moveTo(Math.round(x1 + (horiz ? 0 : d)) + 0.5, Math.round(y1 + (horiz ? d : 0)) + 0.5);
      ctx.lineTo(Math.round(x2 + (horiz ? 0 : d)) + 0.5, Math.round(y2 + (horiz ? d : 0)) + 0.5);
    }
  } else {
    ctx.moveTo(Math.round(x1) - off, Math.round(y1) - off);
    ctx.lineTo(Math.round(x2) - off, Math.round(y2) - off);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function paintTexts(ctx: CanvasRenderingContext2D, items: Item[], src: PaintSource, z: number): void {
  // Occupation par ligne (pour le debordement du texte dans les cellules vides voisines).
  const occupied = new Map<string, boolean>();
  for (const it of items) if (it.look.text !== '' || it.merged) occupied.set(`${it.row},${it.col}`, true);
  const byRow = new Map<number, Item[]>();
  for (const it of items) {
    if (it.merged) continue;
    const list = byRow.get(it.row) ?? [];
    list.push(it);
    byRow.set(it.row, list);
  }
  let lastFont = '';
  for (const it of items) {
    const { look } = it;
    const pad = (src.palette.suite ? 1 : 3) * z;
    if (look.cf?.bar) paintBar(ctx, it, look.cf.bar, z);
    let iconW = 0;
    if (look.cf?.icon) {
      const s = Math.min(16 * z, it.h - 2);
      drawIcon(ctx, look.cf.icon.set, look.cf.icon.index, it.x + pad, it.y + (it.h - s) / 2, s);
      iconW = s + 2;
    }
    if (look.text === '' || (src.editing && src.editing.row === it.row && src.editing.col === it.col)) continue;
    if (look.cf?.bar && !look.cf.bar.showValue) continue;
    if (look.cf?.icon && !look.cf.icon.showValue) continue;
    const scaledFont = z === 1 ? look.font : look.font.replace(/([\d.]+)px/, (_m, n: string) => `${(Number(n) * z).toFixed(2)}px`);
    if (scaledFont !== lastFont) {
      ctx.font = scaledFont;
      lastFont = scaledFont;
    }
    ctx.fillStyle = look.color;
    let text = look.text;
    const avail = it.w - 2 * pad - iconW - look.indent * 9 * z;
    let width = ctx.measureText(text).width;
    if (look.shrink && width > avail && avail > 4) {
      // « Ajuster » : la police est reduite pour que le texte tienne dans la cellule.
      ctx.font = scaledFont.replace(/([\d.]+)px/, (_m, n: string) => `${((Number(n) * avail) / width).toFixed(2)}px`);
      lastFont = '';
      width = ctx.measureText(text).width;
    }
    if (look.numeric && width > avail && !look.wrap) {
      text = '#'.repeat(Math.max(1, Math.floor(avail / Math.max(1, ctx.measureText('#').width))));
      width = ctx.measureText(text).width;
    }
    const lineH = look.fontPx * z * 1.2;
    let lines = [text];
    if (look.wrap) lines = wrapText(ctx, text, Math.max(4, avail));
    else if (text.includes('\n')) lines = [text.replace(/\n/g, ' ')];
    // « Centré sur plusieurs colonnes » : le texte se centre sur la cellule et les cellules vides suivantes de meme alignement.
    let spanW = it.w;
    if (look.hAlign === 'centerContinuous' && !it.merged && !look.wrap) {
      const row = byRow.get(it.row) ?? [];
      for (let k = row.indexOf(it) + 1; k < row.length; k++) {
        const n = row[k];
        if (!n || n.look.text !== '' || n.look.hAlign !== 'centerContinuous' || n.col !== (row[k - 1]?.col ?? -2) + 1) break;
        spanW += n.w;
      }
    }
    // Zone de debordement
    let clipX = it.x;
    let clipW = Math.max(it.w, spanW);
    if (!look.wrap && !it.merged && spanW === it.w && width > avail && !look.numeric && (look.align === 'left' || look.align === 'right' || look.align === 'center')) {
      const row = byRow.get(it.row) ?? [];
      const idx = row.indexOf(it);
      if (look.align !== 'right') {
        for (let k = idx + 1; k < row.length; k++) {
          const n = row[k];
          if (!n || occupied.get(`${n.row},${n.col}`)) break;
          clipW += n.w;
          if (!n.look.fill) {
            ctx.save();
            ctx.fillStyle = src.palette.canvas;
            ctx.fillRect(n.x - 1, n.y, n.w, n.h - 1);
            ctx.restore();
          }
          if (clipW - 2 * pad >= width) break;
        }
      }
      if (look.align !== 'left') {
        for (let k = idx - 1; k >= 0; k--) {
          const n = row[k];
          if (!n || occupied.get(`${n.row},${n.col}`)) break;
          clipX -= n.w;
          clipW += n.w;
          if (!n.look.fill) {
            ctx.save();
            ctx.fillStyle = src.palette.canvas;
            ctx.fillRect(n.x, n.y, n.w, n.h - 1);
            ctx.restore();
          }
          if (clipW - 2 * pad >= width) break;
        }
      }
      ctx.fillStyle = look.color;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(clipX, it.y, clipW, it.h);
    ctx.clip();
    ctx.direction = look.rtl ? 'rtl' : 'ltr';
    const total = lines.length * lineH;
    const free = it.h - 2 * pad - total;
    let y = look.valign === 'top' ? it.y + pad : look.valign === 'center' ? it.y + (it.h - total) / 2 : it.y + it.h - total - pad * 0.6;
    let gap = 0;
    if (look.vSpread) {
      // Vertical « Justifié » : premiere ligne en haut, derniere en bas ; « Distribué » : espaces egaux autour des lignes.
      gap = free > 0 ? free / (look.vSpread === 'justify' ? Math.max(1, lines.length - 1) : lines.length) : 0;
      y = it.y + pad + (look.vSpread === 'distributed' ? gap / 2 : 0);
      if (look.vSpread === 'justify' && lines.length === 1) gap = 0;
    }
    if (look.vert === 'subscript') y += lineH * 0.4;
    if (look.rotation === 255) {
      // Texte vertical : une lettre par ligne, centree.
      const chars = [...text.replace(/\s+/g, ' ')];
      const th = chars.length * lineH;
      let cy = Math.max(it.y + pad, look.valign === 'top' ? it.y + pad : look.valign === 'center' ? it.y + (it.h - th) / 2 : it.y + it.h - th - pad);
      ctx.textBaseline = 'top';
      ctx.textAlign = 'center';
      for (const ch of chars) {
        ctx.fillText(ch, it.x + it.w / 2, cy);
        cy += lineH;
      }
      ctx.restore();
      continue;
    }
    if (look.rotation) {
      const angle = look.rotation <= 90 ? -look.rotation : look.rotation - 90;
      ctx.translate(it.x + it.w / 2, it.y + it.h / 2);
      ctx.rotate((angle * Math.PI) / 180);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(text, 0, 0);
      ctx.restore();
      continue;
    }
    ctx.textBaseline = 'top';
    const accounting = look.underlineStyle === 'singleAccounting' || look.underlineStyle === 'doubleAccounting';
    const doubled = look.underlineStyle === 'double' || look.underlineStyle === 'doubleAccounting';
    lines.forEach((l, i) => {
      let w = ctx.measureText(l).width;
      const indent = look.indent * 9 * z;
      const box = it.w - 2 * pad - iconW - indent;
      let x: number;
      if (look.hAlign === 'distributed' && !look.wrap && l.length > 1 && box > w) {
        // « Distribué » : les lettres se repartissent sur toute la largeur.
        ctx.letterSpacing = `${(box - w) / [...l].length}px`;
        w = box;
        x = it.x + pad + iconW + indent;
      } else if (look.align === 'right') x = it.x + it.w - pad - w - indent;
      else if (look.align === 'center') x = it.x + (spanW - w) / 2;
      else x = it.x + pad + iconW + indent;
      if (look.align === 'justify' && i < lines.length - 1 && box > w) {
        // « Justifié » : les espaces s'etirent pour remplir la largeur (sauf derniere ligne).
        const spaces = l.split(' ').length - 1;
        if (spaces > 0) {
          ctx.wordSpacing = `${(box - w) / spaces}px`;
          w = box;
        }
      }
      if (look.align === 'fill' && w > 0) {
        let s = l;
        while (ctx.measureText(s + l).width <= it.w - 2 * pad) s += l;
        ctx.fillText(s, it.x + pad, y + lineH * 0.1);
      } else ctx.fillText(l, x, y + lineH * 0.1);
      ctx.letterSpacing = '0px';
      ctx.wordSpacing = '0px';
      if (look.underline || look.strike) {
        const t = Math.max(1, z);
        if (look.underline) {
          const ux = accounting ? it.x + pad : x;
          const uw = accounting ? it.w - 2 * pad : w;
          const uy = accounting ? it.y + it.h - (doubled ? 5 : 3) * t : y + lineH * 0.95;
          ctx.fillRect(ux, uy, uw, t);
          if (doubled) ctx.fillRect(ux, uy + 2 * t, uw, t);
        }
        if (look.strike) ctx.fillRect(x, y + lineH * 0.55, w, t);
      }
      y += lineH + gap;
    });
    ctx.restore();
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let lineText = '';
    for (const word of para.split(/(\s+)/)) {
      const next = lineText + word;
      if (ctx.measureText(next).width > width && lineText.trim() !== '') {
        out.push(lineText.trimEnd());
        lineText = word.trimStart();
      } else lineText = next;
    }
    out.push(lineText);
  }
  return out;
}

function paintBar(ctx: CanvasRenderingContext2D, it: Item, bar: NonNullable<NonNullable<CellLook['cf']>['bar']>, z: number): void {
  const pad = 2 * z;
  const h = it.h - 2 * pad;
  const full = it.w - 2 * pad;
  let x = it.x + pad;
  let w = full * Math.min(1, Math.abs(bar.ratio));
  if (bar.axis !== undefined) {
    const ax = it.x + pad + full * bar.axis;
    x = bar.negative ? ax - w : ax;
    ctx.fillStyle = '#000000';
    ctx.setLineDash([2, 2]);
    ctx.fillRect(ax, it.y + pad, 1, h);
    ctx.setLineDash([]);
  }
  w = Math.max(0, w);
  const color = `#${bar.color}`;
  if (bar.gradient) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, color);
    g.addColorStop(1, '#FFFFFF');
    ctx.fillStyle = g;
  } else ctx.fillStyle = color;
  ctx.fillRect(x, it.y + pad, w, h);
  if (bar.gradient) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, it.y + pad + 0.5, Math.max(0, w - 1), h - 1);
  }
}

function paintSparklines(ctx: CanvasRenderingContext2D, v: Viewport, src: PaintSource): void {
  for (const g of src.sheet.sparklineGroups) {
    for (const s of g.sparklines) {
      const r = rangeRect(v, { r1: s.location.row, c1: s.location.col, r2: s.location.row, c2: s.location.col });
      if (r.x > v.width || r.y > v.height || r.x + r.w < v.headerW || r.y + r.h < v.headerH) continue;
      drawSparkline(ctx, g, src.sparkValues(s.source), r);
    }
  }
}

function sparkColor(g: SparklineGroup, key: 'colorSeries' | 'colorNegative' | 'colorMarkers' | 'colorHigh' | 'colorLow', fallback: string): string {
  const c = g[key];
  return c?.rgb ? `#${c.rgb.slice(-6)}` : fallback;
}

function drawSparkline(ctx: CanvasRenderingContext2D, g: SparklineGroup, vals: (number | null)[], r: { x: number; y: number; w: number; h: number }): void {
  const nums = vals.filter((x): x is number => x !== null);
  if (!nums.length) return;
  const pad = 3;
  const min = Math.min(...nums, g.type === 'line' ? Infinity : 0);
  const max = Math.max(...nums, g.type === 'line' ? -Infinity : 0);
  const span = max - min || 1;
  const n = vals.length;
  const X = (i: number): number => r.x + pad + ((r.w - 2 * pad) * (n === 1 ? 0.5 : i / (n - 1)));
  const Y = (val: number): number => r.y + r.h - pad - ((val - min) / span) * (r.h - 2 * pad);
  const color = sparkColor(g, 'colorSeries', '#156082');
  if (g.type === 'line') {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, ((g.lineWeight ?? 0.75) * 4) / 3);
    ctx.beginPath();
    let started = false;
    vals.forEach((val, i) => {
      if (val === null) return;
      if (!started) ctx.moveTo(X(i), Y(val));
      else ctx.lineTo(X(i), Y(val));
      started = true;
    });
    ctx.stroke();
    const hi = Math.max(...nums);
    const lo = Math.min(...nums);
    vals.forEach((val, i) => {
      if (val === null) return;
      const mark = (g.high && val === hi) || (g.low && val === lo) || g.markers;
      if (!mark) return;
      ctx.fillStyle = g.high && val === hi ? sparkColor(g, 'colorHigh', '#C00000') : g.low && val === lo ? sparkColor(g, 'colorLow', '#C00000') : sparkColor(g, 'colorMarkers', color);
      ctx.fillRect(X(i) - 2, Y(val) - 2, 4, 4);
    });
  } else {
    const bw = Math.max(1, (r.w - 2 * pad) / n - 1);
    const zero = Y(Math.max(min, Math.min(max, 0)));
    vals.forEach((val, i) => {
      if (val === null) return;
      ctx.fillStyle = val < 0 ? sparkColor(g, 'colorNegative', '#C00000') : color;
      const x = r.x + pad + i * ((r.w - 2 * pad) / n);
      if (g.type === 'stacked') {
        const hh = (r.h - 2 * pad) / 2;
        ctx.fillRect(x, val >= 0 ? r.y + pad : r.y + pad + hh, bw, hh);
      } else {
        const y = Y(val);
        ctx.fillRect(x, Math.min(y, zero), bw, Math.max(1, Math.abs(zero - y)));
      }
    });
  }
}

function paintIndicators(ctx: CanvasRenderingContext2D, v: Viewport, L: Layout, src: PaintSource): void {
  const visible = (row: number, col: number): boolean => L.rows.some((b) => b.index === row) && L.cols.some((b) => b.index === col);
  const corner = (row: number, col: number, color: string): void => {
    if (!visible(row, col)) return;
    const r = rangeRect(v, { r1: row, c1: col, r2: row, c2: col });
    const s = 6 * v.zoom;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(r.x + r.w - s - 1, r.y);
    ctx.lineTo(r.x + r.w - 1, r.y);
    ctx.lineTo(r.x + r.w - 1, r.y + s);
    ctx.fill();
  };
  if (src.errorAt) {
    const s = 6 * v.zoom;
    ctx.fillStyle = '#107C41';
    for (const rb of L.rows) {
      for (const cb of L.cols) {
        if (!src.errorAt(rb.index, cb.index)) continue;
        const r = rangeRect(v, { r1: rb.index, c1: cb.index, r2: rb.index, c2: cb.index });
        ctx.beginPath();
        ctx.moveTo(r.x + 1, r.y + 1);
        ctx.lineTo(r.x + 1 + s, r.y + 1);
        ctx.lineTo(r.x + 1, r.y + 1 + s);
        ctx.fill();
      }
    }
  }
  for (const n of src.sheet.notes) corner(n.ref.row, n.ref.col, '#D13438');
  for (const c of src.sheet.threadedComments) corner(c.ref.row, c.ref.col, '#8764B8');
  for (const b of src.filterButtons) {
    if (!visible(b.row, b.col)) continue;
    const r = rangeRect(v, { r1: b.row, c1: b.col, r2: b.row, c2: b.col });
    const s = Math.min(r.h - 2, 17 * v.zoom);
    const x = r.x + r.w - s - 2;
    const y = r.y + r.h - s - 1;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = '#A0A0A0';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
    ctx.fillStyle = '#404040';
    ctx.beginPath();
    ctx.moveTo(x + s * 0.3, y + s * 0.4);
    ctx.lineTo(x + s * 0.7, y + s * 0.4);
    ctx.lineTo(x + s * 0.5, y + s * 0.62);
    ctx.fill();
    if (b.active) {
      ctx.fillRect(x + s * 0.2, y + s * 0.72, s * 0.6, 1.5);
    }
  }
}

/** Apercu des sauts de page : hors zone grise, zones d'impression cernees, sauts automatiques (tirets) et manuels (traits pleins), filigrane « Page n ». */
function paintBreaks(ctx: CanvasRenderingContext2D, v: Viewport, br: BreakInfo): void {
  const bw = v.width - v.headerW;
  const bh = v.height - v.headerH;
  const box = (a: CellRange) => ({ x1: colX(v, a.c1), x2: colX(v, a.c2 + 1), y1: rowY(v, a.r1), y2: rowY(v, a.r2 + 1) });
  ctx.save();
  ctx.beginPath();
  ctx.rect(v.headerW, v.headerH, bw, bh);
  ctx.clip();
  ctx.beginPath();
  ctx.rect(v.headerW, v.headerH, bw, bh);
  for (const a of br.areas) {
    const r = box(a);
    ctx.rect(r.x1, r.y1, r.x2 - r.x1, r.y2 - r.y1);
  }
  ctx.fillStyle = 'rgba(120,120,120,0.30)';
  ctx.fill('evenodd');
  // Filigrane « Page n » au centre de chaque page
  ctx.fillStyle = 'rgba(110,110,110,0.45)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const next = (list: number[], from: number, end: number): number => Math.min(end + 1, ...list.filter((k) => k > from));
  for (const l of br.labels) {
    const a = br.areas.find((k) => l.row >= k.r1 && l.row <= k.r2 && l.col >= k.c1 && l.col <= k.c2);
    if (!a) continue;
    const x1 = colX(v, l.col);
    const own = br.perArea[l.area] ?? { rows: [], cols: [] };
    const x2 = colX(v, next([...own.cols, ...br.manualCols], l.col, a.c2));
    const y1 = rowY(v, l.row);
    const y2 = rowY(v, next([...own.rows, ...br.manualRows], l.row, a.r2));
    const size = Math.max(14, Math.min(72, Math.min(x2 - x1, y2 - y1) / 4));
    ctx.font = `bold ${size}px "Segoe UI", sans-serif`;
    ctx.fillText(PS.pageN(l.n), (x1 + x2) / 2, (y1 + y2) / 2);
  }
  const line = (pick: (area: number) => { rows: number[]; cols: number[] }, dash: number[], width: number): void => {
    ctx.setLineDash(dash);
    ctx.lineWidth = width;
    ctx.beginPath();
    br.areas.forEach((a, i) => {
      const r = box(a);
      const { rows, cols } = pick(i);
      for (const k of rows) if (k > a.r1 && k <= a.r2) {
        const y = Math.round(rowY(v, k)) - 0.5;
        ctx.moveTo(r.x1, y);
        ctx.lineTo(r.x2, y);
      }
      for (const k of cols) if (k > a.c1 && k <= a.c2) {
        const x = Math.round(colX(v, k)) - 0.5;
        ctx.moveTo(x, r.y1);
        ctx.lineTo(x, r.y2);
      }
    });
    ctx.stroke();
  };
  ctx.strokeStyle = '#3B6FD8';
  line((i) => ({ rows: (br.perArea[i]?.rows ?? []).filter((k) => !br.manualRows.includes(k)), cols: (br.perArea[i]?.cols ?? []).filter((k) => !br.manualCols.includes(k)) }), [4, 3], 1);
  line(() => ({ rows: br.manualRows, cols: br.manualCols }), [], 2);
  ctx.setLineDash([]);
  ctx.lineWidth = 2;
  for (const a of br.areas) {
    const r = box(a);
    ctx.strokeRect(r.x1 + 0.5, r.y1 + 0.5, r.x2 - r.x1 - 1, r.y2 - r.y1 - 1);
  }
  ctx.restore();
}

function paintSelection(ctx: CanvasRenderingContext2D, v: Viewport, src: PaintSource): void {
  const { sel, palette: P } = src;
  const multi = sel.ranges.length > 1;
  const act = rangeRect(v, { r1: sel.active.row, c1: sel.active.col, r2: sel.active.row, c2: sel.active.col });
  const merge = mergeAt(src.sheet.merges, sel.active.row, sel.active.col);
  const actRect = merge ? rangeRect(v, merge) : act;
  ctx.fillStyle = P.selFill;
  for (const r of sel.ranges) {
    const rect = rangeRect(v, clampHuge(v, r));
    if (r.r1 === r.r2 && r.c1 === r.c2 && !multi) continue;
    if (P.suite) {
      suiteRange(ctx, P.suite, rect);
      continue;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.rect(actRect.x + actRect.w, actRect.y, -actRect.w, actRect.h);
    ctx.fill('evenodd');
    ctx.restore();
  }
  const ar = clampHuge(v, activeRange(sel));
  const rect = rangeRect(v, ar);
  ctx.strokeStyle = P.accent;
  if (P.suite) {
    const isRange = multi || ar.r1 !== ar.r2 || ar.c1 !== ar.c2;
    suiteCursor(ctx, P.suite, isRange ? actRect : rect, multi ? null : rect, isRange);
  } else if (!multi) {
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.round(rect.x) - 0.5, Math.round(rect.y) - 0.5, Math.round(rect.w), Math.round(rect.h));
    // Poignee de recopie
    const s = 6;
    ctx.fillStyle = P.canvas;
    ctx.fillRect(rect.x + rect.w - s / 2 - 1, rect.y + rect.h - s / 2 - 1, s + 2, s + 2);
    ctx.fillStyle = P.accent;
    ctx.fillRect(rect.x + rect.w - s / 2, rect.y + rect.h - s / 2, s, s);
  } else {
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(actRect.x) + 0.5, Math.round(actRect.y) + 0.5, Math.round(actRect.w) - 1, Math.round(actRect.h) - 1);
  }
  if (src.fillTarget) {
    const t = rangeRect(v, src.fillTarget);
    ctx.strokeStyle = '#7F7F7F';
    ctx.setLineDash([3, 2]);
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(t.x) + 0.5, Math.round(t.y) + 0.5, Math.round(t.w) - 1, Math.round(t.h) - 1);
    ctx.setLineDash([]);
  }
  if (src.copyRange) {
    const c = rangeRect(v, clampHuge(v, src.copyRange));
    ctx.strokeStyle = P.accent;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.lineDashOffset = -src.dash;
    ctx.strokeRect(Math.round(c.x) + 0.5, Math.round(c.y) + 0.5, Math.round(c.w) - 1, Math.round(c.h) - 1);
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }
}

/** Les selections de lignes/colonnes entieres sont bornees a la fenetre pour le dessin. */
function clampHuge(v: Viewport, r: CellRange): CellRange {
  if (!isFullCols(r) && !isFullRows(r)) return r;
  const extra = 4000;
  return {
    r1: r.r1, c1: r.c1,
    r2: isFullCols(r) ? Math.min(r.r2, r.r1 + extra) : r.r2,
    c2: isFullRows(r) ? Math.min(r.c2, r.c1 + 400) : r.c2,
  };
}

function paintRefs(ctx: CanvasRenderingContext2D, v: Viewport, src: PaintSource): void {
  for (const ref of src.refs) {
    if (ref.sheet && ref.sheet.toLowerCase() !== src.rangeSheetName.toLowerCase()) continue;
    const r = rangeRect(v, clampHuge(v, ref.range));
    ctx.fillStyle = `${ref.color}22`;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = ref.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.round(r.x) + 0.5, Math.round(r.y) + 0.5, Math.round(r.w) - 1, Math.round(r.h) - 1);
    for (const [cx, cy] of [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]] as const) {
      ctx.fillStyle = ref.color;
      ctx.fillRect(cx - 2.5, cy - 2.5, 5, 5);
    }
  }
}

/** Fleche vers (dependants) ou depuis (antecedents) une autre feuille : pointillee noire reliee a une icone de feuille. */
function paintExternalArrow(ctx: CanvasRenderingContext2D, cell: { x: number; y: number; w: number; h: number }, toSheet: boolean): void {
  const ix = Math.max(4, cell.x - 40);
  const iy = Math.max(4, cell.y - 30);
  const cx = cell.x + cell.w / 2;
  const cy = cell.y + cell.h / 2;
  const [fx, fy, tx, ty] = toSheet ? [cx, cy, ix + 7, iy + 6] : [ix + 7, iy + 6, cx, cy];
  ctx.save();
  ctx.strokeStyle = '#323130';
  ctx.fillStyle = '#323130';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.setLineDash([]);
  const ang = Math.atan2(ty - fy, tx - fx);
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx - 9 * Math.cos(ang - 0.4), ty - 9 * Math.sin(ang - 0.4));
  ctx.lineTo(tx - 9 * Math.cos(ang + 0.4), ty - 9 * Math.sin(ang + 0.4));
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(ix, iy, 14, 12);
  ctx.strokeRect(ix + 0.5, iy + 0.5, 13, 11);
  ctx.beginPath();
  ctx.moveTo(ix, iy + 4);
  ctx.lineTo(ix + 14, iy + 4);
  ctx.moveTo(ix + 5, iy);
  ctx.lineTo(ix + 5, iy + 12);
  ctx.stroke();
  ctx.restore();
}

function paintArrows(ctx: CanvasRenderingContext2D, v: Viewport, src: PaintSource): void {
  ctx.strokeStyle = '#2E5BC9';
  ctx.fillStyle = '#2E5BC9';
  ctx.lineWidth = 1.5;
  for (const a of src.arrows) {
    if (a.external) {
      paintExternalArrow(ctx, rangeRect(v, { r1: a.to.row, c1: a.to.col, r2: a.to.row, c2: a.to.col }), a.dir === 'dep');
      continue;
    }
    const f = rangeRect(v, a.from);
    const t = rangeRect(v, { r1: a.to.row, c1: a.to.col, r2: a.to.row, c2: a.to.col });
    if (a.from.r1 !== a.from.r2 || a.from.c1 !== a.from.c2) ctx.strokeRect(f.x + 1, f.y + 1, f.w - 2, f.h - 2);
    const x1 = f.x + Math.min(f.w, axisSize(v.cols, a.from.c1) * v.zoom) / 2;
    const y1 = f.y + Math.min(f.h, axisSize(v.rows, a.from.r1) * v.zoom) / 2;
    const x2 = t.x + t.w / 2;
    const y2 = t.y + t.h / 2;
    ctx.beginPath();
    ctx.arc(x1, y1, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const ang = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 9 * Math.cos(ang - 0.4), y2 - 9 * Math.sin(ang - 0.4));
    ctx.lineTo(x2 - 9 * Math.cos(ang + 0.4), y2 - 9 * Math.sin(ang + 0.4));
    ctx.fill();
  }
}

function paintHeaders(ctx: CanvasRenderingContext2D, v: Viewport, L: Layout, src: PaintSource): void {
  const { palette: P, sel } = src;
  const z = v.zoom;
  ctx.fillStyle = P.header;
  ctx.fillRect(0, 0, v.width, v.headerH);
  ctx.fillRect(0, 0, v.headerW, v.height);
  const rowSel = (r: number): 'full' | 'part' | null => {
    let part = false;
    for (const s of sel.ranges) {
      if (r < s.r1 || r > s.r2) continue;
      if (isFullRows(s)) return 'full';
      part = true;
    }
    return part ? 'part' : null;
  };
  const colSel = (c: number): 'full' | 'part' | null => {
    let part = false;
    for (const s of sel.ranges) {
      if (c < s.c1 || c > s.c2) continue;
      if (isFullCols(s)) return 'full';
      part = true;
    }
    return part ? 'part' : null;
  };
  ctx.font = `${(11 * z).toFixed(1)}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const drawBand = (b: Band, horizontal: boolean, label: string, state: 'full' | 'part' | null): void => {
    const x = horizontal ? b.pos : 0;
    const y = horizontal ? 0 : b.pos;
    const w = horizontal ? b.size : v.headerW;
    const h = horizontal ? v.headerH : b.size;
    if (P.suite) {
      suiteBand(ctx, P.suite, x, y, w, h, label, horizontal, state !== null, z);
      return;
    }
    if (state) {
      ctx.fillStyle = state === 'full' ? P.headerFull : P.headerSel;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = P.accent;
      if (horizontal) ctx.fillRect(x, y + h - 2, w, 2);
      else ctx.fillRect(x + w - 2, y, 2, h);
    }
    ctx.fillStyle = state === 'full' ? '#FFFFFF' : state ? P.headerSelText : P.headerText;
    ctx.fillText(label, x + w / 2, y + h / 2 + 0.5);
    ctx.fillStyle = P.headerLine;
    if (horizontal) ctx.fillRect(Math.round(x + w) - 1, y, 1, h);
    else ctx.fillRect(x, Math.round(y + h) - 1, w, 1);
  };
  ctx.save();
  ctx.beginPath();
  ctx.rect(v.headerW, 0, v.width, v.headerH);
  ctx.clip();
  for (const b of L.cols) drawBand(b, true, columnName(b.index), colSel(b.index));
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, v.headerH, v.headerW, v.height);
  ctx.clip();
  for (const b of L.rows) drawBand(b, false, String(b.index + 1), rowSel(b.index));
  ctx.restore();
  if (P.suite) {
    suiteCorner(ctx, P.suite, v);
    ctx.textAlign = 'start';
    return;
  }
  ctx.fillStyle = P.headerLine;
  ctx.fillRect(0, v.headerH - 1, v.width, 1);
  ctx.fillRect(v.headerW - 1, 0, 1, v.height);
  // Coin « Selectionner tout » : triangle
  ctx.fillStyle = '#B4B4B4';
  ctx.beginPath();
  ctx.moveTo(v.headerW - 4, v.headerH - 4);
  ctx.lineTo(v.headerW - 4, v.headerH - 4 - 10 * z);
  ctx.lineTo(v.headerW - 4 - 10 * z, v.headerH - 4);
  ctx.fill();
  ctx.textAlign = 'start';
}
