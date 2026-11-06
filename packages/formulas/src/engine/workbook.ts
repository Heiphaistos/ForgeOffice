// Moteur de classeur : cellules, formules, recalcul incremental par graphe de dependances,
// tableaux dynamiques (debordement), references circulaires (+ calcul iteratif), structure.
// Types : types.ts · utilitaires : util.ts · contexte d'evaluation : context.ts · decalage de lignes/colonnes : structure.ts.
import { evaluate, finalValue } from '../eval/evaluator.ts';
import type { EvalContext, TableDefinition, WorkbookContext } from '../eval/types.ts';
import type { DateSystem } from '../format/dates.ts';
import { parseInput, type ParsedInput } from '../format/input.ts';
import type { NumberLocale } from '../format/locale.ts';
import '../functions/all.ts';
import { fromLocalized, toLocalized } from '../parse/localize.ts';
import { parseFormula, stripEquals } from '../parse/parser.ts';
import type { FormulaLocale } from '../parse/syntax.ts';
import {
  MAX_COLS,
  MAX_ROWS,
  cellKey,
  formatCellAddress,
  formatRangeAddress,
  parseCellAddress,
  parseRangeAddress,
  quoteSheetName,
  type CellAddress,
} from '../refs.ts';
import { STRINGS } from '../strings.ts';
import { Matrix, err, type Scalar, type Value } from '../values.ts';
import { removeSheetInFormula, renameSheetInFormula, shiftFormula, type StructuralShift } from './adjust.ts';
import { makeWorkbookContext } from './context.ts';
import { DependencyIndex, Recorder, posKey } from './deps.ts';
import { collectDirty, rewriteFormulas, spillBlocked, tracePrecedents, type TracedArea } from './trace.ts';
import { makeMover, remapSheetCells, shiftTables } from './structure.ts';
import type { CalcMode, CellChange, ChangeListener, EngineOptions, FCell, NameEntry, Sheet, TableInput } from './types.ts';
import { Defer, MAX_DEPTH, NAME_RE, SHEET_NAME_BAD, fail, isVolatile, sameScalar } from './util.ts';

export type { TracedArea } from './trace.ts';
export type { CalcMode, CellChange, ChangeListener, EngineOptions, TableInput } from './types.ts';

/** Reglages de calcul modifiables a chaud. */
export interface CalcSettings {
  mode?: CalcMode;
  iterative?: boolean;
  maxIterations?: number;
  maxChange?: number;
}


export class FormulaEngine {
  readonly dateSystem: DateSystem;
  readonly locale: NumberLocale;
  private readonly opt: EngineOptions;
  private readonly sheets = new Map<number, Sheet>();
  private order: number[] = [];
  private readonly byName = new Map<string, number>();
  private nextId = 0;
  private readonly names = new Map<string, NameEntry>();
  private readonly tables = new Map<string, TableDefinition>();
  private readonly deps = new DependencyIndex<FCell>();
  private readonly volatiles = new Set<FCell>();
  private queue: FCell[] = [];
  private readonly recStack: Recorder[] = [];
  private readonly evalStack: FCell[] = [];
  private depth = 0;
  private batchLevel = 0;
  private readonly circular = new Set<FCell>();
  private lastCircular: FCell[] = [];
  private readonly changed = new Map<number, CellChange>();
  private readonly listeners = new Set<ChangeListener>();
  private readonly wb: WorkbookContext;
  /** Mode manuel : formules obsoletes (marquees « a calculer ») et cellules saisies depuis le dernier calcul. */
  private readonly stale = new Set<FCell>();
  private readonly direct = new Set<FCell>();
  /** Cellules autorisees a se calculer en mode manuel pendant un calcul force (F9, Maj+F9). */
  private allow: ((f: FCell) => boolean) | null = null;

