// Elements de graphique ajoutables (« Ajouter un element graphique ») : titres d'axes, courbes de tendance lineaires, textes.
import type { ChartAxis, ChartModel } from '@forgeoffice/xlsx';

export type AxisTarget = 'category' | 'value';

const isTarget = (a: ChartAxis, t: AxisTarget): boolean => (t === 'value' ? a.kind === 'value' : a.kind !== 'value');

/** Texte du titre de l'axe (undefined : aucun titre). */
export function axisTitle(m: ChartModel, t: AxisTarget): string | undefined {
  return m.axes.find((a) => isTarget(a, t))?.title?.text;
}

/** Ajoute (texte par defaut) ou retire le titre d'un axe ; un texte donne remplace le titre. */
export function setAxisTitle(m: ChartModel, t: AxisTarget, text: string | null, fallback: string): ChartModel {
  // Seul l'axe principal (le premier de ce type) est concerne : un axe secondaire garde son titre.
  const main = m.axes.findIndex((a) => isTarget(a, t));
  return {
    ...m,
    axes: m.axes.map((a, i) => {
      if (i !== main) return a;
      const { title: _old, ...rest } = a;
      return text === null ? rest : { ...rest, title: { text: text || fallback } };
    }),
  };
}

export function setTitleText(m: ChartModel, text: string): ChartModel {
  return { ...m, autoTitleDeleted: false, title: { text } };
}

/** Courbe de tendance lineaire sur toutes les series (ou aucune). */
export function setTrendline(m: ChartModel, on: boolean): ChartModel {
  return {
    ...m,
    plots: m.plots.map((p) => ({
      ...p,
      series: p.series.map((s) => {
        const { trendlines: _t, ...rest } = s;
        return on ? { ...rest, trendlines: [{ type: 'linear' as const }] } : rest;
      }),
    })),
  };
}

export const hasTrendline = (m: ChartModel): boolean => m.plots.some((p) => p.series.some((s) => (s.trendlines?.length ?? 0) > 0));

/** Droite des moindres carres y = a x + b, x = 0..n-1 (valeurs nulles ignorees) ; undefined s'il y a moins de deux points. */
export function linearFit(ys: readonly (number | null)[]): { slope: number; intercept: number } | undefined {
  const pts = ys.map((y, x) => (y === null ? null : ([x, y] as const))).filter((p): p is readonly [number, number] => p !== null);
  if (pts.length < 2) return undefined;
  const n = pts.length;
  const sx = pts.reduce((s, p) => s + p[0], 0);
  const sy = pts.reduce((s, p) => s + p[1], 0);
  const sxx = pts.reduce((s, p) => s + p[0] * p[0], 0);
  const sxy = pts.reduce((s, p) => s + p[0] * p[1], 0);
  const den = n * sxx - sx * sx;
  if (den === 0) return undefined;
  const slope = (n * sxy - sx * sy) / den;
  return { slope, intercept: (sy - slope * sx) / n };
}

export type LabelPosition = 'none' | 'ctr' | 'inEnd' | 'outEnd';

/** Etiquettes de donnees de tous les graphiques : aucune, ou valeurs a la position donnee (barres). */
export function setLabelPosition(m: ChartModel, pos: LabelPosition): ChartModel {
  return {
    ...m,
    plots: m.plots.map((p) => {
      const { dataLabels: _d, ...rest } = p;
      return pos === 'none' ? rest : { ...rest, dataLabels: { showValue: true, position: pos } };
    }),
  };
}

export const labelPositionOf = (m: ChartModel): LabelPosition => {
  const l = m.plots[0]?.dataLabels;
  if (!l?.showValue) return 'none';
  return l.position === 'ctr' || l.position === 'inEnd' ? l.position : 'outEnd';
};
