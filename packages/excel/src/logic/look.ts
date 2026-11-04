// Apparence d'une cellule (sans DOM) : texte formate en francais, couleurs, police, alignement, bordures,
// avec la mise en forme conditionnelle et le style de tableau superposes.
import { FormulaError, formatValueDetailed, toLocalized, type Scalar } from '@forgeoffice/formulas';
import {
  cssFontFamily, resolveColor, type Border, type BorderEdge, type Cell, type Color, type Fill, type HorizontalAlignment, type Workbook,
} from '@forgeoffice/xlsx';
import type { CfOverlay } from './condfmt.ts';
import { cellFormat, numFmtOf } from './styles.ts';

export interface EdgeLook {
  style: BorderEdge['style'];
  color: string;
}

export interface CellLook {
  text: string;
  /** Couleur du texte « #RRGGBB ». */
  color: string;
  fill: string | null;
  align: 'left' | 'center' | 'right' | 'fill' | 'justify';
  valign: 'top' | 'center' | 'bottom';
  /** Police CSS complete (« italic 700 14.67px Calibri »). */
  font: string;
  fontPx: number;
  underline: boolean;
  strike: boolean;
  wrap: boolean;
  indent: number;
  rotation: number;
  /** Nombre (remplace par « ##### » s'il ne tient pas). */
  numeric: boolean;
  borders: { top?: EdgeLook; bottom?: EdgeLook; left?: EdgeLook; right?: EdgeLook };
  cf: CfOverlay | null;
}

export interface TableLook {
  fill?: string;
  color?: string;
  bold?: boolean;
  top?: EdgeLook;
  bottom?: EdgeLook;
}

export function colorHex(wb: Workbook, c: Color | undefined, fallback: string): string {
  const v = resolveColor(wb, c);
  return v ? `#${v}` : fallback;
}

function fillHex(wb: Workbook, f: Fill | undefined): string | null {
  if (!f) return null;
  if (f.type === 'gradient') {
    const s = f.stops[0];
    return s ? colorHex(wb, s.color, '#FFFFFF') : null;
  }
  if (f.pattern === 'none') return null;
  if (f.pattern === 'solid') return colorHex(wb, f.fg ?? f.bg, '#FFFFFF');
  // Motifs : approximation par melange de la couleur de motif et du fond.
  return colorHex(wb, f.fg, '#C0C0C0');
}

function edge(wb: Workbook, e: BorderEdge | undefined): EdgeLook | undefined {
  return e ? { style: e.style, color: colorHex(wb, e.color, '#000000') } : undefined;
}

export interface LookOptions {
  /** Largeur de la colonne (pixels a 100 %) : choisit la precision du format Standard. */
  colPx: number;
  showFormulas?: boolean;
  showZeros?: boolean;
  cf?: CfOverlay | null;
  table?: TableLook | null;
  /** Style effectif (style de ligne/colonne pour une cellule vide). */
  styleId?: number;
}

const ALIGN: Readonly<Record<HorizontalAlignment, CellLook['align'] | null>> = {
  general: null, left: 'left', center: 'center', right: 'right', fill: 'fill', justify: 'justify',
  centerContinuous: 'center', distributed: 'center',
};

/** Texte affiche d'une valeur selon un format (francais). */
export function displayText(wb: Workbook, value: Scalar, code: string, colPx = 64): { text: string; color?: string } {
  const r = formatValueDetailed(value, code, 'fr-FR', { dateSystem: wb.date1904 ? 1904 : 1900, generalWidth: Math.max(1, Math.floor((colPx - 5) / 7)) });
  return r.color ? { text: r.text, color: r.color } : { text: r.text };
}

export function cellLook(wb: Workbook, cell: Cell | undefined, value: Scalar, opt: LookOptions): CellLook {
  const styleId = cell?.styleId ?? opt.styleId ?? 0;
  const xf = cellFormat(wb, styleId);
  const font = wb.styles.fonts[xf.fontId] ?? wb.styles.fonts[0] ?? { name: 'Aptos Narrow', size: 11 };
  const cf = opt.cf ?? null;
  const t = opt.table ?? null;
  const code = cf?.numFmt ?? numFmtOf(wb, styleId);
  let text = '';
  let color: string | undefined;
  if (opt.showFormulas && cell?.formula !== undefined) text = toLocalized(`=${cell.formula}`, 'fr');
  else if (value === 0 && opt.showZeros === false) text = '';
  else {
    const r = displayText(wb, value, code, opt.colPx);
    text = r.text;
    color = r.color;
  }
  const numeric = typeof value === 'number' && !(opt.showFormulas && cell?.formula !== undefined);
  const align = ALIGN[xf.alignment?.horizontal ?? 'general'] ??
    (opt.showFormulas && cell?.formula !== undefined ? 'left'
      : typeof value === 'number' ? 'right'
      : typeof value === 'boolean' || value instanceof FormulaError ? 'center' : 'left');
  const v = xf.alignment?.vertical;
  const valign = v === 'top' ? 'top' : v === 'center' || v === 'justify' || v === 'distributed' ? 'center' : 'bottom';
  const bold = cf?.bold ?? t?.bold ?? font.bold ?? false;
  const italic = cf?.italic ?? font.italic ?? false;
  const px = (font.size * 4) / 3;
  const b: Border = wb.styles.borders[xf.borderId] ?? {};
  const borders: CellLook['borders'] = {};
  const top = edge(wb, b.top) ?? t?.top;
  const bottom = edge(wb, b.bottom) ?? t?.bottom;
  const left = edge(wb, b.left);
  const right = edge(wb, b.right);
  if (top) borders.top = top;
  if (bottom) borders.bottom = bottom;
  if (left) borders.left = left;
  if (right) borders.right = right;
  const hasOwnColor = font.color && !font.color.auto && !(font.color.theme === 1 && !font.color.tint);
  return {
    text,
    color: color ?? (cf?.fontColor ? `#${cf.fontColor}` : hasOwnColor ? colorHex(wb, font.color, '#000000') : t?.color ?? colorHex(wb, font.color, '#000000')),
    fill: cf?.fill ? `#${cf.fill}` : fillHex(wb, wb.styles.fills[xf.fillId]) ?? t?.fill ?? null,
    align,
    valign,
    font: `${italic ? 'italic ' : ''}${bold ? '700 ' : ''}${px.toFixed(2)}px ${cssFontFamily(font.name)}`,
    fontPx: px,
    underline: cf?.underline ?? !!font.underline,
    strike: cf?.strike ?? !!font.strike,
    wrap: !!xf.alignment?.wrapText,
    indent: xf.alignment?.indent ?? 0,
    rotation: xf.alignment?.textRotation ?? 0,
    numeric,
    borders,
    cf,
  };
}
