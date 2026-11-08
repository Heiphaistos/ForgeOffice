// Consolider : regroupe plusieurs plages avec une fonction (somme, nombre, moyenne, max, min), par position ou par etiquettes.
import type { Scalar } from '@forgeoffice/formulas';

export type ConsolidateFn = 'sum' | 'count' | 'average' | 'max' | 'min';
export const CONSOLIDATE_FNS: readonly ConsolidateFn[] = ['sum', 'count', 'average', 'max', 'min'];

const nums = (v: readonly Scalar[]): number[] => v.filter((x): x is number => typeof x === 'number');

export function applyFn(fn: ConsolidateFn, v: readonly Scalar[]): number | null {
  const n = nums(v);
  if (fn === 'count') return n.length;
  if (!n.length) return null;
  switch (fn) {
    case 'sum': return n.reduce((a, b) => a + b, 0);
    case 'average': return n.reduce((a, b) => a + b, 0) / n.length;
    case 'max': return Math.max(...n);
    case 'min': return Math.min(...n);
  }
}

export interface ConsolidateOptions {
  fn: ConsolidateFn;
  /** Etiquettes dans la ligne du haut. */
  topRow: boolean;
  /** Etiquettes dans la colonne de gauche. */
  leftCol: boolean;
}

/**
 * Consolide des matrices de valeurs. Sans etiquettes : meme position dans chaque source. Avec etiquettes : lignes/colonnes alignees
 * sur leurs libelles (ordre de premiere apparition). Renvoie la matrice resultat (etiquettes comprises).
 */
export function consolidate(sources: readonly (readonly (readonly Scalar[])[])[], o: ConsolidateOptions): Scalar[][] {
  if (!o.topRow && !o.leftCol) {
    const rows = Math.max(0, ...sources.map((s) => s.length));
    const cols = Math.max(0, ...sources.map((s) => Math.max(0, ...s.map((r) => r.length))));
    return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => applyFn(o.fn, sources.map((s) => s[r]?.[c] ?? null))));
  }
  const key = (v: Scalar): string => String(v ?? '').toLowerCase();
  const rowLabels: Scalar[] = [];
  const colLabels: Scalar[] = [];
  for (const s of sources) {
    if (o.leftCol) s.forEach((row, r) => { if (r >= (o.topRow ? 1 : 0) && !rowLabels.some((l) => key(l) === key(row[0] ?? null))) rowLabels.push(row[0] ?? null); });
    if (o.topRow) (s[0] ?? []).forEach((v, c) => { if (c >= (o.leftCol ? 1 : 0) && !colLabels.some((l) => key(l) === key(v))) colLabels.push(v); });
  }
  const rowKeys = o.leftCol ? rowLabels : [null];
  const colKeys = o.topRow ? colLabels : [null];
  const out: Scalar[][] = [];
  if (o.topRow) out.push([...(o.leftCol ? [null] : []), ...colLabels]);
  rowKeys.forEach((rk, ri) => {
    const line: Scalar[] = o.leftCol ? [rk] : [];
    colKeys.forEach((ck, ci) => {
      const vals: Scalar[] = [];
      for (const s of sources) {
        const r = o.leftCol ? s.findIndex((row, i) => i >= (o.topRow ? 1 : 0) && key(row[0] ?? null) === key(rk)) : ri + (o.topRow ? 1 : 0);
        const c = o.topRow ? (s[0] ?? []).findIndex((v, i) => i >= (o.leftCol ? 1 : 0) && key(v) === key(ck)) : ci + (o.leftCol ? 1 : 0);
        if (r >= 0 && c >= 0) vals.push(s[r]?.[c] ?? null);
      }
      line.push(applyFn(o.fn, vals));
    });
    out.push(line);
  });
  return out;
}
