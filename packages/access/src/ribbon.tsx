// Ruban d'Access 2024 : Accueil, Creer, Donnees externes, Outils de base de donnees + onglets contextuels.
import type { ButtonControl, ControlSize, IconName, MenuItem, RibbonControl, RibbonGroup, RibbonTab } from '@forgeoffice/ui';
import type { TemplateDef } from './logic/templates.ts';
import { S } from './strings.ts';
import type { Tab, View, ViewApi } from './components/view-types.ts';

export interface RibbonActions {
  setView: (v: View) => void;
  newTable: () => void;
  newTableDesign: () => void;
  newQuery: () => void;
  instantForm: (disposition: 'simple' | 'tabulaire' | 'feuille_donnees' | 'double_affichage', view?: View) => void;
  formDesign: () => void;
  instantReport: (view?: View) => void;
  reportDesign: () => void;
  newMacro: () => void;
  template: (t: TemplateDef) => void;
  importFile: (kind: 'excel' | 'text') => void;
  exportAs: (kind: 'excel' | 'text' | 'html') => void;
  relations: () => void;
  documenter: () => void;
  analyze: () => void;
  compact: () => void;
  integrity: () => void;
  closeTab: () => void;
}

export interface RibbonInput {
  tab: Tab | null;
  api: ViewApi | undefined;
  hasDb: boolean;
  readOnly: boolean;
  templates: readonly TemplateDef[];
  actions: RibbonActions;
}

const CTX_COLOR = '#A4373A';

function btn(id: string, label: string, icon: IconName, onClick: (() => void) | undefined, size: ControlSize = 'large', tip?: string): ButtonControl {
  return { kind: 'button', id, label, icon, size, disabled: !onClick, onClick: onClick ?? (() => undefined), tooltip: tip ? { title: label, description: tip } : undefined };
}

export const VIEWS_BY_KIND: Record<string, readonly View[]> = {
  table: ['datasheet', 'design'],
  requete: ['datasheet', 'sql', 'design'],
  formulaire: ['form', 'layout', 'design'],
  etat: ['preview', 'layout', 'design'],
  macro: ['design'],
};

export const VIEW_LABEL: Record<View, string> = {
  datasheet: S.cmd.datasheet, design: S.cmd.design, sql: S.cmd.sqlView, form: S.cmd.formView, layout: S.cmd.layoutView, preview: S.cmd.preview,
};

export const VIEW_ICON: Record<View, IconName> = {
  datasheet: 'table', design: 'edit', sql: 'math_formula', form: 'form', layout: 'layer', preview: 'document_print',
};

function viewGroup(input: RibbonInput): RibbonGroup {
  const { tab, actions } = input;
  const views = tab ? (VIEWS_BY_KIND[tab.kind] ?? []) : [];
  const items: MenuItem[] = views.map((v) => ({ id: v, label: VIEW_LABEL[v], icon: VIEW_ICON[v], checked: tab?.view === v, onClick: () => actions.setView(v) }));
  const next = views.find((v) => v !== tab?.view);
  return {
    id: 'views', label: S.groups.views, icon: 'eye',
    controls: [{ kind: 'split', id: 'view', label: S.cmd.view, icon: next ? VIEW_ICON[next] : 'eye', size: 'large', disabled: views.length < 2, onClick: () => next && actions.setView(next), items, tooltip: { title: S.cmd.view, description: S.tips.view } }],
  };
}

