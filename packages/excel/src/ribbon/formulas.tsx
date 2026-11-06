// Onglet Formules : bibliotheque de fonctions (dont Recemment utilisees), noms definis, verification des formules, calcul.
import type { IconName, MenuItem, RibbonControl, RibbonTab } from '@forgeoffice/ui';
import { functionCatalog } from '../logic/formula-ui.ts';
import { withCalcMode, type CalcMode } from '../logic/formulas/calc.ts';
import { RECENT_FUNCTIONS_KEY, pushRecent } from '../logic/formulas/names.ts';
import { cellSelection } from '../logic/selection.ts';
import { toggleWatch, isWatchOpen } from '../ui/formulas/WatchHost.tsx';
import { FM, S, RB } from '../strings/index.ts';
import type { RibbonEnv } from './env.ts';

/** Fonctions recemment utilisees (francais, la derniere en tete). */
const recents = (e: RibbonEnv): string[] => e.ctx.services.settings.get<string[]>(RECENT_FUNCTIONS_KEY, []);

/** Insere une fonction depuis le ruban et la retient dans la liste des recentes. */
function insertFrom(e: RibbonEnv, name: string): void {
  e.ctx.services.settings.set(RECENT_FUNCTIONS_KEY, pushRecent(recents(e), name));
  e.insertFunction(name);
}

function fnMenu(e: RibbonEnv, category: string): MenuItem[] {
  return functionCatalog().filter((f) => f.category === category).map((f) => ({ id: f.canonical, label: f.name, description: f.description || undefined, onClick: () => insertFrom(e, f.name) }));
}

function recentMenu(e: RibbonEnv): MenuItem[] {
  const names = recents(e);
  if (names.length === 0) return [{ id: 'none', label: FM.rb.noRecent, disabled: true }];
  return names.map((n) => ({ id: n, label: n, description: functionCatalog().find((f) => f.name === n)?.description || undefined, onClick: () => insertFrom(e, n) }));
}