  constructor(options: EngineOptions = {}) {
    this.opt = options;
    this.dateSystem = options.dateSystem ?? 1900;
    this.locale = options.locale ?? 'fr-FR';
    this.wb = makeWorkbookContext({
      dateSystem: this.dateSystem,
      locale: this.locale,
      options: this.opt,
      sheets: this.sheets,
      byName: this.byName,
      names: this.names,
      tables: this.tables,
      recStack: this.recStack,
      order: () => this.order,
      resolveCell: (sh, row, col) => this.resolveCell(sh, row, col),
      ensure: (f) => this.ensure(f),
    });
  }

  // ---------- Feuilles ----------

  sheetNames(): string[] {
    return this.order.map((id) => this.sheets.get(id)?.name ?? '');
  }

  addSheet(name?: string): string {
    let n = name;
    if (n === undefined) {
      let i = this.order.length + 1;
      while (this.byName.has(`FEUIL${i}`)) i++;
      n = `Feuil${i}`;
    }
    this.checkSheetName(n);
    const id = this.nextId++;
    this.sheets.set(id, { id, name: n, values: new Map(), formulas: new Map(), spill: new Map(), agg: new Map(), rows: 0, cols: 0 });
    this.order.push(id);
    this.byName.set(n.toUpperCase(), id);
    this.dirtyWhere([n]);
    this.flush();
    return n;
  }

  renameSheet(oldName: string, newName: string): void {
    const sh = this.sheet(oldName);
    if (sh.name === newName) return;
    if (newName.toUpperCase() !== sh.name.toUpperCase()) this.checkSheetName(newName);
    const renamed = this.rewriteAll((text) => renameSheetInFormula(text, sh.name, newName));
    this.byName.delete(sh.name.toUpperCase());
    sh.name = newName;
    this.byName.set(newName.toUpperCase(), sh.id);
    this.dirtyWhere([newName, ...renamed.names]);
    this.flush();
  }

  removeSheet(name: string): void {
    const sh = this.sheet(name);
    if (this.order.length <= 1) throw new Error(STRINGS.engine.lastSheet);
    const tabs = this.sheetNames();
    const readers = this.deps.referencing(new Set([sh.id]));
    for (const f of sh.formulas.values()) this.killFormula(f);
    this.sheets.delete(sh.id);
    this.order = this.order.filter((id) => id !== sh.id);
    this.byName.delete(sh.name.toUpperCase());
    const gone: string[] = [];
    for (const [k, n] of this.names) {
      if (n.sheet !== sh.id) continue;
      gone.push(k.slice(k.indexOf('|') + 1));
      this.names.delete(k);
    }
    for (const [k, t] of this.tables) {
      if (t.sheet !== sh.id) continue;
      gone.push(t.name);
      this.tables.delete(k);
    }
    const changed = this.rewriteAll((text) => removeSheetInFormula(text, sh.name, tabs));
    this.dirtyWhere([...gone, ...changed.names], [...changed.cells, ...readers]);
    this.flush();
  }

  // ---------- Cellules ----------

  /** Ecrit une valeur constante (null ou '' efface la cellule). */
  setCell(sheet: string, address: string | CellAddress, value: Scalar): void {
    const sh = this.sheet(sheet);
    const { row, col } = this.address(address);
    const k = cellKey(row, col);
    const f = sh.formulas.get(k);
    if (f) this.killFormula(f);
    if (value === null || value === '') sh.values.delete(k);
    else {
      sh.values.set(k, value);
      this.grow(sh, row, col);
    }
    this.noteChange(sh, row, col);
    this.invalidate([], [[sh.id, row, col]]);
    this.flush();
  }

  /** Ecrit une formule (syntaxe canonique 'en' ou francaise 'fr'). Leve FormulaParseError si elle est invalide. */
  setFormula(sheet: string, address: string | CellAddress, formula: string, syntax: FormulaLocale = 'en'): void {
    const sh = this.sheet(sheet);
    const { row, col } = this.address(address);
    const text = stripEquals(syntax === 'en' ? formula : fromLocalized(formula.startsWith('=') ? formula : `=${formula}`, syntax));
    const ast = parseFormula(text);
    const k = cellKey(row, col);
    const old = sh.formulas.get(k);
    if (old) this.killFormula(old);
    sh.values.delete(k);
    const f: FCell = {
      sheet: sh, row, col, text, ast, volatile: isVolatile(ast),
      dirty: false, computing: false, dead: false, value: null, matrix: undefined,
    };
    sh.formulas.set(k, f);
    if (f.volatile) this.volatiles.add(f);
    this.direct.add(f);
    this.grow(sh, row, col);
    this.invalidate([f], []);
    this.flush();
  }

