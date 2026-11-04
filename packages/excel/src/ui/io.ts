// Ouverture, enregistrement (tous les formats du Tableur) et recuperation apres plantage.
import type { FileFilter, Services } from '@forgeoffice/core';
import { createBlankWorkbook, readWorkbook, writeWorkbook, type SpreadsheetFormat, type Workbook } from '@forgeoffice/xlsx';
import { prepareLoaded, withCachedValues, type WorkbookEngine } from '../logic/engine.ts';
import { S } from '../strings.ts';

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

export function blankWorkbook(): Workbook {
  return createBlankWorkbook();
}

/** Octets du fichier dans le format demande (valeurs calculees ecrites dans le cache des formules). */
export async function serialize(wb: Workbook, engine: WorkbookEngine, format: SaveFormat, activeSheet: number): Promise<Uint8Array> {
  const out = withCachedValues({ ...wb, activeSheet, sheets: wb.sheets.map((s, i) => ({ ...s, view: { ...s.view, tabSelected: i === activeSheet } })) }, engine);
  return writeWorkbook(out, format as SpreadsheetFormat, { sheetIndex: activeSheet });
}

// ---------------------------------------------------------------- Recuperation

const RECOVERY_KEY = 'excel.recovery';
const RECOVERY_MAX = 4_000_000;

export interface Recovery {
  name: string;
  savedAt: number;
  data: string;
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(text: string): Uint8Array {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Copie de secours (xlsx en base64 dans les reglages) ; ignoree au-dela de 4 Mo. */
export async function saveRecovery(services: Services, wb: Workbook, engine: WorkbookEngine, name: string, active: number): Promise<void> {
  const bytes = await serialize(wb, engine, 'xlsx', active);
  if (bytes.length > RECOVERY_MAX) return;
  services.settings.set<Recovery>(RECOVERY_KEY, { name, savedAt: Date.now(), data: toBase64(bytes) });
}

export function readRecovery(services: Services): Recovery | null {
  const r = services.settings.get<Recovery | null>(RECOVERY_KEY, null);
  return r && typeof r.data === 'string' && typeof r.name === 'string' ? r : null;
}

export function clearRecovery(services: Services): void {
  services.settings.set<Recovery | null>(RECOVERY_KEY, null);
}

export async function openRecovery(r: Recovery): Promise<Workbook> {
  return loadWorkbook(fromBase64(r.data), `${r.name}.xlsx`);
}
