// Onglets Insertion, Mise en page, Formules, Donnees, Revision, Affichage.
import type { MenuItem, RibbonTab } from '@forgeoffice/ui';
import { functionCatalog } from '../logic/formula-ui.ts';
import { S, RB } from '../strings.ts';
import type { RibbonEnv } from './env.ts';

const THEMES = ['office', 'office2013', 'green', 'blue', 'red', 'gray'] as const;

function fnMenu(e: RibbonEnv, category: string): MenuItem[] {
  return functionCatalog().filter((f) => f.category === category).map((f) => ({ id: f.canonical, label: f.name, description: f.description || undefined, onClick: () => e.insertFunction(f.name) }));
}

export function insertTab(e: RibbonEnv): RibbonTab {
  return {
    id: 'insert', label: RB.tabs.insert, keytip: 'N',
    groups: [
      { id: 'tables', label: RB.g.tables, icon: 'table', controls: [
        { kind: 'button', id: 'pivot', label: RB.pivot, icon: 'table_lightning', size: 'large', onClick: e.insertPivot },
        { kind: 'button', id: 'table', label: RB.table, icon: 'table_add', size: 'large', onClick: () => e.cmd.formatAsTable('TableStyleMedium2'), tooltip: { title: RB.table, shortcut: 'Ctrl+L' } },
      ] },
      { id: 'illus', label: RB.g.illustrations, icon: 'image', controls: [
        { kind: 'button', id: 'image', label: RB.pictures, icon: 'image_add', size: 'large', onClick: e.insertImage },
      ] },
      { id: 'charts', label: RB.g.charts, icon: 'chart_multiple', controls: [
        { kind: 'button', id: 'recommended', label: RB.recommended, icon: 'chart_multiple', size: 'large', onClick: () => e.insertChart('col') },
        { kind: 'row', id: 'c1', controls: [
          { kind: 'menu', id: 'col', label: RB.chartCol, icon: 'data_bar_vertical', iconOnly: true, items: [
            { id: 'col', label: S.chart.types.col ?? '', onClick: () => e.insertChart('col') },
            { id: 'colStacked', label: S.chart.types.colStacked ?? '', onClick: () => e.insertChart('colStacked') },
            { id: 'bar', label: S.chart.types.bar ?? '', icon: 'data_bar_horizontal', onClick: () => e.insertChart('bar') },
          ] },
          { kind: 'menu', id: 'line', label: RB.chartLine, icon: 'data_line', iconOnly: true, items: [
            { id: 'line', label: S.chart.types.line ?? '', onClick: () => e.insertChart('line') },
            { id: 'lineMarkers', label: S.chart.types.lineMarkers ?? '', onClick: () => e.insertChart('lineMarkers') },
            { id: 'area', label: S.chart.types.area ?? '', icon: 'data_area', onClick: () => e.insertChart('area') },
          ] },
          { kind: 'menu', id: 'pie', label: RB.chartPie, icon: 'data_pie', iconOnly: true, items: [
            { id: 'pie', label: S.chart.types.pie ?? '', onClick: () => e.insertChart('pie') },
            { id: 'doughnut', label: S.chart.types.doughnut ?? '', onClick: () => e.insertChart('doughnut') },
          ] },
        ] },
        { kind: 'row', id: 'c2', controls: [
          { kind: 'button', id: 'scatter', label: RB.chartScatter, icon: 'data_scatter', iconOnly: true, onClick: () => e.insertChart('scatter') },
          { kind: 'button', id: 'combo', label: RB.chartCombo, icon: 'data_histogram', iconOnly: true, onClick: () => e.insertChart('combo') },
          { kind: 'button', id: 'area', label: S.chart.types.area ?? '', icon: 'data_area', iconOnly: true, onClick: () => e.insertChart('area') },
        ] },
      ] },
      { id: 'spark', label: RB.g.sparklines, icon: 'data_trending', controls: [
        { kind: 'button', id: 'spline', label: RB.spLine, icon: 'data_line', onClick: () => e.ctx.open({ kind: 'sparkline', type: 'line' }) },
        { kind: 'button', id: 'spcol', label: RB.spCol, icon: 'data_bar_vertical', onClick: () => e.ctx.open({ kind: 'sparkline', type: 'column' }) },
        { kind: 'button', id: 'spwin', label: RB.spWin, icon: 'data_waterfall', onClick: () => e.ctx.open({ kind: 'sparkline', type: 'stacked' }) },
      ] },
      { id: 'filters', label: RB.g.filters, icon: 'filter', controls: [
        { kind: 'button', id: 'filter', label: RB.filter, icon: 'filter', size: 'large', onClick: e.cmd.toggleFilter },
      ] },
      { id: 'links', label: RB.g.links, icon: 'link', controls: [
        { kind: 'button', id: 'link', label: RB.link, icon: 'link', size: 'large', onClick: () => e.ctx.open({ kind: 'link' }), tooltip: { title: RB.link, shortcut: 'Ctrl+K' } },
      ] },
      { id: 'comments', label: RB.g.comments, icon: 'comment', controls: [
        { kind: 'button', id: 'comment', label: RB.comment, icon: 'comment_add', size: 'large', onClick: e.insertComment },
      ] },
      { id: 'symbols', label: RB.g.symbols, icon: 'symbols', controls: [
        { kind: 'button', id: 'symbol', label: RB.symbol, icon: 'symbols', size: 'large', onClick: () => e.ctx.open({ kind: 'symbol' }) },
      ] },
    ],
  };
}

