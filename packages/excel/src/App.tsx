// Application Tableur : etat du document, edition des cellules, presse-papiers, fichiers, ruban et mise en page.
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { MODULES, sharedRecovery, type ModuleProps, type RecentFile, type RecoveryEntry } from '@forgeoffice/core';
import {
  Button, Icon, Ribbon, StatusBar, TitleBar, collectCommands, remeasureWhenFontsReady, useContextMenu, usePinchZoom, type MenuItem, type QuickAccessItem, type RibbonTab,
} from '@forgeoffice/ui';
import { FormulaError, Matrix, formatValue, quoteSheetName, toLocalized, translateFormula, type Scalar } from '@forgeoffice/formulas';
import { cellName, rangeName, resolveColor, type CellRange } from '@forgeoffice/xlsx';
import { commitEntry, editText, fillRanges, parseEntry } from './logic/cells.ts';
import type { ClipData } from './logic/clipboard.ts';
import { CfEvaluator } from './logic/condfmt.ts';
import { fromScalar, rangeValues, toScalar } from './logic/engine.ts';
import { autoFill } from './logic/fill.ts';
import { canPointAt, findRefs, refBeforeCaret, type FnInfo } from './logic/formula-ui.ts';
import { cellLook, displayText } from './logic/look.ts';
import { activeRange, cellSelection, clipRange, cycleActive, rangeLabel, rangeSelection, sizeLabel, type Selection } from './logic/selection.ts';
import { addSheetAt } from './logic/structure.ts';
import { cellFormat, fontFamilies, mergeAt, numFmtOf, styleAt } from './logic/styles.ts';
import { tableAt, tableStyleParts, type TableStyleParts } from './logic/tables.ts';
import { isValid, listItems, validationAt } from './logic/validation.ts';
import { rangeRect, type Viewport } from './logic/viewport.ts';
import { makeActions, type PivotRecord } from './ui/actions.ts';
import { makeCommands, type Ctx, type DialogState } from './ui/commands.ts';
import { Drawings } from './ui/Drawings.tsx';
import { FormulaBar } from './ui/FormulaBar.tsx';
import { FormulaInput, type FormulaInputHandle } from './ui/FormulaInput.tsx';
import { Grid, type ContextArea } from './ui/Grid.tsx';
import { blankWorkbook, baseName, LEGACY_RECOVERY_KEY, loadWorkbook, saveRecovery } from './ui/io.ts';
import { handleGridKey } from './ui/keys.ts';
import { useFileOps } from './ui/useFileOps.ts';
import { useSheetOps } from './ui/useSheetOps.ts';
import { FilterHost, type FilterMenuState } from './ui/FilterHost.tsx';
import { RecoveryDialog } from './ui/RecoveryDialog.tsx';
import { lastCol } from './logic/rangeText.ts';
import { CommentsPane, PivotPane } from './ui/Panes.tsx';
import { BackstagePages, DialogHost, PrintRoot, SheetTabsHost } from './ui/Hosts.tsx';
import { pageBreakLines } from './ui/print.tsx';
import { DocStore, useDoc } from './ui/store.ts';
import { gridContextMenu, useClipboard } from './ui/clipboard-ui.ts';
import { homeTab } from './ribbon/home.tsx';
import { dataTab, formulasTab, insertTab, layoutTab, reviewTab, viewTab } from './ribbon/tabs.tsx';
import { chartTab, pivotTab, tableTab } from './ribbon/contextual.tsx';
import type { RibbonEnv, UiFlags } from './ribbon/env.ts';
import { S, RB } from './strings.ts';
import './ui/Excel.css';

interface Edit {
  sheet: number;
  row: number;
  col: number;
  text: string;
  caret: number;
  /** Entrer : les fleches valident ; Modifier : les fleches deplacent le curseur. */
  mode: 'enter' | 'edit';
  /** Reference inseree en mode Pointer (remplacee si l'on clique ailleurs). */
  point: { start: number; end: number } | null;
}