export function buildRibbon(input: RibbonInput): RibbonTab[] {
  const { api: a, hasDb, readOnly, actions, tab } = input;
  const w = (f: (() => void) | undefined): (() => void) | undefined => (hasDb && !readOnly ? f : undefined);
  const sel = a?.selectionText;
  const selLabel = sel === null || sel === undefined ? '…' : `« ${sel.length > 24 ? `${sel.slice(0, 24)}…` : sel} »`;

  const home: RibbonTab = {
    id: 'home', label: S.tabs.home,
    groups: [
      viewGroup(input),
      {
        id: 'clip', label: S.groups.clipboard, icon: 'clipboard',
        controls: [
          btn('paste', S.cmd.paste, 'clipboard_paste', a?.paste),
          btn('cut', S.cmd.cut, 'cut', a?.cut, 'small'),
          btn('copy', S.cmd.copy, 'copy', a?.copy, 'small'),
        ],
      },
      {
        id: 'sort', label: S.groups.sortFilter, icon: 'filter',
        controls: [
          btn('filter', S.cmd.filter, 'filter', a?.columnFilterMenu, 'large', S.tips.filter),
          { kind: 'row', id: 'r1', controls: [btn('asc', S.cmd.asc, 'text_sort_ascending', a?.sort && (() => a.sort?.(false)), 'small'), { kind: 'menu', id: 'selection', label: S.cmd.selection, icon: 'select_all_on', size: 'small', disabled: !a?.filterSelection, tooltip: { title: S.cmd.selection, description: S.tips.selection }, items: [
            { id: 'eq', label: S.cmd.equals(selLabel), onClick: () => a?.filterSelection?.('egal') },
            { id: 'ne', label: S.cmd.notEquals(selLabel), onClick: () => a?.filterSelection?.('different') },
            { id: 'ct', label: S.cmd.contains(selLabel), onClick: () => a?.filterSelection?.('contient') },
            { id: 'nc', label: S.cmd.notContains(selLabel), onClick: () => a?.filterSelection?.('ne_contient_pas') },
          ] }] },
          { kind: 'row', id: 'r2', controls: [btn('desc', S.cmd.desc, 'text_sort_descending', a?.sort && (() => a.sort?.(true)), 'small'), { kind: 'menu', id: 'adv', label: S.cmd.clearFilters, icon: 'filter', size: 'small', iconOnly: true, disabled: !a?.clearFilters, items: [{ id: 'clr', label: S.cmd.clearFilters, onClick: () => a?.clearFilters?.() }] }] },
          { kind: 'row', id: 'r3', controls: [btn('nosort', S.cmd.clearSort, 'arrow_sort', a?.clearSort, 'small'), { kind: 'toggle', id: 'tgl', label: S.cmd.toggleFilter, icon: 'filter', size: 'small', pressed: a?.filtered ?? false, disabled: !a?.toggleFilter, onToggle: () => a?.toggleFilter?.() }] },
        ],
      },
      {
        id: 'records', label: S.groups.records, icon: 'table',
        controls: [
          btn('refresh', S.cmd.refresh, 'arrow_clockwise', a?.refresh),
          { kind: 'row', id: 'rr1', controls: [btn('new', S.cmd.newRecord, 'add', a?.newRecord, 'small'), { kind: 'toggle', id: 'totals', label: S.cmd.totals, icon: 'autosum', size: 'small', pressed: a?.totalsOn ?? false, disabled: !a?.toggleTotals, onToggle: () => a?.toggleTotals?.(), tooltip: { title: S.cmd.totals, description: S.tips.totals } }] },
          { kind: 'row', id: 'rr2', controls: [btn('save', S.cmd.saveRecord, 'save', a?.saveRecord ?? a?.save, 'small'), btn('spell', S.cmd.spelling, 'text_proofing_tools', a?.spelling, 'small', S.tips.spelling)] },
          { kind: 'row', id: 'rr3', controls: [btn('del', S.cmd.deleteRecord, 'delete', a?.deleteRecord, 'small')] },
        ],
      },
      {
        id: 'find', label: S.groups.find, icon: 'search',
        controls: [
          btn('find', S.cmd.find, 'search', a?.find),
          btn('replace', S.cmd.replace, 'arrow_sync', a?.replace, 'small'),
          { kind: 'menu', id: 'goto', label: S.cmd.goTo, icon: 'arrow_right', size: 'small', disabled: !a?.goTo, items: (['first', 'previous', 'next', 'last', 'new'] as const).map((g) => ({ id: g, label: { first: S.cmd.first, previous: S.cmd.previous, next: S.cmd.next, last: S.cmd.last, new: S.cmd.newRecord }[g], disabled: g === 'new' && !a?.newRecord, onClick: () => a?.goTo?.(g) })) },
        ],
      },
    ],
  };

  const create: RibbonTab = {
    id: 'create', label: S.tabs.create,
    groups: [
      { id: 'tpl', label: S.groups.templates, icon: 'apps', controls: [{ kind: 'menu', id: 'parts', label: S.cmd.appParts, icon: 'apps', size: 'large', disabled: !hasDb || readOnly, items: input.templates.map((t) => ({ id: t.id, label: t.label, description: t.description, icon: 'table', onClick: () => actions.template(t) })) }] },
      { id: 'tables', label: S.groups.tables, icon: 'table', controls: [btn('table', S.cmd.table, 'table_add', w(actions.newTable), 'large', S.tips.table), btn('tdesign', S.cmd.tableDesign, 'table_settings', w(actions.newTableDesign), 'large', S.tips.tableDesign)] },
      { id: 'queries', label: S.groups.queries, icon: 'database_search', controls: [btn('qwiz', S.cmd.queryWizard, 'database_search', hasDb ? actions.newQuery : undefined), btn('qdesign', S.cmd.queryDesign, 'data_funnel', hasDb ? actions.newQuery : undefined, 'large', S.tips.queryDesign)] },
      {
        id: 'forms', label: S.groups.forms, icon: 'form',
        controls: [
          btn('form', S.cmd.form, 'form', hasDb ? () => actions.instantForm('simple', 'layout') : undefined, 'large', S.tips.form),
          btn('fdesign', S.cmd.formDesign, 'design_ideas', hasDb ? actions.formDesign : undefined),
          btn('finstant', S.cmd.instantForm, 'window_new', hasDb ? () => actions.instantForm('simple', 'form') : undefined, 'small'),
          { kind: 'menu', id: 'more', label: S.cmd.moreForms, icon: 'apps_list', size: 'small', disabled: !hasDb, items: [
            { id: 'multi', label: S.cmd.multipleItems, icon: 'table_simple', onClick: () => actions.instantForm('tabulaire', 'form') },
            { id: 'ds', label: S.cmd.datasheetForm, icon: 'table', onClick: () => actions.instantForm('feuille_donnees', 'form') },
            { id: 'split', label: S.cmd.splitForm, icon: 'table_split', onClick: () => actions.instantForm('double_affichage', 'form') },
          ] },
        ],
      },
      {
        id: 'reports', label: S.groups.reports, icon: 'document_text',
        controls: [
          btn('report', S.cmd.report, 'document_text', hasDb ? () => actions.instantReport('layout') : undefined, 'large', S.tips.report),
          btn('rdesign', S.cmd.reportDesign, 'document_edit', hasDb ? actions.reportDesign : undefined),
          btn('rinstant', S.cmd.instantReport, 'document_print', hasDb ? () => actions.instantReport('preview') : undefined, 'small'),
        ],
      },
      { id: 'macros', label: S.groups.macros, icon: 'play', controls: [btn('macro', S.cmd.macro, 'play', hasDb ? actions.newMacro : undefined)] },
    ],
  };

  const exportable = tab?.kind === 'table' || tab?.kind === 'requete' ? true : false;
  const external: RibbonTab = {
    id: 'external', label: S.tabs.external,
    groups: [
      {
        id: 'import', label: S.groups.import, icon: 'arrow_import',
        controls: [
          { kind: 'menu', id: 'newsrc', label: S.cmd.newSource, icon: 'database_arrow_down', size: 'large', disabled: !hasDb || readOnly, items: [
            { id: 'xl', label: S.cmd.importExcel, icon: 'table', onClick: () => actions.importFile('excel') },
            { id: 'txt', label: S.cmd.importText, icon: 'document_text', onClick: () => actions.importFile('text') },
          ] },
          btn('ixl', S.cmd.importExcel, 'table', w(() => actions.importFile('excel'))),
          btn('itxt', S.cmd.importText, 'document_text', w(() => actions.importFile('text'))),
        ],
      },
      {
        id: 'export', label: S.groups.export, icon: 'arrow_export_ltr',
        controls: [
          btn('exl', S.cmd.exportExcel, 'table', hasDb ? () => actions.exportAs('excel') : undefined, 'large', exportable ? undefined : S.ext.pickObject),
          btn('etxt', S.cmd.exportText, 'document_text', hasDb ? () => actions.exportAs('text') : undefined),
          btn('ehtml', S.cmd.exportHtml, 'globe', hasDb ? () => actions.exportAs('html') : undefined, 'small'),
        ],
      },
    ],
  };

  const tools: RibbonTab = {
    id: 'tools', label: S.tabs.tools,
    groups: [
      { id: 'tools', label: S.groups.tools, icon: 'database', controls: [btn('compact', S.cmd.compact, 'database_arrow_down', w(actions.compact), 'large', S.tips.compact), btn('integrity', S.cmd.integrity, 'shield_lock', hasDb ? actions.integrity : undefined, 'small')] },
      { id: 'rel', label: S.groups.relations, icon: 'database_link', controls: [btn('relations', S.cmd.relations, 'database_link', hasDb ? actions.relations : undefined, 'large', S.tips.relations)] },
      { id: 'analyze', label: S.groups.analyze, icon: 'data_histogram', controls: [btn('doc', S.cmd.documenter, 'document_search', hasDb ? actions.documenter : undefined, 'small', S.tips.documenter), btn('perf', S.cmd.analyzePerf, 'data_trending', hasDb ? actions.analyze : undefined, 'small', S.tips.analyze), btn('atable', S.cmd.analyzeTable, 'table_settings', hasDb ? actions.analyze : undefined, 'small')] },
    ],
  };

  return [home, create, external, tools, ...contextual(input)];
}

