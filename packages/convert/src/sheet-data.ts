// Conversions de donnees typees entre classeurs et JSON / HTML / Markdown (sans DOM, testees).
// Les nombres, booleens et dates restent des valeurs (le pivot natif les passait en texte).
import {
  createBlankWorkbook, createSheet, isCellError, isDateCell, serialToDate, setValue, usedRange,
  type Cell, type CellValue, type Sheet, type Workbook,
} from '@forgeoffice/xlsx';
import { S } from './strings.ts';

export type Scalar = string | number | boolean | null;

export interface SheetRows {
  name: string;
  /** Premiere ligne = en-tetes. */
  rows: Scalar[][];
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Date ISO « 2026-11-07 » (ou avec l'heure si le numero de serie a une fraction). */
export function isoOfSerial(serial: number, date1904: boolean): string {
  const d = serialToDate(serial, date1904);
  const day = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return Number.isInteger(serial) ? day : `${day}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function scalarOf(wb: Workbook, cell: Cell | undefined): Scalar {
  const v: CellValue | undefined = cell?.value;
  if (v === undefined || v === null) return null;
  if (isCellError(v)) return v.error;
  if (typeof v === 'number' && isDateCell(wb, cell)) return isoOfSerial(v, wb.date1904);
  return v;
}

function sheetRows(wb: Workbook, sheet: Sheet): Scalar[][] {
  const used = usedRange(sheet);
  if (!used) return [];
  const rows: Scalar[][] = [];
  for (let r = used.r1; r <= used.r2; r++) {
    const line: Scalar[] = [];
    for (let c = used.c1; c <= used.c2; c++) line.push(scalarOf(wb, sheet.cells.get(r)?.get(c)));
    rows.push(line);
  }
  return rows;
}

/** Feuilles visibles et non vides (les feuilles graphiques sont ignorees). */
export function workbookRows(wb: Workbook): SheetRows[] {
  return wb.sheets
    .filter((s) => s.state === 'visible' && !s.isChartSheet)
    .map((s) => ({ name: s.name, rows: sheetRows(wb, s) }))
    .filter((s) => s.rows.length > 0);
}

/** En-tetes uniques et non vides (« Colonne 2 » si vide, « Nom (2) » si doublon). */
export function headerNames(row: readonly Scalar[]): string[] {
  const seen = new Map<string, number>();
  return row.map((cell, i) => {
    const base = cell === null || String(cell).trim() === '' ? S.data.column(i + 1) : String(cell);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
}

function records(rows: readonly Scalar[][]): Record<string, Scalar>[] {
  const [head, ...body] = rows;
  const keys = headerNames(head ?? []);
  return body.map((line) => Object.fromEntries(keys.map((k, i) => [k, line[i] ?? null])));
}

/** Classeur -> JSON : un tableau d'objets pour une feuille, un objet « feuille: tableau » pour plusieurs. */
export function workbookToJson(wb: Workbook): string {
  const sheets = workbookRows(wb);
  if (sheets.length === 0) throw new Error(S.data.empty);
  const data = sheets.length === 1 && sheets[0] ? records(sheets[0].rows) : Object.fromEntries(sheets.map((s) => [s.name, records(s.rows)]));
  return JSON.stringify(data, null, 2);
}

// ---------------------------------------------------------------- JSON -> classeur

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const isRecord = (v: Json | undefined): v is { [key: string]: Json } => typeof v === 'object' && v !== null && !Array.isArray(v);

function toScalar(v: Json | undefined): Scalar {
  if (v === undefined || v === null) return null;
  return typeof v === 'object' ? JSON.stringify(v) : v;
}

function tableOf(list: readonly Json[]): Scalar[][] {
  if (list.every(Array.isArray)) return list.map((l) => (l as Json[]).map(toScalar));
  if (list.every(isRecord)) {
    const keys: string[] = [];
    for (const item of list) for (const k of Object.keys(item)) if (!keys.includes(k)) keys.push(k);
    return [keys, ...list.map((item) => keys.map((k) => toScalar(item[k])))];
  }
  return [[S.data.value], ...list.map((v) => [toScalar(v)])];
}

/** Noms de feuille valides (31 caracteres, sans \ / ? * [ ] :) et uniques. */
function sheetName(raw: string, used: Set<string>): string {
  const base = raw.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || S.data.sheet;
  let name = base;
  for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base.slice(0, 28)} ${i}`;
  used.add(name.toLowerCase());
  return name;
}

/** JSON -> classeur : tableau d'objets, de tableaux ou de valeurs = une feuille ; objet de tableaux = une feuille par cle. */
export const jsonToWorkbook = (text: string): Workbook => valueToWorkbook(JSON.parse(text.replace(/^﻿/, '')) as Json);

/** Valeur JSON (aussi issue de YAML ou TOML) -> classeur. */
export function valueToWorkbook(data: Json): Workbook {
  const tables: [string, Scalar[][]][] =
    Array.isArray(data) ? [[S.data.sheet, tableOf(data)]]
      : isRecord(data) && Object.values(data).every(Array.isArray) && Object.keys(data).length > 0
        ? Object.entries(data).map(([k, v]) => [k, tableOf(v as Json[])])
        : [[S.data.sheet, tableOf([data])]];
  const wb = createBlankWorkbook();
  wb.sheets.length = 0;
  const used = new Set<string>();
  for (const [name, rows] of tables) {
    const sheet = createSheet(sheetName(name, used));
    rows.forEach((line, r) => line.forEach((v, c) => { if (v !== null) setValue(sheet, r, c, v); }));
    wb.sheets.push(sheet);
  }
  wb.activeSheet = 0;
  return wb;
}

// ---------------------------------------------------------------- HTML et Markdown

const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const display = (v: Scalar): string => (v === null ? '' : typeof v === 'boolean' ? (v ? S.data.yes : S.data.no) : String(v));

/** Classeur -> page HTML autonome : un tableau par feuille, nombres alignes a droite. */
export function workbookToHtml(wb: Workbook, title: string): string {
  const parts = workbookRows(wb).map((s) => {
    const [head, ...body] = s.rows;
    const th = (head ?? []).map((c) => `<th>${escapeHtml(display(c))}</th>`).join('');
    const tr = body.map((line) => `<tr>${line.map((c) => `<td${typeof c === 'number' ? ' class="n"' : ''}>${escapeHtml(display(c))}</td>`).join('')}</tr>`).join('\n');
    return `<h2>${escapeHtml(s.name)}</h2>\n<table>\n<thead><tr>${th}</tr></thead>\n<tbody>\n${tr}\n</tbody>\n</table>`;
  });
  return `<!DOCTYPE html>\n<html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>\n<style>table{border-collapse:collapse;font-family:sans-serif}th,td{border:1px solid #bbb;padding:4px 8px}th{background:#eee;text-align:left}td.n{text-align:right}</style>\n</head><body>\n${parts.join('\n')}\n</body></html>\n`;
}

const mdCell = (v: Scalar): string => display(v).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');

/** Classeur -> Markdown : un tableau par feuille, titre « ## feuille » si plusieurs feuilles. */
export function workbookToMarkdown(wb: Workbook): string {
  const sheets = workbookRows(wb);
  return sheets.map((s) => {
    const [head, ...body] = s.rows;
    const keys = headerNames(head ?? []);
    const lines = [`| ${keys.map(mdCell).join(' | ')} |`, `| ${keys.map(() => '---').join(' | ')} |`, ...body.map((l) => `| ${keys.map((_, i) => mdCell(l[i] ?? null)).join(' | ')} |`)];
    return `${sheets.length > 1 ? `## ${s.name}\n\n` : ''}${lines.join('\n')}\n`;
  }).join('\n');
}
