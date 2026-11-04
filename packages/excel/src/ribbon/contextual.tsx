// Onglets contextuels : Creation de tableau, Creation de graphique, Analyse du tableau croise dynamique.
import type { GalleryItem, RibbonTab } from '@forgeoffice/ui';
import { CHART_KINDS, CHART_PALETTES, kindOf } from '../logic/charts.ts';
import { TABLE_STYLE_NAMES, tableStyleParts } from '../logic/tables.ts';
import { S, RB } from '../strings.ts';
import type { RibbonEnv } from './env.ts';

const ACCENT = '#107C41';

export function tableTab(e: RibbonEnv): RibbonTab | null {
  const t = e.table;
  if (!t) return null;
  const st = t.style;
  const styles: GalleryItem[] = TABLE_STYLE_NAMES.map((name) => {
    const parts = tableStyleParts(e.wb, name);
    return {
      id: name,
      label: name.replace('TableStyle', ''),
      render: () => (
        <span className="xl-tsprev">
          {[parts.header, parts.band1, parts.band2, parts.band1].map((p, i) => <span key={i} style={{ background: p.fill ?? '#FFFFFF' }} />)}
        </span>
      ),
    };
  });
  return {
    id: 'tableDesign', label: RB.tabs.table, contextual: { set: RB.sets.table, color: ACCENT },
    groups: [
      { id: 'props', label: RB.g.props, icon: 'table', controls: [
        { kind: 'combo', id: 'name', label: RB.tableName, value: t.name, options: [{ value: t.name }], editable: true, width: 110, validate: (v) => (/^[A-Za-z_À-ÿ][\w.À-ÿ]*$/.test(v) ? v : null), onChange: (name) => e.tableOption({ name }) },
      ] },
      { id: 'tools', label: RB.g.tools, icon: 'table_edit', controls: [
        { kind: 'button', id: 'pivot', label: RB.pivotFrom, icon: 'table_lightning', onClick: e.insertPivot },
        { kind: 'button', id: 'dup', label: RB.removeDup, icon: 'table_dismiss', onClick: () => e.ctx.open({ kind: 'removeDup' }) },
        { kind: 'button', id: 'range', label: RB.toRange, icon: 'table_simple', onClick: e.tableToRange },
      ] },
      { id: 'opts', label: RB.g.tableStyleOptions, icon: 'checkbox_checked', controls: [
        { kind: 'checkbox', id: 'header', label: RB.headerRow, checked: t.headerRowCount > 0, onChange: (v) => e.tableOption({ header: v }) },
        { kind: 'checkbox', id: 'total', label: RB.totalRow, checked: t.totalsRowCount > 0, onChange: (v) => e.tableOption({ total: v }) },
        { kind: 'checkbox', id: 'banded', label: RB.bandedRows, checked: st?.showRowStripes ?? true, onChange: (v) => e.tableOption({ showRowStripes: v }) },
        { kind: 'checkbox', id: 'first', label: RB.firstCol, checked: !!st?.showFirstColumn, onChange: (v) => e.tableOption({ showFirstColumn: v }) },
        { kind: 'checkbox', id: 'last', label: RB.lastCol, checked: !!st?.showLastColumn, onChange: (v) => e.tableOption({ showLastColumn: v }) },
        { kind: 'checkbox', id: 'bcols', label: RB.bandedCols, checked: !!st?.showColumnStripes, onChange: (v) => e.tableOption({ showColumnStripes: v }) },
        { kind: 'checkbox', id: 'filter', label: RB.filterBtn, checked: !!t.autoFilter, onChange: (v) => e.tableOption({ filter: v }) },
      ] },
      { id: 'styles', label: RB.g.tableStyles, icon: 'paint_brush', controls: [
        { kind: 'gallery', id: 'style', label: RB.g.tableStyles, items: styles, selectedId: st?.name ?? null, itemWidth: 56, columns: 7, onSelect: (styleName) => e.tableOption({ styleName }) },
      ] },
    ],
  };
}

