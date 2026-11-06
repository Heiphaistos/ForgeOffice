// Filtre personnalise : operateurs de l'interface (est egal a, contient, commence par...) et leur forme dans le modele
// (operateur + valeur avec jokers « * »), dans les deux sens.
import type { CustomFilterOperator } from '@forgeoffice/xlsx';

export type UiFilterOp =
  | 'equal' | 'notEqual' | 'greaterThan' | 'greaterThanOrEqual' | 'lessThan' | 'lessThanOrEqual'
  | 'contains' | 'notContains' | 'beginsWith' | 'notBeginsWith' | 'endsWith' | 'notEndsWith';

export const NUMBER_OPS: readonly UiFilterOp[] = ['equal', 'notEqual', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual'];
export const TEXT_OPS: readonly UiFilterOp[] = ['equal', 'notEqual', 'beginsWith', 'notBeginsWith', 'endsWith', 'notEndsWith', 'contains', 'notContains'];

/** Condition du modele pour un operateur de l'interface et une valeur saisie. */
export function toCondition(op: UiFilterOp, value: string): { operator: CustomFilterOperator; value: string } {
  switch (op) {
    case 'contains': return { operator: 'equal', value: `*${value}*` };
    case 'notContains': return { operator: 'notEqual', value: `*${value}*` };
    case 'beginsWith': return { operator: 'equal', value: `${value}*` };
    case 'notBeginsWith': return { operator: 'notEqual', value: `${value}*` };
    case 'endsWith': return { operator: 'equal', value: `*${value}` };
    case 'notEndsWith': return { operator: 'notEqual', value: `*${value}` };
    default: return { operator: op, value };
  }
}

/** Operateur de l'interface et valeur saisie retrouves depuis une condition du modele. */
export function fromCondition(c: { operator: CustomFilterOperator; value: string }): { op: UiFilterOp; value: string } {
  const v = c.value;
  if (c.operator === 'equal' || c.operator === 'notEqual') {
    const neg = c.operator === 'notEqual';
    const starts = v.startsWith('*');
    const ends = v.endsWith('*') && !v.endsWith('~*');
    if (starts && ends && v.length >= 2) return { op: neg ? 'notContains' : 'contains', value: v.slice(1, -1) };
    if (ends && !starts) return { op: neg ? 'notBeginsWith' : 'beginsWith', value: v.slice(0, -1) };
    if (starts && !ends) return { op: neg ? 'notEndsWith' : 'endsWith', value: v.slice(1) };
  }
  return { op: c.operator, value: v };
}
