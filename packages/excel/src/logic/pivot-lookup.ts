// LIREDONNEESTABCROISDYNAMIQUE : valeur d'un tableau croise a partir de ses cellules calculees (disposition compactee de pivot.ts).
import { formatValue, type Scalar } from '@forgeoffice/formulas';
import type { CellRange } from '@forgeoffice/xlsx';
import type { PivotCell, PivotDef, PivotLabels } from './pivot.ts';

/** Ce que l'hote sait d'un tableau croise pour y chercher une valeur. */
export interface PivotSnapshot {
  sheet: string;
  /** Zone occupee dans la feuille (null tant qu'il n'est pas ecrit). */
  area: CellRange | null;
  def: PivotDef;
  fields: readonly string[];
  cells: readonly (readonly PivotCell[])[];
}

const text = (v: Scalar): string => (typeof v === 'number' ? formatValue(v, 'General', 'fr-FR') : v === null ? '' : String(v));
const same = (cell: Scalar, item: Scalar): boolean => text(cell) === text(item) || text(cell) === String(item ?? '');

/** Tableau croise qui contient la cellule (feuille, ligne, colonne). */
export function pivotAtCell(list: readonly PivotSnapshot[], sheet: string, row: number, col: number): PivotSnapshot | undefined {
  return list.find((p) => p.sheet === sheet && p.area && row >= p.area.r1 && row <= p.area.r2 && col >= p.area.c1 && col <= p.area.c2);
}

/**
 * Valeur du champ de donnees `dataField` (« Somme de Ventes » ou « Ventes ») pour les couples champ/element donnes ;
 * sans element de ligne, le total general des lignes ; sans element de colonne, le total general des colonnes. undefined si introuvable.
 */
export function pivotLookup(p: PivotSnapshot, L: PivotLabels, dataField: string, items: readonly (readonly [string, Scalar])[]): Scalar | undefined {
  const { def, fields, cells } = p;
  const vi = def.values.length ? def.values.findIndex((v) => dataField === (fields[v.field] ?? '') || dataField === L.valueName(v.fn, fields[v.field] ?? '')) : 0;
  if (vi < 0) return undefined;
  const valueName = (k: number): string => { const v = def.values[k]; return v ? L.valueName(v.fn, fields[v.field] ?? '') : L.values; };
  const itemOf = (field: number): Scalar | undefined => items.find(([n]) => n === (fields[field] ?? ''))?.[1];
  const hr = cells.findIndex((line) => line.some((c) => c.kind === 'colLabel'));
  const head = cells[hr];
  if (!head) return undefined;

  // Colonne : les elements de colonne joints par « - », ou le total general, ou (sans champ de colonne) le nom de la valeur.
  const multi = def.values.length > 1;
  let target: string;
  if (!def.cols.length) target = valueName(vi);
  else {
    const given = def.cols.map(itemOf);
    if (given.every((g) => g === undefined)) target = multi ? `${valueName(vi)} (${L.grandTotal})` : L.grandTotal;
    else if (given.some((g) => g === undefined)) return undefined;
    else target = given.map((g) => (g === null || g === '' ? L.blank : text(g as Scalar))).join(' - ') + (multi ? ` - ${valueName(vi)}` : '');
  }
  const col = head.findIndex((c, j) => j > 0 && c.kind === 'colLabel' && text(c.value) === target);
  if (col < 0) return undefined;

  // Ligne : on descend niveau par niveau (retrait = profondeur) ; sans element de ligne, la ligne de total general.
  let row = -1;
  const rowItems: Scalar[] = [];
  for (const f of def.rows) {
    const it = itemOf(f);
    if (it === undefined) break;
    rowItems.push(it);
  }
  if (!rowItems.length) row = cells.findIndex((line, i) => i > hr && line[0]?.kind === (def.rows.length ? 'grandLabel' : 'rowLabel'));
  else {
    let from = hr + 1;
    for (let depth = 0; depth < rowItems.length; depth++) {
      const it = rowItems[depth] as Scalar;
      let found = -1;
      for (let i = from; i < cells.length; i++) {
        const c = cells[i]?.[0];
        if (!c || c.kind === 'grandLabel') break;
        if ((c.indent ?? 0) < depth) break;
        if ((c.indent ?? 0) === depth && (same(c.value, it) || (it === null && text(c.value) === L.blank))) { found = i; break; }
      }
      if (found < 0) return undefined;
      from = found + 1;
      row = found;
    }
  }
  const cell = cells[row]?.[col];
  return cell && (cell.value !== null || cell.kind === 'value' || cell.kind === 'grand') ? cell.value : undefined;
}