  /** Saisie utilisateur interpretee comme Excel (nombre, date, %, booleen, formule...). */
  setInput(sheet: string, address: string | CellAddress, text: string, locale: NumberLocale = this.locale): ParsedInput {
    const p = parseInput(text, locale, { dateSystem: this.dateSystem });
    switch (p.type) {
      case 'formula':
        this.setFormula(sheet, address, p.formula, locale === 'fr-FR' ? 'fr' : 'en');
        break;
      case 'error':
        this.setCell(sheet, address, err(p.value));
        break;
      case 'blank':
        this.setCell(sheet, address, null);
        break;
      default:
        this.setCell(sheet, address, p.value);
    }
    return p;
  }

  clearCell(sheet: string, address: string | CellAddress): void {
    this.setCell(sheet, address, null);
  }

  /** Valeur affichee d'une cellule (calculee si necessaire). */
  getValue(sheet: string, address: string | CellAddress): Scalar {
    const sh = this.sheet(sheet);
    const { row, col } = this.address(address);
    const k = cellKey(row, col);
    const f = sh.formulas.get(k) ?? sh.spill.get(k);
    if (f?.dirty && !this.isStale(f)) this.evalTop(f);
    return this.resolveCell(sh, row, col);
  }

  /** Formule de la cellule (avec '='), dans la syntaxe demandee ; undefined pour une constante. */
  getFormula(sheet: string, address: string | CellAddress, syntax: FormulaLocale = 'en'): string | undefined {
    const sh = this.sheet(sheet);
    const { row, col } = this.address(address);
    const f = sh.formulas.get(cellKey(row, col));
    if (!f) return undefined;
    return syntax === 'en' ? `=${f.text}` : toLocalized(`=${f.text}`, syntax);
  }

  /** Zone de debordement d'une formule matricielle ("A1:C3"), undefined sinon. */
  spillRange(sheet: string, address: string | CellAddress): string | undefined {
    const sh = this.sheet(sheet);
    const { row, col } = this.address(address);
    const f = sh.formulas.get(cellKey(row, col));
    if (f?.dirty) this.evalTop(f);
    const m = f?.matrix;
    if (!f || !m) return undefined;
    return formatRangeAddress({ r1: row, c1: col, r2: row + m.rows - 1, c2: col + m.cols - 1 });
  }

  /** Calcule une formule dans le contexte d'une feuille sans l'enregistrer (apercu, barre de formule). */
  evaluate(formula: string, sheet?: string, syntax: FormulaLocale = 'en'): Value {
    this.process();
    const id = sheet === undefined ? (this.order[0] ?? 0) : this.sheet(sheet).id;
    const text = syntax === 'en' ? formula : fromLocalized(formula, syntax);
    const ctx: EvalContext = { wb: this.wb, sheet: id, row: 0, col: 0, scope: undefined, depth: 0 };
    return finalValue(evaluate(parseFormula(text), ctx), ctx);
  }

  // ---------- Noms et tableaux ----------

  /** Definit un nom (formule canonique, ex. "Feuil1!$A$1:$A$10"), global ou limite a une feuille. */
  defineName(name: string, formula: string, scope?: string, syntax: FormulaLocale = 'en'): void {
    if (!NAME_RE.test(name) || parseCellAddress(name) || /^[RCrc]$/.test(name)) fail(STRINGS.engine.invalidName, name);
    const text = stripEquals(syntax === 'en' ? formula : fromLocalized(formula, syntax));
    const node = parseFormula(text);
    const sheet = scope === undefined ? undefined : this.sheet(scope).id;
    this.names.set(`${sheet ?? ''}|${name.toUpperCase()}`, { text, node, sheet });
    this.dirtyWhere([name]);
    this.flush();
  }

