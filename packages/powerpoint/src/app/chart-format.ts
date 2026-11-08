// Format de l'élément de graphique sélectionné (zone de graphique, zone de traçage, titre, légende, axes, séries) : lecture et écriture pures.
import type { ChartModel, Color, Fill, Line, RunProps } from '@forgeoffice/pptx';
import { axisOf } from './chart-elements.ts';

export type ChartElement = 'chartArea' | 'plotArea' | 'title' | 'legend' | 'axisH' | 'axisV' | `series${number}`;

/** Elements presents dans ce graphique, dans l'ordre d'Office. */
export function elementsOf(c: ChartModel): ChartElement[] {
  const out: ChartElement[] = ['chartArea', 'plotArea'];
  // Titre automatique (nom de la serie) d'un graphique a une seule serie compris.
  if (c.title || (c.title === undefined && (c.plots[0]?.series.length ?? 0) === 1)) out.push('title');
  if (c.legend) out.push('legend');
  if (axisOf(c, 'h')) out.push('axisH');
  if (axisOf(c, 'v')) out.push('axisV');
  (c.plots[0]?.series ?? []).forEach((_, i) => out.push(`series${i}`));
  return out;
}

export const seriesIndex = (el: ChartElement): number => (el.startsWith('series') ? Number(el.slice(6)) : -1);

/** Remplissage et contour : zones et series ; les axes n'ont qu'un contour ; titre et legende aucun des deux. */
export const hasFill = (el: ChartElement): boolean => el === 'chartArea' || el === 'plotArea' || el.startsWith('series');
export const hasLine = (el: ChartElement): boolean => el !== 'title' && el !== 'legend';
export const hasText = (el: ChartElement): boolean => el === 'title' || el === 'legend' || el === 'axisH' || el === 'axisV' || el === 'chartArea';

export function fillOf(c: ChartModel, el: ChartElement): Fill | undefined {
  if (el === 'chartArea') return c.chartFill;
  if (el === 'plotArea') return c.plotFill;
  return c.plots[0]?.series[seriesIndex(el)]?.fill;
}

export function lineOf(c: ChartModel, el: ChartElement): Line | undefined {
  if (el === 'chartArea') return c.chartLine;
  if (el === 'plotArea') return c.plotLine;
  if (el === 'axisH' || el === 'axisV') return axisOf(c, el === 'axisH' ? 'h' : 'v')?.line;
  return c.plots[0]?.series[seriesIndex(el)]?.line;
}

export function textOf(c: ChartModel, el: ChartElement): RunProps | undefined {
  if (el === 'title') return c.title?.props;
  if (el === 'legend') return c.legend?.props;
  if (el === 'axisH' || el === 'axisV') return axisOf(c, el === 'axisH' ? 'h' : 'v')?.textProps;
  return c.textProps;
}

/** Remplissage : `null` retire la mise en forme (retour a l'aspect automatique). */
export function setFill(c: ChartModel, el: ChartElement, fill: Fill | null): void {
  if (el === 'chartArea') {
    if (fill) c.chartFill = fill;
    else delete c.chartFill;
  } else if (el === 'plotArea') {
    if (fill) c.plotFill = fill;
    else delete c.plotFill;
  } else {
    const s = c.plots[0]?.series[seriesIndex(el)];
    if (!s) return;
    if (fill) s.fill = fill;
    else delete s.fill;
  }
}

export function setLine(c: ChartModel, el: ChartElement, line: Line | null): void {
  if (el === 'chartArea') {
    if (line) c.chartLine = line;
    else delete c.chartLine;
  } else if (el === 'plotArea') {
    if (line) c.plotLine = line;
    else delete c.plotLine;
  } else if (el === 'axisH' || el === 'axisV') {
    const a = axisOf(c, el === 'axisH' ? 'h' : 'v');
    if (!a) return;
    if (line) a.line = line;
    else delete a.line;
  } else {
    const s = c.plots[0]?.series[seriesIndex(el)];
    if (!s) return;
    if (line) s.line = line;
    else delete s.line;
  }
}

/** Texte (taille, gras, couleur) : fusion dans les proprietes existantes ; la taille et la couleur `undefined` sont retirees. */
export function setText(c: ChartModel, el: ChartElement, patch: { size?: number; bold?: boolean; color?: Color }): void {
  const merge = (cur: RunProps | undefined): RunProps => {
    const next: RunProps = { ...cur };
    if ('size' in patch) next.size = patch.size;
    if ('bold' in patch) next.bold = patch.bold || undefined;
    if ('color' in patch) next.color = patch.color;
    for (const k of Object.keys(next) as Array<keyof RunProps>) if (next[k] === undefined) delete next[k];
    return next;
  };
  if (el === 'title') {
    c.title = { ...(c.title ?? {}), props: merge(c.title?.props) };
  } else if (el === 'legend') {
    if (c.legend) c.legend.props = merge(c.legend.props);
  } else if (el === 'axisH' || el === 'axisV') {
    const a = axisOf(c, el === 'axisH' ? 'h' : 'v');
    if (a) a.textProps = merge(a.textProps);
  } else {
    c.textProps = merge(c.textProps);
  }
}
