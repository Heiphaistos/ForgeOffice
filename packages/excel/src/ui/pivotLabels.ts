// Libelles francais des tableaux croises (calcul, ecriture dans la feuille et recherche LIREDONNEESTABCROISDYNAMIQUE).
import type { PivotLabels } from '../logic/pivot.ts';
import { S } from '../strings/index.ts';

export const PIVOT_LABELS: PivotLabels = {
  rowLabels: S.pivot.rowLabels, colLabels: S.pivot.colLabels, grandTotal: S.pivot.grandTotal, blank: S.pivot.blank, all: S.pivot.all, values: S.pivot.values,
  valueName: (fn: string, field: string) => S.pivot.valueName(S.pivot.fn[fn] ?? fn, field),
};