  removeName(name: string, scope?: string): void {
    const sheet = scope === undefined ? undefined : this.sheet(scope).id;
    this.names.delete(`${sheet ?? ''}|${name.toUpperCase()}`);
    this.dirtyWhere([name]);
    this.flush();
  }

  definedNames(): { name: string; formula: string; scope: string | undefined }[] {
    return [...this.names.entries()].map(([k, n]) => ({
      name: k.slice(k.indexOf('|') + 1),
      formula: `=${n.text}`,
      scope: n.sheet === undefined ? undefined : this.sheets.get(n.sheet)?.name,
    }));
  }

  defineTable(t: TableInput): void {
    const sh = this.sheet(t.sheet);
    const a = parseRangeAddress(t.ref);
    if (!NAME_RE.test(t.name) || !a) fail(STRINGS.engine.invalidTable, t.name);
    const headerRow = t.headerRow ?? true;
    const width = a.c2 - a.c1 + 1;
    const columns: string[] = [];
    for (let i = 0; i < width; i++) {
      const given = t.columns?.[i];
      const h = headerRow ? this.resolveCell(sh, a.r1, a.c1 + i) : null;
      columns.push(given ?? (h === null ? STRINGS.engine.defaultColumn.replace('{0}', String(i + 1)) : String(h)));
    }
    this.tables.set(t.name.toUpperCase(), {
      name: t.name, sheet: sh.id, r1: a.r1, c1: a.c1, r2: a.r2, c2: a.c2,
      columns, headerRow, totalsRow: t.totalsRow ?? false,
    });
    this.dirtyWhere([t.name], [], true);
    this.flush();
  }

  removeTable(name: string): void {
    this.tables.delete(name.toUpperCase());
    this.dirtyWhere([name], [], true);
    this.flush();
  }

  // ---------- Structure ----------

  // `group` : feuilles groupees modifiees ensemble ; seules elles ajustent les references 3D qui les couvrent.
  insertRows(sheet: string, at: number, count = 1, group?: readonly string[]): void {
    this.structural({ sheet, axis: 'row', at, count, ...(group ? { group } : {}) });
  }
  deleteRows(sheet: string, at: number, count = 1, group?: readonly string[]): void {
    this.structural({ sheet, axis: 'row', at, count: -count, ...(group ? { group } : {}) });
  }
  insertColumns(sheet: string, at: number, count = 1, group?: readonly string[]): void {
    this.structural({ sheet, axis: 'col', at, count, ...(group ? { group } : {}) });
  }
  deleteColumns(sheet: string, at: number, count = 1, group?: readonly string[]): void {
    this.structural({ sheet, axis: 'col', at, count: -count, ...(group ? { group } : {}) });
  }

  // ---------- Calcul ----------

  /** Regroupe plusieurs modifications : un seul recalcul a la fin. */
  batch(fn: () => void): void {
    this.batchLevel++;
    try {
      fn();
    } finally {
      this.batchLevel--;
      this.flush();
    }
  }

  /** Mode de calcul courant. */
  get calcMode(): CalcMode {
    return this.opt.calcMode ?? 'auto';
  }

  /** Change le mode de calcul et le calcul iteratif ; revenir au mode automatique calcule tout de suite ce qui etait en attente. */
  setCalcSettings(s: CalcSettings): void {
    const wasManual = this.calcMode === 'manual';
    const wasIterative = !!this.opt.iterative;
    if (s.mode !== undefined) this.opt.calcMode = s.mode;
    if (s.iterative !== undefined) this.opt.iterative = s.iterative;
    if (s.maxIterations !== undefined) this.opt.maxIterations = s.maxIterations;
    if (s.maxChange !== undefined) this.opt.maxChange = s.maxChange;
    if (wasIterative !== !!this.opt.iterative) this.recalculateAll();
    else if (wasManual && this.calcMode !== 'manual') this.recalculate();
  }

