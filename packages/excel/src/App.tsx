// Application Tableur : etat du document, edition des cellules, presse-papiers, fichiers, ruban et mise en page.
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { MODULES, registerProbe, sharedRecovery, type ModuleProps, type RecentFile, type RecoveryEntry } from '@forgeoffice/core';
import {
  Button, MiniToolbar, Ribbon, type MenuItem, TitleBar, collectCommands, remeasureWhenFontsReady, useAsk, useContextMenu, usePinchZoom, useSelectionMiniToolbar, type QuickAccessItem, type RibbonTab,
} from '@forgeoffice/ui';
import { FormulaError, Matrix, formatValue, quoteSheetName, toLocalized, translateFormula, type Scalar } from '@forgeoffice/formulas';
import { cellName, resolveColor, type CellRange } from '@forgeoffice/xlsx';
import { commitEntry, editText, fillRanges, parseEntry } from './logic/cells.ts';
import type { ClipData } from './logic/clipboard.ts';
import { CfEvaluator } from './logic/condfmt.ts';
import { fromScalar, rangeValues, toScalar } from './logic/engine.ts';
import { autoFill, type SeriesOptions } from './logic/fill.ts';
import { applyFillMode, fillUnion, snapshotFill, type FillBefore, type FillMode } from './logic/fill-options.ts';
import { allNotesVisible, neighbourTarget, reviewTargets, setNotesVisible } from './logic/review.ts';
import { applyFixedDecimals, fixedDecimals, recoverySeconds } from './logic/options.ts';
import { quickAnalysisItems } from './ui/quick-analysis.ts';
import { OutlineButtons } from './ui/OutlineButtons.tsx';
import { autoOutlineRows, colsAsRows, setGroupCollapsed, showLevel, writeColsBack } from './logic/outline.ts';
import { editShape } from './logic/shapes.ts';
import { insertShape, setShapeText } from './ui/shape-actions.ts';
import { moveRangeCells } from './logic/move-range.ts';
import { canPointAt, cycleAbsoluteAt, findRefs, refBeforeCaret } from './logic/formula-ui.ts';
import { displayText } from './logic/look.ts';
import { commitArrayEntry } from './logic/keys-logic.ts';
import { activeRange, cellSelection, cycleActive, rangeLabel, rangeSelection, type Selection } from './logic/selection.ts';
import { cellFormat, fontFamilies, numFmtOf, styleAt } from './logic/styles.ts';
import { tableAt, tableStyleParts, type TableStyleParts } from './logic/tables.ts';
import { isValid, listItems, validationAt } from './logic/validation.ts';
import { rangeRect, type Viewport } from './logic/viewport.ts';
import { makeActions, type PivotRecord } from './ui/actions.ts';
import { makeCommands, type AllowKey, type Ctx } from './ui/commands.ts';
import { FormulaBar } from './ui/FormulaBar.tsx';
import { KeyBar } from './ui/KeyBar.tsx';
import type { FormulaInputHandle } from './ui/FormulaInput.tsx';
import { GridOverlay } from './ui/GridOverlay.tsx';
import { PageLayoutView } from './ui/page-setup/layout-view.tsx';
import { Grid } from './ui/Grid.tsx';
import { listVersions, loadVersion } from './ui/versions-store.ts';
import { blankWorkbook, LEGACY_RECOVERY_KEY, loadWorkbook, saveRecovery } from './ui/io.ts';
import { handleGridKey } from './ui/keys.ts';
import { applyKeytips } from './ribbon/keytips.ts';
import { makeKeyHost } from './ui/keys-host.ts';
import { recordCommands } from './ui/keys-repeat.ts';
import { installZoneKeys } from './ui/keys-zones.ts';
import { selectionModeLabel } from './ui/keys-select.ts';
import type { Edit } from './ui/keys-types.ts';
import { miniBarRows } from './ui/miniBar.ts';
import { buildMenu, dispatchKey, type DialogState, type MenuEnv } from './ui/registry.ts';
import { ExcelServicesProvider, makeServices } from './ui/services.tsx';
import { StatusBarHost } from './ui/StatusBarHost.tsx';
import './ui/register.ts';
import { useFileOps } from './ui/useFileOps.ts';
import { useSheetOps } from './ui/useSheetOps.ts';
import { FilterHost, type FilterMenuState } from './ui/FilterHost.tsx';
import { RecoveryDialog } from './ui/RecoveryDialog.tsx';
import { CommentsPane, PivotPane } from './ui/Panes.tsx';
import { BackstagePages, DialogHost, PrintRoot, SheetTabsHost } from './ui/Hosts.tsx';
import { pageBreakLines } from './ui/print.tsx';
import { DocStore, useDoc } from './ui/store.ts';
import { excelProbe, probeCounters, type ExcelSources } from './ui/probe.ts';
import { useClipboard } from './ui/clipboard-ui.ts';
import { homeTab } from './ribbon/home.tsx';
import { dataTab, formulasTab, insertTab, layoutTab, reviewTab, viewTab } from './ribbon/tabs.tsx';
import { removeLevel, traceLevel, traceStep, type TraceArrow } from './logic/formulas/audit.ts';
import { withCalcMode } from './logic/formulas/calc.ts';
import { rememberFunctions } from './logic/formulas/names.ts';
import { afterEntry } from './logic/formulas/table-auto.ts';
import { ErrorCache, checkEnv, errorRules, ignoredErrors } from './ui/formulas/error-state.ts';
import { WatchHost } from './ui/formulas/WatchHost.tsx';
import { CompletionContext } from './ui/formulas/completion-context.ts';
import { completionSource } from './logic/formulas/completion.ts';
import { chartTab, pivotTab, tableTab } from './ribbon/contextual.tsx';
import { shapeTab } from './ribbon/shape-tab.tsx';
import type { RibbonEnv, UiFlags } from './ribbon/env.ts';
import { FM, S } from './strings/index.ts';
import './ui/Excel.css';

