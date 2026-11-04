// Tableaux (Mettre sous forme de tableau) : creation, styles integres Clair / Moyen / Fonce calcules a partir
// des couleurs du theme, ligne de total, bandes, et apparence par cellule.
import { resolveColor, type CellRange, type Sheet, type Table, type TableStyleInfo, type Workbook } from '@forgeoffice/xlsx';
import type { TableLook } from './look.ts';
import type { ValueAt } from './data.ts';

/** Noms des styles proposes dans la galerie (comme Excel : 21 clairs, 28 moyens, 11 fonces). */
export const TABLE_STYLE_NAMES: readonly string[] = [
  ...Array.from({ length: 21 }, (_, i) => `TableStyleLight${i + 1}`),
  ...Array.from({ length: 28 }, (_, i) => `TableStyleMedium${i + 1}`),
  ...Array.from({ length: 11 }, (_, i) => `TableStyleDark${i + 1}`),
];

function tint(hex: string, t: number): string {
  const c = [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  return `#${c.map((v) => Math.round(v + (255 - v) * t).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function shadeHex(hex: string, s: number): string {
  const c = [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  return `#${c.map((v) => Math.round(v * (1 - s)).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export interface TableStyleParts {
  header: TableLook;
  band1: TableLook;
  band2: TableLook;
  total: TableLook;
  first: TableLook;
}

/** Palette d'un style integre : famille + variante (0 : neutre, 1..6 : accents du theme). */
export function tableStyleParts(wb: Workbook, name: string): TableStyleParts {
  const m = name.match(/^TableStyle(Light|Medium|Dark)(\d+)$/);
  const family = m?.[1] ?? 'Medium';
  const n = Number(m?.[2] ?? 2) - 1;
  const variant = n % 7;
  const group = Math.floor(n / 7);
  const a = variant === 0 ? (family === 'Dark' ? '404040' : '000000') : resolveColor(wb, { theme: 3 + variant }) ?? '4472C4';
  const line = { style: 'thin' as const, color: variant === 0 ? '#7F7F7F' : `#${a}` };
  if (family === 'Light') {
    if (group === 0) return { header: { bold: true, bottom: line, top: line }, band1: { fill: tint(a, 0.8) }, band2: {}, total: { bold: true, top: { style: 'double', color: line.color } }, first: { bold: true } };
    if (group === 1) return { header: { bold: true, fill: `#${a}`, color: '#FFFFFF' }, band1: {}, band2: {}, total: { bold: true, top: { style: 'double', color: line.color } }, first: { bold: true } };
    return { header: { bold: true, bottom: line }, band1: { fill: tint(a, 0.8), top: { style: 'thin', color: tint(a, 0.4) } }, band2: { top: { style: 'thin', color: tint(a, 0.4) } }, total: { bold: true, top: line }, first: { bold: true } };
  }
  if (family === 'Medium') {
    if (group === 0) return { header: { bold: true, fill: `#${a}`, color: '#FFFFFF' }, band1: { fill: tint(a, 0.8) }, band2: {}, total: { bold: true, top: { style: 'double', color: `#${a}` } }, first: { bold: true } };
    if (group === 1) return { header: { bold: true, fill: `#${a}`, color: '#FFFFFF' }, band1: { fill: tint(a, 0.6) }, band2: { fill: tint(a, 0.8) }, total: { bold: true, fill: `#${a}`, color: '#FFFFFF' }, first: { bold: true } };
    if (group === 2) return { header: { bold: true, fill: shadeHex(a, 0.25), color: '#FFFFFF' }, band1: { fill: tint(a, 0.7) }, band2: { fill: tint(a, 0.85) }, total: { bold: true, top: { style: 'medium', color: '#000000' } }, first: { bold: true } };
    return { header: { bold: true, fill: '#000000', color: '#FFFFFF' }, band1: { fill: tint(a, 0.6) }, band2: { fill: tint(a, 0.8) }, total: { bold: true, top: { style: 'double', color: '#000000' } }, first: { bold: true } };
  }
  return { header: { bold: true, fill: '#000000', color: '#FFFFFF' }, band1: { fill: shadeHex(a, 0.25), color: '#FFFFFF' }, band2: { fill: `#${a}`, color: '#FFFFFF' }, total: { bold: true, fill: shadeHex(a, 0.5), color: '#FFFFFF' }, first: { bold: true, color: '#FFFFFF' } };
}

/** Tableau contenant la cellule. */
export function tableAt(sh: Sheet, row: number, col: number): Table | undefined {
  return sh.tables.find((t) => row >= t.ref.r1 && row <= t.ref.r2 && col >= t.ref.c1 && col <= t.ref.c2);
}

export function defaultTableStyle(): TableStyleInfo {
  return { name: 'TableStyleMedium2', showFirstColumn: false, showLastColumn: false, showRowStripes: true, showColumnStripes: false };
}

/** Apparence de la cellule selon le style de son tableau. */
export function tableLook(t: Table, row: number, col: number, p: TableStyleParts): TableLook {
  const style = t.style ?? defaultTableStyle();
  if (t.headerRowCount > 0 && row === t.ref.r1) return p.header;
  if (t.totalsRowCount > 0 && row === t.ref.r2) return p.total;
  const firstData = t.ref.r1 + t.headerRowCount;
  const idx = style.showColumnStripes ? col - t.ref.c1 : row - firstData;
  const banded = style.showRowStripes || style.showColumnStripes ? (idx % 2 === 0 ? p.band1 : p.band2) : {};
  if (style.showFirstColumn && col === t.ref.c1) return { ...banded, ...p.first };
  if (style.showLastColumn && col === t.ref.c2) return { ...banded, bold: true };
  return banded;
}

/** Nom de tableau libre : Tableau1, Tableau2... */
export function nextTableName(wb: Workbook): string {
  const taken = new Set(wb.sheets.flatMap((s) => s.tables.map((t) => t.name.toLowerCase())));
  let i = 1;
  while (taken.has(`tableau${i}`)) i++;
  return `Tableau${i}`;
}

/** Cree un tableau sur la plage (en-tetes « Colonne1 » inseres au-dessus si la plage n'en a pas). */
export function makeTable(wb: Workbook, range: CellRange, hasHeader: boolean, styleName: string, valueAt: ValueAt, columnLabel: (i: number) => string): Table {
  const name = nextTableName(wb);
  const id = Math.max(0, ...wb.sheets.flatMap((s) => s.tables.map((t) => t.id))) + 1;
  const names: string[] = [];
  for (let i = 0; i <= range.c2 - range.c1; i++) {
    const v = hasHeader ? valueAt(range.r1, range.c1 + i) : null;
    let n = v === null || v === '' ? columnLabel(i + 1) : String(v);
    while (names.some((x) => x.toLowerCase() === n.toLowerCase())) n = `${n}2`;
    names.push(n);
  }
  return {
    id, name, displayName: name, ref: range, headerRowCount: 1, totalsRowShown: false, totalsRowCount: 0,
    columns: names.map((n, i) => ({ id: i + 1, name: n })),
    style: { ...defaultTableStyle(), name: styleName },
    autoFilter: { ref: range, columns: [] },
  };
}

/** Formule de la ligne Total d'une colonne (SOUS.TOTAL 109 = somme des lignes visibles). */
export const TOTAL_CODES = { sum: 109, average: 101, count: 103, countNums: 102, max: 104, min: 105, stdDev: 107, var: 110 } as const;
