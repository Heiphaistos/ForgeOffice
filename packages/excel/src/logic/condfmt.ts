// Mise en forme conditionnelle : evaluation des regles d'Excel cellule par cellule (valeur, texte, dates,
// 10 premiers, moyenne, doublons, formules) et rendus graphiques (echelles de couleurs, barres de donnees, icones).
import { FormulaError, translateFormula, type Scalar } from '@forgeoffice/formulas';
import {
  type Border, type CellRange, type Cfvo, type CfRule, type Color, type ConditionalFormat, type DifferentialFormat, type IconSetName, type Workbook,
} from '@forgeoffice/xlsx';

export interface CfOverlay {
  fill?: string;
  fontColor?: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  underline?: boolean;
  numFmt?: string;
  border?: Border;
  bar?: { ratio: number; color: string; gradient: boolean; negative: boolean; axis?: number; showValue: boolean };
  icon?: { set: IconSetName; index: number; showValue: boolean };
}

export interface CfContext {
  wb: Workbook;
  valueAt: (row: number, col: number) => Scalar;
  /** Evalue une formule canonique (sans « = ») dans le contexte de la feuille. */
  evaluate: (formula: string) => Scalar;
  /** Couleur Office -> « RRGGBB ». */
  color: (c: Color | undefined) => string | undefined;
  /** Etendue utilisee de la feuille (bornage des plages entieres). */
  used: CellRange | undefined;
  /** Date du jour (numero de serie) pour les regles « Date ». */
  today: number;
}

interface Stats {
  nums: number[];
  counts: Map<string, number>;
  avg: number;
  std: number;
}

const NUM_CAP = 200_000;

function keyOf(v: Scalar): string {
  return typeof v === 'string' ? `s${v.toLowerCase()}` : `${typeof v}:${String(v)}`;
}

function inRanges(ranges: readonly CellRange[], row: number, col: number): CellRange | undefined {
  return ranges.find((r) => row >= r.r1 && row <= r.r2 && col >= r.c1 && col <= r.c2);
}

function truthy(v: Scalar): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.toUpperCase() === 'VRAI' || v.toUpperCase() === 'TRUE';
  return false;
}

function hex(c: string): [number, number, number] {
  return [0, 2, 4].map((i) => Number.parseInt(c.slice(i, i + 2), 16) || 0) as [number, number, number];
}