  /** Vrai si, en mode manuel, des formules attendent un calcul (indicateur « Calculer » de la barre d'etat). */
  get pendingCalculation(): boolean {
    for (const f of this.stale) if (!f.dead) return true;
    return false;
  }

  /** Recalcule les cellules modifiees et les fonctions volatiles (F9) ; en mode manuel, calcule aussi les formules en attente. */
  recalculate(): void {
    this.requeueStale(() => true);
    this.forced(() => true, () => this.flush());
  }

  /** Recalcule la feuille seule (Maj+F9) ; en mode manuel, les formules des autres feuilles restent en attente. */
  calculateSheet(name: string): void {
    const sh = this.sheet(name);
    this.invalidate([...sh.formulas.values()], []);
    this.requeueStale((f) => f.sheet === sh);
    this.forced((f) => f.sheet === sh, () => this.flush());
  }

  /** Recalcul complet (Ctrl+Alt+F9). */
  recalculateAll(): void {
    this.stale.clear();
    this.deps.clear();
    for (const sh of this.sheets.values()) {
      sh.agg.clear();
      for (const k of sh.spill.keys()) this.noteChange(sh, Math.floor(k / MAX_COLS), k % MAX_COLS);
      sh.spill.clear();
      for (const f of sh.formulas.values()) {
        f.matrix = undefined;
        if (!f.dirty) {
          f.dirty = true;
          this.queue.push(f);
        }
      }
    }
    this.forced(() => true, () => this.flush());
  }

  private isStale(f: FCell): boolean {
    return this.calcMode === 'manual' && this.stale.has(f) && !this.allowed(f);
  }

  private allowed(f: FCell): boolean {
    return this.allow ? this.allow(f) : this.direct.has(f);
  }

  private forced(allow: (f: FCell) => boolean, fn: () => void): void {
    this.allow = allow;
    try {
      fn();
    } finally {
      this.allow = null;
    }
  }

  private requeueStale(pick: (f: FCell) => boolean): void {
    for (const f of [...this.stale]) {
      if (f.dead) this.stale.delete(f);
      else if (pick(f)) {
        this.stale.delete(f);
        this.queue.push(f);
      }
    }
  }

  /** Zones lues par la formule d'une cellule lors de son dernier calcul (ses antecedents), toutes feuilles confondues. */
  precedentsOf(sheet: string, address: string | CellAddress): TracedArea[] {
    const sh = this.sheet(sheet);
    const { row, col } = this.address(address);
    const f = sh.formulas.get(cellKey(row, col));
    return f ? tracePrecedents(this.deps, this.sheets, f) : [];
  }

  /** Cellules dont la formule lit directement la cellule donnee (ses dependants). */
  dependentsOf(sheet: string, address: string | CellAddress): { sheet: string; row: number; col: number }[] {
    const sh = this.sheet(sheet);
    const { row, col } = this.address(address);
    const out: { sheet: string; row: number; col: number }[] = [];
    this.deps.dependents(sh.id, row, col, (f) => {
      if (!f.dead && !(f.sheet === sh && f.row === row && f.col === col)) out.push({ sheet: f.sheet.name, row: f.row, col: f.col });
    });
    return out;
  }

  /** Cellules impliquees dans une reference circulaire lors du dernier calcul ("Feuil1!A1"). */
  circularReferences(): string[] {
    return this.lastCircular.map((f) => `${quoteSheetName(f.sheet.name)}!${formatCellAddress(f.row, f.col)}`);
  }

