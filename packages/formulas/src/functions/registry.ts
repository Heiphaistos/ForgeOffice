// Registre des fonctions de feuille de calcul.
import type { Node } from '../parse/ast.ts';
import { checkNum, toNumber, toText } from '../eval/coerce.ts';
import type { EvalContext, EvalValue, Evaluator } from '../eval/types.ts';
import { FormulaError, type Scalar } from '../values.ts';

export type Category =
  | 'math'
  | 'stats'
  | 'text'
  | 'date'
  | 'logical'
  | 'lookup'
  | 'financial'
  | 'info'
  | 'engineering'
  | 'database'
  | 'compat';

/**
 * Nature de chaque argument (un caractere par position, le dernier se repete) :
 * S scalaire (diffuse elementairement sur les matrices), V valeur ou matrice, R reference conservee,
 * F fonction LAMBDA.
 */
export type ArgKinds = string;

export type Arg = EvalValue | undefined;
export type Impl = (args: Arg[], ctx: EvalContext, ev: Evaluator) => EvalValue;
export type LazyImpl = (nodes: Node[], ctx: EvalContext, ev: Evaluator) => EvalValue;

export interface FnDef {
  name: string;
  min: number;
  max: number;
  kinds: ArgKinds;
  volatile: boolean;
  category: Category;
  impl?: Impl | undefined;
  lazy?: LazyImpl | undefined;
}

const REGISTRY = new Map<string, FnDef>();

export interface DefineOptions {
  min: number;
  max?: number;
  kinds?: ArgKinds;
  volatile?: boolean;
}

/** Un '+' final repete les deux dernieres natures par paires (NB.SI.ENS : 'RS+'). */
export function kindAt(kinds: ArgKinds, i: number): string {
  if (kinds.length === 0) return 'S';
  if (kinds.endsWith('+')) {
    const base = kinds.slice(0, -1);
    if (i < base.length) return base[i] ?? 'S';
    return base[base.length - 2 + ((i - base.length) % 2)] ?? 'S';
  }
  return kinds[Math.min(i, kinds.length - 1)] ?? 'S';
}

export function define(category: Category, name: string, opt: DefineOptions, impl: Impl): void {
  REGISTRY.set(name, {
    name,
    min: opt.min,
    max: opt.max ?? opt.min,
    kinds: opt.kinds ?? 'S',
    volatile: opt.volatile ?? false,
    category,
    impl,
  });
}

export function defineLazy(category: Category, name: string, opt: DefineOptions, lazy: LazyImpl): void {
  REGISTRY.set(name, {
    name,
    min: opt.min,
    max: opt.max ?? opt.min,
    kinds: 'S',
    volatile: opt.volatile ?? false,
    category,
    lazy,
  });
}

/** Declare un synonyme (ancienne fonction de compatibilite). */
export function alias(name: string, target: string, category?: Category): void {
  const def = REGISTRY.get(target);
  if (def) REGISTRY.set(name, { ...def, name, category: category ?? def.category });
}

export function getFunction(name: string): FnDef | undefined {
  return REGISTRY.get(name);
}

export function listFunctions(): FnDef[] {
  return [...REGISTRY.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Fonction purement numerique : chaque argument est converti en nombre (erreur propagee),
 * les arguments omis sont absents du tableau. Resultat non fini -> #NOMBRE!.
 */
export function numFn(
  category: Category,
  name: string,
  min: number,
  max: number,
  f: (a: number[], ctx: EvalContext) => number | FormulaError,
): void {
  define(category, name, { min, max }, (args, ctx) => {
    const ns: number[] = [];
    for (const a of args) {
      const n = toNumber(a, ctx);
      if (n instanceof FormulaError) return n;
      ns.push(n);
    }
    const r = f(ns, ctx);
    return typeof r === 'number' ? checkNum(r) : r;
  });
}

/** Fonction texte : arguments convertis en texte. */
export function textFn(
  category: Category,
  name: string,
  min: number,
  max: number,
  f: (a: string[], ctx: EvalContext) => Scalar,
): void {
  define(category, name, { min, max }, (args, ctx) => {
    const ss: string[] = [];
    for (const a of args) {
      const s = toText(a, ctx);
      if (s instanceof FormulaError) return s;
      ss.push(s);
    }
    return f(ss, ctx);
  });
}
