// Choix des pages à imprimer (sans DOM, testé) : toutes, page affichée, pages sélectionnées, plage « 1-3, 5 ».
import { parsePageRange } from '../../convert/src/pdf-ops.ts';

export type PrintScope = 'all' | 'current' | 'selected' | 'range';

/** Indices (0-based) des pages à imprimer, ou null pour tout le document. Lève une erreur française si la plage est invalide. */
export function printPages(scope: PrintScope, range: string, total: number, current: number, selected: readonly number[]): number[] | null {
  if (scope === 'all') return null;
  if (scope === 'current') return [Math.min(Math.max(current, 0), total - 1)];
  if (scope === 'selected') return selected.length > 0 && selected.length < total ? [...selected].sort((a, b) => a - b) : null;
  const pages = parsePageRange(range, total);
  return pages.length === total ? null : pages;
}
