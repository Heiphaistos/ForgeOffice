// Publipostage depuis un classeur : lecture d'une feuille par @forgeoffice/xlsx (valeurs mises en forme comme dans le Tableur :
// formats de nombre, dates), choix de la feuille et des champs. Sans DOM.
import { formatValue } from '@forgeoffice/formulas';
import { isDateCell, numberFormatCode, readXlsx, writeCsv, type Cell, type Workbook } from '@forgeoffice/xlsx';
import { parseCsv } from './merge.ts';
import type { MergeSource } from './model.ts';

export const XLSX_EXTENSIONS = ['xlsx', 'xlsm', 'xltx', 'xltm'] as const;

export const isWorkbookName = (name: string): boolean => /\.(xlsx|xlsm|xltx|xltm)$/i.test(name);

export interface MergeBook {
  /** Noms des feuilles visibles, dans l'ordre. */
  sheets: string[];
  /** Source de la feuille d'indice `i` de `sheets` : la premiere ligne donne les noms des champs. */
  read: (i: number) => MergeSource;
}

/** Texte d'une cellule numerique avec son format de nombre (hors dates, traitees par writeCsv). */
function formatted(wb: Workbook): (cell: Cell) => string | undefined {
  return (cell) => {
    if (typeof cell.value !== 'number' || isDateCell(wb, cell)) return undefined;
    const code = numberFormatCode(wb.styles, wb.styles.cellXfs[cell.styleId ?? 0]?.numFmtId ?? 0);
    if (code === 'General') return undefined;
    try {
      return formatValue(cell.value, code, 'fr-FR');
    } catch {
      return undefined;
    }
  };
}

/** Ouvre un classeur .xlsx pour le publipostage. Leve une erreur lisible si le fichier n'est pas un classeur. */
export async function openMergeBook(bytes: Uint8Array, fileName: string): Promise<MergeBook> {
  const wb = await readXlsx(bytes);
  const visible = wb.sheets.filter((s) => s.state === 'visible');
  const format = formatted(wb);
  return {
    sheets: visible.map((s) => s.name),
    read: (i) => {
      const sheet = visible[i];
      if (!sheet) return { name: fileName, fields: [], records: [] };
      const csv = new TextDecoder().decode(writeCsv(wb, sheet, { separator: ';', decimal: ',', bom: false, escapeFormulas: false, format: (cell) => format(cell) }));
      return parseCsv(csv, `${fileName} — ${sheet.name}`);
    },
  };
}

/** Source restreinte aux champs choisis (ordre d'origine) ; les enregistrements gardent leurs valeurs. */
export function pickFields(source: MergeSource, keep: ReadonlySet<string>): MergeSource {
  const idx = source.fields.map((f, i) => (keep.has(f) ? i : -1)).filter((i) => i >= 0);
  return {
    name: source.name,
    fields: idx.map((i) => source.fields[i] as string),
    records: source.records.map((r) => idx.map((i) => r[i] ?? '')),
  };
}