function saveGroup(a: ViewApi | undefined): RibbonGroup {
  return { id: 'save', label: S.cmd.save, icon: 'save', controls: [btn('csave', S.cmd.save, 'save', a?.save)] };
}

function contextual({ tab, api: a, actions }: RibbonInput): RibbonTab[] {
  if (!tab) return [];
  const ctxSet = (set: string) => ({ set, color: CTX_COLOR });
  if (tab.kind === 'table' && tab.view === 'datasheet') {
    const col = a?.column ?? '';
    return [
      {
        id: 'fields', label: S.tabs.fields, contextual: ctxSet(S.tabs.tableTools),
        groups: [
          viewGroup({ tab, api: a, hasDb: true, readOnly: false, templates: [], actions }),
          {
            id: 'add', label: S.groups.add, icon: 'add',
            controls: [
              btn('ftext', S.cmd.newShortText, 'text_t', a?.addField && (() => a.addField?.('texte_court')), 'small'),
              btn('fnum', S.cmd.newNumber, 'number_symbol', a?.addField && (() => a.addField?.('reel_double')), 'small'),
              btn('fcur', S.cmd.newCurrency, 'currency_dollar_euro', a?.addField && (() => a.addField?.('monetaire')), 'small'),
              btn('fdate', S.cmd.newDate, 'calendar_ltr', a?.addField && (() => a.addField?.('date_heure')), 'small'),
              btn('fyes', S.cmd.newYesNo, 'checkbox_checked', a?.addField && (() => a.addField?.('oui_non')), 'small'),
              btn('fdel', S.cmd.deleteField, 'delete', a?.deleteField),
            ],
          },
          { id: 'props', label: S.groups.properties, icon: 'settings', controls: [{ kind: 'custom', id: 'col', label: S.cmd.name, render: () => <span className="acc-rib-col">{col}</span> }, btn('fdesign', S.cmd.design, 'edit', () => actions.setView('design'), 'small')] },
          {
            id: 'valid', label: S.groups.validation, icon: 'checkmark',
            controls: [
              { kind: 'checkbox', id: 'req', label: S.cmd.required, checked: a?.required ?? false, disabled: !a?.toggleRequired, onChange: () => a?.toggleRequired?.() },
              { kind: 'checkbox', id: 'idx', label: S.cmd.indexed, checked: a?.indexed ?? false, disabled: !a?.toggleIndexed, onChange: () => a?.toggleIndexed?.() },
            ],
          },
        ],
      },
      { id: 'tabletab', label: S.tabs.table, contextual: ctxSet(S.tabs.tableTools), groups: [{ id: 'rel', label: S.groups.relations, icon: 'database_link', controls: [btn('trel', S.cmd.relations, 'database_link', actions.relations), btn('tprops', S.cmd.tableProps, 'table_settings', () => actions.setView('design'))] }] },
    ];
  }
  if (tab.kind === 'table' && tab.view === 'design') {
    return [{
      id: 'design', label: S.tabs.design, contextual: ctxSet(S.tabs.tableTools),
      groups: [
        viewGroup({ tab, api: a, hasDb: true, readOnly: false, templates: [], actions }),
        { id: 'tools', label: S.groups.tools2, icon: 'key', controls: [btn('pk', S.cmd.primaryKey, 'key', a?.primaryKey), btn('ins', S.cmd.insertRows, 'table_insert_row', a?.insertRow, 'small'), btn('delr', S.cmd.deleteRows, 'table_delete_row', a?.deleteRow, 'small')] },
        { id: 'sh', label: S.groups.showHide, icon: 'panel_right', controls: [btn('sheet', S.cmd.propertySheet, 'panel_right', a?.togglePropertySheet)] },
        saveGroup(a),
      ],
    }];
  }
  if (tab.kind === 'requete' && tab.view !== 'datasheet') {
    const types = [['selection', S.cmd.select, 'table'], ['creation_table', S.cmd.makeTable, 'table_add'], ['ajout', S.cmd.append, 'table_insert_row'], ['mise_a_jour', S.cmd.update, 'edit'], ['analyse_croisee', S.cmd.crosstab, 'grid'], ['suppression', S.cmd.deleteQuery, 'table_delete_row']] as const;
    return [{
      id: 'qdesign', label: S.tabs.design, contextual: ctxSet(S.tabs.queryTools),
      groups: [
        { id: 'res', label: S.groups.results, icon: 'play', controls: [viewGroup({ tab, api: a, hasDb: true, readOnly: false, templates: [], actions }).controls[0] as RibbonControl, btn('run', S.cmd.run, 'play', a?.run, 'large', S.tips.run)] },
        { id: 'qtype', label: S.groups.queryType, icon: 'database_search', controls: types.map(([id, label, icon]): RibbonControl => ({ kind: 'toggle', id: `qt-${id}`, label, icon, size: id === 'selection' ? 'large' : 'small', pressed: a?.queryType === id, disabled: !a?.setQueryType, onToggle: () => a?.setQueryType?.(id) })) },
        {
          id: 'setup', label: S.groups.setup, icon: 'table_add',
          controls: [
            btn('addt', S.cmd.showTable, 'table_add', a?.showTables),
            { kind: 'combo', id: 'top', label: S.cmd.returnTop, value: a?.top ? String(a.top) : S.q.top, width: 72, editable: true, options: [S.q.top, '5', '25', '100'].map((v) => ({ value: v })), validate: (t) => (t === S.q.top || /^\d+$/.test(t) ? t : null), disabled: !a?.setTop, onChange: (v) => a?.setTop?.(v === S.q.top ? null : Number(v)) },
          ],
        },
        { id: 'sh', label: S.groups.showHide, icon: 'autosum', controls: [{ kind: 'toggle', id: 'qtot', label: S.cmd.showTotals, icon: 'autosum', size: 'large', pressed: a?.totalsRow ?? false, disabled: !a?.toggleTotalsRow, onToggle: () => a?.toggleTotalsRow?.() }] },
        saveGroup(a),
      ],
    }];
  }
  if (tab.kind === 'relations') {
    return [{
      id: 'reldesign', label: S.tabs.design, contextual: ctxSet(S.tabs.relTools),
      groups: [
        { id: 'tools', label: S.groups.tools2, icon: 'database_link', controls: [btn('edit', S.cmd.editRelations, 'edit', a?.editRelation), btn('clear', S.cmd.clearLayout, 'eraser', a?.clearLayout, 'small'), btn('all', S.cmd.allRelations, 'database_link', a?.allRelations, 'small')] },
        { id: 'rels', label: S.groups.relations, icon: 'table_add', controls: [btn('addt', S.cmd.showTable, 'table_add', a?.showTables), btn('close', S.cmd.close, 'dismiss', actions.closeTab)] },
      ],
    }];
  }
  if ((tab.kind === 'formulaire' || tab.kind === 'etat') && tab.view !== 'form' && tab.view !== 'preview') {
    return [{
      id: 'fdesign', label: tab.kind === 'etat' ? S.tabs.reportDesign : S.tabs.formDesign, contextual: ctxSet(tab.kind === 'etat' ? S.tabs.reportTools : S.tabs.formTools),
      groups: [
        viewGroup({ tab, api: a, hasDb: true, readOnly: false, templates: [], actions }),
        ...(tab.kind === 'etat'
          ? [{
              id: 'grp', label: S.groups.grouping, icon: 'group' as IconName,
              controls: [{ kind: 'combo' as const, id: 'groupby', label: S.cmd.group, value: a?.groupBy ?? S.reports.noGroup, width: 150, options: [S.reports.noGroup, ...(a?.groupFields ?? [])].map((v) => ({ value: v })), disabled: !a?.setGroupBy, onChange: (v: string) => a?.setGroupBy?.(v === S.reports.noGroup ? null : v) }],
            }]
          : [{ id: 'ctl', label: S.groups.controls, icon: 'textbox' as IconName, controls: [btn('lbl', S.cmd.label, 'text_t', a?.addControl && (() => a.addControl?.('etiquette'))), btn('tb', S.cmd.textbox, 'textbox', a?.addControl && (() => a.addControl?.('zone_texte')))] }]),
        { id: 'tools', label: S.groups.tools2, icon: 'apps_list', controls: [btn('fields', S.cmd.addField, 'apps_list', a?.toggleFieldList)] },
        saveGroup(a),
      ],
    }];
  }
  if (tab.kind === 'etat' && tab.view === 'preview') {
    return [{
      id: 'preview', label: S.tabs.preview, contextual: ctxSet(S.tabs.reportTools),
      groups: [
        { id: 'print', label: S.groups.print, icon: 'print', controls: [btn('print', S.cmd.print, 'print', a?.print)] },
        { id: 'size', label: S.groups.pageSize, icon: 'orientation', controls: [
          { kind: 'toggle', id: 'por', label: S.cmd.portrait, icon: 'document', size: 'large', pressed: !a?.landscape, disabled: !a?.setLandscape, onToggle: () => a?.setLandscape?.(false) },
          { kind: 'toggle', id: 'land', label: S.cmd.landscape, icon: 'document_landscape', size: 'large', pressed: a?.landscape ?? false, disabled: !a?.setLandscape, onToggle: () => a?.setLandscape?.(true) },
        ] },
        { id: 'close', label: S.groups.close, icon: 'dismiss', controls: [btn('cp', S.cmd.closePreview, 'dismiss', () => actions.setView('layout'))] },
      ],
    }];
  }
  if (tab.kind === 'macro') {
    return [{
      id: 'mdesign', label: S.tabs.design, contextual: ctxSet(S.groups.macro),
      groups: [
        { id: 'tools', label: S.groups.tools2, icon: 'play', controls: [btn('run', S.cmd.run, 'play', a?.run), btn('add', S.cmd.addAction, 'add', a?.addAction)] },
        saveGroup(a),
      ],
    }];
  }
  return [];
}
