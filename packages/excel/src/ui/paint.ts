// Dessin de la grille sur canvas : remplissages, quadrillage, bordures, texte (debordement, renvoi a la ligne),
// fusions, mise en forme conditionnelle, sparklines, indicateurs, selection, references colorees, en-tetes.
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
  arrows: readonly { from: CellRange; to: { row: number; col: number } }[];
  pageBreaks: { rows: number[]; cols: number[] } | null;
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
      if (it.look.fill) {
        ctx.fillStyle = it.look.fill;
        ctx.fillRect(it.x, it.y, it.w, it.h);
      }
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
          ctx.fillStyle = it.look.fill;
          ctx.fillRect(it.x - 1, it.y - 1, it.w + 1, it.h + 1);
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
    const pad = 3 * z;
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
    if (look.numeric && width > avail && !look.wrap) {
      text = '#'.repeat(Math.max(1, Math.floor(avail / Math.max(1, ctx.measureText('#').width))));
      width = ctx.measureText(text).width;
    }
    const lineH = look.fontPx * z * 1.2;
    let lines = [text];
    if (look.wrap) lines = wrapText(ctx, text, Math.max(4, avail));
    else if (text.includes('\n')) lines = [text.replace(/\n/g, ' ')];
    // Zone de debordement
    let clipX = it.x;
    let clipW = it.w;
    if (!look.wrap && !it.merged && width > avail && !look.numeric && (look.align === 'left' || look.align === 'right' || look.align === 'center')) {
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
    const total = lines.length * lineH;
    let y = look.valign === 'top' ? it.y + pad : look.valign === 'center' ? it.y + (it.h - total) / 2 : it.y + it.h - total - pad * 0.6;
    if (look.rotation && look.rotation !== 255) {
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
    for (const l of lines) {
      const w = ctx.measureText(l).width;
      const indent = look.indent * 9 * z;
      let x: number;
      if (look.align === 'right') x = it.x + it.w - pad - w - indent;
      else if (look.align === 'center') x = it.x + (it.w - w) / 2;
      else x = it.x + pad + iconW + indent;
      if (look.align === 'fill' && w > 0) {
        let s = l;
        while (ctx.measureText(s + l).width <= it.w - 2 * pad) s += l;
        ctx.fillText(s, it.x + pad, y + lineH * 0.1);
      } else ctx.fillText(l, x, y + lineH * 0.1);
      if (look.underline || look.strike) {
        ctx.fillRect(x, look.underline ? y + lineH * 0.95 : y + lineH * 0.55, w, Math.max(1, z));
      }
      y += lineH;
    }
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

function paintBreaks(ctx: CanvasRenderingContext2D, v: Viewport, br: { rows: number[]; cols: number[] }): void {
  ctx.strokeStyle = '#3B6FD8';
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const r of br.rows) {
    const y = Math.round(rowY(v, r)) - 0.5;
    if (y < v.headerH || y > v.height) continue;
    ctx.moveTo(v.headerW, y);
    ctx.lineTo(v.width, y);
  }
  for (const c of br.cols) {
    const x = Math.round(colX(v, c)) - 0.5;
    if (x < v.headerW || x > v.width) continue;
    ctx.moveTo(x, v.headerH);
    ctx.lineTo(x, v.height);
  }
  ctx.stroke();
  ctx.setLineDash([]);
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
  if (!multi) {
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

function paintArrows(ctx: CanvasRenderingContext2D, v: Viewport, src: PaintSource): void {
  ctx.strokeStyle = '#2E5BC9';
  ctx.fillStyle = '#2E5BC9';
  ctx.lineWidth = 1.5;
  for (const a of src.arrows) {
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
