// Validation des donnees : regle applicable a une cellule, controle d'une saisie, valeurs d'une liste deroulante.
import type { Scalar } from '@forgeoffice/formulas';
import type { CellValue, DataValidation, Sheet } from '@forgeoffice/xlsx';

export function validationAt(sh: Sheet, row: number, col: number): DataValidation | undefined {
  return sh.dataValidations.find((v) => v.type !== 'none' && v.ranges.some((r) => row >= r.r1 && row <= r.r2 && col >= r.c1 && col <= r.c2));
}

/** Elements d'une liste : constante « "Oui,Non" » ou plage evaluee. */
export function listItems(dv: DataValidation, evaluate: (formula: string) => Scalar[]): string[] {
  const f = dv.formula1 ?? '';
  if (f.startsWith('"')) return f.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
  return evaluate(f).filter((v) => v !== null && v !== '').map((v) => String(v));
}

function num(v: Scalar): number | null {
  return typeof v === 'number' ? v : null;
}

/** Vrai si la valeur respecte la regle. `evaluate` calcule une formule de la regle (bornes, formule personnalisee). */
export function isValid(dv: DataValidation, value: CellValue, evaluate: (formula: string) => Scalar, list: () => string[]): boolean {
  if (value === null || value === '') return dv.allowBlank !== false;
  switch (dv.type) {
    case 'none': return true;
    case 'list': {
      const items = list().map((s) => s.toLowerCase());
      return items.includes(String(value).toLowerCase());
    }
    case 'custom': {
      const r = evaluate(dv.formula1 ?? 'TRUE');
      return r === true || (typeof r === 'number' && r !== 0);
    }
    default: {
      const subject = dv.type === 'textLength' ? String(typeof value === 'object' ? '' : value).length : typeof value === 'number' ? value : null;
      if (subject === null) return false;
      if (dv.type === 'whole' && !Number.isInteger(subject)) return false;
      const a = num(evaluate(dv.formula1 ?? '0'));
      const b = num(evaluate(dv.formula2 ?? '0'));
      if (a === null) return true;
      switch (dv.operator ?? 'between') {
        case 'between': return b !== null && subject >= a && subject <= b;
        case 'notBetween': return b !== null && (subject < a || subject > b);
        case 'equal': return subject === a;
        case 'notEqual': return subject !== a;
        case 'greaterThan': return subject > a;
        case 'lessThan': return subject < a;
        case 'greaterThanOrEqual': return subject >= a;
        case 'lessThanOrEqual': return subject <= a;
      }
    }
  }
  return true;
}
