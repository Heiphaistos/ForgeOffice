// Criteres de NB.SI, SOMME.SI.ENS, BDSOMME... (operateurs, jokers * ? ~, comparaisons typees).
import { localeData } from '../format/locale.ts';
import { syntaxFor } from '../parse/syntax.ts';
import { FormulaError, type Scalar } from '../values.ts';
import { compareText, numEquals, textToNumber } from './coerce.ts';
import type { EvalContext } from './types.ts';

export type Criterion = (v: Scalar) => boolean;

/** Joker Excel -> expression reguliere (* ? et ~ d'echappement). */
export function wildcardToRegExp(pattern: string, anchored = true): RegExp {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i] ?? '';
    if (ch === '~' && i + 1 < pattern.length) {
      const nx = pattern[i + 1] ?? '';
      re += nx.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      i++;
    } else if (ch === '*') re += '.*';
    else if (ch === '?') re += '.';
    else re += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(anchored ? `^${re}$` : re, 'is');
}

export function hasWildcards(s: string): boolean {
  return /[*?~]/.test(s);
}

/** Compile un critere a partir de la valeur fournie par l'utilisateur. */
export function makeCriterion(crit: Scalar, ctx: EvalContext): Criterion {
  if (typeof crit === 'number') {
    return (v) => {
      if (typeof v === 'number') return numEquals(v, crit);
      if (typeof v === 'string') {
        const n = textToNumber(v, ctx);
        return n !== undefined && numEquals(n, crit);
      }
      return false;
    };
  }
  if (typeof crit === 'boolean') return (v) => v === crit;
  if (crit instanceof FormulaError) return (v) => v instanceof FormulaError && v.code === crit.code;
  if (crit === null) return (v) => v === null || v === '';
  const m = crit.match(/^(<=|>=|<>|<|>|=)?([\s\S]*)$/);
  const op = m?.[1] ?? '';
  const operand = m?.[2] ?? '';
  if (operand === '') {
    if (op === '=') return (v) => v === null || v === '';
    if (op === '<>') return (v) => v !== null && v !== '';
    if (op === '') return (v) => v === null || v === '';
    return () => false;
  }
  const l = localeData(ctx.wb.locale);
  const up = operand.toUpperCase();
  const num = textToNumber(operand, ctx);
  const errHit = syntaxFor(l.id === 'fr-FR' ? 'fr' : 'en').errorsIn.find(([t]) => t.toUpperCase() === up);
  let test: (v: Scalar) => number | undefined;
  if (num !== undefined) {
    test = (v) => {
      if (typeof v === 'number') return numEquals(v, num) ? 0 : v < num ? -1 : 1;
      if (typeof v === 'string' && (op === '' || op === '=')) {
        const n = textToNumber(v, ctx);
        return n !== undefined && numEquals(n, num) ? 0 : undefined;
      }
      return undefined;
    };
  } else if (up === 'TRUE' || up === 'FALSE' || up === l.trueName || up === l.falseName) {
    const b = up === 'TRUE' || up === l.trueName;
    test = (v) => (typeof v === 'boolean' ? (v === b ? 0 : v ? 1 : -1) : undefined);
  } else if (errHit) {
    const code = errHit[1];
    test = (v) => (v instanceof FormulaError && v.code === code ? 0 : undefined);
  } else if ((op === '' || op === '=' || op === '<>') && hasWildcards(operand)) {
    const re = wildcardToRegExp(operand);
    test = (v) => (typeof v === 'string' && re.test(v) ? 0 : typeof v === 'string' ? 1 : undefined);
  } else {
    test = (v) => (typeof v === 'string' ? compareText(v, operand) : undefined);
  }
  switch (op) {
    case '':
    case '=':
      return (v) => test(v) === 0;
    case '<>':
      return (v) => test(v) !== 0;
    case '<':
      return (v) => {
        const r = test(v);
        return r !== undefined && r < 0;
      };
    case '<=':
      return (v) => {
        const r = test(v);
        return r !== undefined && r <= 0;
      };
    case '>':
      return (v) => {
        const r = test(v);
        return r !== undefined && r > 0;
      };
    default:
      return (v) => {
        const r = test(v);
        return r !== undefined && r >= 0;
      };
  }
}
