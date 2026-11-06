// Application hote du moteur de formules (EngineOptions.host) : styles de cellule, largeur de colonne, nom du fichier,
// systeme, tableaux croises. Les fonctions CELLULE, INFORMATIONS et LIREDONNEESTABCROISDYNAMIQUE lisent le classeur courant.
import type { CellStyleInfo, HostInfo, Scalar } from '@forgeoffice/formulas';
import type { Workbook } from '@forgeoffice/xlsx';
import type { PivotLabels } from './pivot.ts';
import { pivotAtCell, pivotLookup, type PivotSnapshot } from './pivot-lookup.ts';
import { cellFormat, numFmtOf, styleAt } from './styles.ts';

/** Etat de l'application lu par l'hote (mis a jour par l'interface). */
export interface HostState {
  /** Chemin complet du classeur ; vide si non enregistre. */
  fileName: string;
  pivots: () => readonly PivotSnapshot[];
  labels: PivotLabels;
}

const HORIZONTAL = new Set(['general', 'left', 'right', 'center', 'fill', 'justify', 'distributed', 'centerContinuous']);

/** Version du systeme pour INFORMATIONS("osversion"), d'apres l'agent utilisateur du navigateur ou de la coquille. */
export function osVersionOf(userAgent: string | undefined): string | undefined {
  if (!userAgent) return undefined;
  if (/Windows/i.test(userAgent)) return 'Windows (64-bit) NT 10.00';
  if (/Macintosh|Mac OS/i.test(userAgent)) return 'Macintosh (64-bit)';
  if (/Android/i.test(userAgent)) return 'Android (64-bit)';
  if (/Linux/i.test(userAgent)) return 'Linux (64-bit)';
  return undefined;
}

/** Dossier d'un chemin (separateurs / ou \). */
export function directoryOf(path: string): string {
  const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf(String.fromCharCode(92)));
  return i < 0 ? '' : path.slice(0, i);
}

export function makeHost(workbook: () => Workbook | null, state: HostState, userAgent?: string): HostInfo {
  const sheetOf = (name: string) => workbook()?.sheets.find((s) => s.name === name);
  return {
    get fileName() { return state.fileName; },
    get directory() { return directoryOf(state.fileName); },
    osVersion: osVersionOf(userAgent),
    cellStyle(sheet: string, row: number, col: number): CellStyleInfo | undefined {
      const wb = workbook();
      const sh = sheetOf(sheet);
      if (!wb || !sh) return undefined;
      const id = styleAt(sh, row, col);
      const xf = cellFormat(wb, id);
      const align = xf.alignment?.horizontal;
      return { numFmt: numFmtOf(wb, id), locked: xf.protection?.locked !== false, ...(align && HORIZONTAL.has(align) ? { align } : {}) };
    },
    columnWidth(sheet: string, col: number): number | undefined {
      const sh = sheetOf(sheet);
      if (!sh) return undefined;
      return sh.cols.find((c) => col >= c.min && col <= c.max)?.width ?? sh.defaultColWidth;
    },
    pivotValue(sheet: string, row: number, col: number, dataField: string, items: [string, Scalar][]): Scalar | undefined {
      const p = pivotAtCell(state.pivots(), sheet, row, col);
      return p ? pivotLookup(p, state.labels, dataField, items) : undefined;
    },
  };
}