export function layoutTab(e: RibbonEnv): RibbonTab {
  const ps = e.sheet.pageSetup;
  const m = (left: number, top: number, header: number) => ({ left, right: left, top, bottom: top, header, footer: header });
  return {
    id: 'layout', label: RB.tabs.layout, keytip: 'P',
    groups: [
      { id: 'themes', label: RB.g.themes, icon: 'color', controls: [
        { kind: 'menu', id: 'colors', label: RB.themesColors, icon: 'color', size: 'large', items: THEMES.map((t) => ({ id: t, label: RB.themeNames[t] ?? t, onClick: () => e.themeColors(t) })) },
      ] },
      { id: 'page', label: RB.g.pageSetup, icon: 'document_margins', controls: [
        { kind: 'menu', id: 'margins', label: RB.margins, icon: 'document_margins', size: 'large', items: [
          { id: 'n', label: RB.marginsNormal, onClick: () => e.cmd.pageSetup({ margins: m(0.7, 0.75, 0.3) }) },
          { id: 'w', label: RB.marginsWide, onClick: () => e.cmd.pageSetup({ margins: m(1, 1, 0.5) }) },
          { id: 's', label: RB.marginsNarrow, onClick: () => e.cmd.pageSetup({ margins: m(0.25, 0.75, 0.3) }) },
        ] },
        { kind: 'menu', id: 'orient', label: RB.orientationPage, icon: 'document_landscape', size: 'large', items: [
          { id: 'p', label: RB.portrait, checked: ps.orientation !== 'landscape', onClick: () => e.cmd.pageSetup({ orientation: 'portrait' }) },
          { id: 'l', label: RB.landscape, checked: ps.orientation === 'landscape', onClick: () => e.cmd.pageSetup({ orientation: 'landscape' }) },
        ] },
        { kind: 'menu', id: 'size', label: RB.pageSize, icon: 'document', size: 'large', items: [
          { id: 'a4', label: S.print.a4, checked: (ps.paperSize ?? 9) === 9, onClick: () => e.cmd.pageSetup({ paperSize: 9 }) },
          { id: 'letter', label: S.print.letter, checked: ps.paperSize === 1, onClick: () => e.cmd.pageSetup({ paperSize: 1 }) },
        ] },
        { kind: 'menu', id: 'area', label: RB.printArea, icon: 'print', size: 'large', items: [
          { id: 'set', label: RB.setPrintArea, onClick: () => e.printArea(true) },
          { id: 'clear', label: RB.clearPrintArea, onClick: () => e.printArea(false) },
        ] },
        { kind: 'menu', id: 'breaks', label: RB.breaks, icon: 'document_page_break', size: 'large', items: [
          { id: 'ins', label: RB.insertBreak, onClick: () => e.pageBreak('insert') },
          { id: 'rem', label: RB.removeBreak, onClick: () => e.pageBreak('remove') },
          { id: 'reset', label: RB.resetBreaks, onClick: () => e.pageBreak('reset') },
        ] },
      ] },
      { id: 'scale', label: RB.g.scale, icon: 'page_fit', controls: [
        { kind: 'checkbox', id: 'fit', label: RB.scaleFit, checked: !!ps.fitToPage, onChange: (v) => e.cmd.pageSetup({ fitToPage: v, fitToWidth: 1, fitToHeight: 1 }) },
        { kind: 'number', id: 'scale', label: RB.scale, value: ps.scale ?? 100, min: 10, max: 400, step: 5, unit: '%', width: 64, onChange: (v) => e.cmd.pageSetup({ scale: v, fitToPage: false }) },
      ] },
      { id: 'opts', label: RB.g.sheetOptions, icon: 'grid', controls: [
        { kind: 'checkbox', id: 'gv', label: `${RB.gridlines} : ${RB.viewOpt}`, checked: e.sheet.view.showGridLines, onChange: (v) => e.cmd.view({ showGridLines: v }) },
        { kind: 'checkbox', id: 'gp', label: `${RB.gridlines} : ${RB.printOpt}`, checked: !!ps.printGridLines, onChange: (v) => e.cmd.pageSetup({ printGridLines: v }) },
        { kind: 'checkbox', id: 'hv', label: `${RB.headings} : ${RB.viewOpt}`, checked: e.sheet.view.showHeaders, onChange: (v) => e.cmd.view({ showHeaders: v }) },
        { kind: 'checkbox', id: 'hp', label: `${RB.headings} : ${RB.printOpt}`, checked: !!ps.printHeadings, onChange: (v) => e.cmd.pageSetup({ printHeadings: v }) },
      ] },
    ],
  };
}

