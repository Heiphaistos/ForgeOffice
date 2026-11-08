// Filtre avance : zone de criteres (en-tetes + lignes ; ET entre colonnes, OU entre lignes), sur place ou copie, sans doublons.
import { wildcardMatcher, type Scalar } from '@forgeoffice/formulas';

const blank = (v: Scalar): boolean => v === null || v === '';

function num(text: string): number | undefined {
  const t = text.trim().replace(',', '.');
  return t !== '' && Number.isFinite(Number(t)) ? Number(t) : undefined;
}

/** La valeur satisfait-elle le critere (nombre, texte avec jokers, ou comparateur >, <, >=, <=, <>, =) ? Un critere vide est toujours vrai. */
export function matchesCriterion(value: Scalar, crit: Scalar): boolean {
  if (blank(crit)) return true;
  if (typeof crit === 'number') return typeof value === 'number' && value === crit;
  if (typeof crit !== 'string') return false;
  const m = crit.match(/^(>=|<=|<>|>|<|=)?(.*)$/);
  const op = m?.[1] ?? '=';
  const operand = m?.[2] ?? crit;
  const n = num(operand);
  if (op === '=' && operand === '') return blank(value);
  if (op === '<>' && operand === '') return !blank(value);
  const eq = (): boolean => (n !== undefined ? typeof value === 'number' && value === n : typeof value === 'string' && wildcardMatcher(operand.slice(0, 255)).test(value) || (typeof value === 'number' && String(value) === operand));
  switch (op) {
    case '=': return eq();
    case '<>': return !eq();
    default: {
      if (n !== undefined) {
        if (typeof value !== 'number') return false;
        return op === '>' ? value > n : op === '<' ? value < n : op === '>=' ? value >= n : value <= n;
      }
      if (typeof value !== 'string') return false;
      const c = value.localeCompare(operand, 'fr', { sensitivity: 'base' });
      return op === '>' ? c > 0 : op === '<' ? c < 0 : op === '>=' ? c >= 0 : c <= 0;
    }
  }
}

export interface AdvancedOptions {
  /** N'afficher que les enregistrements uniques. */
  unique: boolean;
}

/**
 * Indices (dans `list`, en-tete exclu : 1..n) des lignes qui satisfont la zone de criteres.
 * Les colonnes de criteres sont retrouvees par leur en-tete ; plusieurs lignes de criteres = OU ; une ligne entierement vide accepte tout.
 */
export function advancedFilter(list: readonly (readonly Scalar[])[], criteria: readonly (readonly Scalar[])[], o: AdvancedOptions): number[] {
  const head = (list[0] ?? []).map((h) => String(h ?? '').toLowerCase());
  const cols = (criteria[0] ?? []).map((h) => head.indexOf(String(h ?? '').toLowerCase()));
  const rules = criteria.slice(1);
  const seen = new Set<string>();
  const out: number[] = [];
  for (let r = 1; r < list.length; r++) {
    const row = list[r] ?? [];
    const ok = rules.length === 0 || rules.some((rule) => rule.every((crit, k) => {
      const col = cols[k] ?? -1;
      return blank(crit) || (col >= 0 && matchesCriterion(row[col] ?? null, crit));
    }));
    if (!ok) continue;
    if (o.unique) {
      const key = row.map((v) => String(v ?? '').toLowerCase()).join('\u0001');
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(r);
  }
  return out;
}
