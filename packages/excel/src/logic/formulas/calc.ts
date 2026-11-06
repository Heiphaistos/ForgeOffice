// Options de calcul du classeur (Formules > Options de calcul, Fichier > Options > Formules) : mode, calcul iteratif.
// Les reglages vivent dans `Workbook.calc` (enregistres dans le fichier, calcPr) ; le moteur les recoit a chaque changement.
import type { CalcSettings } from '@forgeoffice/formulas';
import type { CalcOptions } from '@forgeoffice/xlsx';

export type CalcMode = CalcOptions['mode'];

/** Valeurs d'Excel : 100 iterations au plus, ecart maximal 0,001. */
export const ITERATION_DEFAULTS = { count: 100, delta: 0.001 } as const;

export const CALC_MODES: readonly CalcMode[] = ['auto', 'autoNoTable', 'manual'];

/** Reglages du moteur d'apres les options du classeur. */
export function engineSettings(c: CalcOptions): CalcSettings {
  return {
    mode: c.mode,
    iterative: !!c.iterate,
    maxIterations: c.iterateCount ?? ITERATION_DEFAULTS.count,
    maxChange: c.iterateDelta ?? ITERATION_DEFAULTS.delta,
  };
}

export function withCalcMode(c: CalcOptions, mode: CalcMode): CalcOptions {
  return c.mode === mode ? c : { ...c, mode };
}

export interface IterationInput {
  enabled: boolean;
  count: number;
  delta: number;
}

/** Message d'erreur (cle de FM.calc) si les valeurs saisies sont refusees par Excel (1 a 32 767 iterations, ecart positif). */
export function iterationError(i: IterationInput): 'count' | 'delta' | null {
  if (!Number.isInteger(i.count) || i.count < 1 || i.count > 32767) return 'count';
  if (!Number.isFinite(i.delta) || i.delta < 0) return 'delta';
  return null;
}

export function withIteration(c: CalcOptions, i: IterationInput): CalcOptions {
  const next: CalcOptions = { ...c };
  if (i.enabled) next.iterate = true;
  else delete next.iterate;
  next.iterateCount = i.count;
  next.iterateDelta = i.delta;
  return next;
}

export function iterationOf(c: CalcOptions): IterationInput {
  return { enabled: !!c.iterate, count: c.iterateCount ?? ITERATION_DEFAULTS.count, delta: c.iterateDelta ?? ITERATION_DEFAULTS.delta };
}
