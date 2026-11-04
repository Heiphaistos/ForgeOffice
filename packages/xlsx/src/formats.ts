// Point d'entree unique : detection du format (signature puis extension) et lecture/ecriture d'un classeur.
import { readCsv, writeCsv, type CsvReadOptions, type CsvWriteOptions } from './csv.ts';
import type { Workbook, WorkbookFormat } from './model.ts';
import { readOds } from './ods/ods-read.ts';
import { writeOds } from './ods/ods-write.ts';
import { SpreadsheetError, strings } from './strings.ts';
import { isCfb } from './xls/cfb.ts';
import { readXls } from './xls/xls-read.ts';
import { readXlsx, type XlsxReadOptions } from './xlsx/read-workbook.ts';
import { writeXlsx, type XlsxWriteOptions } from './xlsx/write-workbook.ts';

export type SpreadsheetFormat = WorkbookFormat | 'tsv';

/** Extensions ouvrables par le Tableur (pour les boites de dialogue). */
export const SPREADSHEET_EXTENSIONS = ['xlsx', 'xlsm', 'xltx', 'xltm', 'xls', 'ods', 'csv', 'tsv', 'txt'] as const;

const ODS_SIGNATURE = 'mimetypeapplication/vnd.oasis.opendocument.spreadsheet';

function extensionOf(fileName: string | undefined): string {
  const dot = fileName?.lastIndexOf('.') ?? -1;
  return dot >= 0 && fileName ? fileName.slice(dot + 1).toLowerCase() : '';
}

/** Format d'apres le contenu (signature zip/OLE), puis l'extension pour les fichiers texte. */
export function detectFormat(bytes: Uint8Array, fileName?: string): SpreadsheetFormat {
  const ext = extensionOf(fileName);
  if (isCfb(bytes)) return 'xls';
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const head = new TextDecoder('latin1').decode(bytes.subarray(30, 30 + ODS_SIGNATURE.length));
    if (head === ODS_SIGNATURE || ext === 'ods') return 'ods';
    return ext === 'xlsm' || ext === 'xltx' || ext === 'xltm' ? ext : 'xlsx';
  }
  if (ext === 'tsv' || ext === 'tab') return 'tsv';
  return 'csv';
}

export interface ReadOptions {
  csv?: CsvReadOptions;
  xlsx?: XlsxReadOptions;
}

/** Ouvre un classeur quel que soit son format (xlsx, xlsm, xltx, xls, ods, csv, tsv). */
export async function readWorkbook(bytes: Uint8Array, fileName?: string, options: ReadOptions = {}): Promise<Workbook> {
  if (bytes.length === 0) throw new SpreadsheetError(strings.notSpreadsheet);
  const format = detectFormat(bytes, fileName);
  switch (format) {
    case 'xls': return readXls(bytes);
    case 'ods': return readOds(bytes);
    case 'csv': return readCsv(bytes, options.csv);
    case 'tsv': return readCsv(bytes, { separator: '\t', ...options.csv });
    default: return readXlsx(bytes, options.xlsx);
  }
}

export interface WriteOptions {
  csv?: CsvWriteOptions;
  xlsx?: XlsxWriteOptions;
  /** Feuille exportee en CSV/TSV (defaut : feuille active). */
  sheetIndex?: number;
}

/** Enregistre dans le format demande (.xls en lecture seule : enregistre en .xlsx). */
export async function writeWorkbook(wb: Workbook, format: SpreadsheetFormat, options: WriteOptions = {}): Promise<Uint8Array> {
  switch (format) {
    case 'ods': return writeOds(wb);
    case 'csv':
    case 'tsv': {
      const sheet = wb.sheets[options.sheetIndex ?? wb.activeSheet] ?? wb.sheets[0];
      if (!sheet) throw new SpreadsheetError(strings.noSheets);
      return writeCsv(wb, sheet, format === 'tsv' ? { separator: '\t', ...options.csv } : options.csv);
    }
    case 'xlsm':
    case 'xltx':
    case 'xltm':
      return writeXlsx(wb, { ...options.xlsx, format });
    default:
      return writeXlsx(wb, options.xlsx);
  }
}
