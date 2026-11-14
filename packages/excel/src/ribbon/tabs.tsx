// Onglets Insertion, Mise en page, Formules, Donnees, Revision, Affichage.
import type { MenuItem, RibbonTab } from '@forgeoffice/ui';
import { SHAPES } from '../logic/shapes.ts';
import { S, RB } from '../strings/index.ts';
import type { RibbonEnv } from './env.ts';

export { formulasTab } from './formulas.tsx';

export function insertTab(e: RibbonEnv): RibbonTab {
  return {
    id: 'insert', label: RB.tabs.insert, keytip: 'N',
    groups: [
      { id: 'tables', label: RB.g.tables, icon: 'table', controls: [
        { kind: 'button', id: 'pivot', label: RB.pivot, icon: 'table_lightning', size: 'large', onClick: e.insertPivot },
        { kind: 'button', id: 'table', label: RB.table, icon: 'table_add', size: 'large', onClick: () => e.ctx.open({ kind: 'createTable', style: 'TableStyleMedium2' }), tooltip: { title: RB.table, shortcut: 'Ctrl+L' } },
      ] },
      { id: 'illus', label: RB.g.illustrations, icon: 'image', controls: [
        { kind: 'button', id: 'image', label: RB.pictures, icon: 'image_add', size: 'large', onClick: e.insertImage },
        { kind: 'menu', id: 'shapes', label: S.shapes.gallery, icon: 'shapes', size: 'large', items: [
          ...SHAPES.map((sh) => ({ id: sh.id, label: sh.label, onClick: () => e.insertShape(sh.id) })),
          { id: 'sepTb', kind: 'separator' as const },
          { id: 'textbox', label: S.shapes.textBox, icon: 'text_t', onClick: () => e.insertShape('rect', true) },
        ] },
        // Bouton propre au profil OnlyOffice (Insertion > Zone de texte) ; masque ailleurs, la zone de texte reste dans le menu Formes.
        { kind: 'button', id: 'oo-textbox', label: S.shapes.textBox, icon: 'text_t', size: 'large', hidden: true, onClick: () => e.insertShape('rect', true) },
      ] },
      { id: 'charts', label: RB.g.charts, icon: 'chart_multiple', controls: [
        { kind: 'button', id: 'recommended', label: RB.recommended, icon: 'chart_multiple', size: 'large', onClick: () => e.insertChart('col') },
        { kind: 'row', id: 'c1', controls: [
          { kind: 'menu', id: 'col', label: RB.chartCol, icon: 'data_bar_vertical', iconOnly: true, items: [
            { id: 'col', label: S.chart.types.col ?? '', onClick: () => e.insertChart('col') },
            { id: 'colStacked', label: S.chart.types.colStacked ?? '', onClick: () => e.insertChart('colStacked') },
            { id: 'colPercent', label: S.chart.types.colPercent ?? '', onClick: () => e.insertChart('colPercent') },
            { id: 'bar', label: S.chart.types.bar ?? '', icon: 'data_bar_horizontal', onClick: () => e.insertChart('bar') },
            { id: 'barStacked', label: S.chart.types.barStacked ?? '', icon: 'data_bar_horizontal', onClick: () => e.insertChart('barStacked') },
            { id: 'barPercent', label: S.chart.types.barPercent ?? '', icon: 'data_bar_horizontal', onClick: () => e.insertChart('barPercent') },
          ] },
          { kind: 'menu', id: 'line', label: RB.chartLine, icon: 'data_line', iconOnly: true, items: [
            { id: 'line', label: S.chart.types.line ?? '', onClick: () => e.insertChart('line') },
            { id: 'lineStacked', label: S.chart.types.lineStacked ?? '', onClick: () => e.insertChart('lineStacked') },
            { id: 'lineSmooth', label: S.chart.types.lineSmooth ?? '', onClick: () => e.insertChart('lineSmooth') },
            { id: 'lineMarkers', label: S.chart.types.lineMarkers ?? '', onClick: () => e.insertChart('lineMarkers') },
            { id: 'area', label: S.chart.types.area ?? '', icon: 'data_area', onClick: () => e.insertChart('area') },
            { id: 'areaStacked', label: S.chart.types.areaStacked ?? '', icon: 'data_area', onClick: () => e.insertChart('areaStacked') },
          ] },
          { kind: 'menu', id: 'pie', label: RB.chartPie, icon: 'data_pie', iconOnly: true, items: [
            { id: 'pie', label: S.chart.types.pie ?? '', onClick: () => e.insertChart('pie') },
            { id: 'doughnut', label: S.chart.types.doughnut ?? '', onClick: () => e.insertChart('doughnut') },
            { id: 'radar', label: S.chart.types.radar ?? '', onClick: () => e.insertChart('radar') },
            { id: 'radarFilled', label: S.chart.types.radarFilled ?? '', onClick: () => e.insertChart('radarFilled') },
          ] },
        ] },
        { kind: 'row', id: 'c2', controls: [
          { kind: 'menu', id: 'scatter', label: RB.chartScatter, icon: 'data_scatter', iconOnly: true, items: [
            { id: 'scatter', label: S.chart.types.scatter ?? '', onClick: () => e.insertChart('scatter') },
            { id: 'scatterLines', label: S.chart.types.scatterLines ?? '', onClick: () => e.insertChart('scatterLines') },
          ] },
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

export { layoutTab } from './layout-tab.tsx';

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
        { kind: 'button', id: 'adv', label: S.advFilter.btn, icon: 'filter', onClick: () => e.ctx.open({ kind: 'advancedFilter' }) },
        { kind: 'button', id: 're', label: RB.reapply, icon: 'arrow_clockwise', disabled: !e.sheet.autoFilter, onClick: e.cmd.reapplyFilter },
      ] },
      { id: 'tools', label: RB.g.dataTools, icon: 'table_edit', controls: [
        { kind: 'button', id: 'ttc', label: RB.textToCols, icon: 'column_triple', size: 'large', onClick: () => e.ctx.open({ kind: 'textToCols' }) },
        { kind: 'button', id: 'flash', label: RB.flashFill, icon: 'flow', onClick: e.flashFill },
        { kind: 'button', id: 'dup', label: RB.removeDup, icon: 'table_dismiss', onClick: () => e.ctx.open({ kind: 'removeDup' }) },
        { kind: 'button', id: 'consolidate', label: S.consolidate.btn, icon: 'table_stack_below', onClick: () => e.ctx.open({ kind: 'consolidate' }) },
        { kind: 'button', id: 'val', label: RB.validation, icon: 'checkbox_checked', onClick: () => e.ctx.open({ kind: 'validation' }) },
      ] },
      { id: 'forecast', label: S.goalSeek.menu, icon: 'data_trending', controls: [
        { kind: 'menu', id: 'whatif', label: S.goalSeek.menu, icon: 'data_trending', size: 'large', items: [
          { id: 'goal', label: `${S.goalSeek.title}…`, onClick: () => e.ctx.open({ kind: 'goalSeek' }) },
        ] },
      ] },
      { id: 'outline', label: RB.g.outline, icon: 'group', controls: [
        { kind: 'split', id: 'group', label: RB.group, icon: 'group', size: 'large', onClick: () => e.outline('row', 1), items: [
          { id: 'r', label: `${RB.group} (lignes)`, onClick: () => e.outline('row', 1) },
          { id: 'c', label: `${RB.group} (colonnes)`, onClick: () => e.outline('col', 1) },
          { id: 'auto', label: S.outlineAuto.menu, onClick: e.outlineAuto },
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
        { kind: 'button', id: 'prev', label: RB.prevComment, icon: 'arrow_up', onClick: () => e.reviewNav(-1) },
        { kind: 'button', id: 'next', label: RB.nextComment, icon: 'arrow_down', onClick: () => e.reviewNav(1) },
        { kind: 'toggle', id: 'pane', label: RB.showComments, icon: 'comment_multiple', size: 'large', pressed: e.ui.commentsPane, onToggle: (v) => e.setUi({ commentsPane: v }) },
      ] },
      { id: 'notes', label: RB.g.notes, icon: 'note', controls: [
        { kind: 'button', id: 'note', label: RB.newNote, icon: 'note', size: 'large', onClick: () => e.ctx.open({ kind: 'note' }), tooltip: { title: RB.newNote, shortcut: 'Maj+F2' } },
        { kind: 'button', id: 'delnote', label: RB.delNote, icon: 'delete', onClick: e.deleteNote },
        { kind: 'toggle', id: 'allnotes', label: RB.showAllNotes, icon: 'note', pressed: e.allNotesVisible, onToggle: e.toggleAllNotes },
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
        // Sans rendu : les zooms fixes du menu Affichage > Zoom des dispositions LibreOffice / OpenOffice.
        { kind: 'custom', id: 'zoomPct', label: RB.zoom, hidden: true, render: () => null, commands: [50, 75, 150, 200].map((z) => ({ id: `z${z}`, label: `${z} %`, onClick: () => e.setZoom(z) })) },
        { kind: 'button', id: 'zsel', label: RB.zoomSel, icon: 'arrow_fit', size: 'large', onClick: e.zoomToSelection },
      ] },
      { id: 'window', label: RB.g.window, icon: 'window', controls: [
        // Sans rendu : la liste des feuilles et l'acces direct aux cellules du panneau Navigateur (disposition LibreOffice).
        { kind: 'custom', id: 'sheetNav', label: 'Feuilles', hidden: true, render: () => null, go: e.navigate, commands: e.wb.sheets.filter((s) => s.state === 'visible').map((s, i) => ({ id: `sheet${i}`, label: s.name, checked: e.wb.sheets[e.si] === s, onClick: () => e.navigate(`'${s.name.replace(/'/g, "''")}'!A1`) })) },
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