export function formulasTab(e: RibbonEnv): RibbonTab {
  const cat = (id: string, label: string, icon: 'currency_dollar_euro' | 'checkbox_checked' | 'text_t' | 'calendar_ltr' | 'search' | 'math_formula' | 'more_horizontal', category: string): RibbonTab['groups'][number]['controls'][number] =>
    ({ kind: 'menu', id, label, icon, items: fnMenu(e, category) });
  return {
    id: 'formulas', label: RB.tabs.formulas, keytip: 'U',
    groups: [
      { id: 'lib', label: RB.g.library, icon: 'math_formula', controls: [
        { kind: 'button', id: 'insfn', label: RB.insertFn, icon: 'math_formula', size: 'large', onClick: () => e.insertFunction(), tooltip: { title: RB.insertFn, shortcut: 'Maj+F3' } },
        { kind: 'split', id: 'autosum', label: RB.autoSum, icon: 'autosum', size: 'large', onClick: () => e.cmd.autoSum('SUM'), items: [
          { id: 'sum', label: RB.sum, onClick: () => e.cmd.autoSum('SUM') },
          { id: 'avg', label: RB.average, onClick: () => e.cmd.autoSum('AVERAGE') },
          { id: 'cnt', label: RB.countNumbers, onClick: () => e.cmd.autoSum('COUNT') },
          { id: 'max', label: RB.max, onClick: () => e.cmd.autoSum('MAX') },
          { id: 'min', label: RB.min, onClick: () => e.cmd.autoSum('MIN') },
        ] },
        cat('fin', RB.financial, 'currency_dollar_euro', 'financial'),
        cat('log', RB.logical, 'checkbox_checked', 'logical'),
        cat('txt', RB.text, 'text_t', 'text'),
        cat('date', RB.dateTime, 'calendar_ltr', 'date'),
        cat('look', RB.lookup, 'search', 'lookup'),
        cat('math', RB.math, 'math_formula', 'math'),
        { kind: 'menu', id: 'more', label: RB.moreFns, icon: 'more_horizontal', items: (['stats', 'engineering', 'info', 'database', 'compat'] as const).map((c) => ({ id: c, label: S.categories[c] ?? c, items: fnMenu(e, c) })) },
      ] },
      { id: 'names', label: RB.g.names, icon: 'tag', controls: [
        { kind: 'button', id: 'mgr', label: RB.nameManager, icon: 'tag', size: 'large', onClick: () => e.ctx.open({ kind: 'names' }), tooltip: { title: RB.nameManager, shortcut: 'Ctrl+F3' } },
        { kind: 'button', id: 'def', label: RB.defineName, icon: 'tag', onClick: () => e.ctx.open({ kind: 'names' }) },
        { kind: 'menu', id: 'use', label: RB.useInFormula, icon: 'math_formula', items: e.wb.definedNames.filter((n) => !n.name.startsWith('_xlnm')).map((n) => ({ id: n.name, label: n.name, onClick: () => e.insertFunction(`=${n.name}`) })) },
      ] },
      { id: 'audit', label: RB.g.audit, icon: 'arrow_flow_diagonal_up_right', controls: [
        { kind: 'button', id: 'prec', label: RB.precedents, icon: 'arrow_flow_diagonal_up_right', onClick: () => e.trace('precedents') },
        { kind: 'button', id: 'dep', label: RB.dependents, icon: 'arrow_routing', onClick: () => e.trace('dependents') },
        { kind: 'button', id: 'rm', label: RB.removeArrows, icon: 'dismiss', disabled: !e.ui.arrows, onClick: () => e.trace('clear') },
        { kind: 'toggle', id: 'show', label: RB.showFormulas, icon: 'math_formula', pressed: e.ui.showFormulas, onToggle: (v) => e.setUi({ showFormulas: v }), tooltip: { title: RB.showFormulas, shortcut: 'Ctrl+"' } },
        { kind: 'button', id: 'eval', label: RB.evaluate, icon: 'arrow_step_in', onClick: () => e.ctx.open({ kind: 'evaluate' }) },
      ] },
      { id: 'calc', label: RB.g.calc, icon: 'calculator', controls: [
        { kind: 'menu', id: 'opts', label: RB.calcOptions, icon: 'calculator', size: 'large', items: [
          { id: 'auto', label: RB.calcAuto, checked: !e.ui.calcManual, onClick: () => e.setUi({ calcManual: false }) },
          { id: 'manual', label: RB.calcManual, checked: e.ui.calcManual, onClick: () => e.setUi({ calcManual: true }) },
        ] },
        { kind: 'button', id: 'now', label: RB.calcNow, icon: 'calculator_arrow_clockwise', onClick: e.recalc, tooltip: { title: RB.calcNow, shortcut: 'F9' } },
      ] },
    ],
  };
}

