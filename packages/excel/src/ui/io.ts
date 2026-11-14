// Ouverture, enregistrement (tous les formats du Tableur) et recuperation apres plantage.
import { recordVersion } from './versions-store.ts';
import { isOnlyOfficeFor } from '@forgeoffice/ui/logic/ooMode';
import { sharedRecovery, type FileFilter, type Settings, type RecoveryEntry } from '@forgeoffice/core';
import { createBlankWorkbook, readWorkbook, writeWorkbook, type SpreadsheetFormat, type Workbook } from '@forgeoffice/xlsx';
import { prepareLoaded, withCachedValues, type WorkbookEngine } from '../logic/engine.ts';
import { S } from '../strings/index.ts';

export const SAVE_FORMATS = ['xlsx', 'xlsm', 'xltx', 'ods', 'csv', 'tsv'] as const;
export type SaveFormat = (typeof SAVE_FORMATS)[number];

export function filtersFor(format: SaveFormat): FileFilter[] {
  return [{ name: S.backstage.formats[format] ?? format, extensions: [format] }];
}

export const OPEN_FILTERS: readonly FileFilter[] = [
  { name: 'Classeurs', extensions: ['xlsx', 'xlsm', 'xltx', 'xltm', 'xls', 'ods', 'csv', 'tsv', 'txt'] },
];

export function baseName(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

export function formatOf(name: string): SaveFormat {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  return (SAVE_FORMATS as readonly string[]).includes(ext) ? (ext as SaveFormat) : 'xlsx';
}

export async function loadWorkbook(bytes: Uint8Array, name: string): Promise<Workbook> {
  return prepareLoaded(await readWorkbook(bytes, name));
}

export function blankWorkbook(settings?: Settings | null): Workbook {
  return createBlankWorkbook(isOnlyOfficeFor(settings, 'excel') ? 'onlyoffice' : undefined);
}

/** Octets du fichier dans le format demande (valeurs calculees ecrites dans le cache des formules).
 * CSV/TSV : par defaut, le texte commencant par = + - @ est neutralise (injection de formules chez le destinataire). */
export async function serialize(wb: Workbook, engine: WorkbookEngine, format: SaveFormat, activeSheet: number, protectFormulas = true): Promise<Uint8Array> {
  const out = withCachedValues({ ...wb, activeSheet, sheets: wb.sheets.map((s, i) => ({ ...s, view: { ...s.view, tabSelected: i === activeSheet } })) }, engine);
  return writeWorkbook(out, format as SpreadsheetFormat, { sheetIndex: activeSheet, csv: { escapeFormulas: protectFormulas } });
}

// ---------------------------------------------------------------- Recuperation

const RECOVERY_MAX = 4_000_000;
/** Ancienne copie unique (reglages, base64) : supprimee au demarrage. */
export const LEGACY_RECOVERY_KEY = 'excel.recovery';

/** Copie de secours (xlsx dans le magasin commun de recuperation, une cle par session) ; ignoree au-dela de 4 Mo. */
export async function saveRecovery(wb: Workbook, engine: WorkbookEngine, name: string, active: number): Promise<void> {
  const bytes = await serialize(wb, engine, 'xlsx', active);
  if (bytes.length > RECOVERY_MAX) return;
  await sharedRecovery('excel').save({ name, path: null, bytes });
  await recordVersion(name, bytes);
}

export async function openRecovery(r: RecoveryEntry): Promise<Workbook> {
  return loadWorkbook(r.bytes, `${r.name}.xlsx`);
}