  onChange(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ---------- Interne : acces ----------

  private sheet(name: string): Sheet {
    const id = this.byName.get(name.toUpperCase());
    const sh = id === undefined ? undefined : this.sheets.get(id);
    return sh ?? fail(STRINGS.engine.unknownSheet, name);
  }

  private address(a: string | CellAddress): CellAddress {
    if (typeof a !== 'string') {
      if (a.row < 0 || a.col < 0 || a.row >= MAX_ROWS || a.col >= MAX_COLS) fail(STRINGS.engine.invalidAddress, `${a.row},${a.col}`);
      return a;
    }
    return parseCellAddress(a) ?? fail(STRINGS.engine.invalidAddress, a);
  }

  private checkSheetName(n: string): void {
    if (n.length === 0 || n.length > 31 || SHEET_NAME_BAD.test(n) || n.startsWith("'") || n.endsWith("'")) {
      fail(STRINGS.engine.invalidSheetName, n);
    }
    if (this.byName.has(n.toUpperCase())) fail(STRINGS.engine.duplicateSheet, n);
  }

  private grow(sh: Sheet, row: number, col: number): void {
    if (row < sh.rows && col < sh.cols) return;
    sh.rows = Math.max(sh.rows, row + 1);
    sh.cols = Math.max(sh.cols, col + 1);
    const hit: FCell[] = [];
    this.deps.boundsDependents(sh.id, (f) => hit.push(f));
    if (hit.length > 0) this.invalidate(hit, []);
  }

  private noteChange(sh: Sheet, row: number, col: number): void {
    this.changed.set(posKey(sh.id, row, col), { sheet: sh.name, row, col });
    sh.agg.get(col)?.truncate(row);
  }

  /** Retire une formule (cellule ecrasee ou detruite) et libere son debordement. */
  private killFormula(f: FCell): void {
    f.dead = true;
    f.sheet.formulas.delete(cellKey(f.row, f.col));
    this.deps.remove(f);
    this.volatiles.delete(f);
    const freed = this.releaseSpill(f);
    if (freed.length > 0) this.invalidate([], freed);
  }

  private releaseSpill(f: FCell): [number, number, number][] {
    const m = f.matrix;
    const freed: [number, number, number][] = [];
    if (!m) return freed;
    const sh = f.sheet;
    for (let r = 0; r < m.rows; r++) {
      for (let c = 0; c < m.cols; c++) {
        if (r === 0 && c === 0) continue;
        const k = cellKey(f.row + r, f.col + c);
        if (sh.spill.get(k) === f) {
          sh.spill.delete(k);
          this.noteChange(sh, f.row + r, f.col + c);
          freed.push([sh.id, f.row + r, f.col + c]);
        }
      }
    }
    f.matrix = undefined;
    return freed;
  }

  // ---------- Interne : invalidation et calcul ----------

  /** Marque `cells` et toutes les formules qui dependent d'elles ou des positions donnees. */
  private invalidate(cells: FCell[], positions: [number, number, number][], except?: Set<FCell>): void {
    const work: FCell[] = [];
    const mark = (d: FCell): void => {
      if (d.dirty || d.dead || except?.has(d)) return;
      d.dirty = true;
      for (let c = d.col; c < d.col + (d.matrix?.cols ?? 1); c++) d.sheet.agg.get(c)?.truncate(d.row);
      this.queue.push(d);
      work.push(d);
    };
    for (const c of cells) mark(c);
    for (const [s, r, c] of positions) this.deps.dependents(s, r, c, mark);
    while (work.length > 0) {
      const f = work.pop();
      if (!f) break;
      const id = f.sheet.id;
      this.deps.dependents(id, f.row, f.col, mark);
      const m = f.matrix;
      if (m) {
        for (let r = 0; r < m.rows; r++) {
          for (let c = 0; c < m.cols; c++) if (r !== 0 || c !== 0) this.deps.dependents(id, f.row + r, f.col + c, mark);
        }
      }
    }
  }

  private flush(): void {
    if (this.batchLevel > 0) return;
    if (this.volatiles.size > 0 && (this.calcMode !== 'manual' || this.allow)) this.invalidate([...this.volatiles].filter((f) => !this.allow || this.allow(f)), []);
    this.process();
    if (this.changed.size === 0) return;
    const changes = [...this.changed.values()];
    this.changed.clear();
    for (const l of this.listeners) l(changes);
  }

  private process(): void {
    let circularDone = false;
    for (;;) {
      for (let i = 0; i < this.queue.length; i++) {
        const f = this.queue[i];
        if (!f || !f.dirty || f.dead) continue;
        if (this.calcMode === 'manual' && !this.allowed(f)) this.stale.add(f);
        else this.evalTop(f);
      }
      this.queue = [];
      if (!this.allow) this.direct.clear();
      if (this.circular.size === 0 || circularDone) break;
      circularDone = true;
      this.resolveCircular();
    }
    if (!circularDone) this.lastCircular = [];
  }

  /** Calcule une formule et ses precedents en attente sans depasser la pile (pile explicite). */
  private evalTop(start: FCell): void {
    const stack: FCell[] = [start];
    const onStack = new Set<FCell>(stack);
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      if (!top || !top.dirty || top.dead) {
        stack.pop();
        if (top) onStack.delete(top);
        continue;
      }
      try {
        this.compute(top);
      } catch (e) {
        if (!(e instanceof Defer)) throw e;
        if (onStack.has(e.cell)) {
          for (const c of stack.slice(stack.indexOf(e.cell))) this.circular.add(c);
          e.cell.dirty = false;
        } else {
          stack.push(e.cell);
          onStack.add(e.cell);
        }
      }
    }
  }