const excel = MODULES.excel;
/** La mini-barre n'apparait pas d'elle-meme sur une selection de cellules : seulement au clic droit. */
const noRect = (): null => null;
let measureCtx: CanvasRenderingContext2D | null = null;
function measure(text: string, font: string): number {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * 7;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

export function ExcelApp({ services, file }: ModuleProps) {
  const store = useMemo(() => new DocStore(blankWorkbook()), []);
  useDoc(store);
  const wb = store.wb;
  const [si, setSiState] = useState(0);
  /** Selection par feuille (cle : nom de feuille, stable quand des feuilles sont inserees). */
  const [sels, setSels] = useState<Record<string, Selection>>({});
  const [edit, setEdit] = useState<Edit | null>(null);
  const [uiState, setUiState] = useState<UiFlags>(() => ({ showFormulas: false, formulaBar: true, commentsPane: false, pivotPane: false, calcManual: false, arrows: false, miniBar: services.settings.get('excel.minibar', true) }));
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [backstage, setBackstage] = useState<string | null>(null);
  const [clip, setClip] = useState<ClipData | null>(null);
  const [painter, setPainter] = useState<number | null>(null);
  const [drawing, setDrawing] = useState<number | null>(null);
  const [pivots, setPivots] = useState<PivotRecord[]>([]);
  const [arrows, setArrows] = useState<TraceArrow[]>([]);
  if (import.meta.env.DEV) probeCounters.arrows = arrows.length;
  const [filterMenu, setFilterMenu] = useState<FilterMenuState | null>(null);
  const [fillOpts, setFillOpts] = useState<{ si: number; src: CellRange; target: CellRange; before: FillBefore; mode: FillMode } | null>(null);
  const [hover, setHover] = useState<{ row: number; col: number; x: number; y: number } | null>(null);
  const [recents, setRecents] = useState<RecentFile[]>([]);
  const [recovery, setRecovery] = useState<RecoveryEntry | null>(null);
  const [printing, setPrinting] = useState(false);
  const [autoSave, setAutoSave] = useState(false);
  const [tab, setTab] = useState('home');
  const viewport = useRef<Viewport | null>(null);
  const barRef = useRef<FormulaInputHandle>(null);
  const cellRef = useRef<FormulaInputHandle>(null);
  const gridEl = useRef<HTMLDivElement | null>(null);
  /** Colonne de depart d'une saisie par Tab : Entree y revient (comme Excel). */
  const tabOrigin = useRef<number | null>(null);
  const context = useContextMenu();

  const sheet = wb.sheets[si] ?? wb.sheets[0];
  if (!sheet) throw new Error('classeur sans feuille');
  const selection = sels[sheet.name] ?? (sheet.view.activeCell ? cellSelection(sheet.view.activeCell.row, sheet.view.activeCell.col) : cellSelection(0, 0));
  const setSel = useCallback((s: Selection) => setSels((m) => ({ ...m, [sheet.name]: s })), [sheet.name]);
  /** Le mode de calcul vit dans le classeur (calcPr) : `calcManual` est derive de `wb.calc` et ecrit dans `wb.calc`. */
  const ui = useMemo<UiFlags>(() => ({ ...uiState, calcManual: wb.calc.mode === 'manual' }), [uiState, wb.calc.mode]);
  const setUi = useCallback((patch: Partial<UiFlags>) => {
    const { calcManual, ...rest } = patch;
    if (calcManual !== undefined) store.commit((d) => { d.wb.calc = withCalcMode(d.wb.calc, calcManual ? 'manual' : 'auto'); }, 'calc');
    if (Object.keys(rest).length > 0) setUiState((u) => ({ ...u, ...rest }));
  }, [store]);
  const setSi = useCallback((i: number) => {
    setSiState(i);
    setDrawing(null);
    setArrows([]);
  }, []);
  const notify = useCallback((m: string, kind: 'info' | 'success' | 'warning' | 'error' = 'info') => services.notify(m, kind), [services]);

  // ------------------------------------------------ Valeurs affichees
  const valueAt = useCallback((row: number, col: number): Scalar => {
    const cell = sheet.cells.get(row)?.get(col);
    try {
      return store.engine.value(sheet.name, row, col);
    } catch {
      return toScalar(cell?.value); // feuille absente du moteur pendant une reconstruction : valeur en cache
    }
  }, [sheet, store, store.version]);
  const displayAt = useCallback((row: number, col: number): string => displayText(wb, valueAt(row, col), numFmtOf(wb, styleAt(sheet, row, col))).text, [wb, sheet, valueAt]);
  const textOf = useCallback((v: Scalar): string => (v === null ? '' : v instanceof FormulaError ? toLocalized(`=${v.code}`, 'fr').slice(1) : typeof v === 'number' ? formatValue(v, 'General', 'fr-FR') : typeof v === 'boolean' ? (v ? 'VRAI' : 'FAUX') : v), []);

  // ------------------------------------------------ Fichier
  const onReplaced = useCallback(() => {
    setSels({});
    setPivots([]);
  }, []);
  // Polices : le dessin de la grille (canvas) et les largeurs mesurees avant le chargement des @font-face sont refaits quand elles arrivent.
  const [, setFontTick] = useState(0);
  const fontKey = useMemo(() => fontFamilies(wb).join('|'), [wb.styles.fonts]);
  useEffect(() => remeasureWhenFontsReady(() => setFontTick((t) => t + 1), fontKey ? fontKey.split('|') : []), [fontKey]);
  const closeBackstage = useCallback(() => setBackstage(null), []);
  const { name, setName, path, loadFile, save, openFile, newBlank, closeDoc, confirmDialog } = useFileOps({ store, services, si, notify, setSi, onReplaced, closeBackstage });

  // Hote du moteur de formules (CELLULE, INFORMATIONS, LIREDONNEESTABCROISDYNAMIQUE) : lu pendant le calcul, donc mis a jour au rendu.
  store.hostState.fileName = path ?? '';
  store.hostState.pivots = () => pivots.flatMap((p) => (p.cells ? [{ sheet: p.sheet, area: p.area, def: p.def, fields: p.fields, cells: p.cells }] : []));

  useEffect(() => {
    if (file) void loadFile(file.bytes, file.name, file.path);
    else void sharedRecovery('excel').pending().then((list) => list[0] && setRecovery(list[0]), () => undefined);
    services.recentFiles().then(setRecents, () => setRecents([]));
  }, [file, loadFile, services]);

  // Fermeture normale (fenetre, retour a l'accueil) : pas de recuperation a proposer ensuite ; ancienne copie des reglages supprimee.
  useEffect(() => {
    services.settings.set(LEGACY_RECOVERY_KEY, null);
    return sharedRecovery('excel').clearOnExit();
  }, [services]);

  useEffect(() => installZoneKeys(), []);

  // Copie de secours (intervalle regle dans Fichier > Options > Enregistrement) quand le classeur est modifie.
  useEffect(() => {
    let t = 0;
    const tick = (): void => {
      if (store.modified) void saveRecovery(store.wb, store.engine, name, si).catch(() => undefined);
      t = window.setTimeout(tick, recoverySeconds() * 1000);
    };
    t = window.setTimeout(tick, recoverySeconds() * 1000);
    return () => window.clearTimeout(t);
  }, [store, services, name, si]);

  const print = useCallback(() => {
    setBackstage(null);
    setPrinting(true);
  }, []);
  useEffect(() => {
    if (!printing) return;
    const t = window.setTimeout(() => {
      services.print();
      setPrinting(false);
    }, 150);
    return () => window.clearTimeout(t);
  }, [printing, services]);

  // ------------------------------------------------ Protection
  const guard = useCallback((need?: AllowKey): boolean => {
    if (!sheet.protection?.sheet) return true;
    if (need && sheet.protection.allow?.[need]) return true;
    const xf = cellFormat(wb, styleAt(sheet, selection.active.row, selection.active.col));
    if (xf.protection?.locked === false) return true;
    notify(S.protectedCell, 'warning');
    return false;
  }, [sheet, wb, selection, notify]);

  // ------------------------------------------------ Contexte des commandes
  const widenRef = useRef<() => void>(() => undefined);
  const ctx: Ctx = {
    store, services, si, sheet, sel: selection, setSel, value: valueAt, display: displayAt, open: setDialog, notify, clip, setClip, guard,
    widen: () => widenRef.current(),
  };
  const cmd = recordCommands(makeCommands(ctx));
  usePinchZoom(gridEl, sheet.view.zoom || 100, (z) => cmd.view({ zoom: Math.max(10, Math.min(400, z)) }), 10, 400);
  const act = makeActions(ctx, {
    selectedDrawing: drawing, setSelectedDrawing: setDrawing, pivots, setPivots, setSi, measure,
    dataRange: cmd.dataRange,
  });
  widenRef.current = act.widenSelection;

  // Crochet du banc de conformite (developpement seulement).
  const probeRef = useRef<ExcelSources | null>(null);
  if (import.meta.env.DEV) probeRef.current = { store, selection, setSel, si, setSi, setDrawing };
  useEffect(() => (import.meta.env.DEV ? registerProbe(excelProbe(() => probeRef.current as ExcelSources)) : undefined), []);

  // ------------------------------------------------ Edition
  const startEdit = useCallback((text: string | null, fromBar = false) => {
    if (!guard()) return;
    const a = selection.active;
    const cell = sheet.cells.get(a.row)?.get(a.col);
    const t = text ?? editText(wb, cell);
    setEdit({ sheet: si, row: a.row, col: a.col, text: t, caret: t.length, mode: text === null || fromBar ? 'edit' : 'enter', point: null });
    requestAnimationFrame(() => (fromBar ? barRef.current : cellRef.current)?.setCaret(t.length));
  }, [guard, selection, sheet, wb, si]);

  /** Insere du texte au curseur de la saisie en cours ; hors saisie, demarre « =texte » dans la cellule active. */
  const insertAtCaret = useCallback((text: string) => {
    if (!edit) {
      startEdit(`=${text}`);
      return;
    }
    const t = edit.text.slice(0, edit.caret) + text + edit.text.slice(edit.caret);
    const caret = edit.caret + text.length;
    setEdit({ ...edit, text: t, caret, point: null });
    requestAnimationFrame(() => (edit.sheet === si ? cellRef.current : barRef.current)?.setCaret(caret));
  }, [edit, si, startEdit]);

  const cancelEdit = useCallback(() => {
    if (edit && edit.sheet !== si) setSi(edit.sheet);
    setEdit(null);
    requestAnimationFrame(() => gridEl.current?.focus({ preventScroll: true }));
  }, [edit, si, setSi]);

  const commitEdit = useCallback((dr: number, dc: number, fillAll = false, asArray = false): boolean => {
    if (!edit) return true;
    const entry = parseEntry(applyFixedDecimals(edit.text, fixedDecimals()), wb.date1904);
    if (!entry.ok) {
      notify(`${S.formulaError} ${entry.message}`, 'error');
      return false;
    }
    const target = wb.sheets[edit.sheet];
    const dv = target ? validationAt(target, edit.row, edit.col) : undefined;
    if (dv && target && entry.formula === undefined) {
      const ev = (f: string): Scalar => {
        try {
          const v = store.engine.engine.evaluate(translateFormula(f, edit.row - (dv.ranges[0]?.r1 ?? edit.row), edit.col - (dv.ranges[0]?.c1 ?? edit.col)), target.name);
          return v instanceof Matrix ? v.get(0, 0) : v;
        } catch {
          return null; // formule de validation invalide : bornes ignorees
        }
      };
      const list = (): string[] => listItems(dv, (f) => rangeValues(store.engine, f, target.name).flat());
      if (dv.showErrorMessage !== false && !isValid(dv, entry.value, ev, list)) {
        const text = `${dv.errorTitle ? `${dv.errorTitle} : ` : ''}${dv.error || S.invalidValue}`;
        // Arret : la saisie est refusee ; Avertissement et Information : la saisie est acceptee et la remarque affichee.
        if (dv.errorStyle === 'information' || dv.errorStyle === 'warning') notify(text, dv.errorStyle === 'warning' ? 'warning' : 'info');
        else {
          notify(text, 'error');
          return false;
        }
      }
    }
    store.commit((d) => {
      if (asArray && entry.formula !== undefined) commitArrayEntry(d, edit.sheet, activeRange(selection), entry);
      else if (fillAll) fillRanges(d, edit.sheet, selection.ranges, entry, translateFormula, { row: edit.row, col: edit.col });
      else {
        commitEntry(d, edit.sheet, edit.row, edit.col, entry);
        afterEntry(d, edit.sheet, edit.row, edit.col, entry);
      }
    });
    if (entry.formula !== undefined) rememberFunctions(services.settings, edit.text);
    if (edit.sheet !== si) setSi(edit.sheet);
    setEdit(null);
    const base = edit.sheet === si ? selection : cellSelection(edit.row, edit.col);
    const multiCell = base.ranges.length > 1 || activeRange(base).r1 !== activeRange(base).r2 || activeRange(base).c1 !== activeRange(base).c2;
    if (dc !== 0 && tabOrigin.current === null) tabOrigin.current = edit.col;
    const col = dr !== 0 && tabOrigin.current !== null ? tabOrigin.current : Math.max(0, edit.col + dc);
    if (dr !== 0) tabOrigin.current = null;
    if (!fillAll && !asArray && (dr || dc)) setSels((m) => ({ ...m, [wb.sheets[edit.sheet]?.name ?? '']: multiCell ? cycleActive(base, dr, dc) : cellSelection(Math.max(0, edit.row + dr), col) }));
    requestAnimationFrame(() => gridEl.current?.focus({ preventScroll: true }));
    return true;
  }, [edit, wb, store, selection, si, notify, setSi]);

  const pointing = !!edit && edit.text.startsWith('=') && (edit.point !== null || canPointAt(edit.text, edit.caret));

  const onPoint = useCallback((range: CellRange) => {
    if (!edit) return;
    const label = rangeLabel(range);
    const ref = si !== edit.sheet ? `${quoteSheetName(sheet.name)}!${label}` : label;
    const at = edit.point ?? { start: edit.caret, end: edit.caret };
    const text = edit.text.slice(0, at.start) + ref + edit.text.slice(at.end);
    const caret = at.start + ref.length;
    setEdit({ ...edit, text, caret, point: { start: at.start, end: caret }, mode: 'enter' });
    requestAnimationFrame(() => (edit.sheet === si ? cellRef.current : barRef.current)?.setCaret(caret));
  }, [edit, si, sheet.name]);

  /** F4 : bascule $A$1 -> A$1 -> $A1 -> A1 sur la reference au curseur. */
  const cycleAbsolute = useCallback(() => {
    if (!edit) return;
    const next = cycleAbsoluteAt(edit.text, edit.caret);
    if (!next) return;
    setEdit({ ...edit, ...next });
    requestAnimationFrame(() => cellRef.current?.setCaret(next.caret));
  }, [edit]);

  /** Touches pendant la saisie : table de raccourcis du contexte « entry » (keys-entry.ts). */
  const onEditKey = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!edit) return;
    const handled = dispatchKey('entry', e, { edit, si, pointing, commit: commitEdit, open: setDialog, cancel: cancelEdit, cycleAbsolute, setEdit, onPoint, textarea: e.currentTarget });
    if (handled) e.preventDefault();
  }, [edit, commitEdit, cancelEdit, cycleAbsolute, pointing, si, onPoint]);

  const onEditChange = useCallback((text: string, caret: number) => {
    setEdit((e) => (e ? { ...e, text, caret, point: refBeforeCaret(text, caret) && e.point?.end === caret ? e.point : null } : e));
  }, []);

  // ------------------------------------------------ Presse-papiers
  const { doCopy, paste } = useClipboard({ store, wb, si, sheet, selection, setSel, displayAt, notify, guard, clip, setClip, gridEl });

  // ------------------------------------------------ Selection (reproduire la mise en forme)
  const onSelect = useCallback((s: Selection) => {
    if (s.active.row !== selection.active.row) tabOrigin.current = null;
    setSel(s);
    setDrawing(null);
    if (painter !== null) {
      store.commit((d) => {
        for (const r of s.ranges) for (let row = r.r1; row <= Math.min(r.r2, r.r1 + 5000); row++) for (let col = r.c1; col <= Math.min(r.c2, r.c1 + 500); col++) {
          const cell = d.get(si, row, col);
          d.set(si, row, col, { ...(cell ?? { value: null }), styleId: painter });
        }
      }, 'painter');
      setPainter(null);
    }
  }, [setSel, painter, store, si, selection.active.row]);

  // ------------------------------------------------ Recalcul, audit
  const recalc = useCallback((scope?: 'sheet' | 'all') => {
    const eng = store.engine.engine;
    if (import.meta.env.DEV) probeCounters.recalc += 1;
    if (scope === 'sheet') eng.calculateSheet(sheet.name);
    else if (scope === 'all') eng.recalculateAll();
    else eng.recalculate();
    store.notify();
  }, [store, sheet.name]);

  const trace = useCallback((dir: 'precedents' | 'dependents' | 'clear' | 'clearPrecedents' | 'clearDependents') => {
    if (dir === 'clear') {
      setArrows([]);
      setUi({ arrows: false });
      return;
    }
    if (dir === 'clearPrecedents' || dir === 'clearDependents') {
      const left = removeLevel(arrows, dir === 'clearPrecedents' ? 'prec' : 'dep', selection.active);
      setArrows(left);
      setUi({ arrows: left.length > 0 });
      return;
    }
    const kind = dir === 'precedents' ? 'prec' : 'dep';
    const r = traceStep(arrows, kind, selection.active, sheet.name, store.engine.engine);
    if (r.added === 0) {
      notify(traceLevel(arrows, kind, selection.active) > 0 ? FM.trace.noMore : kind === 'prec' ? FM.trace.noPrecedents : FM.trace.noDependents, 'info');
      return;
    }
    setArrows(r.arrows);
    setUi({ arrows: true });
  }, [arrows, selection, sheet.name, store, notify, setUi]);

  // ------------------------------------------------ Feuilles
  const focusGrid = useCallback(() => gridEl.current?.focus(), []);
  const ask = useAsk();
  const { addSheet, removeSheet, renameCurrent, switchSheet, goTo } = useSheetOps({ store, si, setSi, setSels, notify, focusGrid, ask });

  // ------------------------------------------------ Graphiques, tableaux croises
  const pivot = act.pivotAt(sheet.name, selection.active.row, selection.active.col) ?? pivots.find((p) => p.sheet === sheet.name);
  const table = tableAt(sheet, selection.active.row, selection.active.col);
  const chartObj = act.chart();
  const selectedDrawing = drawing === null ? undefined : sheet.drawings[drawing];
  const shapeObj = selectedDrawing?.kind === 'shape' ? selectedDrawing : undefined;
  useEffect(() => {
    if (chartObj) setTab('chartDesign');
    else setTab((t) => (t === 'chartDesign' ? 'home' : t));
  }, [chartObj !== undefined]);
  useEffect(() => {
    if (shapeObj) setTab('shapeFormat');
    else setTab((t) => (t === 'shapeFormat' ? 'home' : t));
  }, [shapeObj !== undefined]);
  useEffect(() => {
    if (pivot && pivot.def.values.length === 0 && pivot.def.rows.length === 0) setUi({ pivotPane: true });
  }, [pivot?.id]);

  // ------------------------------------------------ Ruban
  const env: RibbonEnv = {
    cmd, ctx, wb, sheet, si, sel: selection, ui, setUi,
    paste, cut: () => doCopy(true), copy: () => doCopy(false),
    painter: { active: painter !== null, start: () => setPainter(painter === null ? styleAt(sheet, selection.active.row, selection.active.col) : null) },
    insertChart: act.insertChart, insertImage: () => void act.insertImage(),
    reviewNav: (dir) => {
      const next = neighbourTarget(reviewTargets(sheet), selection.active, dir);
      if (next) setSel(cellSelection(next.row, next.col));
      else notify(S.noComments, 'info');
    },
    deleteNote: () => store.commit((d) => {
      const s = d.sheet(si);
      s.notes = s.notes.filter((n) => !(n.ref.row === selection.active.row && n.ref.col === selection.active.col));
    }),
    toggleAllNotes: (visible) => store.commit((d) => { const s = d.sheet(si); s.notes = setNotesVisible(s.notes, visible); }),
    allNotesVisible: allNotesVisible(sheet.notes),
    outlineAuto: () => {
      let n = 0;
      store.commit((d) => { n = autoOutlineRows(d.sheet(si)); return n > 0; });
      notify(n > 0 ? S.outlineAuto.done(n) : S.outlineAuto.none, n > 0 ? 'success' : 'info');
    },
    insertShape: (geometry, textBox) => setDrawing(insertShape(store, si, selection.active, geometry, textBox)), insertPivot: () => setDialog({ kind: 'pivotCreate' }),
    insertComment: () => setDialog({ kind: 'newComment' }),
    importCsv: () => {
      void services.openFile([{ name: 'CSV', extensions: ['csv', 'tsv', 'txt'] }]).then((f) => {
        if (f) setDialog({ kind: 'importText', name: f.name, bytes: f.bytes });
      });
    },
    recalc, trace,
    newWindow: () => void services.openModule('excel', path ?? undefined),
    setZoom: (z) => cmd.view({ zoom: z }),
    zoomToSelection: () => {
      const v = viewport.current;
      if (!v) return;
      const r = activeRange(selection);
      const rect = rangeRect({ ...v, zoom: 1, scrollX: 0, scrollY: 0, frozenCols: 0, frozenRows: 0 }, r);
      cmd.view({ zoom: Math.max(10, Math.min(400, Math.floor(Math.min((v.width - v.headerW) / rect.w, (v.height - v.headerH) / rect.h) * 100))) });
    },
    autofit: act.autofit, renameSheet: renameCurrent, addSheet, deleteSheet: () => removeSheet(si),
    outline: act.outline, showDetail: act.showDetail,
    insertFunction: (fnName) => {
      if (fnName?.startsWith('=')) {
        startEdit(fnName);
        return;
      }
      setDialog({ kind: 'fnWizard', ...(fnName ? { fn: fnName } : {}) });
    },
    themeColors: act.themeColors, printArea: act.printArea, pageBreak: act.pageBreak,
    table, tableOption: act.tableOption, tableToRange: act.tableToRange,
    shapeObj, shapeEdit: (patch) => { if (drawing !== null) store.commit((d) => { const sh = d.sheet(si); sh.drawings = sh.drawings.map((o, i) => (i === drawing && o.kind === 'shape' ? editShape(o, patch) : o)); }); },
    chart: chartObj, chartKind: act.chartKind, chartSwitch: act.chartSwitch, chartLegend: act.chartLegend, chartLabels: act.chartLabels,
    chartTitle: act.chartTitle, chartAxisTitle: act.chartAxisTitle, chartTrend: act.chartTrend, chartLabelPos: act.chartLabelPos, chartIndex: drawing, chartGrid: act.chartGrid, chartPalette: act.chartPalette, chartDelete: act.chartDelete,
    pivotActive: !!act.pivotAt(sheet.name, selection.active.row, selection.active.col),
    pivotRefresh: () => act.refreshPivots(textOf),
    iconSet: cmd.iconSet, flashFill: act.flashFill,
    protectToggle: (target) => setDialog({ kind: 'protect', target }),
  };
  const tabs: RibbonTab[] = applyKeytips([homeTab(env), insertTab(env), layoutTab(env), formulasTab(env), dataTab(env), reviewTab(env), viewTab(env)]);
  for (const t of [tableTab(env), chartTab(env), pivotTab(env), shapeTab(env)]) if (t) tabs.push(t);
  const commands = collectCommands(tabs);

  // ------------------------------------------------ Grille : sources de dessin
  const zoom = (sheet.view.zoom || 100) / 100;
  const cf = useMemo(() => (sheet.conditionalFormats.length ? new CfEvaluator(sheet.conditionalFormats, {
    wb, valueAt, used: { r1: 0, c1: 0, r2: Math.max(0, ...[...sheet.cells.keys()]), c2: Math.max(0, ...[...sheet.cells.values()].flatMap((l) => [...l.keys()])) },
    evaluate: (f) => {
      const v = store.engine.engine.evaluate(f, sheet.name);
      return v instanceof Matrix ? v.get(0, 0) : v;
    },
    color: (c) => resolveColor(wb, c),
    today: Math.floor((Date.now() - Date.UTC(1899, 11, 30)) / 86_400_000),
  }) : null), [sheet, wb, valueAt, store.version]);
  const partsCache = useMemo(() => new Map<string, TableStyleParts>(), [wb.theme]);
  const tableParts = useCallback((t: { style?: { name: string } }): TableStyleParts => {
    const n = t.style?.name ?? 'TableStyleMedium2';
    let p = partsCache.get(n);
    if (!p) {
      p = tableStyleParts(wb, n);
      partsCache.set(n, p);
    }
    return p;
  }, [partsCache, wb]);
  const filterButtons = useMemo(() => {
    const out: { row: number; col: number; active: boolean }[] = [];
    const af = sheet.autoFilter;
    if (af) for (let c = af.ref.c1; c <= af.ref.c2; c++) out.push({ row: af.ref.r1, col: c, active: af.columns.some((k) => k.colId === c - af.ref.c1 && k.filter) });
    for (const t of sheet.tables) if (t.autoFilter && t.headerRowCount) for (let c = t.ref.c1; c <= t.ref.c2; c++) out.push({ row: t.ref.r1, col: c, active: t.autoFilter.columns.some((k) => k.colId === c - t.ref.c1 && k.filter) });
    return out;
  }, [sheet.autoFilter, sheet.tables]);
  const breaks = useMemo(() => (sheet.view.view !== 'normal' ? pageBreakLines(sheet) : null), [sheet]);
  const editRefs = edit ? findRefs(edit.text) : [];
  const completion = completionSource(wb, si);
  const errors = useMemo(() => new ErrorCache(checkEnv(store, si, errorRules(services.settings)), ignoredErrors(store)), [store, si, store.version, wb]);

  // ------------------------------------------------ Clavier de la grille
  const onGridKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    const handled = handleGridKey(e, {
      sheet, sel: selection, setSel: onSelect, cmd, startEdit: (t) => startEdit(t),
      undo: () => store.undo(), redo: () => store.redo(), canRedo: store.canRedo, save: () => void save(), saveAs: () => setBackstage('saveAs'), openFile: () => void openFile(), newFile: () => void newBlank(), closeDoc: () => void closeDoc(),
      print, open: setDialog, switchSheet, addSheet, recalc, toggleFormulas: () => setUi({ showFormulas: !ui.showFormulas }),
      escape: () => { setClip(null); setPainter(null); setDrawing(null); },
      stamp: (kind) => {
        const now = new Date();
        const text = kind === 'date' ? now.toLocaleDateString('fr-FR') : now.toLocaleTimeString('fr-FR');
        const entry = parseEntry(text, wb.date1904);
        if (entry.ok) store.commit((d) => commitEntry(d, si, selection.active.row, selection.active.col, entry));
      },
      deleteDrawing: () => {
        if (drawing === null) return false;
        act.chartDelete();
        return true;
      },
      flashFill: act.flashFill,
      notify, outline: act.outline, insertChart: act.insertChart,
      toggleTotalRow: () => {
        if (!table) return false;
        act.tableOption({ total: table.totalsRowCount === 0 });
        return true;
      },
      ...makeKeyHost({
        gridEl, viewport, selection, sheet, wb, si, store, filterButtons, openFilter: (row, col, at) => setFilterMenu({ row, col, x: at.x, y: at.y }),
        openMenu: context.open, openCellMenu: (at) => context.open({ clientX: at.x, clientY: at.y }, buildMenu('cell', menuEnv)),
        display: displayAt, valueText: (row, col) => textOf(valueAt(row, col)), notify, value: valueAt, dataRange: cmd.dataRange, setSi,
      }),
    });
    if (handled) e.preventDefault();
  };

  // ------------------------------------------------ Barre d'etat
  const active = selection.active;
  const mode = edit ? (pointing ? S.point : edit.mode === 'enter' ? S.enter : S.edit) : selectionModeLabel() ?? S.ready;
  const circular = store.engine.engine.circularReferences();

  const quickAccess: QuickAccessItem[] = [
    { id: 'save', label: S.qa.save, icon: 'save', shortcut: 'Ctrl+S', onClick: () => void save() },
    { id: 'undo', label: S.qa.undo, icon: 'arrow_undo', shortcut: 'Ctrl+Z', disabled: !store.canUndo, onClick: () => store.undo() },
    { id: 'redo', label: S.qa.redo, icon: 'arrow_redo', shortcut: 'Ctrl+Y', disabled: !store.canRedo, onClick: () => store.redo() },
    { id: 'print', label: S.qa.print, icon: 'print', defaultVisible: false, onClick: print },
  ];

  // ------------------------------------------------ Menus contextuels et services (registre)
  const menuEnv: MenuEnv = { cmd, copy: doCopy, paste, open: setDialog, comment: env.insertComment, notify };
  const xlServices = makeServices(setDialog, context.open, menuEnv);
  const mini = useSelectionMiniToolbar({ container: gridEl, getRect: noRect, enabled: ui.miniBar });
  const menuOpen = context.menu !== null;
  useEffect(() => {
    if (!menuOpen) mini.hide();
  }, [menuOpen]);

  // ------------------------------------------------ Superpositions de la grille
  const fillBase: SeriesOptions = { isDate: (c) => /[dmy]/i.test(numFmtOf(wb, c.styleId).replace(/"[^"]*"/g, '')) && numFmtOf(wb, c.styleId) !== 'General' };
  const fillShown = fillOpts && fillOpts.si === si && selection.ranges.length === 1 && JSON.stringify(activeRange(selection)) === JSON.stringify(fillUnion(fillOpts.src, fillOpts.target));
  const overlay = (v: Viewport) => {
    viewport.current = v;
    return (
      <GridOverlay
        v={v} wb={wb} sheet={sheet} si={si} store={store} selection={selection} edit={edit} drawing={drawing} onSelectDrawing={setDrawing} onMoveDrawing={act.moveDrawing} onShapeText={(i, t) => setShapeText(store, si, i, t)} openDialog={setDialog} quickItems={quickAnalysisItems(cmd, act.insertChart, () => setDialog({ kind: 'createTable', style: 'TableStyleMedium2' }))}
        textOf={textOf} hover={hover} zoom={zoom} cellRef={cellRef} onEditChange={onEditChange} onEditKey={onEditKey} onCaret={(caret) => setEdit((e) => (e ? { ...e, caret } : e))}
        onFunctionHelp={(fn) => setDialog({ kind: 'fnWizard', fn: fn.name })} openMenu={context.open}
        fillOpts={fillShown && fillOpts ? { range: fillUnion(fillOpts.src, fillOpts.target), mode: fillOpts.mode, pick: (mode) => {
          store.commit((d) => applyFillMode(d, fillOpts.si, fillOpts.src, fillOpts.target, mode, fillOpts.before, fillBase));
          setFillOpts({ ...fillOpts, mode });
        } } : null}
      />
    );
  };

  return (
    <ExcelServicesProvider value={xlServices}>
    <CompletionContext.Provider value={completion}>
      <div className="xl-app" data-app="excel">
        <TitleBar
          app={excel} documentName={name} location={path} saveState={store.modified ? 'modified' : 'saved'}
          autoSave={{ enabled: autoSave, onChange: setAutoSave, disabled: !path }}
          quickAccess={quickAccess} commands={commands} onRename={(n) => setName(n)} windowControls={services.windowControls} settings={services.settings}
        />
        <Ribbon tabs={tabs} activeTab={tab} onTabChange={setTab} onFile={() => setBackstage('home')} settings={services.settings}
          end={<Button size="small" appearance="subtle" icon="comment" onClick={() => setUi({ commentsPane: !ui.commentsPane })}>{S.comments}</Button>} />
        {ui.formulaBar && (
          <FormulaBar
            ref={barRef}
            address={edit ? cellName(edit.row, edit.col) : cellName(active.row, active.col)}
            names={wb.definedNames.filter((n) => !n.name.startsWith('_xlnm')).map((n) => n.name)}
            onGo={goTo}
            text={edit ? edit.text : editText(wb, sheet.cells.get(active.row)?.get(active.col))}
            editing={!!edit}
            onFocusEdit={() => { if (!edit) startEdit(null, true); }}
            onChange={onEditChange}
            onKeyDown={onEditKey}
            onCaret={(caret) => setEdit((e) => (e ? { ...e, caret } : e))}
            onCancel={cancelEdit}
            onConfirm={() => commitEdit(0, 0)}
            onInsertFunction={() => setDialog({ kind: 'fnWizard' })}
            onFunctionHelp={(fn) => setDialog({ kind: 'fnWizard', fn: fn.name })}
          />
        )}
        <div className="xl-body">
          <div className="xl-main">
            {sheet.view.view === 'pageLayout' ? (
              <PageLayoutView
                wb={wb} sheet={sheet} value={valueAt} fileName={name} zoom={zoom}
                onEditHeaderFooter={() => setDialog({ kind: 'pageSetup', tab: 'headerFooter' })}
                onOpenCell={(row, col) => { setSel(cellSelection(row, col)); cmd.view({ view: 'normal' }); }}
              />
            ) : (
            <Grid
              sheet={sheet}
              zoom={zoom}
              sel={selection}
              onSelect={onSelect}
              source={{
                wb, value: valueAt, cf, tableParts, showGrid: sheet.view.showGridLines, showHeaders: sheet.view.showHeaders, showFormulas: ui.showFormulas,
                editing: edit && edit.sheet === si ? { row: edit.row, col: edit.col } : null,
                refs: editRefs, copyRange: clip && clip.sheet === si ? clip.range : null, filterButtons, arrows, pageBreaks: breaks, errorAt: errors.at,
                rangeSheetName: edit ? (wb.sheets[edit.sheet]?.name ?? sheet.name) : sheet.name,
                sparkValues: (src) => rangeValues(store.engine, src, sheet.name).flat().map((v) => (typeof v === 'number' ? v : null)),
              }}
              pointing={pointing}
              onPoint={onPoint}
              onEdit={(row, col) => {
                const rec = act.pivotAt(sheet.name, row, col);
                if (rec && act.pivotDetail(rec, row, col)) return;
                setSel(cellSelection(row, col));
                const cell = sheet.cells.get(row)?.get(col);
                const t = editText(wb, cell);
                if (!guard()) return;
                setEdit({ sheet: si, row, col, text: t, caret: t.length, mode: 'edit', point: null });
                requestAnimationFrame(() => cellRef.current?.setCaret(t.length));
              }}
              onFill={(src, target, copyOnly) => {
                if (!guard()) return;
                let before: FillBefore = [];
                store.commit((d) => {
                  before = snapshotFill(d, si, src, target);
                  autoFill(d, si, src, target, { ...fillBase, copyOnly });
                });
                setSel(rangeSelection(fillUnion(src, target), selection.active));
                setFillOpts({ si, src, target, before, mode: copyOnly ? 'copy' : 'series' });
              }}
              onMoveRange={(src, target, copy) => {
                if (!guard()) return;
                store.commit((d) => setSel(rangeSelection(moveRangeCells(d, si, src, target, copy))));
              }}
              onResize={(axis, first, last, px) => (px === 'auto' ? (axis === 'col' ? act.autofitColumn(first, last) : act.autofit('row')) : act.resizeLive(axis, first, last, px))}
              onContext={(e, area) => {
                const rec = area === 'cell' ? act.pivotAt(sheet.name, selection.active.row, selection.active.col) : undefined;
                const pivotItems: MenuItem[] = rec ? [
                  { id: 'pv-refresh', label: S.pivot.ctx.refresh, icon: 'arrow_sync', onClick: () => act.refreshPivots(textOf) },
                  { id: 'pv-detail', label: S.pivot.ctx.details, onClick: () => { if (!act.pivotDetail(rec, selection.active.row, selection.active.col)) notify(S.pivot.ctx.noDetails, 'info'); } },
                  { id: 'pv-fields', label: S.pivot.ctx.fields, checked: ui.pivotPane, onClick: () => setUi({ pivotPane: !ui.pivotPane }) },
                  { id: 'pv-sep', kind: 'separator' },
                ] : [];
                context.open(e, [...pivotItems, ...buildMenu(area, menuEnv)]);
                if (ui.miniBar) mini.showAt({ left: e.clientX, top: e.clientY, width: 0, height: 0 });
              }}
              onFilterButton={(row, col, at) => setFilterMenu({ row, col, x: at.x, y: at.y })}
              onZoom={(z) => cmd.view({ zoom: z })}
              onHover={setHover}
              onKeyDown={onGridKey}
              gridRef={(el) => { gridEl.current = el; }}
              margin={(v) => (
                <OutlineButtons v={v} sheet={sheet} onAction={(a) => store.commit((d) => {
                  const sh = d.sheet(si);
                  const cols = colsAsRows(sh.cols);
                  if ('level' in a) {
                    showLevel(sh.rows, a.level);
                    showLevel(cols, a.level);
                    writeColsBack(sh.cols, cols);
                  } else if (a.axis === 'row') setGroupCollapsed(sh.rows, a.group, !a.group.collapsed);
                  else {
                    setGroupCollapsed(cols, a.group, !a.group.collapsed);
                    writeColsBack(sh.cols, cols);
                  }
                })} />
              )}
              overlay={overlay}
            />
            )}
            <SheetTabsHost env={{ wb, si, setSi, store, addSheet, removeSheet, setDialog, notify, cmd }} />
          </div>
          {ui.pivotPane && pivot && (
            <PivotPane fields={pivot.fields} numeric={pivot.numeric} def={pivot.def} onChange={(def) => act.updatePivot(pivot, def, textOf)} onClose={() => setUi({ pivotPane: false })} />
          )}
          {ui.commentsPane && (
            <CommentsPane
              comments={sheet.threadedComments} sheetName={sheet.name}
              onSelect={(c) => setSel(cellSelection(c.ref.row, c.ref.col))}
              onReply={(c, text) => store.commit((d) => {
                const s = d.sheet(si);
                s.threadedComments = s.threadedComments.map((k) => (k === c ? { ...k, replies: [...k.replies, { id: `{${crypto.randomUUID().toUpperCase()}}`, personId: 'local', text, date: new Date().toISOString() }] } : k));
              })}
              onResolve={(c) => store.commit((d) => {
                const s = d.sheet(si);
                s.threadedComments = s.threadedComments.map((k) => (k === c ? { ...k, done: !k.done } : k));
              })}
              onEdit={(c, text) => store.commit((d) => {
                const s = d.sheet(si);
                s.threadedComments = s.threadedComments.map((k) => (k === c ? { ...k, text } : k));
              })}
              onDelete={(c) => store.commit((d) => {
                const s = d.sheet(si);
                s.threadedComments = s.threadedComments.filter((k) => k !== c);
              })}
              onClose={() => setUi({ commentsPane: false })}
            />
          )}
        </div>
        <WatchHost store={store} sheet={sheet.name} selection={selection} notify={notify}
          goTo={(name, row, col) => { const i = wb.sheets.findIndex((k) => k.name === name); if (i >= 0) { setSi(i); setSels((m) => ({ ...m, [name]: cellSelection(row, col) })); } }} />
        <KeyBar home={tabs[0] as RibbonTab} />
        <StatusBarHost
          wb={wb} sheet={sheet} selection={selection} valueAt={valueAt} mode={mode} calcManual={ui.calcManual && store.engine.engine.pendingCalculation} recalc={() => recalc()} circular={circular} painter={painter !== null}
          setView={(view) => cmd.view({ view })} setZoom={(z) => cmd.view({ zoom: z })} zoomToSelection={env.zoomToSelection} openMenu={context.open}
        />
        <BackstagePages
          open={backstage !== null} page={backstage ?? 'home'} onPage={setBackstage} onClose={() => setBackstage(null)}
          env={{
            services, wb, sheet, name, recents, value: valueAt,
            listVersions: () => listVersions(name),
            restoreVersion: async (id) => {
              const bytes = await loadVersion(id);
              if (!bytes) return;
              store.reset(await loadWorkbook(bytes, `${name}.xlsx`));
              store.markSaved();
              closeBackstage();
              notify(S.backstage.restored, 'success');
            },
            setProperties: (patch) => store.commit((d) => { d.wb.properties = { ...d.wb.properties, ...patch }; }),
            newBlank: () => void newBlank(), open: () => void openFile(), save: () => void save(),
            saveAs: (n, f, protectFormulas) => void save(n, f, protectFormulas), print, close: () => void closeDoc(), closeBackstage,
            protect: () => setDialog({ kind: 'protect', target: 'book' }), setPage: cmd.pageSetup,
            openPageSetup: (tab) => { setBackstage(null); setDialog({ kind: 'pageSetup', ...(tab ? { tab } : {}) }); },
            calcManual: ui.calcManual, setCalcManual: (v) => setUi({ calcManual: v }),
          }}
        />
        {dialog && (
          <DialogHost
            dialog={dialog} x={{ ...ctx, cmd, close: () => setDialog(null) }}
            host={{ zoom: sheet.view.zoom || 100, setZoom: (z) => cmd.view({ zoom: z }), createPivot: act.createPivot, insertFormula: (f) => startEdit(f), setUi, setSheet: setSi, goToCell: (name, row, col) => { const i = wb.sheets.findIndex((k) => k.name === name); if (i >= 0) { setSi(i); setSels((m) => ({ ...m, [name]: cellSelection(row, col) })); } }, insertAtCaret }}
          />
        )}
        {filterMenu && <FilterHost menu={filterMenu} store={store} si={si} valueAt={valueAt} displayAt={displayAt} onClose={() => setFilterMenu(null)} />}
        {recovery && <RecoveryDialog recovery={recovery} store={store} setName={setName} onClose={() => setRecovery(null)} />}
        {confirmDialog}
        {ask.dialog}
        {printing && <PrintRoot wb={wb} sheet={sheet} value={valueAt} name={name} valueOf={(sh) => (r, c) => store.engine.value(sh.name, r, c)} selection={activeRange(selection)} />}
        {context.menu}
        {mini.visible && mini.anchor && <MiniToolbar rows={miniBarRows(tabs[0] as RibbonTab)} anchor={mini.anchor} label={S.miniBar} onClose={mini.hide} />}
      </div>
    </CompletionContext.Provider>
    </ExcelServicesProvider>
  );
}