/** Cellules en reference circulaire de la feuille active (« Feuil1!A1 »), pour le sous-menu « Reference circulaire ». */
function circularItems(e: RibbonEnv): MenuItem[] {
  const own = e.ctx.store.engine.engine.circularReferences().filter((c) => c.replace(/'/g, '').startsWith(`${e.sheet.name}!`));
  if (own.length === 0) return [{ id: 'none', label: FM.rb.noCircular, disabled: true }];
  return own.slice(0, 30).map((c) => {
    const addr = c.slice(c.lastIndexOf('!') + 1);
    return {
      id: c, label: addr,
      onClick: () => {
        const m = addr.match(/^([A-Z]+)(\d+)$/);
        if (!m) return;
        const col = [...(m[1] ?? '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
        e.ctx.setSel(cellSelection(Number(m[2]) - 1, col));
      },
    };
  });
}

function calcMenu(e: RibbonEnv): MenuItem[] {
  const mode = e.wb.calc.mode;
  const set = (m: CalcMode): void => {
    e.ctx.store.commit((d) => {
      d.wb.calc = withCalcMode(d.wb.calc, m);
    }, 'calc');
  };
  return [
    { id: 'auto', label: FM.calc.auto, checked: mode === 'auto', onClick: () => set('auto') },
    { id: 'autoNoTable', label: FM.calc.autoNoTable, checked: mode === 'autoNoTable', onClick: () => set('autoNoTable') },
    { id: 'manual', label: FM.calc.manual, checked: mode === 'manual', onClick: () => set('manual') },
    { id: 'sep', kind: 'separator' },
    { id: 'iter', label: FM.calc.iterative, icon: 'settings', onClick: () => e.ctx.open({ kind: 'calcOptions' }) },
  ];
}

export function formulasTab(e: RibbonEnv): RibbonTab {
  const cat = (id: string, label: string, icon: IconName, category: string): RibbonControl => ({ kind: 'menu', id, label, icon, items: fnMenu(e, category) });
  const names = e.wb.definedNames.filter((n) => !n.name.startsWith('_xlnm') && !n.hidden);
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
          { id: 'sep', kind: 'separator' },
          { id: 'more', label: RB.moreFunctions, icon: 'math_formula', onClick: () => e.ctx.open({ kind: 'fnWizard' }) },
        ] },
        { kind: 'menu', id: 'recent', label: RB.recentFns, icon: 'history', size: 'large', items: recentMenu(e) },
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
        { kind: 'button', id: 'def', label: RB.defineName, icon: 'tag_multiple', onClick: () => e.ctx.open({ kind: 'nameEdit', index: null }) },
        { kind: 'menu', id: 'use', label: RB.useInFormula, icon: 'math_formula', items: [
          ...(names.length ? names.map((n): MenuItem => ({ id: n.name, label: n.name, description: n.comment || undefined, onClick: () => e.insertFunction(`=${n.name}`) })) : [{ id: 'none', label: FM.rb.noNames, disabled: true }]),
          { id: 'sep', kind: 'separator' },
          { id: 'paste', label: FM.rb.pasteNames, shortcut: 'F3', onClick: () => e.ctx.open({ kind: 'keysPasteName' }) },
        ] },
        { kind: 'button', id: 'fromsel', label: FM.rb.fromSelection, icon: 'table_cell_edit', onClick: () => e.ctx.open({ kind: 'keysNamesFromSelection' }), tooltip: { title: FM.rb.fromSelection, shortcut: 'Ctrl+Maj+F3' } },
      ] },
      { id: 'audit', label: RB.g.audit, icon: 'arrow_flow_diagonal_up_right', controls: [
        { kind: 'button', id: 'prec', label: RB.precedents, icon: 'arrow_flow_diagonal_up_right', onClick: () => e.trace('precedents') },
        { kind: 'button', id: 'dep', label: RB.dependents, icon: 'arrow_routing', onClick: () => e.trace('dependents') },
        { kind: 'split', id: 'rm', label: RB.removeArrows, icon: 'dismiss', disabled: !e.ui.arrows, onClick: () => e.trace('clear'), items: [
          { id: 'all', label: FM.trace.removeAll, onClick: () => e.trace('clear') },
          { id: 'prec', label: FM.trace.removePrecedents, onClick: () => e.trace('clearPrecedents') },
          { id: 'dep', label: FM.trace.removeDependents, onClick: () => e.trace('clearDependents') },
        ] },
        { kind: 'toggle', id: 'show', label: RB.showFormulas, icon: 'math_formula', pressed: e.ui.showFormulas, onToggle: (v) => e.setUi({ showFormulas: v }), tooltip: { title: RB.showFormulas, shortcut: 'Ctrl+"' } },
        { kind: 'split', id: 'errors', label: FM.rb.errorCheck, icon: 'warning', onClick: () => e.ctx.open({ kind: 'errorCheck' }), items: [
          { id: 'check', label: FM.rb.errorCheck, icon: 'warning', onClick: () => e.ctx.open({ kind: 'errorCheck' }) },
          { id: 'circ', label: FM.rb.circular, items: circularItems(e) },
        ] },
        { kind: 'button', id: 'eval', label: RB.evaluate, icon: 'arrow_step_in', onClick: () => e.ctx.open({ kind: 'evaluate' }) },
        { kind: 'toggle', id: 'watch', label: FM.rb.watch, icon: 'eye', pressed: isWatchOpen(e.ctx.store), onToggle: () => toggleWatch(e.ctx.store) },
      ] },
      { id: 'calc', label: RB.g.calc, icon: 'calculator', controls: [
        { kind: 'menu', id: 'opts', label: RB.calcOptions, icon: 'calculator', size: 'large', items: calcMenu(e) },
        { kind: 'button', id: 'now', label: RB.calcNow, icon: 'calculator_arrow_clockwise', onClick: () => e.recalc(), tooltip: { title: RB.calcNow, shortcut: 'F9' } },
        { kind: 'button', id: 'sheet', label: FM.calc.sheet, icon: 'calculator', onClick: () => e.recalc('sheet'), tooltip: { title: FM.calc.sheet, shortcut: 'Maj+F9' } },
      ] },
    ],
  };
}