  private compute(f: FCell): void {
    const rec = new Recorder();
    this.recStack.push(rec);
    this.evalStack.push(f);
    f.computing = true;
    this.depth++;
    let v: Value;
    try {
      const ctx: EvalContext = { wb: this.wb, sheet: f.sheet.id, row: f.row, col: f.col, scope: undefined, depth: 0 };
      v = finalValue(evaluate(f.ast, ctx), ctx);
    } finally {
      this.recStack.pop();
      this.evalStack.pop();
      f.computing = false;
      this.depth--;
    }
    f.dirty = false;
    this.stale.delete(f);
    this.store(f, v, rec);
    this.deps.set(f, rec);
  }

  /** Enregistre le resultat d'une formule ; un resultat matriciel deborde ou donne #EPARS!. */
  private store(f: FCell, v: Value, rec: Recorder): void {
    const sh = f.sheet;
    const old = f.value;
    const oldM = f.matrix;
    let value: Scalar;
    let m: Matrix | undefined;
    if (v instanceof Matrix) {
      const r2 = Math.min(f.row + v.rows - 1, MAX_ROWS - 1);
      const c2 = Math.min(f.col + v.cols - 1, MAX_COLS - 1);
      rec.areas.push({ sheet: sh.id, r1: f.row, c1: f.col, r2, c2 });
      if (spillBlocked(f, v)) value = err('#SPILL!');
      else {
        value = v.get(0, 0);
        m = v;
      }
    } else value = v;
    if (oldM) this.releaseSpill(f);
    f.value = value;
    if (!sameScalar(old, value)) this.noteChange(sh, f.row, f.col);
    if (!m) return;
    f.matrix = m;
    const fresh: [number, number, number][] = [];
    for (let r = 0; r < m.rows; r++) {
      for (let c = 0; c < m.cols; c++) {
        if (r === 0 && c === 0) continue;
        const row = f.row + r;
        const col = f.col + c;
        sh.spill.set(cellKey(row, col), f);
        this.noteChange(sh, row, col);
        if (!oldM || r >= oldM.rows || c >= oldM.cols) fresh.push([sh.id, row, col]);
      }
    }
    this.grow(sh, f.row + m.rows - 1, f.col + m.cols - 1);
    if (fresh.length > 0) this.invalidate([], fresh, new Set([f]));
  }

  /** Valeur d'une formule, calculee a la demande ; reference circulaire -> valeur precedente. */
  private ensure(f: FCell): void {
    if (!f.dirty || this.isStale(f)) return;
    if (f.computing) {
      const i = this.evalStack.indexOf(f);
      for (const c of this.evalStack.slice(i < 0 ? 0 : i)) this.circular.add(c);
      return;
    }
    if (this.depth >= MAX_DEPTH) throw new Defer(f);
    this.compute(f);
  }

