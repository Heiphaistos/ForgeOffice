// Actions de niveau application (graphiques, images, tableaux croises, tableaux, plan, audit, theme, impression)
// utilisees par le ruban ; elles completent les commandes de cellules de commands.ts.
import { editBreaks } from '../logic/pagebreaks.ts';
import type { Scalar } from '@forgeoffice/formulas';
import { whenFontsReady } from '@forgeoffice/ui';
import {
  MAX_COLS, MAX_ROWS, columnName, createSheet, uniqueSheetName, type CellRange, type ChartModel, type ChartObject, type DrawingObject, type ThemeColors,
} from '@forgeoffice/xlsx';
import { buildChart, CHART_PALETTES, kindOf, withKind, type ChartKind } from '../logic/charts.ts';
import { computePivot, writePivot, type PivotCell, type PivotDef } from '../logic/pivot.ts';
import { activeRange } from '../logic/selection.ts';
import { setColumnWidths, setRowHeights } from '../logic/structure.ts';
import { pxToColWidth, pxToRowHeight } from '../logic/geometry.ts';
import { flashFillGuess } from '../logic/fill.ts';
import { tableAt, TOTAL_CODES } from '../logic/tables.ts';
import { cellLook } from '../logic/look.ts';
import { toScalar } from '../logic/engine.ts';
import { fontFamilies } from '../logic/styles.ts';
import { readRange } from './dialogs/basic.tsx';
import type { Ctx } from './commands.ts';
import { PIVOT_LABELS } from './pivotLabels.ts';
import { S } from '../strings/index.ts';

export interface PivotRecord {
  id: number;
  sheet: string;
  anchor: { row: number; col: number };
  def: PivotDef;
  area: CellRange | null;
  fields: string[];
  numeric: boolean[];
  /** Cellules calculees (pour LIREDONNEESTABCROISDYNAMIQUE). */
  cells?: PivotCell[][];
}

export const EMU_PX = 9525;

const THEME_SETS: Readonly<Record<string, Partial<ThemeColors>>> = {
  office: { dk2: '0E2841', lt2: 'E8E8E8', accent1: '156082', accent2: 'E97132', accent3: '196B24', accent4: '0F9ED5', accent5: 'A02B93', accent6: '4EA72E' },
  office2013: { dk2: '44546A', lt2: 'E7E6E6', accent1: '4472C4', accent2: 'ED7D31', accent3: 'A5A5A5', accent4: 'FFC000', accent5: '5B9BD5', accent6: '70AD47' },
  green: { dk2: '455F51', lt2: 'E3DED1', accent1: '549E39', accent2: '8AB833', accent3: 'C0CF3A', accent4: '029676', accent5: '4AB5C4', accent6: '0989B1' },
  blue: { dk2: '17406D', lt2: 'DBEFF9', accent1: '0F6FC6', accent2: '009DD9', accent3: '0BD0D9', accent4: '10CF9B', accent5: '7CCA62', accent6: 'A5C249' },
  red: { dk2: '505046', lt2: 'EEECE1', accent1: 'E84C22', accent2: 'FFBD47', accent3: 'B64926', accent4: 'FF8427', accent5: 'CC9900', accent6: 'B22600' },
  gray: { dk2: '000000', lt2: 'F8F8F8', accent1: 'DDDDDD', accent2: 'B2B2B2', accent3: '969696', accent4: '808080', accent5: '5F5F5F', accent6: '4D4D4D' },
};

/** Plage de 8 x 15 colonnes/lignes a droite des donnees pour un nouveau graphique. */
function chartAnchor(r: CellRange): DrawingObject['anchor'] {
  const col = Math.min(MAX_COLS - 9, r.c2 + 2);
  const row = r.r1;
  return { type: 'twoCell', from: { col, colOffset: 0, row, rowOffset: 0 }, to: { col: col + 7, colOffset: 0, row: row + 15, rowOffset: 0 } };
}

