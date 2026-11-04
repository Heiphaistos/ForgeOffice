// Operations sur les tableaux (sans DOM) : lignes, colonnes, fusion, fractionnement, repartition.
import type { Table, TableCell, TableShape } from '@forgeoffice/pptx';
import { mergeCells } from '@forgeoffice/pptx';

const emptyCell = (): TableCell => ({ text: { props: {}, paragraphs: [{ props: {}, runs: [] }] } });

/** Insere une ligne avant l'indice `at` (copie la hauteur de la ligne voisine). */
export function insertRow(shape: TableShape, at: number): void {
  const t = shape.table;
  const ref = t.rows[Math.min(at, t.rows.length - 1)] ?? t.rows[0];
  const height = ref?.height ?? 37;
  t.rows.splice(Math.max(0, Math.min(at, t.rows.length)), 0, { height, cells: t.columns.map(() => emptyCell()) });
  if (shape.xfrm) shape.xfrm = { ...shape.xfrm, height: shape.xfrm.height + height };
}

/** Insere une colonne avant `at` ; la largeur totale est conservee si `keepWidth`, sinon le tableau s'elargit. */
export function insertColumn(shape: TableShape, at: number, keepWidth = false): void {
  const t = shape.table;
  const index = Math.max(0, Math.min(at, t.columns.length));
  const width = t.columns[Math.min(index, t.columns.length - 1)] ?? 100;
  if (keepWidth) {
    const total = t.columns.reduce((a, b) => a + b, 0);
    const k = total / (total + width);
    t.columns = t.columns.map((w) => w * k);
    t.columns.splice(index, 0, width * k);
  } else {
    t.columns.splice(index, 0, width);
    if (shape.xfrm) shape.xfrm = { ...shape.xfrm, width: shape.xfrm.width + width };
  }
  for (const row of t.rows) row.cells.splice(index, 0, emptyCell());
}

export function deleteRows(shape: TableShape, from: number, to: number): void {
  const t = shape.table;
  const removed = t.rows.splice(from, to - from + 1);
  const h = removed.reduce((a, r) => a + r.height, 0);
  if (shape.xfrm) shape.xfrm = { ...shape.xfrm, height: Math.max(1, shape.xfrm.height - h) };
  clearDanglingMerges(t);
}

export function deleteColumns(shape: TableShape, from: number, to: number): void {
  const t = shape.table;
  const removed = t.columns.splice(from, to - from + 1);
  for (const row of t.rows) row.cells.splice(from, to - from + 1);
  const w = removed.reduce((a, b) => a + b, 0);
  if (shape.xfrm) shape.xfrm = { ...shape.xfrm, width: Math.max(1, shape.xfrm.width - w) };
  clearDanglingMerges(t);
}

/** Supprime les fusions devenues invalides (cellule maitresse supprimee). */
function clearDanglingMerges(t: Table): void {
  t.rows.forEach((row, r) =>
    row.cells.forEach((cell, c) => {
      if (cell.gridSpan && c + cell.gridSpan > row.cells.length) cell.gridSpan = row.cells.length - c > 1 ? row.cells.length - c : undefined;
      if (cell.rowSpan && r + cell.rowSpan > t.rows.length) cell.rowSpan = t.rows.length - r > 1 ? t.rows.length - r : undefined;
      if (cell.hMerge && c === 0) delete cell.hMerge;
      if (cell.vMerge && r === 0) delete cell.vMerge;
      if (!cell.gridSpan) delete cell.gridSpan;
      if (!cell.rowSpan) delete cell.rowSpan;
    }),
  );
}

/** Fusionne la plage ; le texte des cellules couvertes est ajoute a la cellule maitresse. */
export function mergeRange(shape: TableShape, r0: number, c0: number, r1: number, c1: number): void {
  const master = shape.table.rows[r0]?.cells[c0];
  if (!master) return;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (r === r0 && c === c0) continue;
      const cell = shape.table.rows[r]?.cells[c];
      if (cell?.text.paragraphs.some((p) => p.runs.length)) master.text.paragraphs.push(...cell.text.paragraphs);
      if (cell) cell.text = { props: {}, paragraphs: [{ props: {}, runs: [] }] };
    }
  }
  mergeCells(shape, r0, c0, r1 - r0 + 1, c1 - c0 + 1);
}

/** Annule la fusion qui contient la cellule (Fractionner). */
export function unmerge(shape: TableShape, row: number, col: number): void {
  const cell = shape.table.rows[row]?.cells[col];
  if (!cell) return;
  const rows = cell.rowSpan ?? 1;
  const cols = cell.gridSpan ?? 1;
  for (let r = row; r < row + rows; r++) {
    for (let c = col; c < col + cols; c++) {
      const x = shape.table.rows[r]?.cells[c];
      if (!x) continue;
      delete x.gridSpan;
      delete x.rowSpan;
      delete x.hMerge;
      delete x.vMerge;
    }
  }
}

/** Fractionne une cellule en `n` colonnes (insere des colonnes et fusionne les autres lignes). */
export function splitColumns(shape: TableShape, row: number, col: number, n: number): void {
  if (n < 2) return;
  const width = shape.table.columns[col] ?? 100;
  for (let i = 1; i < n; i++) insertColumn(shape, col + 1, true);
  const each = width / n;
  for (let i = 0; i < n; i++) shape.table.columns[col + i] = each;
  const total = shape.table.columns.reduce((a, b) => a + b, 0);
  if (shape.xfrm) shape.xfrm = { ...shape.xfrm, width: total };
  shape.table.rows.forEach((_, r) => {
    if (r !== row) mergeCells(shape, r, col, 1, n);
  });
}

/** Repartit les hauteurs de lignes ou largeurs de colonnes de facon egale. */
export function distribute(shape: TableShape, which: 'rows' | 'columns'): void {
  const t = shape.table;
  if (which === 'rows') {
    const total = t.rows.reduce((a, r) => a + r.height, 0);
    for (const r of t.rows) r.height = total / Math.max(1, t.rows.length);
  } else {
    const total = t.columns.reduce((a, b) => a + b, 0);
    t.columns = t.columns.map(() => total / Math.max(1, t.columns.length));
  }
}
