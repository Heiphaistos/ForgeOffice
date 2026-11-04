// Evaluation d'une formule isolee (sans classeur complet) : calculatrice, tests, apercus.
import { finalValue, evaluate } from './eval/evaluator.ts';
import type { EvalContext, WorkbookContext } from './eval/types.ts';
import { jsDateToSerial, type DateSystem } from './format/dates.ts';
import type { NumberLocale } from './format/locale.ts';
import './functions/all.ts';
import { parseFormula } from './parse/parser.ts';
import { syntaxFor, type FormulaLocale } from './parse/syntax.ts';
import { parseCellAddress, type Area } from './refs.ts';
import type { Scalar, Value } from './values.ts';

export interface StandaloneOptions {
  /** Syntaxe de la formule ('en' canonique par defaut). */
  syntax?: FormulaLocale;
  /** Region des conversions texte <-> nombre ('fr-FR' par defaut). */
  locale?: NumberLocale;
  dateSystem?: DateSystem;
  /** Valeurs de cellules de la feuille unique, ex. { A1: 2, B3: 'texte' }. */
  cells?: Record<string, Scalar>;
  /** Date courante pour MAINTENANT/AUJOURDHUI. */
  now?: Date;
  random?: () => number;
}

class SimpleWorkbook implements WorkbookContext {
  readonly dateSystem: DateSystem;
  readonly locale: NumberLocale;
  private readonly cells = new Map<string, Scalar>();
  private readonly nowDate: Date | undefined;
  private readonly rnd: () => number;
  private rows = 0;
  private cols = 0;
  constructor(opt: StandaloneOptions) {
    this.dateSystem = opt.dateSystem ?? 1900;
    this.locale = opt.locale ?? 'fr-FR';
    this.nowDate = opt.now;
    this.rnd = opt.random ?? Math.random;
    for (const [addr, v] of Object.entries(opt.cells ?? {})) {
      const a = parseCellAddress(addr);
      if (!a) continue;
      this.cells.set(`${a.row},${a.col}`, v);
      this.rows = Math.max(this.rows, a.row + 1);
      this.cols = Math.max(this.cols, a.col + 1);
    }
  }
  sheetId(name: string): number | undefined {
    return name.toUpperCase() === 'FEUIL1' || name.toUpperCase() === 'SHEET1' ? 0 : undefined;
  }
  sheetName(id: number): string | undefined {
    return id === 0 ? 'Feuil1' : undefined;
  }
  sheetOrder(): number[] {
    return [0];
  }
  getCell(_s: number, r: number, c: number): Scalar {
    return this.cells.get(`${r},${c}`) ?? null;
  }
  usedBounds(): { rows: number; cols: number } {
    return { rows: this.rows, cols: this.cols };
  }
  forEachCell(area: Area, cb: (row: number, col: number, v: Scalar) => boolean | void): void {
    for (let r = area.r1; r <= Math.min(area.r2, this.rows - 1); r++) {
      for (let c = area.c1; c <= Math.min(area.c2, this.cols - 1); c++) {
        const v = this.cells.get(`${r},${c}`);
        if (v !== undefined && v !== null && cb(r, c, v) === true) return;
      }
    }
  }
  getName(): undefined {
    return undefined;
  }
  getTable(): undefined {
    return undefined;
  }
  tableAt(): undefined {
    return undefined;
  }
  spillArea(): undefined {
    return undefined;
  }
  formulaText(): undefined {
    return undefined;
  }
  now(): number {
    return jsDateToSerial(this.nowDate ?? new Date(), this.dateSystem);
  }
  random(): number {
    return this.rnd();
  }
}

/**
 * Calcule une formule hors classeur. Exemple : evaluateFormula('=SOMME(1;2)', { syntax: 'fr' }) -> 3.
 * Les references lisent `options.cells`. Leve FormulaParseError si la formule est invalide.
 */
export function evaluateFormula(formula: string, options: StandaloneOptions = {}): Value {
  const wb = new SimpleWorkbook(options);
  const ast = parseFormula(formula, syntaxFor(options.syntax ?? 'en'));
  const ctx: EvalContext = { wb, sheet: 0, row: 0, col: 0, scope: undefined, depth: 0 };
  const v = finalValue(evaluate(ast, ctx), ctx);
  return v === null ? 0 : v;
}
