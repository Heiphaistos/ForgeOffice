// Etats : regroupement, totaux, expressions simples des zones de texte (=Date(), =Somme([X]), pagination).
import { S } from '../strings.ts';
import type { Json } from '../types.ts';
import { compareValues } from './table-ops.ts';
import { displayValue, frenchNumber } from './values.ts';

export interface ReportGroup {
  key: Json;
  rows: Json[][];
}

/** Regroupe les lignes sur une colonne (tri croissant), ou un seul groupe sans regroupement. */
export function groupRows(columns: readonly string[], rows: readonly Json[][], groupField: string | null): ReportGroup[] {
  const c = groupField ? columns.indexOf(groupField) : -1;
  if (c < 0) return [{ key: null, rows: [...rows] }];
  const sorted = [...rows].sort((a, b) => compareValues(a[c] ?? null, b[c] ?? null));
  const groups: ReportGroup[] = [];
  for (const row of sorted) {
    const key = row[c] ?? null;
    const last = groups[groups.length - 1];
    if (last && compareValues(last.key, key) === 0) last.rows.push(row);
    else groups.push({ key, rows: [row] });
  }
  return groups;
}

export interface ExprContext {
  columns: readonly string[];
  rows: readonly Json[][];
  page: number;
  pages: number;
  today: Date;
}

function column(ctx: ExprContext, name: string): Json[] {
  const i = ctx.columns.findIndex((c) => c.toLowerCase() === name.toLowerCase());
  return i < 0 ? [] : ctx.rows.map((r) => r[i] ?? null);
}

function sum(values: Json[]): number {
  return values.reduce<number>((s, v) => s + (typeof v === 'number' ? v : 0), 0);
}

const AGGREGATE = /^(somme|sum|moyenne|avg|compte|count|min|max)\(\s*(\*|\[([^\]]+)\])\s*\)$/i;

/** Evalue une source de zone de texte d'etat. Expressions inconnues : texte vide (jamais d'evaluation de code). */
export function evalReportExpression(source: string, ctx: ExprContext): string {
  const src = source.trim();
  if (!src.startsWith('=')) return src;
  const e = src.slice(1).trim();
  if (/^(date|maintenant|now)\(\)$/i.test(e)) return ctx.today.toLocaleDateString('fr-FR');
  const agg = e.match(AGGREGATE);
  if (agg) {
    const fn = (agg[1] ?? '').toLowerCase();
    const values = agg[2] === '*' ? ctx.rows.map(() => 1 as Json) : column(ctx, agg[3] ?? '');
    const nums = values.filter((v): v is number => typeof v === 'number');
    if (fn === 'compte' || fn === 'count') return frenchNumber(values.filter((v) => v !== null).length);
    if (nums.length === 0) return '';
    if (fn === 'somme' || fn === 'sum') return frenchNumber(Math.round(sum(nums) * 100) / 100);
    if (fn === 'moyenne' || fn === 'avg') return frenchNumber(Math.round((sum(nums) / nums.length) * 100) / 100);
    return frenchNumber(fn === 'min' ? Math.min(...nums) : Math.max(...nums));
  }
  // Concatenation « "Page " & [Page] & " sur " & [Pages] ».
  if (e.includes('&')) {
    return e
      .split('&')
      .map((part) => {
        const p = part.trim();
        if (/^".*"$/.test(p)) return p.slice(1, -1);
        if (/^\[page\]$/i.test(p)) return String(ctx.page);
        if (/^\[pages\]$/i.test(p)) return String(ctx.pages);
        return '';
      })
      .join('');
  }
  const ref = e.match(/^\[([^\]]+)\]$/);
  if (ref) return displayValue(column(ctx, ref[1] ?? '')[0] ?? null, null);
  return '';
}

/** Lignes d'etat a plat (en-tetes de groupe, details, pieds) puis decoupage en pages. */
export type ReportLine =
  | { kind: 'group'; key: Json }
  | { kind: 'detail'; row: Json[] }
  | { kind: 'groupFooter'; rows: Json[][] };

export function reportLines(groups: readonly ReportGroup[], grouped: boolean): ReportLine[] {
  const lines: ReportLine[] = [];
  for (const g of groups) {
    if (grouped) lines.push({ kind: 'group', key: g.key });
    for (const row of g.rows) lines.push({ kind: 'detail', row });
    if (grouped) lines.push({ kind: 'groupFooter', rows: g.rows });
  }
  return lines;
}

export function paginate<T>(items: readonly T[], perPage: number): T[][] {
  const size = Math.max(1, perPage);
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages.length > 0 ? pages : [[]];
}

export function groupLabel(key: Json): string {
  return key === null ? S.ds.blanks : displayValue(key, null);
}
