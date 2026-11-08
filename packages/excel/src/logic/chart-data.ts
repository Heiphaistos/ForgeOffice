// « Selectionner des donnees » : series d'un graphique sous forme de lignes modifiables (nom, valeurs, categories).
import type { ChartModel, ChartPlot, ChartSeries } from '@forgeoffice/xlsx';

export interface SeriesRow {
  /** Nom : texte libre ou reference de cellule. */
  name: string;
  /** Plage des valeurs (« Feuil1!$B$2:$B$5 » ou « B2:B5 »). */
  values: string;
  /** Plage des etiquettes de categories. */
  categories: string;
}

const isRef = (t: string): boolean => /^(('[^']+'|[\w.]+)!)?\$?[A-Za-z]{1,3}\$?\d+(:\$?[A-Za-z]{1,3}\$?\d+)?$/.test(t.trim());

export function seriesRows(model: ChartModel): SeriesRow[] {
  return model.plots.flatMap((p) => p.series).map((s) => ({
    name: s.name?.ref ?? s.name?.text ?? '',
    values: s.values.ref ?? '',
    categories: s.categories?.ref ?? '',
  }));
}

/** Renvoie les lignes invalides (indices) : valeurs absentes ou qui ne sont pas une plage. */
export function invalidRows(rows: readonly SeriesRow[]): number[] {
  return rows.flatMap((r, i) => (isRef(r.values) && (r.categories.trim() === '' || isRef(r.categories)) ? [] : [i]));
}

/** Reconstruit les series : les lignes remplacent les series existantes dans l'ordre ; les lignes en trop vont dans le premier trace, les series en trop sont retirees. */
export function applySeries(model: ChartModel, rows: readonly SeriesRow[]): ChartModel {
  let k = 0;
  const build = (row: SeriesRow, old: ChartSeries | undefined, idx: number): ChartSeries => {
    const { name: _n, categories: _c, ...rest } = old ?? { idx, order: idx, values: {} };
    const name = row.name.trim();
    return {
      ...rest, idx, order: idx,
      ...(name ? { name: isRef(name) ? { ref: name } : { text: name } } : {}),
      values: { ref: row.values.trim() },
      ...(row.categories.trim() ? { categories: { ref: row.categories.trim() } } : {}),
    };
  };
  const existing = model.plots.reduce((n, p) => n + p.series.length, 0);
  const plots: ChartPlot[] = model.plots.map((p, pi) => {
    const own = p.series.map((s) => {
      const row = rows[k];
      return row ? build(row, s, k++) : undefined;
    }).filter((s): s is ChartSeries => s !== undefined);
    const extra = pi === 0 ? rows.slice(existing).map((row, n) => build(row, undefined, existing + n)) : [];
    return { ...p, series: [...own, ...extra] };
  });
  return { ...model, plots };
}