function mix(a: string, b: string, t: number): string {
  const x = hex(a);
  const y = hex(b);
  return x.map((v, i) => Math.round(v + ((y[i] ?? 0) - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export class CfEvaluator {
  private readonly ctx: CfContext;
  private readonly formats: readonly ConditionalFormat[];
  private readonly stats = new Map<CfRule, Stats>();
  private readonly rules: { cf: ConditionalFormat; rule: CfRule }[];

  constructor(formats: readonly ConditionalFormat[], ctx: CfContext) {
    this.formats = formats;
    this.ctx = ctx;
    this.rules = formats.flatMap((cf) => cf.rules.map((rule) => ({ cf, rule }))).sort((a, b) => a.rule.priority - b.rule.priority);
  }

  get empty(): boolean {
    return this.formats.length === 0;
  }

  /** Mise en forme conditionnelle effective de la cellule (null si aucune regle ne s'applique). */
  at(row: number, col: number): CfOverlay | null {
    let out: CfOverlay = {};
    let any = false;
    for (const { cf, rule } of this.rules) {
      const range = inRanges(cf.ranges, row, col);
      if (!range) continue;
      const v = this.ctx.valueAt(row, col);
      const applied = this.apply(rule, cf, range, row, col, v);
      if (!applied) continue;
      out = { ...applied, ...out };
      any = true;
      if (rule.stopIfTrue) break;
    }
    return any ? out : null;
  }

  private statsOf(rule: CfRule, cf: ConditionalFormat): Stats {
    let s = this.stats.get(rule);
    if (s) return s;
    const nums: number[] = [];
    const counts = new Map<string, number>();
    let visited = 0;
    for (const r0 of cf.ranges) {
      const u = this.ctx.used;
      if (!u) break;
      const r = { r1: Math.max(r0.r1, u.r1), c1: Math.max(r0.c1, u.c1), r2: Math.min(r0.r2, u.r2), c2: Math.min(r0.c2, u.c2) };
      for (let row = r.r1; row <= r.r2 && visited < NUM_CAP; row++) {
        for (let col = r.c1; col <= r.c2 && visited < NUM_CAP; col++) {
          visited++;
          const v = this.ctx.valueAt(row, col);
          if (typeof v === 'number') nums.push(v);
          if (v !== null && v !== '') counts.set(keyOf(v), (counts.get(keyOf(v)) ?? 0) + 1);
        }
      }
    }
    nums.sort((a, b) => a - b);
    const avg = nums.reduce((a, b) => a + b, 0) / (nums.length || 1);
    const std = Math.sqrt(nums.reduce((a, b) => a + (b - avg) ** 2, 0) / Math.max(1, nums.length - 1));
    s = { nums, counts, avg, std };
    this.stats.set(rule, s);
    return s;
  }

  private evalAt(formula: string, range: CellRange, row: number, col: number): Scalar {
    try {
      return this.ctx.evaluate(translateFormula(formula, row - range.r1, col - range.c1));
    } catch {
      return null; // formule de regle invalide : la regle ne s'applique pas
    }
  }

  private threshold(cfvo: Cfvo, s: Stats, range: CellRange, row: number, col: number, isMin: boolean): number {
    const { nums } = s;
    const min = nums[0] ?? 0;
    const max = nums[nums.length - 1] ?? 0;
    const num = (): number => {
      const raw = cfvo.value ?? '0';
      const n = Number(raw);
      if (Number.isFinite(n)) return n;
      const v = this.evalAt(raw, range, row, col);
      return typeof v === 'number' ? v : 0;
    };
    switch (cfvo.type) {
      case 'min':
      case 'autoMin': return cfvo.type === 'autoMin' ? Math.min(0, min) : min;
      case 'max':
      case 'autoMax': return cfvo.type === 'autoMax' ? Math.max(0, max) : max;
      case 'num':
      case 'formula': return num();
      case 'percent': return min + ((max - min) * num()) / 100;
      case 'percentile': {
        if (!nums.length) return 0;
        const p = (num() / 100) * (nums.length - 1);
        const lo = Math.floor(p);
        const a = nums[lo] ?? 0;
        const b = nums[Math.min(nums.length - 1, lo + 1)] ?? a;
        return a + (b - a) * (p - lo);
      }
    }
    return isMin ? min : max;
  }

  private dxf(rule: CfRule): CfOverlay {
    const d: DifferentialFormat | undefined = rule.dxfId === undefined ? undefined : this.ctx.wb.styles.dxfs[rule.dxfId];
    if (!d) return {};
    const o: CfOverlay = {};
    if (d.font?.color) {
      const c = this.ctx.color(d.font.color);
      if (c) o.fontColor = c;
    }
    if (d.font?.bold) o.bold = true;
    if (d.font?.italic) o.italic = true;
    if (d.font?.strike) o.strike = true;
    if (d.font?.underline) o.underline = true;
    if (d.fill?.type === 'pattern' && d.fill.pattern !== 'none') {
      const c = this.ctx.color(d.fill.bg ?? d.fill.fg) ?? this.ctx.color(d.fill.fg);
      if (c) o.fill = c;
    }
    if (d.numFmt) o.numFmt = d.numFmt.code;
    if (d.border) o.border = d.border;
    return o;
  }

  private apply(rule: CfRule, cf: ConditionalFormat, range: CellRange, row: number, col: number, v: Scalar): CfOverlay | null {
    const text = v === null ? '' : typeof v === 'string' ? v : v instanceof FormulaError ? v.code : String(v);
    const lower = text.toLowerCase();
    const needle = (rule.text ?? '').toLowerCase();
    switch (rule.type) {
      case 'cellIs': {
        if (v === null) return null;
        const [f1, f2] = (rule.formulas ?? []).map((f) => this.evalAt(f, range, row, col));
        const cmp = (a: Scalar, b: Scalar | undefined): number => {
          if (typeof a === 'number' && typeof b === 'number') return a - b;
          return String(a ?? '').localeCompare(String(b ?? ''), 'fr', { sensitivity: 'base' });
        };
        let ok = false;
        switch (rule.operator) {
          case 'greaterThan': ok = cmp(v, f1) > 0; break;
          case 'lessThan': ok = cmp(v, f1) < 0; break;
          case 'greaterThanOrEqual': ok = cmp(v, f1) >= 0; break;
          case 'lessThanOrEqual': ok = cmp(v, f1) <= 0; break;
          case 'equal': ok = cmp(v, f1) === 0; break;
          case 'notEqual': ok = cmp(v, f1) !== 0; break;
          case 'between': ok = cmp(v, f1) >= 0 && cmp(v, f2) <= 0; break;
          case 'notBetween': ok = cmp(v, f1) < 0 || cmp(v, f2) > 0; break;
          default: ok = false;
        }
        return ok ? this.dxf(rule) : null;
      }
      case 'expression':
        return truthy(this.evalAt(rule.formulas?.[0] ?? 'FALSE', range, row, col)) ? this.dxf(rule) : null;
      case 'containsText': return lower.includes(needle) ? this.dxf(rule) : null;
      case 'notContainsText': return !lower.includes(needle) ? this.dxf(rule) : null;
      case 'beginsWith': return lower.startsWith(needle) ? this.dxf(rule) : null;
      case 'endsWith': return lower.endsWith(needle) ? this.dxf(rule) : null;
      case 'containsBlanks': return text.trim() === '' ? this.dxf(rule) : null;
      case 'notContainsBlanks': return text.trim() !== '' ? this.dxf(rule) : null;
      case 'containsErrors': return v instanceof FormulaError ? this.dxf(rule) : null;
      case 'notContainsErrors': return v instanceof FormulaError ? null : this.dxf(rule);
      case 'duplicateValues':
      case 'uniqueValues': {
        if (v === null || v === '') return null;
        const n = this.statsOf(rule, cf).counts.get(keyOf(v)) ?? 0;
        return (rule.type === 'duplicateValues' ? n > 1 : n === 1) ? this.dxf(rule) : null;
      }
      case 'top10': {
        if (typeof v !== 'number') return null;
        const { nums } = this.statsOf(rule, cf);
        const rank = rule.rank ?? 10;
        const n = rule.percent ? Math.max(1, Math.floor((nums.length * rank) / 100)) : rank;
        const t = rule.bottom ? nums[Math.min(nums.length, n) - 1] : nums[Math.max(0, nums.length - n)];
        if (t === undefined) return null;
        return (rule.bottom ? v <= t : v >= t) ? this.dxf(rule) : null;
      }
      case 'aboveAverage': {
        if (typeof v !== 'number') return null;
        const s = this.statsOf(rule, cf);
        const k = rule.stdDev ?? 0;
        const above = rule.aboveAverage !== false;
        const limit = s.avg + (above ? k : -k) * s.std;
        const ok = above ? (rule.equalAverage ? v >= limit : v > limit) : (rule.equalAverage ? v <= limit : v < limit);
        return ok ? this.dxf(rule) : null;
      }
      case 'timePeriod': {
        if (typeof v !== 'number') return null;
        const d = Math.floor(v);
        const t = this.ctx.today;
        const ok = rule.timePeriod === 'today' ? d === t : rule.timePeriod === 'yesterday' ? d === t - 1 : rule.timePeriod === 'tomorrow' ? d === t + 1
          : rule.timePeriod === 'last7Days' ? d <= t && d > t - 7 : false;
        return ok ? this.dxf(rule) : null;
      }
      case 'colorScale': {
        if (typeof v !== 'number' || !rule.colorScale) return null;
        const s = this.statsOf(rule, cf);
        const { cfvos, colors } = rule.colorScale;
        const pts = cfvos.map((c, i) => this.threshold(c, s, range, row, col, i === 0));
        const cols = colors.map((c) => this.ctx.color(c) ?? 'FFFFFF');
        if (pts.length < 2 || cols.length < 2) return null;
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i] ?? 0;
          const b = pts[i + 1] ?? 0;
          if (v <= b || i === pts.length - 2) {
            const t = b === a ? 0 : Math.min(1, Math.max(0, (v - a) / (b - a)));
            return { fill: mix(cols[i] ?? 'FFFFFF', cols[i + 1] ?? 'FFFFFF', t) };
          }
        }
        return null;
      }
      case 'dataBar': {
        if (typeof v !== 'number' || !rule.dataBar) return null;
        const s = this.statsOf(rule, cf);
        const db = rule.dataBar;
        const lo = this.threshold(db.cfvos[0], s, range, row, col, true);
        const hi = this.threshold(db.cfvos[1], s, range, row, col, false);
        const color = this.ctx.color(db.color) ?? '638EC6';
        const negColor = this.ctx.color(db.negativeColor) ?? 'FF0000';
        const showValue = db.showValue !== false;
        const gradient = db.gradient !== false;
        if (lo < 0 && hi > 0) {
          const axis = -lo / (hi - lo);
          const ratio = v / (hi - lo);
          return { bar: { ratio, color: v < 0 ? negColor : color, gradient, negative: v < 0, axis, showValue } };
        }
        const span = hi - lo;
        const ratio = span <= 0 ? 1 : Math.min(1, Math.max(0, (v - lo) / span));
        return { bar: { ratio: Math.max(0.1 * (v > lo ? 1 : 0), ratio), color: v < 0 ? negColor : color, gradient, negative: v < 0, showValue } };
      }
      case 'iconSet': {
        if (typeof v !== 'number' || !rule.iconSet) return null;
        const s = this.statsOf(rule, cf);
        const is = rule.iconSet;
        const thresholds = is.cfvos.map((c, i) => this.threshold(c, s, range, row, col, i === 0));
        let idx = 0;
        thresholds.forEach((t, i) => {
          if (i === 0) return;
          const gte = is.cfvos[i]?.gte !== false;
          if (gte ? v >= t : v > t) idx = i;
        });
        const count = is.cfvos.length;
        return { icon: { set: is.iconSet, index: is.reverse ? count - 1 - idx : idx, showValue: is.showValue !== false } };
      }
    }
    return null;
  }
}

/** Nombre d'icones d'un jeu. */
export function iconCount(set: IconSetName): number {
  return Number(set.charAt(0)) || 3;
}