export function chartTab(e: RibbonEnv): RibbonTab | null {
  const ch = e.chart;
  if (!ch) return null;
  const kind = kindOf(ch.chart);
  const legend = ch.chart.legend?.position ?? 'none';
  const labels = !!ch.chart.plots[0]?.dataLabels?.showValue;
  const grid = ch.chart.axes.some((a) => a.kind === 'value' && a.majorGridlines);
  return {
    id: 'chartDesign', label: RB.tabs.chart, contextual: { set: RB.sets.chart, color: ACCENT },
    groups: [
      { id: 'layouts', label: RB.g.chartLayouts, icon: 'chart_multiple', controls: [
        { kind: 'menu', id: 'title', label: RB.chartTitle, icon: 'text_header_1', items: [
          { id: 'none', label: RB.none, checked: !!ch.chart.autoTitleDeleted || !ch.chart.title, onClick: () => e.chartTitle(false) },
          { id: 'show', label: RB.chartTitle, checked: !ch.chart.autoTitleDeleted && !!ch.chart.title, onClick: () => e.chartTitle(true) },
        ] },
        { kind: 'menu', id: 'legend', label: RB.legend, icon: 'list', items: (['none', 'r', 't', 'l', 'b'] as const).map((p) => ({ id: p, label: S.chart.legendPos[p] ?? p, checked: legend === p, onClick: () => e.chartLegend(p) })) },
        { kind: 'toggle', id: 'labels', label: RB.dataLabels, icon: 'tag', pressed: labels, onToggle: e.chartLabels },
        { kind: 'toggle', id: 'grid', label: RB.gridlinesChart, icon: 'grid', pressed: grid, onToggle: e.chartGrid },
      ] },
      { id: 'styles', label: RB.g.chartStyles, icon: 'color', controls: [
        { kind: 'menu', id: 'colors', label: RB.colors, icon: 'color', size: 'large', items: CHART_PALETTES.map((p, i) => ({
          id: `p${i}`, label: `${RB.colors} ${i + 1}`, adornment: <span className="xl-barprev" style={{ background: `linear-gradient(90deg, ${p.map((c, k) => `#${c} ${(k * 100) / p.length}% ${((k + 1) * 100) / p.length}%`).join(',')})` }} />, onClick: () => e.chartPalette(i),
        })) },
      ] },
      { id: 'data', label: RB.g.data, icon: 'arrow_repeat_all', controls: [
        { kind: 'button', id: 'switch', label: RB.switchRC, icon: 'arrow_repeat_all', size: 'large', onClick: e.chartSwitch },
      ] },
      { id: 'type', label: RB.g.type, icon: 'chart_multiple', controls: [
        { kind: 'menu', id: 'kind', label: RB.changeType, icon: 'chart_multiple', size: 'large', items: CHART_KINDS.map((k) => ({ id: k, label: S.chart.types[k] ?? k, checked: k === kind, onClick: () => e.chartKind(k) })) },
        { kind: 'button', id: 'delete', label: RB.deleteChart, icon: 'delete', size: 'large', onClick: e.chartDelete },
      ] },
    ],
  };
}

export function pivotTab(e: RibbonEnv): RibbonTab | null {
  if (!e.pivotActive) return null;
  return {
    id: 'pivotAnalyze', label: RB.tabs.pivot, contextual: { set: RB.sets.pivot, color: ACCENT },
    groups: [
      { id: 'pt', label: RB.g.pivotTable, icon: 'table_lightning', controls: [
        { kind: 'button', id: 'refresh', label: RB.refresh, icon: 'arrow_sync', size: 'large', onClick: e.pivotRefresh },
        { kind: 'toggle', id: 'list', label: RB.fieldList, icon: 'panel_right', size: 'large', pressed: e.ui.pivotPane, onToggle: (v) => e.setUi({ pivotPane: v }) },
      ] },
    ],
  };
}