export function dataTab(e: RibbonEnv): RibbonTab {
  return {
    id: 'data', label: RB.tabs.data, keytip: 'D',
    groups: [
      { id: 'get', label: RB.g.getData, icon: 'database_arrow_down', controls: [
        { kind: 'button', id: 'csv', label: RB.importCsv, icon: 'document_text', size: 'large', onClick: e.importCsv },
      ] },
      { id: 'queries', label: RB.g.queries, icon: 'arrow_sync', controls: [
        { kind: 'button', id: 'refresh', label: RB.refreshAll, icon: 'arrow_sync', size: 'large', onClick: () => { e.recalc(); e.pivotRefresh(); } },
      ] },
      { id: 'sort', label: RB.g.sortFilter, icon: 'arrow_sort', controls: [
        { kind: 'button', id: 'asc', label: RB.sortAsc, icon: 'text_sort_ascending', iconOnly: true, onClick: () => e.cmd.sortQuick(false) },
        { kind: 'button', id: 'desc', label: RB.sortDesc, icon: 'text_sort_descending', iconOnly: true, onClick: () => e.cmd.sortQuick(true) },
        { kind: 'button', id: 'sort', label: RB.sortBtn, icon: 'arrow_sort', size: 'large', onClick: () => e.ctx.open({ kind: 'sort' }) },
        { kind: 'toggle', id: 'filter', label: RB.filter, icon: 'filter', size: 'large', pressed: !!e.sheet.autoFilter, onToggle: e.cmd.toggleFilter },
        { kind: 'button', id: 'clear', label: RB.clearFilter, icon: 'filter_dismiss', disabled: !e.sheet.autoFilter, onClick: e.cmd.clearFilters },
        { kind: 'button', id: 're', label: RB.reapply, icon: 'arrow_clockwise', disabled: !e.sheet.autoFilter, onClick: e.cmd.reapplyFilter },
      ] },
      { id: 'tools', label: RB.g.dataTools, icon: 'table_edit', controls: [
        { kind: 'button', id: 'ttc', label: RB.textToCols, icon: 'column_triple', size: 'large', onClick: () => e.ctx.open({ kind: 'textToCols' }) },
        { kind: 'button', id: 'flash', label: RB.flashFill, icon: 'flow', onClick: e.flashFill },
        { kind: 'button', id: 'dup', label: RB.removeDup, icon: 'table_dismiss', onClick: () => e.ctx.open({ kind: 'removeDup' }) },
        { kind: 'button', id: 'val', label: RB.validation, icon: 'checkbox_checked', onClick: () => e.ctx.open({ kind: 'validation' }) },
      ] },
      { id: 'outline', label: RB.g.outline, icon: 'group', controls: [
        { kind: 'split', id: 'group', label: RB.group, icon: 'group', size: 'large', onClick: () => e.outline('row', 1), items: [
          { id: 'r', label: `${RB.group} (lignes)`, onClick: () => e.outline('row', 1) },
          { id: 'c', label: `${RB.group} (colonnes)`, onClick: () => e.outline('col', 1) },
        ] },
        { kind: 'split', id: 'ungroup', label: RB.ungroup, icon: 'group_dismiss', size: 'large', onClick: () => e.outline('row', -1), items: [
          { id: 'r', label: `${RB.ungroup} (lignes)`, onClick: () => e.outline('row', -1) },
          { id: 'c', label: `${RB.ungroup} (colonnes)`, onClick: () => e.outline('col', -1) },
        ] },
        { kind: 'button', id: 'sub', label: RB.subtotal, icon: 'autosum', size: 'large', onClick: () => e.ctx.open({ kind: 'subtotal' }) },
        { kind: 'button', id: 'show', label: RB.showDetail, icon: 'add', onClick: () => e.showDetail(true) },
        { kind: 'button', id: 'hide', label: RB.hideDetail, icon: 'subtract', onClick: () => e.showDetail(false) },
      ] },
    ],
  };
}

