// Construction d'un cache de tableau croise depuis une plage de cellules (en-tetes sur la premiere ligne).
import type { PivotCache, PivotCacheField, PivotValue } from '../model-pivot.ts';
import type { Cell, CellRange, Sheet, Workbook } from '../model.ts';
import { isCellError, isDateCell, serialToDate } from '../workbook.ts';

function valueOf(wb: Workbook, cell: Cell | undefined): PivotValue {
  const v = cell?.value ?? null;
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return v === '' ? null : v;
  if (isCellError(v)) return v;
  if (isDateCell(wb, cell)) return { date: serialToDate(v, wb.date1904).toISOString().slice(0, 19) };
  return v;
}

/** Cache d'une plage : noms de champs = textes de la premiere ligne, un enregistrement par ligne suivante. */
export function buildPivotCache(wb: Workbook, sheet: Sheet, ref: CellRange, id: number): PivotCache {
  const fields: PivotCacheField[] = [];
  for (let c = ref.c1; c <= ref.c2; c++) {
    const head = sheet.cells.get(ref.r1)?.get(c)?.value;
    const field: PivotCacheField = { name: head === null || head === undefined || head === '' ? `Champ${c - ref.c1 + 1}` : String(head) };
    const xf = wb.styles.cellXfs[sheet.cells.get(ref.r1 + 1)?.get(c)?.styleId ?? 0];
    if (xf && xf.numFmtId) field.numFmtId = xf.numFmtId;
    fields.push(field);
  }
  const records: PivotValue[][] = [];
  for (let r = ref.r1 + 1; r <= ref.r2; r++) {
    const line = sheet.cells.get(r);
    const row: PivotValue[] = [];
    for (let c = ref.c1; c <= ref.c2; c++) row.push(valueOf(wb, line?.get(c)));
    records.push(row);
  }
  return { id, source: { sheet: sheet.name, ref }, fields, records };
}
