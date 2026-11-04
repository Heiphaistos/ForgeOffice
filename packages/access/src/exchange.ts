// Donnees externes : import CSV/classeur vers le moteur, export Excel/texte/HTML, creation des modeles.
import type { OpenedFile, Services } from '@forgeoffice/core';
import { createBlankWorkbook, decodeText, readWorkbook, setValue, writeWorkbook, type CellValue } from '@forgeoffice/xlsx';
import { api, readAll, type Db } from './db.ts';
import { fileNameFor, toCsv, toHtml, type ExportData } from './logic/export.ts';
import type { TemplateDef } from './logic/templates.ts';
import { S } from './strings.ts';
import type { Json, RapportImport } from './types.ts';
import type { ImportChoice } from './components/Dialogs.tsx';

/** Lignes d'une table ou d'une requete a exporter. */
export async function exportData(db: Db, kind: 'table' | 'requete', name: string): Promise<ExportData> {
  if (kind === 'table') {
    const all = await readAll(db, name);
    return { title: name, columns: all.colonnes.map((c) => c.nom), rows: all.lignes };
  }
  const r = await api.runQuery(db, name);
  return { title: name, columns: r.colonnes.map((c) => c.nom), rows: r.lignes };
}

function cell(v: Json): CellValue {
  if (v === null || typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return v;
  return JSON.stringify(v);
}

export async function exportTo(services: Services, data: ExportData, kind: 'excel' | 'text' | 'html'): Promise<boolean> {
  let bytes: Uint8Array;
  let ext: string;
  let filter: string;
  if (kind === 'excel') {
    const wb = createBlankWorkbook();
    const sheet = wb.sheets[0];
    if (!sheet) return false;
    sheet.name = data.title.replace(/[\\/?*[\]:]/g, '_').slice(0, 31) || 'Feuil1';
    data.columns.forEach((c, i) => setValue(sheet, 0, i, c));
    data.rows.forEach((r, ri) => r.forEach((v, ci) => setValue(sheet, ri + 1, ci, cell(v))));
    bytes = await writeWorkbook(wb, 'xlsx');
    ext = 'xlsx';
    filter = S.ext.filterExcel;
  } else {
    bytes = new TextEncoder().encode(kind === 'html' ? toHtml(data) : toCsv(data));
    ext = kind === 'html' ? 'html' : 'csv';
    filter = kind === 'html' ? S.ext.filterHtml : S.ext.filterText;
  }
  const saved = await services.saveFile(bytes, fileNameFor(data.title, ext), [{ name: filter, extensions: [ext] }], null);
  return saved !== null;
}

/** Importe un fichier deja lu (CSV/texte ou classeur) selon les choix de l'assistant. */
export async function importFile(db: Db, file: OpenedFile, kind: 'excel' | 'text', c: ImportChoice): Promise<RapportImport> {
  const options = { entete: c.header, mode: c.mode, ajouter_numero_auto: c.mode === 'creer_table' && c.autoKey };
  if (kind === 'text') {
    return db.call<RapportImport>('importer_csv', { table: c.table, texte: decodeText(file.bytes).text, options });
  }
  const wb = await readWorkbook(file.bytes, file.name);
  const sheet = wb.sheets[wb.activeSheet] ?? wb.sheets[0];
  const grid: Json[][] = [];
  for (const [row, line] of [...(sheet?.cells ?? new Map())].sort((a, b) => a[0] - b[0])) {
    const out: Json[] = [];
    for (const [col, ce] of line) {
      const v = ce.value;
      out[col] = v === null || typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string' ? v : null;
    }
    grid[row] = out;
  }
  const rows = grid.filter((r) => r !== undefined).map((r) => Array.from(r, (v) => v ?? null));
  if (rows.length === 0) throw new Error(S.ext.emptySheet);
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r: Json[]): Json[] => Array.from({ length: width }, (_, i) => r[i] ?? null);
  const entetes = c.header ? pad(rows[0] ?? []).map((v, i) => (v === null || v === '' ? `Champ${i + 1}` : String(v))) : Array.from({ length: width }, (_, i) => `Champ${i + 1}`);
  const lignes = (c.header ? rows.slice(1) : rows).map(pad);
  return db.call<RapportImport>('importer_lignes', { table: c.table, entetes, lignes, options: { ...options, entete: true } });
}

/** Cree les tables, relations et donnees d'un modele dans la base ouverte. */
export async function applyTemplate(db: Db, t: TemplateDef): Promise<void> {
  for (const table of t.tables) await db.call('creer_table', { definition: table });
  for (const r of t.relations) await db.call('creer_relation', { relation: r });
  for (const table of t.tables) {
    for (const row of t.rows[table.nom] ?? []) await db.call('inserer', { table: table.nom, valeurs: row });
  }
}