export function reviewTab(e: RibbonEnv): RibbonTab {
  const sheetProtected = !!e.sheet.protection?.sheet;
  const bookProtected = !!e.wb.protection?.lockStructure;
  return {
    id: 'review', label: RB.tabs.review, keytip: 'R',
    groups: [
      { id: 'comments', label: RB.g.comments, icon: 'comment', controls: [
        { kind: 'button', id: 'new', label: RB.newComment, icon: 'comment_add', size: 'large', onClick: e.insertComment },
        { kind: 'button', id: 'del', label: RB.delComment, icon: 'delete', onClick: () => e.cmd.clear('comments') },
        { kind: 'toggle', id: 'pane', label: RB.showComments, icon: 'comment_multiple', size: 'large', pressed: e.ui.commentsPane, onToggle: (v) => e.setUi({ commentsPane: v }) },
      ] },
      { id: 'notes', label: RB.g.notes, icon: 'note', controls: [
        { kind: 'button', id: 'note', label: RB.newNote, icon: 'note', size: 'large', onClick: () => e.ctx.open({ kind: 'note' }), tooltip: { title: RB.newNote, shortcut: 'Maj+F2' } },
      ] },
      { id: 'protect', label: RB.g.protect, icon: 'shield_lock', controls: [
        { kind: 'button', id: 'ps', label: sheetProtected ? RB.unprotectSheet : RB.protectSheet, icon: sheetProtected ? 'lock_open' : 'shield_lock', size: 'large', onClick: () => e.protectToggle('sheet') },
        { kind: 'button', id: 'pb', label: bookProtected ? RB.unprotectBook : RB.protectBook, icon: bookProtected ? 'lock_open' : 'lock_closed', size: 'large', onClick: () => e.protectToggle('book') },
      ] },
    ],
  };
}