  /** Valeur d'une cellule sans enregistrer de dependance. */
  private resolveCell(sh: Sheet, row: number, col: number): Scalar {
    const k = cellKey(row, col);
    const f = sh.formulas.get(k);
    if (f) {
      this.ensure(f);
      return f.value;
    }
    const v = sh.values.get(k);
    if (v !== undefined) return v;
    const owner = sh.spill.get(k);
    if (!owner) return null;
    this.ensure(owner);
    const o = sh.spill.get(k);
    return o?.matrix ? o.matrix.get(row - o.row, col - o.col) : null;
  }

  private resolveCircular(): void {
    const cells = [...this.circular].filter((f) => !f.dead);
    this.circular.clear();
    this.lastCircular = cells;
    const inCycle = new Set(cells);
    if (this.opt.iterative) {
      const maxIter = this.opt.maxIterations ?? 100;
      const maxChange = this.opt.maxChange ?? 0.001;
      for (let it = 1; it < maxIter; it++) {
        let delta = 0;
        for (const f of cells) {
          const old = f.value;
          f.dirty = true;
          this.evalTop(f);
          const d = typeof old === 'number' && typeof f.value === 'number' ? Math.abs(f.value - old) : sameScalar(old, f.value) ? 0 : Infinity;
          delta = Math.max(delta, d);
        }
        this.circular.clear();
        if (delta < maxChange) break;
      }
    } else {
      for (const f of cells) {
        this.releaseSpill(f);
        if (!sameScalar(f.value, 0)) this.noteChange(f.sheet, f.row, f.col);
        f.value = 0;
      }
    }
    this.invalidate([], cells.map((f) => [f.sheet.id, f.row, f.col]), inCycle);
  }

  // ---------- Interne : structure ----------

  private rewriteAll(fn: (text: string, sheetName: string | undefined) => string): { cells: FCell[]; names: string[] } {
    return rewriteFormulas(this.sheets, this.names, this.volatiles, fn);
  }

  /**
   * Recalcul partiel apres un changement de feuille, de nom ou de tableau : seules sont recalculees (avec leurs
   * dependants) les formules dont le texte mentionne un des `tokens` (ou un nom qui en depend), celles qui lisent
   * la structure du classeur (INDIRECT, FEUILLE, CELLULE...), celles de `extra`, et avec `structured` toutes les
   * formules a references structurees.
   */
  private dirtyWhere(tokens: string[], extra: Iterable<FCell> = [], structured = false): void {
    const hit = collectDirty(this.sheets, this.names, tokens, extra, structured);
    this.invalidate([...hit].filter((f) => !f.dead), []);
  }

  /**
   * Insertion/suppression de lignes ou colonnes. Sont recalculees : toutes les formules des feuilles modifiees
   * (leur index de dependances est indexe par position), celles des autres feuilles qui les lisent, celles dont le
   * texte a ete reecrit, les references structurees et les fonctions qui lisent la structure. Les formules des
   * feuilles non concernees gardent valeurs et dependances.
   */
  private structural(shift: StructuralShift): void {
    const sh = this.sheet(shift.sheet);
    if (shift.count === 0) return;
    const group = [sh, ...(shift.group ?? []).map((n) => this.sheet(n)).filter((g) => g !== sh)];
    const full: StructuralShift = { ...shift, group: group.map((g) => g.name), order: this.sheetNames() };
    const changed = this.rewriteAll((text, sheetName) => shiftFormula(text, full, sheetName));
    const readers = this.deps.referencing(new Set(group.map((g) => g.id)));
    const move = makeMover(shift);
    const own: FCell[] = [];
    for (const g of group) {
      remapSheetCells(g, move, (row, col) => this.noteChange(g, row, col), (f) => {
        f.dead = true;
        this.deps.remove(f);
        this.volatiles.delete(f);
      });
      shiftTables(this.tables, g.id, shift, move);
      g.agg.clear();
      for (const f of g.formulas.values()) {
        f.matrix = undefined;
        own.push(f);
      }
    }
    this.dirtyWhere(changed.names, [...changed.cells, ...readers, ...own], true);
    this.flush();
  }
}
