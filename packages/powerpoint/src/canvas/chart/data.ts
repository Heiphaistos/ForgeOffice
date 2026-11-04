// Donnees des series : nettoyage (valeurs hostiles), empilement, textes des etiquettes de donnees.
import type { ChartDataLabels, ChartPlot, ChartSeries, ChartValues } from '@forgeoffice/pptx';
import { formatNumber } from './format.ts';
import { CHART_STRINGS } from './strings.ts';

/** Limites contre les fichiers hostiles (Excel : 255 series, 32 000 points par serie). */
export const MAX_SERIES = 255;
export const MAX_POINTS = 4000;

export function cleanNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(-1e300, Math.min(1e300, v)) : null;
}

export function valuesOf(v: ChartValues | undefined): Array<number | null> {
  return (v?.values ?? []).slice(0, MAX_POINTS).map(cleanNumber);
}

export const seriesOf = (plot: ChartPlot): ChartSeries[] => (plot.series ?? []).slice(0, MAX_SERIES);

/** Abscisses d'un nuage : xValues, sinon 1..n comme Office. */
export function xValuesOf(s: ChartSeries, n: number): Array<number | null> {
  return s.xValues ? valuesOf(s.xValues) : Array.from({ length: n }, (_, i) => i + 1);
}

export const seriesName = (s: ChartSeries, rank: number): string => String(s.name ?? '').trim() || CHART_STRINGS.seriesName(rank + 1);

export const categoryLabel = (s: ChartSeries | undefined, i: number): string => String(s?.categories?.labels?.[i] ?? i + 1);

/** Nombre de categories d'un ensemble de series. */
export const pointCount = (series: ChartSeries[]): number =>
  Math.min(MAX_POINTS, series.reduce((n, s) => Math.max(n, s.values?.values?.length ?? 0), 0));

export const isStacked = (plot: ChartPlot): boolean => plot.grouping === 'stacked' || plot.grouping === 'percentStacked';

/**
 * Intervalle [debut, fin] de chaque point : [base, v] sans empilement, cumul sinon (100 % : part de la somme
 * des valeurs absolues). `splitSigns` : les barres empilent positifs et negatifs separement. null = trou.
 */
export function stack(plot: ChartPlot, rows: Array<Array<number | null>>, n: number, base: number, splitSigns: boolean): Array<Array<[number, number] | null>> {
  const stacked = isStacked(plot);
  const percent = plot.grouping === 'percentStacked';
  const totals = Array.from({ length: n }, (_, i) => rows.reduce((t, row) => t + Math.abs(row[i] ?? 0), 0));
  const pos = new Array<number>(n).fill(0);
  const neg = new Array<number>(n).fill(0);
  return rows.map((row) =>
    Array.from({ length: n }, (_, i): [number, number] | null => {
      const raw = row[i];
      if (raw === null || raw === undefined) return null;
      if (!stacked) return [base, raw];
      const total = totals[i] ?? 0;
      const v = percent ? (total ? raw / total : 0) : raw;
      const acc = splitSigns && v < 0 ? neg : pos;
      const from = acc[i] ?? 0;
      acc[i] = from + v;
      return [from, from + v];
    }),
  );
}

/** Etiquettes de donnees effectives de la serie (null si rien a afficher). */
export function labelsOf(plot: ChartPlot, s: ChartSeries): ChartDataLabels | null {
  const dl = s.dataLabels ?? plot.dataLabels;
  return dl && (dl.showValue || dl.showCategory || dl.showSeriesName || dl.showPercent || dl.showBubbleSize) ? dl : null;
}

export interface LabelParts {
  name: string;
  category: string;
  value: number;
  format?: string;
  percent?: number;
  size?: number;
}

/** Texte d'une etiquette : nom de serie, categorie, valeur, pourcentage, taille (ordre d'Office). */
export function labelText(dl: ChartDataLabels, parts: LabelParts): string {
  const out: string[] = [];
  if (dl.showSeriesName) out.push(parts.name);
  if (dl.showCategory) out.push(parts.category);
  if (dl.showValue) out.push(formatNumber(parts.value, dl.numberFormat ?? parts.format));
  if (dl.showPercent && parts.percent !== undefined) out.push(formatNumber(parts.percent, '0%'));
  if (dl.showBubbleSize && parts.size !== undefined) out.push(formatNumber(parts.size, dl.numberFormat));
  return out.join((dl.separator ?? '; ').slice(0, 10));
}