export function makeActions(c: Ctx, extra: {
  selectedDrawing: number | null;
  setSelectedDrawing: (i: number | null) => void;
  pivots: PivotRecord[];
  setPivots: (p: PivotRecord[]) => void;
  setSi: (i: number) => void;
  measure: (text: string, font: string) => number;
  dataRange: () => CellRange;
}) {
  const { store, si } = c;
  /** Ajustement des colonnes : les polices du classeur doivent etre chargees, sinon la mesure se fait avec la police de repli. */
  const afterFonts = (run: () => void): void => void whenFontsReady(fontFamilies(store.wb)).then(run);
  const sheetName = (): string => store.wb.sheets[si]?.name ?? '';
  const chart = (): ChartObject | undefined => {
    const d = extra.selectedDrawing === null ? undefined : c.sheet.drawings[extra.selectedDrawing];
    return d?.kind === 'chart' ? d : undefined;
  };
  const updateChart = (fn: (m: ChartModel) => ChartModel): void => {
    const idx = extra.selectedDrawing;
    const ch = chart();
    if (idx === null || !ch) return;
    store.commit((d) => {
      const sh = d.sheet(si);
      sh.drawings = sh.drawings.map((x, i) => (i === idx && x.kind === 'chart' ? { ...x, chart: fn(x.chart) } : x));
    });
  };
  const pivotData = (sheet: string, range: CellRange): Scalar[][] => {
    const rows: Scalar[][] = [];
    for (let r = range.r1; r <= Math.min(range.r2, range.r1 + 200_000); r++) {
      const line: Scalar[] = [];
      for (let k = range.c1; k <= range.c2; k++) line.push(store.engine.value(sheet, r, k));
      rows.push(line);
    }
    return rows;
  };
  /** Ajuste la largeur des colonnes au texte le plus long (Excel : double-clic sur la bordure). */
  const fitColumns = (d: Parameters<Parameters<typeof store.commit>[0]>[0], index: number, c1: number, c2: number, r1: number, r2: number, widenOnly = false): void => {
    const sh = d.wb.sheets[index];
    if (!sh) return;
    for (let col = c1; col <= c2; col++) {
      const info = sh.cols.find((k) => col >= k.min && col <= k.max);
      if (widenOnly && info?.width !== undefined) continue;
      let max = 0;
      for (const [row, line] of sh.cells) {
        const cell = line.get(col);
        if (row < r1 || row > r2 || !cell) continue;
        const value = cell.formula !== undefined ? store.engine.value(sh.name, row, col) : toScalar(cell.value);
        const l = cellLook(d.wb, cell, value, { colPx: 1000 });
        if (l.text) max = Math.max(max, extra.measure(l.text, l.font) + l.indent * 9);
      }
      if (max > 0 && (!widenOnly || max + 10 > 64)) setColumnWidths(d, index, col, col, pxToColWidth(Math.ceil(max + 10)));
    }
  };
  const renderPivot = (rec: PivotRecord, def: PivotDef, label: (v: Scalar) => string): PivotRecord => {
    const data = pivotData(def.sourceSheet, def.source);
    const res = computePivot(def, data, label, PIVOT_LABELS);
    const target = store.wb.sheets.findIndex((s) => s.name === rec.sheet);
    let area = rec.area;
    if (target >= 0) store.commit((d) => {
      area = writePivot(d, target, rec.anchor, res, rec.area);
      fitColumns(d, target, area.c1, area.c2, area.r1, area.r2);
    });
    return { ...rec, def, area, fields: res.fields, cells: res.cells };
  };

  return {
    chart,
    pivotAt: (sheet: string, row: number, col: number): PivotRecord | undefined =>
      extra.pivots.find((p) => p.sheet === sheet && p.area && row >= p.area.r1 && row <= p.area.r2 && col >= p.area.c1 && col <= p.area.c2),
    insertChart(kind: ChartKind): void {
      const r0 = activeRange(c.sel);
      const r = r0.r1 === r0.r2 && r0.c1 === r0.c2 ? extra.dataRange() : r0;
      let hasNumber = false;
      for (let row = r.r1; row <= Math.min(r.r2, r.r1 + 200) && !hasNumber; row++) for (let col = r.c1; col <= r.c2; col++) if (typeof c.value(row, col) === 'number') hasNumber = true;
      if (!hasNumber) {
        c.notify(S.chart.noData, 'warning');
        return;
      }
      const model = buildChart(kind, sheetName(), r, c.value, S.chart.title);
      let index = 0;
      store.commit((d) => {
        const sh = d.sheet(si);
        const n = sh.drawings.filter((x) => x.kind === 'chart').length + 1;
        sh.drawings = [...sh.drawings, { kind: 'chart', name: `Graphique ${n}`, anchor: chartAnchor(r), chart: model }];
        index = sh.drawings.length - 1;
      });
      extra.setSelectedDrawing(index);
    },
    chartKind: (kind: ChartKind): void => updateChart((m) => withKind(m, kind)),
    chartSwitch: (): void => {
      const ch = chart();
      if (!ch) return;
      const ranges = ch.chart.plots.flatMap((p) => p.series).map((x) => readRange(x.values.ref ?? '')).filter((x): x is CellRange => !!x);
      const first = ranges[0];
      if (!first) return;
      const byRows = first.r1 === first.r2 && ranges.length > 0;
      const all = ranges.reduce((a, b) => ({ r1: Math.min(a.r1, b.r1), c1: Math.min(a.c1, b.c1), r2: Math.max(a.r2, b.r2), c2: Math.max(a.c2, b.c2) }));
      const full = { r1: Math.max(0, all.r1 - 1), c1: Math.max(0, all.c1 - 1), r2: all.r2, c2: all.c2 };
      const series = buildChart('col', sheetName(), full, c.value, S.chart.title, !byRows).plots.flatMap((p) => p.series);
      updateChart((m) => withKind(m, kindOf(m), series));
    },
    chartLegend: (pos: 'r' | 'b' | 't' | 'l' | 'none'): void => updateChart((m) => {
      const out = { ...m };
      if (pos === 'none') delete out.legend;
      else out.legend = { position: pos };
      return out;
    }),
    chartLabels: (show: boolean): void => updateChart((m) => ({ ...m, plots: m.plots.map((p) => ({ ...p, dataLabels: { ...p.dataLabels, showValue: show } })) })),
    chartTitle: (show: boolean): void => updateChart((m) => ({ ...m, autoTitleDeleted: !show, ...(show && !m.title ? { title: { text: S.chart.title } } : {}) })),
    chartGrid: (show: boolean): void => updateChart((m) => ({ ...m, axes: m.axes.map((a) => (a.kind === 'value' ? { ...a, majorGridlines: show } : a)) })),
    chartPalette: (index: number): void => {
      const pal = CHART_PALETTES[index] ?? CHART_PALETTES[0] ?? [];
      updateChart((m) => {
        let k = 0;
        return { ...m, plots: m.plots.map((p) => ({ ...p, series: p.series.map((s) => {
          const color = pal[k % pal.length] ?? '156082';
          k++;
          const points = p.varyColors ? Object.fromEntries((s.values.cache ?? Array.from({ length: 24 })).map((_, i) => [i, pal[i % pal.length] ?? color])) : undefined;
          return { ...s, color, ...(points ? { pointColors: points } : {}) };
        }) })) };
      });
    },
    chartDelete: (): void => {
      const idx = extra.selectedDrawing;
      if (idx === null) return;
      store.commit((d) => {
        const sh = d.sheet(si);
        sh.drawings = sh.drawings.filter((_, i) => i !== idx);
      });
      extra.setSelectedDrawing(null);
    },
    async insertImage(): Promise<void> {
      const f = await c.services.openFile([{ name: S.image, extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'] }]);
      if (!f) return;
      if (f.bytes.length > 20_000_000) {
        c.notify(S.imageTooBig, 'error');
        return;
      }
      const ext = f.name.slice(f.name.lastIndexOf('.') + 1).toLowerCase();
      const type = ext === 'jpg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
      const size = await new Promise<{ w: number; h: number }>((resolve) => {
        const url = URL.createObjectURL(new Blob([f.bytes as BlobPart], { type }));
        const img = new Image();
        img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
        img.onerror = () => { resolve({ w: 320, h: 240 }); URL.revokeObjectURL(url); };
        img.src = url;
      });
      const k = Math.min(1, 480 / Math.max(1, size.w));
      const a = c.sel.active;
      store.commit((d) => {
        const sh = d.sheet(si);
        sh.drawings = [...sh.drawings, {
          kind: 'image', name: f.name, description: S.imageAlt, data: f.bytes, contentType: type,
          anchor: { type: 'oneCell', from: { col: a.col, colOffset: 0, row: a.row, rowOffset: 0 }, width: Math.round(size.w * k * EMU_PX), height: Math.round(size.h * k * EMU_PX) },
        }];
      });
    },
    createPivot(source: string, newSheet: boolean): void {
      const range = readRange(source);
      if (!range) return;
      const srcSheet = source.includes('!') ? source.slice(0, source.lastIndexOf('!')).replace(/^'|'$/g, '') : sheetName();
      let target = si;
      let anchor = { row: c.sel.active.row, col: c.sel.active.col };
      if (newSheet) {
        store.commit((d) => {
          const sh = createSheet(uniqueSheetName(d.wb, `${S.pivot.sheetName}${extra.pivots.length + 1}`));
          d.wb.sheets.splice(si, 0, sh);
          target = si;
        });
        anchor = { row: 2, col: 0 };
      }
      const data = pivotData(srcSheet, range);
      const numeric = (data[0] ?? []).map((_, k) => data.slice(1).some((row) => typeof row[k] === 'number'));
      const rec: PivotRecord = {
        id: Date.now(), sheet: store.wb.sheets[target]?.name ?? '', anchor, area: null, fields: (data[0] ?? []).map((v, i) => (v === null || v === '' ? `${S.pivot.values} ${i + 1}` : String(v))), numeric,
        def: { sourceSheet: srcSheet, source: range, rows: [], cols: [], values: [], filters: [] },
      };
      const out = renderPivot(rec, rec.def, (v) => (v === null ? '' : String(v)));
      extra.setPivots([...extra.pivots, out]);
      extra.setSi(target);
    },
    updatePivot(rec: PivotRecord, def: PivotDef, label: (v: Scalar) => string): void {
      const out = renderPivot(rec, def, label);
      extra.setPivots(extra.pivots.map((p) => (p.id === rec.id ? out : p)));
    },
    refreshPivots(label: (v: Scalar) => string): void {
      extra.setPivots(extra.pivots.map((p) => renderPivot(p, p.def, label)));
    },
    autofit(axis: 'row' | 'col'): void {
      const ranges = c.sel.ranges;
      afterFonts(() => store.commit((d) => {
        for (const r of ranges) {
          if (axis === 'col') {
            fitColumns(d, si, r.c1, Math.min(r.c2, r.c1 + 200), r.r1, r.r2);
            continue;
          }
          for (let row = r.r1; row <= Math.min(r.r2, r.r1 + 5000); row++) {
            const info = d.wb.sheets[si]?.rows.get(row);
            if (info?.height === undefined) continue;
            const next = { ...info };
            delete next.height;
            d.sheet(si).rows.set(row, next);
          }
        }
      }));
    },
    /** Elargit les colonnes standard de la selection dont le contenu ne tient plus (format de nombre). */
    widenSelection(): void {
      store.commit((d) => {
        for (const r of c.sel.ranges) fitColumns(d, si, r.c1, Math.min(r.c2, r.c1 + 50), r.r1, Math.min(r.r2, r.r1 + 5000), true);
      }, 'widen');
    },
    autofitColumn(first: number, last: number): void {
      afterFonts(() => store.commit((d) => fitColumns(d, si, first, last, 0, MAX_ROWS - 1)));
    },
    outline(axis: 'row' | 'col', delta: 1 | -1): void {
      const r = activeRange(c.sel);
      store.commit((d) => {
        const sh = d.sheet(si);
        if (axis === 'row') {
          for (let row = r.r1; row <= Math.min(r.r2, r.r1 + 100_000); row++) {
            const info = sh.rows.get(row);
            const level = Math.max(0, Math.min(7, (info?.outlineLevel ?? 0) + delta));
            sh.rows.set(row, { ...info, outlineLevel: level, ...(level === 0 ? { hidden: false } : {}) });
          }
        } else {
          const cols = [...sh.cols];
          for (let col = r.c1; col <= Math.min(r.c2, r.c1 + 1000); col++) {
            const cur = cols.find((k) => col >= k.min && col <= k.max)?.outlineLevel ?? 0;
            setColumnWidths(d, si, col, col, undefined);
            const after = d.sheet(si).cols.map((k) => (col >= k.min && col <= k.max ? { ...k, outlineLevel: Math.max(0, Math.min(7, cur + delta)) } : k));
            d.sheet(si).cols = after;
          }
        }
      });
    },
    showDetail(show: boolean): void {
      const r = activeRange(c.sel);
      store.commit((d) => {
        const sh = d.sheet(si);
        const start = Math.max(0, r.r1 - 1);
        for (let row = start; row <= Math.min(MAX_ROWS - 1, r.r2 + 20_000); row++) {
          const info = sh.rows.get(row);
          if (!info?.outlineLevel) {
            if (row > r.r2) break;
            continue;
          }
          sh.rows.set(row, { ...info, hidden: !show });
        }
      });
    },
    flashFill(): void {
      const a = c.sel.active;
      const sh = c.sheet;
      const example = sh.cells.get(a.row)?.get(a.col);
      const left = c.value(a.row, a.col - 1);
      if (a.col === 0 || typeof example?.value !== 'string' || typeof left !== 'string') {
        c.notify(S.noData, 'info');
        return;
      }
      store.commit((d) => {
        for (let row = a.row + 1; row < a.row + 100_000; row++) {
          const src = c.value(row, a.col - 1);
          if (typeof src !== 'string' || src === '') break;
          const guess = flashFillGuess({ source: left, result: String(example.value) }, src);
          if (guess !== undefined) d.set(si, row, a.col, { value: guess });
        }
      });
    },
    tableOption(patch: { total?: boolean; header?: boolean; filter?: boolean; name?: string; styleName?: string; showRowStripes?: boolean; showColumnStripes?: boolean; showFirstColumn?: boolean; showLastColumn?: boolean }): void {
      const a = c.sel.active;
      const t = tableAt(c.sheet, a.row, a.col);
      if (!t) return;
      store.commit((d) => {
        const sh = d.sheet(si);
        let next = { ...t, style: { ...(t.style ?? { name: 'TableStyleMedium2', showFirstColumn: false, showLastColumn: false, showRowStripes: true, showColumnStripes: false }) } };
        if (patch.styleName) next.style.name = patch.styleName;
        for (const k of ['showRowStripes', 'showColumnStripes', 'showFirstColumn', 'showLastColumn'] as const) if (patch[k] !== undefined) next.style[k] = patch[k] ?? false;
        if (patch.name && /^[A-Za-z_À-ÿ][\w.À-ÿ]*$/.test(patch.name)) next = { ...next, name: patch.name, displayName: patch.name };
        if (patch.filter !== undefined) {
          if (patch.filter) next.autoFilter = { ref: next.ref, columns: [] };
          else delete next.autoFilter;
        }
        if (patch.total !== undefined && patch.total !== next.totalsRowCount > 0) {
          if (patch.total) {
            const row = next.ref.r2 + 1;
            next = { ...next, ref: { ...next.ref, r2: row }, totalsRowCount: 1, totalsRowShown: true };
            const lastCol = next.ref.c2;
            d.set(si, row, next.ref.c1, { value: 'Total' });
            d.set(si, row, lastCol, { value: null, formula: `SUBTOTAL(${TOTAL_CODES.sum},${columnName(lastCol)}${next.ref.r1 + 2}:${columnName(lastCol)}${row})` });
            next.columns = next.columns.map((k, i) => (i === lastCol - next.ref.c1 ? { ...k, totalsRowFunction: 'sum' as const } : i === 0 ? { ...k, totalsRowLabel: 'Total' } : k));
          } else {
            for (let col = next.ref.c1; col <= next.ref.c2; col++) d.set(si, next.ref.r2, col, undefined);
            next = { ...next, ref: { ...next.ref, r2: next.ref.r2 - 1 }, totalsRowCount: 0, totalsRowShown: false };
          }
          if (next.autoFilter) next.autoFilter = { ...next.autoFilter, ref: { ...next.ref, r2: next.ref.r2 - next.totalsRowCount } };
        }
        sh.tables = sh.tables.map((x) => (x === t ? next : x));
      });
    },
    tableToRange(): void {
      const a = c.sel.active;
      const t = tableAt(c.sheet, a.row, a.col);
      if (!t) return;
      store.commit((d) => {
        const sh = d.sheet(si);
        sh.tables = sh.tables.filter((x) => x !== t);
      });
    },
    themeColors(name: string): void {
      const set = THEME_SETS[name];
      if (!set) return;
      store.commit((d) => {
        d.wb.theme = { ...d.wb.theme, colors: { ...d.wb.theme.colors, ...set }, colorSchemeName: name };
        delete d.wb.theme.xml;
      });
    },
    printArea(set: boolean | 'add'): void {
      store.commit((d) => {
        const sh = d.sheet(si);
        const ps = { ...sh.pageSetup };
        if (set === 'add') ps.printArea = [...(ps.printArea ?? []), ...c.sel.ranges];
        else if (set) ps.printArea = [...c.sel.ranges];
        else delete ps.printArea;
        sh.pageSetup = ps;
      });
    },
    pageBreak(op: 'insert' | 'remove' | 'reset'): void {
      store.commit((d) => {
        const sh = d.sheet(si);
        sh.pageSetup = { ...sh.pageSetup, ...editBreaks(sh.pageSetup, op, c.sel.active) };
      });
    },
    resizeLive(axis: 'row' | 'col', first: number, last: number, px: number): void {
      store.commit((d) => {
        if (axis === 'col') setColumnWidths(d, si, first, last, pxToColWidth(px), px === 0 ? true : undefined);
        else setRowHeights(d, si, first, last, pxToRowHeight(px), px === 0 ? true : undefined);
      }, `resize-${axis}-${first}`);
    },
    moveDrawing(index: number, anchor: DrawingObject['anchor']): void {
      store.commit((d) => {
        const sh = d.sheet(si);
        sh.drawings = sh.drawings.map((x, i) => (i === index ? { ...x, anchor } : x));
      }, `draw-${index}`);
    },
  };
}

export type Actions = ReturnType<typeof makeActions>;
