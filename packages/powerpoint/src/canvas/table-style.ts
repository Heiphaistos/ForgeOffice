// Styles de tableau predefinis d'Office (rendu) : Style moyen 2 (accentuations 1 a 6), Style clair 1, Style a theme 1,
// Sans style. Les GUID sont ceux de PowerPoint ; un style inconnu est rendu comme Style moyen 2 - Accentuation 1.
import type { Color, Fill, Line, Table } from '@forgeoffice/pptx';

type Accent = 'accent1' | 'accent2' | 'accent3' | 'accent4' | 'accent5' | 'accent6' | 'tx1';
type Family = 'medium2' | 'light1' | 'themed1' | 'none' | 'grid' | 'medium4';

export interface TableStyleInfo {
  id: string;
  family: Family;
  accent: Accent;
}

/** Styles proposes par la galerie (Création de tableau > Styles de tableau). */
export const TABLE_STYLES: readonly TableStyleInfo[] = [
  { id: '{2D5ABB26-0587-4C30-8999-92F81FD0307C}', family: 'none', accent: 'tx1' },
  { id: '{5940675A-B579-460E-94D1-54222C63F5DA}', family: 'grid', accent: 'tx1' },
  { id: '{9D7B26C5-4107-4FEC-AEDC-1716B250A1EF}', family: 'light1', accent: 'tx1' },
  { id: '{3B4B98B0-60AC-42C2-AFA5-B58CD77FA1E5}', family: 'light1', accent: 'accent1' },
  { id: '{0E3FDE45-AF77-4B5C-9715-49D594BDF05E}', family: 'light1', accent: 'accent2' },
  { id: '{C083E6E3-FA7D-4D7B-A595-EF9225AFEA82}', family: 'light1', accent: 'accent3' },
  { id: '{D27102A9-8310-4765-A935-A1911B00CA55}', family: 'light1', accent: 'accent4' },
  { id: '{5FD0F851-EC5A-4D38-B0AD-8093EC10F338}', family: 'light1', accent: 'accent5' },
  { id: '{68D230F3-CF80-4859-8CE7-A43EE81993B5}', family: 'light1', accent: 'accent6' },
  { id: '{073A0DAA-6AF3-43AB-8588-CEC1D06C72B9}', family: 'medium2', accent: 'tx1' },
  { id: '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}', family: 'medium2', accent: 'accent1' },
  { id: '{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}', family: 'medium2', accent: 'accent2' },
  { id: '{F5AB1C69-6EDB-4FF4-983F-18BD219EF322}', family: 'medium2', accent: 'accent3' },
  { id: '{00A15C55-8517-42AA-B614-E9B94910E393}', family: 'medium2', accent: 'accent4' },
  { id: '{7DF18680-E054-41AD-8BC1-D1AEF772440D}', family: 'medium2', accent: 'accent5' },
  { id: '{93296810-A885-4BE3-A3E7-6D5BEEA58F35}', family: 'medium2', accent: 'accent6' },
  { id: '{3C2FFA5D-87B4-456A-9821-1D502468CF0F}', family: 'themed1', accent: 'accent1' },
  { id: '{284E427A-3D55-4303-BF80-6455036E1DE7}', family: 'themed1', accent: 'accent2' },
  { id: '{69C7853C-536D-4A76-A0AE-DD22124D55A5}', family: 'themed1', accent: 'accent3' },
];

const DEFAULT = TABLE_STYLES.find((s) => s.id === '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}') as TableStyleInfo;

export function tableStyleInfo(id: string | undefined): TableStyleInfo {
  if (!id) return TABLE_STYLES[0] as TableStyleInfo;
  return TABLE_STYLES.find((s) => s.id.toUpperCase() === id.toUpperCase()) ?? DEFAULT;
}

const sc = (value: Accent | 'lt1' | 'dk1', mods?: Array<[string, number]>): Color => ({ type: 'scheme', value: value === 'tx1' ? 'dk1' : value, mods: mods?.map(([name, val]) => ({ name, val })) });
const solid = (color: Color): Fill => ({ type: 'solid', color });
const line = (color: Color, width = 1): Line => ({ width, fill: solid(color) });

export interface CellLook {
  fill?: Fill;
  color?: Color;
  bold?: boolean;
  top?: Line;
  bottom?: Line;
  left?: Line;
  right?: Line;
}

/** Aspect d'une cellule selon le style et les options (ligne d'en-tete, lignes a bandes...). */
export function cellLook(table: Table, row: number, col: number): CellLook {
  const style = tableStyleInfo(table.styleId);
  const a = style.accent;
  const rows = table.rows.length;
  const cols = table.columns.length;
  const header = !!table.firstRow && row === 0;
  const total = !!table.lastRow && row === rows - 1 && rows > 1;
  const firstCol = !!table.firstCol && col === 0;
  const lastCol = !!table.lastCol && col === cols - 1 && cols > 1;
  const bodyIndex = row - (table.firstRow ? 1 : 0);
  const colIndex = col - (table.firstCol ? 1 : 0);
  const band = (table.bandRow && bodyIndex % 2 === 0) || (table.bandCol && colIndex % 2 === 0);
  switch (style.family) {
    case 'none':
      return { color: sc('dk1'), bold: header || total };
    case 'grid': {
      const g = line(sc('dk1'));
      return { color: sc('dk1'), bold: header || total, top: g, bottom: g, left: g, right: g };
    }
    case 'light1': {
      const accent = sc(a);
      const look: CellLook = { color: sc('dk1'), bold: header || total || firstCol || lastCol };
      if (header) look.bottom = line(accent);
      if (row === 0) look.top = line(accent);
      if (row === rows - 1) look.bottom = line(accent);
      if (total) look.top = line(accent);
      if (!header && !total && band) look.fill = solid(sc(a, [['alpha', 20000]]));
      return look;
    }
    case 'themed1': {
      const accent = sc(a);
      const white = line(sc('lt1'));
      if (header || total) return { fill: solid(accent), color: sc('lt1'), bold: true, top: white, bottom: white, left: white, right: white };
      if (firstCol || lastCol) return { fill: solid(accent), color: sc('lt1'), bold: true, top: white, bottom: white, left: white, right: white };
      return { fill: solid(sc(a, band ? [['tint', 40000]] : [['tint', 20000]])), color: sc('dk1'), top: white, bottom: white, left: white, right: white };
    }
    case 'medium4':
    case 'medium2': {
      const white = line(sc('lt1'));
      if (header) return { fill: solid(sc(a)), color: sc('lt1'), bold: true, top: white, bottom: line(sc('lt1'), 3), left: white, right: white };
      if (total) return { fill: solid(sc(a)), color: sc('lt1'), bold: true, top: line(sc('lt1'), 3), bottom: white, left: white, right: white };
      if (firstCol || lastCol) return { fill: solid(sc(a)), color: sc('lt1'), bold: true, top: white, bottom: white, left: white, right: white };
      return { fill: solid(sc(a, band ? [['tint', 40000]] : [['tint', 20000]])), color: sc('dk1'), top: white, bottom: white, left: white, right: white };
    }
  }
}