export function viewTab(e: RibbonEnv): RibbonTab {
  const v = e.sheet.view;
  return {
    id: 'view', label: RB.tabs.view, keytip: 'A',
    groups: [
      { id: 'views', label: RB.g.views, icon: 'document_one_page', controls: [
        { kind: 'toggle', id: 'normal', label: RB.normal, icon: 'grid', size: 'large', pressed: v.view === 'normal', onToggle: () => e.cmd.view({ view: 'normal' }) },
        { kind: 'toggle', id: 'break', label: RB.pageBreak, icon: 'document_page_break', size: 'large', pressed: v.view === 'pageBreakPreview', onToggle: () => e.cmd.view({ view: 'pageBreakPreview' }) },
        { kind: 'toggle', id: 'layout', label: RB.pageLayout, icon: 'document_one_page', size: 'large', pressed: v.view === 'pageLayout', onToggle: () => e.cmd.view({ view: 'pageLayout' }) },
      ] },
      { id: 'show', label: RB.g.show, icon: 'eye', controls: [
        { kind: 'checkbox', id: 'grid', label: RB.gridlines, checked: v.showGridLines, onChange: (x) => e.cmd.view({ showGridLines: x }) },
        { kind: 'checkbox', id: 'fbar', label: RB.formulaBar, checked: e.ui.formulaBar, onChange: (x) => e.setUi({ formulaBar: x }) },
        { kind: 'checkbox', id: 'heads', label: RB.headings, checked: v.showHeaders, onChange: (x) => e.cmd.view({ showHeaders: x }) },
      ] },
      { id: 'zoom', label: RB.g.zoom, icon: 'zoom_in', controls: [
        { kind: 'button', id: 'zoom', label: RB.zoom, icon: 'zoom_in', size: 'large', onClick: () => e.ctx.open({ kind: 'zoom' }) },
        { kind: 'button', id: 'z100', label: RB.zoom100, icon: 'zoom_fit', size: 'large', onClick: () => e.setZoom(100) },
        { kind: 'button', id: 'zsel', label: RB.zoomSel, icon: 'arrow_fit', size: 'large', onClick: e.zoomToSelection },
      ] },
      { id: 'window', label: RB.g.window, icon: 'window', controls: [
        { kind: 'button', id: 'new', label: RB.newWindow, icon: 'window_new', size: 'large', onClick: e.newWindow },
        { kind: 'menu', id: 'freeze', label: RB.freeze, icon: 'table_freeze_column_and_row', size: 'large', items: [
          v.frozen ? { id: 'unfreeze', label: RB.unfreeze, onClick: () => e.cmd.freeze('none') } : { id: 'panes', label: RB.freezePanes, icon: 'table_freeze_column_and_row', onClick: () => e.cmd.freeze('panes') },
          { id: 'row', label: RB.freezeRow, icon: 'table_freeze_row', onClick: () => e.cmd.freeze('row') },
          { id: 'col', label: RB.freezeCol, icon: 'table_freeze_column', onClick: () => e.cmd.freeze('col') },
        ] },
      ] },
    ],
  };
}
