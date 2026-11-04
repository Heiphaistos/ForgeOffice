// Impression : pagination de la zone d'impression (taille de papier, orientation, marges, echelle, ajustement),
// apercu dans le Backstage et document imprime (pages HTML, masque a l'ecran).
import type { CSSProperties } from 'react';
import { usedRange, type CellRange, type Sheet, type Workbook } from '@forgeoffice/xlsx';
import { axisSize, colAxis, rowAxis } from '../logic/geometry.ts';
import { cellLook } from '../logic/look.ts';
import type { Scalar } from '@forgeoffice/formulas';
import { inheritedStyle } from '../logic/styles.ts';

export interface PrintPage {
  rows: number[];
  cols: number[];
}

const PAPER: Readonly<Record<number, [number, number]>> = { 9: [794, 1123], 1: [816, 1056] };

export function pageSize(sheet: Sheet): { w: number; h: number } {
  const [w, h] = PAPER[sheet.pageSetup.paperSize ?? 9] ?? [794, 1123];
  return sheet.pageSetup.orientation === 'landscape' ? { w: h, h: w } : { w, h };
}

/** Zone imprimee : zone d'impression definie, sinon plage utilisee. */
export function printRange(sheet: Sheet, selection?: CellRange): CellRange | null {
  return selection ?? sheet.pageSetup.printArea?.[0] ?? usedRange(sheet) ?? null;
}

/** Decoupe en pages (bas puis droite) ; renvoie aussi l'echelle appliquee. */
export function paginate(sheet: Sheet, range: CellRange): { pages: PrintPage[]; scale: number } {
  const ps = sheet.pageSetup;
  const { w, h } = pageSize(sheet);
  const m = ps.margins;
  const availW = w - (m.left + m.right) * 96;
  const availH = h - (m.top + m.bottom) * 96;
  const rows = rowAxis(sheet);
  const cols = colAxis(sheet);
  const colList: number[] = [];
  const rowList: number[] = [];
  let totalW = 0;
  let totalH = 0;
  for (let c = range.c1; c <= range.c2 && colList.length < 2000; c++) if (axisSize(cols, c) > 0) { colList.push(c); totalW += axisSize(cols, c); }
  for (let r = range.r1; r <= range.r2 && rowList.length < 20000; r++) if (axisSize(rows, r) > 0) { rowList.push(r); totalH += axisSize(rows, r); }
  let scale = (ps.scale ?? 100) / 100;
  if (ps.fitToPage) {
    const sw = ps.fitToWidth ? (availW * ps.fitToWidth) / Math.max(1, totalW) : Infinity;
    const sh = ps.fitToHeight ? (availH * ps.fitToHeight) / Math.max(1, totalH) : Infinity;
    scale = Math.min(1, sw, sh);
  }
  const split = (list: number[], size: (i: number) => number, avail: number, breaks: number[]): number[][] => {
    const out: number[][] = [];
    let cur: number[] = [];
    let used = 0;
    for (const i of list) {
      const s = size(i) * scale;
      if (cur.length && (used + s > avail || breaks.includes(i - 1))) {
        out.push(cur);
        cur = [];
        used = 0;
      }
      cur.push(i);
      used += s;
    }
    if (cur.length) out.push(cur);
    return out;
  };
  const rowChunks = split(rowList, (i) => axisSize(rows, i), availH, ps.rowBreaks);
  const colChunks = split(colList, (i) => axisSize(cols, i), availW, ps.colBreaks);
  const pages: PrintPage[] = [];
  if (ps.pageOrder === 'overThenDown') for (const r of rowChunks) for (const c of colChunks) pages.push({ rows: r, cols: c });
  else for (const c of colChunks) for (const r of rowChunks) pages.push({ rows: r, cols: c });
  return { pages, scale };
}

/** Lignes de sauts de page automatiques (pour l'apercu des sauts de page dans la grille). */
export function pageBreakLines(sheet: Sheet): { rows: number[]; cols: number[] } | null {
  const range = printRange(sheet);
  if (!range) return null;
  const { pages } = paginate(sheet, range);
  const rows = new Set<number>();
  const cols = new Set<number>();
  for (const p of pages) {
    const lastR = p.rows[p.rows.length - 1];
    const lastC = p.cols[p.cols.length - 1];
    if (lastR !== undefined) rows.add(lastR + 1);
    if (lastC !== undefined) cols.add(lastC + 1);
  }
  return { rows: [...rows], cols: [...cols] };
}

export interface PageViewProps {
  wb: Workbook;
  sheet: Sheet;
  page: PrintPage;
  scale: number;
  value: (row: number, col: number) => Scalar;
  zoom?: number;
}

/** Une page imprimee (tableau HTML fidele a la grille). */
export function PageView({ wb, sheet, page, scale, value, zoom = 1 }: PageViewProps) {
  const { w, h } = pageSize(sheet);
  const m = sheet.pageSetup.margins;
  const rows = rowAxis(sheet);
  const cols = colAxis(sheet);
  const grid = !!sheet.pageSetup.printGridLines;
  const style: CSSProperties = { width: w * zoom, height: h * zoom };
  const borderCss = (e: { style: string; color: string } | undefined): string | undefined =>
    e ? `${e.style === 'medium' || e.style === 'thick' ? 2 : 1}px ${e.style === 'double' ? 'double' : e.style.includes('ash') || e.style === 'dotted' || e.style === 'hair' ? 'dashed' : 'solid'} ${e.color}` : undefined;
  return (
    <div className="xl-page" style={style}>
      <div style={{ position: 'absolute', left: m.left * 96 * zoom, top: m.top * 96 * zoom, transform: `scale(${scale * zoom})`, transformOrigin: '0 0' }}>
        <table className={`xl-page__table${grid ? ' has-grid' : ''}`}>
          <colgroup>{page.cols.map((c) => <col key={c} style={{ width: axisSize(cols, c) }} />)}</colgroup>
          <tbody>
            {page.rows.map((r) => (
              <tr key={r} style={{ height: axisSize(rows, r) }}>
                {page.cols.map((c) => {
                  const cell = sheet.cells.get(r)?.get(c);
                  const look = cellLook(wb, cell, value(r, c), { colPx: axisSize(cols, c), showZeros: sheet.view.showZeros, ...(cell ? {} : { styleId: inheritedStyle(sheet, r, c) ?? 0 }) });
                  return (
                    <td key={c} style={{
                      font: look.font, color: look.color, background: look.fill ?? undefined, textAlign: look.align === 'fill' || look.align === 'justify' ? 'left' : look.align,
                      verticalAlign: look.valign === 'center' ? 'middle' : look.valign, whiteSpace: look.wrap ? 'pre-wrap' : 'nowrap',
                      borderTop: borderCss(look.borders.top), borderBottom: borderCss(look.borders.bottom), borderLeft: borderCss(look.borders.left), borderRight: borderCss(look.borders.right),
                      textDecoration: look.underline ? 'underline' : look.strike ? 'line-through' : undefined,
                    }}>{look.text}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