const excel = MODULES.excel;
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
  const [ui, setUiState] = useState<UiFlags>({ showFormulas: false, formulaBar: true, commentsPane: false, pivotPane: false, calcManual: false, arrows: false });
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [backstage, setBackstage] = useState<string | null>(null);
  const [clip, setClip] = useState<ClipData | null>(null);
  const [painter, setPainter] = useState<number | null>(null);
  const [drawing, setDrawing] = useState<number | null>(null);
  const [pivots, setPivots] = useState<PivotRecord[]>([]);
  const [arrows, setArrows] = useState<{ from: CellRange; to: { row: number; col: number } }[]>([]);
  const [filterMenu, setFilterMenu] = useState<FilterMenuState | null>(null);
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
  const setUi = useCallback((patch: Partial<UiFlags>) => setUiState((u) => ({ ...u, ...patch })), []);
  const setSi = useCallback((i: number) => {
    setSiState(i);
    setDrawing(null);
    setArrows([]);
  }, []);
  const notify = useCallback((m: string, kind: 'info' | 'success' | 'warning' | 'error' = 'info') => services.notify(m, kind), [services]);

  // ------------------------------------------------ Valeurs affichees
  const valueAt = useCallback((row: number, col: number): Scalar => {
    const cell = sheet.cells.get(row)?.get(col);
    if (ui.calcManual && cell?.formula !== undefined) return toScalar(cell.value);
    try {
      return store.engine.value(sheet.name, row, col);
    } catch {
      return toScalar(cell?.value); // feuille absente du moteur pendant une reconstruction : valeur en cache
    }
  }, [sheet, store, ui.calcManual, store.version]);
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

  // Copie de secours toutes les 30 s quand le classeur est modifie.
  useEffect(() => {
    const t = window.setInterval(() => {
      if (store.modified) void saveRecovery(store.wb, store.engine, name, si).catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(t);
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
  const guard = useCallback((): boolean => {
    if (!sheet.protection?.sheet) return true;
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
  const cmd = makeCommands(ctx);
  usePinchZoom(gridEl, sheet.view.zoom || 100, (z) => cmd.view({ zoom: Math.max(10, Math.min(400, z)) }), 10, 400);
  const act = makeActions(ctx, {
    selectedDrawing: drawing, setSelectedDrawing: setDrawing, pivots, setPivots, setSi, measure,
    dataRange: cmd.dataRange,
  });
  widenRef.current = act.widenSelection;

  // ------------------------------------------------ Edition
  const startEdit = useCallback((text: string | null, fromBar = false) => {
    if (!guard()) return;
    const a = selection.active;
    const cell = sheet.cells.get(a.row)?.get(a.col);
    const t = text ?? editText(wb, cell);
    setEdit({ sheet: si, row: a.row, col: a.col, text: t, caret: t.length, mode: text === null || fromBar ? 'edit' : 'enter', point: null });
    requestAnimationFrame(() => (fromBar ? barRef.current : cellRef.current)?.setCaret(t.length));
  }, [guard, selection, sheet, wb, si]);

  const cancelEdit = useCallback(() => {
    if (edit && edit.sheet !== si) setSi(edit.sheet);
    setEdit(null);
    requestAnimationFrame(() => gridEl.current?.focus({ preventScroll: true }));
  }, [edit, si, setSi]);

  const commitEdit = useCallback((dr: number, dc: number, fillAll = false): boolean => {
    if (!edit) return true;
    const entry = parseEntry(edit.text, wb.date1904);
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
      if (!isValid(dv, entry.value, ev, list) && dv.errorStyle !== 'information' && dv.errorStyle !== 'warning') {
        notify(dv.error || S.invalidValue, 'error');
        return false;
      }
    }
    store.commit((d) => {
      if (fillAll) fillRanges(d, edit.sheet, selection.ranges, entry, translateFormula, { row: edit.row, col: edit.col });
      else commitEntry(d, edit.sheet, edit.row, edit.col, entry);
    });
    if (edit.sheet !== si) setSi(edit.sheet);
    setEdit(null);
    const base = edit.sheet === si ? selection : cellSelection(edit.row, edit.col);
    const multiCell = base.ranges.length > 1 || activeRange(base).r1 !== activeRange(base).r2 || activeRange(base).c1 !== activeRange(base).c2;
    if (dc !== 0 && tabOrigin.current === null) tabOrigin.current = edit.col;
    const col = dr !== 0 && tabOrigin.current !== null ? tabOrigin.current : Math.max(0, edit.col + dc);
    if (dr !== 0) tabOrigin.current = null;
    if (!fillAll && (dr || dc)) setSels((m) => ({ ...m, [wb.sheets[edit.sheet]?.name ?? '']: multiCell ? cycleActive(base, dr, dc) : cellSelection(Math.max(0, edit.row + dr), col) }));
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
    const refs = findRefs(edit.text);
    const r = refs.find((x) => edit.caret >= x.start && edit.caret <= x.end);
    if (!r) return;
    const cycle = (part: string): string => {
      const m = part.match(/^(\$?)([A-Za-z]+)(\$?)(\d+)$/);
      if (!m) return part;
      const state = (m[1] ? 2 : 0) + (m[3] ? 1 : 0);
      const next = [3, 0, 1, 2][state] ?? 3;
      return `${next & 2 ? '$' : ''}${m[2]}${next & 1 ? '$' : ''}${m[4]}`;
    };
    const bang = r.text.lastIndexOf('!');
    const prefix = bang >= 0 ? r.text.slice(0, bang + 1) : '';
    const body = r.text.slice(prefix.length).split(':').map(cycle).join(':');
    const text = edit.text.slice(0, r.start) + prefix + body + edit.text.slice(r.end);
    const caret = r.start + prefix.length + body.length;
    setEdit({ ...edit, text, caret });
    requestAnimationFrame(() => cellRef.current?.setCaret(caret));
  }, [edit]);

  const onEditKey = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!edit) return;
    if (e.key === 'Enter' && e.altKey) {
      e.preventDefault();
      const el = e.currentTarget;
      const pos = el.selectionStart;
      const text = `${edit.text.slice(0, pos)}\n${edit.text.slice(el.selectionEnd)}`;
      setEdit({ ...edit, text, caret: pos + 1, mode: 'edit' });
      requestAnimationFrame(() => el.setSelectionRange(pos + 1, pos + 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit(e.shiftKey ? -1 : 1, 0, e.ctrlKey);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit(0, e.shiftKey ? -1 : 1);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
      return;
    }
    if (e.key === 'F4') {
      e.preventDefault();
      cycleAbsolute();
      return;
    }
    if (e.key === 'F2') {
      e.preventDefault();
      setEdit({ ...edit, mode: edit.mode === 'enter' ? 'edit' : 'enter' });
      return;
    }
    const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const dir = arrows[e.key];
    if (dir && edit.mode === 'enter') {
      e.preventDefault();
      if (pointing && edit.sheet === si) {
        const base = edit.point ? findRefs(edit.text).find((r) => r.start === edit.point?.start)?.range : undefined;
        const from = base ? { row: base.r1, col: base.c1 } : { row: edit.row, col: edit.col };
        const row = Math.max(0, from.row + dir[0]);
        const col = Math.max(0, from.col + dir[1]);
        onPoint({ r1: row, c1: col, r2: row, c2: col });
      } else commitEdit(dir[0], dir[1]);
    }
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
  const recalc = useCallback(() => {
    store.engine.engine.recalculateAll();
    if (ui.calcManual) {
      store.commit((d) => {
        for (const [row, line] of sheet.cells) for (const [col, cell] of line) {
          if (cell.formula !== undefined) d.set(si, row, col, { ...cell, value: fromScalar(store.engine.value(sheet.name, row, col)) });
        }
      }, 'calc');
    } else store.notify();
  }, [store, ui.calcManual, sheet, si]);

  const trace = useCallback((dir: 'precedents' | 'dependents' | 'clear') => {
    if (dir === 'clear') {
      setArrows([]);
      setUi({ arrows: false });
      return;
    }
    const a = selection.active;
    const out: { from: CellRange; to: { row: number; col: number } }[] = [];
    if (dir === 'precedents') {
      const cell = sheet.cells.get(a.row)?.get(a.col);
      if (cell?.formula) for (const r of findRefs(toLocalized(`=${cell.formula}`, 'fr'))) if (!r.sheet) out.push({ from: r.range, to: a });
    } else {
      for (const [row, line] of sheet.cells) for (const [col, cell] of line) {
        if (!cell.formula) continue;
        if (findRefs(toLocalized(`=${cell.formula}`, 'fr')).some((r) => !r.sheet && a.row >= r.range.r1 && a.row <= r.range.r2 && a.col >= r.range.c1 && a.col <= r.range.c2)) {
          out.push({ from: { r1: a.row, c1: a.col, r2: a.row, c2: a.col }, to: { row, col } });
        }
      }
    }
    setArrows((prev) => [...prev, ...out]);
    setUi({ arrows: true });
  }, [selection, sheet, setUi]);

  // ------------------------------------------------ Feuilles
  const focusGrid = useCallback(() => gridEl.current?.focus(), []);
  const { addSheet, removeSheet, renameCurrent, switchSheet, goTo } = useSheetOps({ store, si, setSi, setSels, notify, focusGrid });

  // ------------------------------------------------ Graphiques, tableaux croises
  const pivot = act.pivotAt(sheet.name, selection.active.row, selection.active.col) ?? pivots.find((p) => p.sheet === sheet.name);
  const table = tableAt(sheet, selection.active.row, selection.active.col);
  const chartObj = act.chart();
  useEffect(() => {
    if (chartObj) setTab('chartDesign');
    else setTab((t) => (t === 'chartDesign' ? 'home' : t));
  }, [chartObj !== undefined]);
  useEffect(() => {
    if (pivot && pivot.def.values.length === 0 && pivot.def.rows.length === 0) setUi({ pivotPane: true });
  }, [pivot?.id]);

  // ------------------------------------------------ Ruban
  const env: RibbonEnv = {
    cmd, ctx, wb, sheet, si, sel: selection, ui, setUi,
    paste, cut: () => doCopy(true), copy: () => doCopy(false),
    painter: { active: painter !== null, start: () => setPainter(painter === null ? styleAt(sheet, selection.active.row, selection.active.col) : null) },
    insertChart: act.insertChart, insertImage: () => void act.insertImage(), insertPivot: () => setDialog({ kind: 'pivotCreate' }),
    insertComment: () => {
      const a = selection.active;
      const text = window.prompt(S.newComment);
      if (!text) return;
      store.commit((d) => {
        const s = d.sheet(si);
        s.threadedComments = [...s.threadedComments, { id: `{${crypto.randomUUID().toUpperCase()}}`, ref: { row: a.row, col: a.col }, personId: 'local', text, date: new Date().toISOString(), replies: [] }];
      });
      setUi({ commentsPane: true });
    },
    importCsv: () => {
      void services.openFile([{ name: 'CSV', extensions: ['csv', 'tsv', 'txt'] }]).then(async (f) => {
        if (!f) return;
        const book = await loadWorkbook(f.bytes, f.name);
        const imported = book.sheets[0];
        if (!imported) return;
        store.commit((d) => {
          const idx = addSheetAt(d, si + 1, baseName(f.name));
          const target = d.sheet(idx);
          target.cells = imported.cells;
          target.cols = imported.cols;
        });
        setSi(si + 1);
        notify(S.csvImported(f.name), 'success');
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
    chart: chartObj, chartKind: act.chartKind, chartSwitch: act.chartSwitch, chartLegend: act.chartLegend, chartLabels: act.chartLabels,
    chartTitle: act.chartTitle, chartGrid: act.chartGrid, chartPalette: act.chartPalette, chartDelete: act.chartDelete,
    pivotActive: !!act.pivotAt(sheet.name, selection.active.row, selection.active.col),
    pivotRefresh: () => act.refreshPivots(textOf),
    iconSet: cmd.iconSet, flashFill: act.flashFill,
    protectToggle: (target) => setDialog({ kind: 'protect', target }),
  };
  const tabs: RibbonTab[] = [homeTab(env), insertTab(env), layoutTab(env), formulasTab(env), dataTab(env), reviewTab(env), viewTab(env)];
  for (const t of [tableTab(env), chartTab(env), pivotTab(env)]) if (t) tabs.push(t);
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

  // ------------------------------------------------ Clavier de la grille
  const onGridKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.altKey && (e.key === '=' || e.key === '0')) {
      e.preventDefault();
      cmd.autoSum('SUM');
      return;
    }
    const handled = handleGridKey(e, {
      sheet, sel: selection, setSel: onSelect, cmd, startEdit: (t) => startEdit(t),
      undo: () => store.undo(), redo: () => store.redo(), save: () => void save(), openFile: () => void openFile(), newFile: () => void newBlank(),
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
      pageRows: Math.max(1, Math.floor(((viewport.current?.height ?? 600) - 20) / 20)),
    });
    if (handled) e.preventDefault();
  };

  // ------------------------------------------------ Barre d'etat
  const stats = useMemo(() => {
    let sum = 0;
    let nums = 0;
    let count = 0;
    let visited = 0;
    for (const r0 of selection.ranges) {
      const r = clipRange(r0, { r1: 0, c1: 0, r2: Math.max(0, ...[...sheet.cells.keys()]), c2: lastCol(sheet) });
      if (!r) continue;
      for (let row = r.r1; row <= r.r2 && visited < 1_000_000; row++) {
        const line = sheet.cells.get(row);
        if (!line) continue;
        for (let col = r.c1; col <= r.c2; col++) {
          visited++;
          if (!line.has(col)) continue;
          const v = valueAt(row, col);
          if (v === null || v === '') continue;
          count++;
          if (typeof v === 'number') {
            nums++;
            sum += v;
          }
        }
      }
    }
    return { sum, nums, count };
  }, [selection, sheet, valueAt]);
  const fmtNum = (n: number): string => formatValue(n, numFmtOf(wb, styleAt(sheet, selection.active.row, selection.active.col)) === 'General' ? 'General' : numFmtOf(wb, styleAt(sheet, selection.active.row, selection.active.col)), 'fr-FR');
  const multi = selection.ranges.length > 1 || activeRange(selection).r1 !== activeRange(selection).r2 || activeRange(selection).c1 !== activeRange(selection).c2;
  const mode = edit ? (pointing ? S.point : edit.mode === 'enter' ? S.enter : S.edit) : S.ready;
  const circular = store.engine.engine.circularReferences();

  const quickAccess: QuickAccessItem[] = [
    { id: 'save', label: S.qa.save, icon: 'save', shortcut: 'Ctrl+S', onClick: () => void save() },
    { id: 'undo', label: S.qa.undo, icon: 'arrow_undo', shortcut: 'Ctrl+Z', disabled: !store.canUndo, onClick: () => store.undo() },
    { id: 'redo', label: S.qa.redo, icon: 'arrow_redo', shortcut: 'Ctrl+Y', disabled: !store.canRedo, onClick: () => store.redo() },
    { id: 'print', label: S.qa.print, icon: 'print', defaultVisible: false, onClick: print },
  ];

  const contextItems = (area: ContextArea): MenuItem[] => gridContextMenu(area, { cmd, copy: doCopy, paste, open: setDialog, comment: env.insertComment });

  // ------------------------------------------------ Superpositions de la grille
  const active = selection.active;
  const activeMerge = mergeAt(sheet.merges, active.row, active.col);
  const dv = validationAt(sheet, active.row, active.col);
  const note = hover ? sheet.notes.find((n) => n.ref.row === hover.row && n.ref.col === hover.col) ?? sheet.threadedComments.find((n) => n.ref.row === hover.row && n.ref.col === hover.col) : undefined;
  const overlay = (v: Viewport) => {
    viewport.current = v;
    const editRect = edit && edit.sheet === si ? rangeRect(v, mergeAt(sheet.merges, edit.row, edit.col) ?? { r1: edit.row, c1: edit.col, r2: edit.row, c2: edit.col }) : null;
    const editLook = edit ? cellLook(wb, sheet.cells.get(edit.row)?.get(edit.col), null, { colPx: 64 }) : null;
    const activeRect = rangeRect(v, activeMerge ?? { r1: active.row, c1: active.col, r2: active.row, c2: active.col });
    return (
      <>
        <Drawings v={v} sheet={sheet} selected={drawing} onSelect={setDrawing} onMove={act.moveDrawing} read={(ref) => rangeValues(store.engine, ref, sheet.name)} text={textOf} />
        {dv?.type === 'list' && dv.inCellDropdown !== false && !edit && (
          <button type="button" className="xl-dvbtn" style={{ left: activeRect.x + activeRect.w + 1, top: activeRect.y + activeRect.h - 18 }} aria-label={S.validationList}
            onPointerDown={(e) => {
              e.stopPropagation();
              const items = listItems(dv, (f) => rangeValues(store.engine, f, sheet.name).flat());
              context.open(e, items.map((it) => ({ id: it, label: it, onClick: () => {
                const entry = parseEntry(it, wb.date1904);
                if (entry.ok) store.commit((d) => commitEntry(d, si, active.row, active.col, entry));
              } })));
            }}>
            <Icon name="chevron_down" size={12} />
          </button>
        )}
        {dv?.prompt && !edit && (
          <div className="xl-dvprompt" style={{ left: activeRect.x + 8, top: activeRect.y + activeRect.h + 4 }}>
            {dv.promptTitle && <strong>{dv.promptTitle}</strong>}
            <span>{dv.prompt}</span>
          </div>
        )}
        {note && hover && (
          <div className="xl-notetip" style={{ left: rangeRect(v, { r1: hover.row, c1: hover.col, r2: hover.row, c2: hover.col }).x + rangeRect(v, { r1: hover.row, c1: hover.col, r2: hover.row, c2: hover.col }).w + 6, top: rangeRect(v, { r1: hover.row, c1: hover.col, r2: hover.row, c2: hover.col }).y }}>
            {'author' in note ? <strong>{note.author} :</strong> : <strong>{S.author} :</strong>}
            <span>{note.text}</span>
          </div>
        )}
        {editRect && editLook && edit && (
          <FormulaInput
            ref={cellRef}
            className="xl-celledit"
            style={{ left: editRect.x, top: editRect.y, minWidth: editRect.w, minHeight: editRect.h, maxWidth: Math.max(editRect.w, v.width - editRect.x - 4), font: editLook.font.replace(/([\d.]+)px/, (_m, n: string) => `${(Number(n) * zoom).toFixed(2)}px`), color: editLook.color, background: editLook.fill ?? '#FFFFFF' }}
            value={edit.text}
            ariaLabel={cellName(edit.row, edit.col)}
            assist
            onChange={onEditChange}
            onKeyDown={onEditKey}
            onCaret={(caret) => setEdit((e) => (e ? { ...e, caret } : e))}
            onFunctionHelp={(fn: FnInfo) => setDialog({ kind: 'fnWizard', fn: fn.name })}
          />
        )}
      </>
    );
  };

  return (
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
          <Grid
            sheet={sheet}
            zoom={zoom}
            sel={selection}
            onSelect={onSelect}
            source={{
              wb, value: valueAt, cf, tableParts, showGrid: sheet.view.showGridLines, showHeaders: sheet.view.showHeaders, showFormulas: ui.showFormulas,
              editing: edit && edit.sheet === si ? { row: edit.row, col: edit.col } : null,
              refs: editRefs, copyRange: clip && clip.sheet === si ? clip.range : null, filterButtons, arrows, pageBreaks: breaks,
              rangeSheetName: edit ? (wb.sheets[edit.sheet]?.name ?? sheet.name) : sheet.name,
              sparkValues: (src) => rangeValues(store.engine, src, sheet.name).flat().map((v) => (typeof v === 'number' ? v : null)),
            }}
            pointing={pointing}
            onPoint={onPoint}
            onEdit={(row, col) => {
              setSel(cellSelection(row, col));
              const cell = sheet.cells.get(row)?.get(col);
              const t = editText(wb, cell);
              if (!guard()) return;
              setEdit({ sheet: si, row, col, text: t, caret: t.length, mode: 'edit', point: null });
              requestAnimationFrame(() => cellRef.current?.setCaret(t.length));
            }}
            onFill={(src, target, copyOnly) => {
              if (!guard()) return;
              store.commit((d) => autoFill(d, si, src, target, { copyOnly, isDate: (c) => /[dmy]/i.test(numFmtOf(wb, c.styleId).replace(/"[^"]*"/g, '')) && numFmtOf(wb, c.styleId) !== 'General' }));
              setSel(rangeSelection({ r1: Math.min(src.r1, target.r1), c1: Math.min(src.c1, target.c1), r2: Math.max(src.r2, target.r2), c2: Math.max(src.c2, target.c2) }, selection.active));
            }}
            onResize={(axis, first, last, px) => (px === 'auto' ? (axis === 'col' ? act.autofitColumn(first, last) : act.autofit('row')) : act.resizeLive(axis, first, last, px))}
            onContext={(e, area) => context.open(e, contextItems(area))}
            onFilterButton={(row, col, at) => setFilterMenu({ row, col, x: at.x, y: at.y })}
            onZoom={(z) => cmd.view({ zoom: z })}
            onHover={setHover}
            onKeyDown={onGridKey}
            gridRef={(el) => { gridEl.current = el; }}
            overlay={overlay}
          />
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
            onDelete={(c) => store.commit((d) => {
              const s = d.sheet(si);
              s.threadedComments = s.threadedComments.filter((k) => k !== c);
            })}
            onClose={() => setUi({ commentsPane: false })}
          />
        )}
      </div>
      <StatusBar
        left={[
          { id: 'mode', label: mode },
          ...(ui.calcManual ? [{ id: 'calc', label: S.calculate, onClick: recalc }] : []),
          ...(circular.length ? [{ id: 'circ', label: `${S.circular} : ${circular[0] ?? ''}`, icon: 'warning' as const }] : []),
          ...(painter !== null ? [{ id: 'painter', label: RB.painter, icon: 'paint_brush' as const }] : []),
        ]}
        right={multi && stats.count > 0 ? [
          ...(stats.nums > 0 ? [{ id: 'avg', label: `${S.average} : ${fmtNum(stats.sum / stats.nums)}` }] : []),
          { id: 'cnt', label: `${S.count} : ${stats.count}` },
          ...(stats.nums > 0 ? [{ id: 'sum', label: `${S.sum} : ${fmtNum(stats.sum)}` }] : []),
        ] : []}
        views={[{ id: 'normal', label: S.viewNormal, icon: 'grid' }, { id: 'pageLayout', label: S.viewLayout, icon: 'document_one_page' }, { id: 'pageBreakPreview', label: S.viewBreak, icon: 'document_page_break' }]}
        activeView={sheet.view.view}
        onViewChange={(id) => cmd.view({ view: id as 'normal' | 'pageLayout' | 'pageBreakPreview' })}
        zoom={sheet.view.zoom || 100}
        onZoomChange={(z) => cmd.view({ zoom: Math.max(10, Math.min(400, Math.round(z))) })}
        zoomPresets={[{ label: S.zoomSelection, compute: () => { env.zoomToSelection(); return sheet.view.zoom || 100; } }]}
      />
      <BackstagePages
        open={backstage !== null} page={backstage ?? 'home'} onPage={setBackstage} onClose={() => setBackstage(null)}
        env={{
          services, wb, sheet, name, recents, value: valueAt,
          newBlank: () => void newBlank(), open: () => void openFile(), save: () => void save(),
          saveAs: (n, f, protectFormulas) => void save(n, f, protectFormulas), print, close: () => void closeDoc(), closeBackstage,
          protect: () => setDialog({ kind: 'protect', target: 'book' }), setPage: cmd.pageSetup,
          calcManual: ui.calcManual, setCalcManual: (v) => setUi({ calcManual: v }),
        }}
      />
      {dialog && (
        <DialogHost dialog={dialog} x={{ ...ctx, cmd, close: () => setDialog(null) }} zoom={sheet.view.zoom || 100}
          onZoom={(z) => cmd.view({ zoom: z })} onCreatePivot={act.createPivot}
          onInsertFormula={(f) => startEdit(f)} />
      )}
      {filterMenu && <FilterHost menu={filterMenu} store={store} si={si} valueAt={valueAt} displayAt={displayAt} onClose={() => setFilterMenu(null)} />}
      {recovery && <RecoveryDialog recovery={recovery} store={store} setName={setName} onClose={() => setRecovery(null)} />}
      {confirmDialog}
      {printing && <PrintRoot wb={wb} sheet={sheet} value={valueAt} />}
      {context.menu}
      <span className="xl-sr" aria-live="polite">{multi ? sizeLabel(activeRange(selection)) : rangeName(activeRange(selection))}</span>
    </div>
  );
}
